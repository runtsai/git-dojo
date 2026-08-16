import { useCallback, useEffect, useRef, useState } from 'react';

export type ExportState =
  | 'idle'
  | 'rendering' // server-side headless render + transcode in progress
  | 'done'
  | 'error';

// The API server is mounted at /api on the same origin (path-routed proxy),
// so a root-relative URL is correct here even though the promo app itself is
// served under /git-dojo-promo/.
const EXPORT_ENDPOINT = '/api/export/promo-video';

/**
 * Server-side promo video export.
 *
 * Calls the API server, which spawns a headless browser, records the video
 * cleanly (no screen-share dialog), muxes in the background music, and
 * returns a ready-to-download MP4.
 */
export function useExportRecorder() {
  const [state, setState] = useState<ExportState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const startExport = useCallback(async () => {
    if (state === 'rendering') return;

    setState('rendering');
    setErrorMessage('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(EXPORT_ENDPOINT, { signal: controller.signal });

      if (!res.ok) {
        let message = `Export failed (HTTP ${res.status}).`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(message);
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error('The server returned an empty video file.');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'git-dojo-promo.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      setState('done');
    } catch (err) {
      if (controller.signal.aborted) {
        setState('idle');
        return;
      }
      console.error('[export] server export failed', err);
      setState('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Promo video export failed.',
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [state]);

  const cancelExport = useCallback(() => {
    abortRef.current?.abort();
    setState('idle');
    setErrorMessage('');
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setErrorMessage('');
  }, []);

  // Abort any in-flight request on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return { state, errorMessage, startExport, cancelExport, reset };
}
