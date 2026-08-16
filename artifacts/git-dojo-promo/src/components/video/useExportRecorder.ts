import { useCallback, useEffect, useRef, useState } from 'react';

export type ExportState =
  | 'idle'
  | 'requesting'   // browser permission dialog
  | 'countdown'    // 3-2-1 before playback
  | 'recording'    // active capture — all UI must be hidden by the parent
  | 'transcoding'  // ffmpeg converting WebM → MP4
  | 'done'
  | 'error';

export interface ExportRecorderOptions {
  /** Total video duration in ms */
  totalDurationMs: number;
  /**
   * Called with the stream just before recording starts so the parent can
   * reset to scene 0. Must return a Promise that resolves only after the
   * first new frame is painted (gives React time to commit the reset).
   */
  onResetVideo: () => Promise<void>;
}

// Ordered by preference; first supported type wins.
const CAPTURE_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of CAPTURE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

/** Wait for two animation frames — ensures React has painted the reset. */
function waitTwoFrames(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export function useExportRecorder(options: ExportRecorderOptions) {
  const { totalDurationMs, onResetVideo } = options;

  const [state, setState] = useState<ExportState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recordingStartRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  // True while a cancellation is in flight — blocks countdown → recording.
  const cancelledRef = useRef(false);
  // Set to true only for a natural end-of-recording; guards the onstop download.
  const downloadOnStopRef = useRef(false);
  // Tracks whether the original document title needs restoring.
  const originalTitleRef = useRef<string>('');

  // ── helpers ──────────────────────────────────────────────────────────────

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const cleanupTimers = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    stopTimerRef.current = null;
    progressIntervalRef.current = null;
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
  }, []);

  const restoreTitle = useCallback(() => {
    if (originalTitleRef.current) {
      document.title = originalTitleRef.current;
      originalTitleRef.current = '';
    }
  }, []);

  // ── ffmpeg transcoding ────────────────────────────────────────────────────

  const transcodeToMp4 = useCallback(async (webmBlob: Blob): Promise<Blob> => {
    // Dynamic import keeps this off the critical path until export is used.
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();

    // Assets are served from public/ffmpeg/ (copied from @ffmpeg/core@0.12.6
    // at install time) so there is no runtime CDN dependency.
    const base = `${import.meta.env.BASE_URL}ffmpeg`;
    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));

    // Re-encode to H.264/AAC MP4.  -c:v libx264 produces a universally
    // compatible MP4; -crf 20 is visually lossless at a manageable size.
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4',
    ]);

    const data = await ffmpeg.readFile('output.mp4');
    // ffmpeg.readFile returns FileData (Uint8Array<ArrayBufferLike> | string).
    // TypeScript's Blob constructor requires ArrayBufferView<ArrayBuffer>, not
    // ArrayBufferLike, so we copy the bytes into a fresh ArrayBuffer first.
    const raw = data as Uint8Array;
    const copy = new Uint8Array(raw.byteLength);
    copy.set(raw);
    return new Blob([copy], { type: 'video/mp4' });
  }, []);

  // ── main export flow ──────────────────────────────────────────────────────

  const startExport = useCallback(async () => {
    if (state !== 'idle' && state !== 'error' && state !== 'done') return;

    chunksRef.current = [];
    cancelledRef.current = false;
    downloadOnStopRef.current = false;
    setProgress(0);
    setErrorMessage('');
    setState('requesting');

    // ── 1. Ask for screen/tab capture permission ──────────────────────────
    let stream: MediaStream;
    try {
      stream = await (
        navigator.mediaDevices as MediaDevices & {
          getDisplayMedia: (opts: object) => Promise<MediaStream>;
        }
      ).getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
        preferCurrentTab: true,
      });
    } catch {
      if (cancelledRef.current) return;
      setState('error');
      const inIframe = window.self !== window.top;
      setErrorMessage(
        inIframe
          ? 'Screen capture was denied. Open the video in a new browser tab and export from there.'
          : 'Screen capture was cancelled or not allowed. Click "Try again" and select this browser tab.',
      );
      return;
    }

    if (cancelledRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;

    // ── 2. Set up MediaRecorder ───────────────────────────────────────────
    const mimeType = getSupportedMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    } catch {
      cleanupStream();
      setState('error');
      setErrorMessage('MediaRecorder failed to initialise. Try a different browser.');
      return;
    }

    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    // If the user stops sharing (closes the screen-capture dialog or clicks
    // "Stop sharing") at ANY point before transcoding — including during the
    // countdown — treat it as a cancellation so no truncated file is downloaded.
    const onTrackEnded = () => {
      if (cancelledRef.current) return; // already cancelled
      cancelledRef.current = true;
      downloadOnStopRef.current = false;
      cleanupTimers();
      if (recorder.state === 'recording') {
        recorder.stop(); // onstop will see downloadOnStopRef=false → idle
      } else {
        // Track ended before recording started (during countdown / requesting).
        cleanupStream();
        chunksRef.current = [];
        setState('idle');
      }
    };
    stream.getTracks().forEach((t) => t.addEventListener('ended', onTrackEnded));

    recorder.onstop = async () => {
      cleanupTimers();
      cleanupStream();
      restoreTitle();

      if (!downloadOnStopRef.current) {
        // Cancelled — discard and return to idle.
        chunksRef.current = [];
        setState('idle');
        return;
      }

      setState('transcoding');

      try {
        const capturedMime = recorder.mimeType || mimeType || 'video/webm';
        const rawBlob = new Blob(chunksRef.current, { type: capturedMime });
        const mp4Blob = await transcodeToMp4(rawBlob);

        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'git-dojo-promo.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);

        setState('done');
      } catch (err) {
        console.error('[export] transcoding failed', err);
        setState('error');
        setErrorMessage(
          'Transcoding to MP4 failed. The raw video file could not be converted.',
        );
      }
    };

    // ── 3. Countdown 3-2-1 ───────────────────────────────────────────────
    setState('countdown');
    setCountdown(3);

    const schedule = (n: number) => {
      setCountdown(n);
      if (n > 1) {
        const t = setTimeout(() => {
          if (!cancelledRef.current) schedule(n - 1);
        }, 1000);
        countdownTimersRef.current.push(t);
      } else {
        // Final tick — kick off recording after countdown expires
        const t = setTimeout(async () => {
          if (cancelledRef.current) return;

          // ── 4. Reset video and wait for React to commit the new frame ──
          await onResetVideo();
          await waitTwoFrames();

          if (cancelledRef.current) return;

          // ── 5. Hide UI: change document title (tab bar) as the only
          //     visible indicator.  The parent hides all DOM overlays. ──
          originalTitleRef.current = document.title;
          document.title = '● Recording…';

          downloadOnStopRef.current = true;
          recorder.start(250);
          setState('recording');
          recordingStartRef.current = performance.now();

          progressIntervalRef.current = setInterval(() => {
            const elapsed = performance.now() - recordingStartRef.current;
            setProgress(Math.min(1, elapsed / totalDurationMs));
          }, 150);

          // Stop exactly at totalDurationMs — no extra buffer to avoid
          // capturing the next loop start.
          stopTimerRef.current = setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.requestData(); // flush final chunk
              recorder.stop();
            }
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            setProgress(1);
          }, totalDurationMs);
        }, 1000);
        countdownTimersRef.current.push(t);
      }
    };
    schedule(3);
  }, [state, totalDurationMs, onResetVideo, cleanupStream, cleanupTimers, restoreTitle, transcodeToMp4]);

  // ── cancel ────────────────────────────────────────────────────────────────

  const cancelExport = useCallback(() => {
    cancelledRef.current = true;
    downloadOnStopRef.current = false;
    cleanupTimers();
    restoreTitle();

    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      // onstop will see downloadOnStopRef=false and go to idle
      recorder.stop();
    } else {
      cleanupStream();
      chunksRef.current = [];
      setState('idle');
    }
  }, [cleanupTimers, cleanupStream, restoreTitle]);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setErrorMessage('');
  }, []);

  // Safety net: restore title if component unmounts mid-recording
  useEffect(() => {
    return () => {
      restoreTitle();
    };
  }, [restoreTitle]);

  return { state, countdown, progress, errorMessage, startExport, cancelExport, reset };
}
