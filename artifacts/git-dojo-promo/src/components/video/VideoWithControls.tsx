import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Repeat, Volume2, VolumeX, X } from 'lucide-react';

import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';
import { useExportRecorder } from './useExportRecorder';
import { TOTAL_RUNTIME_MS } from '@workspace/promo-config';

const PROGRESS_TICK_MS = 60;

function ProgressSegments({
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start);
    }, PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;

  return (
    <div className="flex-1 flex items-center gap-1.5">
      {sceneKeys.map((key, i) => {
        const isActive = i === activeIndex;
        const fill = isActive ? progress * 100 : 0;
        return (
          <button
            key={key}
            onClick={() => onJumpTo(i)}
            className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-4 hover:bg-white/25 transition-all relative min-h-[12px]"
            aria-label={`Jump to scene ${i + 1}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <div
              className="absolute inset-y-0 left-0 bg-white/90 rounded-full transition-[width] duration-100"
              style={{ width: `${fill}%` }}
            />
          </button>
        );
      })}
    </div>
  );
}

interface ControlBarProps {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onToggleLock: () => void;
  onToggleMuted: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
  onExport: () => void;
}

function ControlBar({
  visible,
  collapsed,
  locked,
  muted,
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onToggleLock,
  onToggleMuted,
  onJumpTo,
  onToggleCollapsed,
  onExport,
}: ControlBarProps) {
  return (
    <div
      className={`flex items-center gap-3 bg-black/50 backdrop-blur-sm px-5 py-4 transition-all duration-200 ease-out ${
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      <button
        onClick={onToggleLock}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          locked
            ? 'text-white bg-white/15 hover:bg-white/25'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className="w-8 h-8" />
      </button>

      <button
        onClick={onToggleMuted}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title={muted ? 'Unmute music' : 'Mute music'}
        aria-label={muted ? 'Unmute music' : 'Mute music'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
      </button>

      <button
        onClick={onExport}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title="Export video"
        aria-label="Export video"
      >
        <Download className="w-8 h-8" />
      </button>

      <div className="w-px self-stretch bg-white/15" aria-hidden="true" />

      <ProgressSegments
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        tick={tick}
        onJumpTo={onJumpTo}
      />

      <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">
        {activeIndex + 1}/{sceneKeys.length}
      </div>

      <button
        onClick={onToggleCollapsed}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
      </button>
    </div>
  );
}

// ── Export mode (headless render target) ────────────────────────────────────
//
// The API server's export endpoint opens this page (?export=1) in a headless
// browser. It renders ONLY the video — no controls, no modal — and waits for
// the server to trigger playback so the recording starts exactly at frame 0.

declare global {
  interface Window {
    __exportReady?: boolean;
    __exportTotalMs?: number;
    __startExportPlayback?: () => void;
  }
}

function ExportPlayback() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    window.__exportTotalMs = TOTAL_RUNTIME_MS;
    window.__startExportPlayback = () => setStarted(true);
    window.__exportReady = true;
    return () => {
      window.__exportReady = false;
      delete window.__startExportPlayback;
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black">
      {started && (
        <VideoTemplate
          durations={SCENE_DURATIONS}
          loop={false}
          muted
          onSceneChange={() => {}}
        />
      )}
    </div>
  );
}

// ── Export modal ──────────────────────────────────────────────────────────────

type ExportModalState = 'idle' | 'rendering' | 'done' | 'error';

export function ExportModal({
  state,
  errorMessage,
  onStart,
  onCancel,
  onClose,
}: {
  state: ExportModalState;
  errorMessage: string;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const totalSec = Math.round(TOTAL_RUNTIME_MS / 1000);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Export video"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={
          state === 'idle' || state === 'done' || state === 'error' ? onClose : undefined
        }
      />

      <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl">
        {/* Close — only when safe to dismiss */}
        {(state === 'idle' || state === 'done' || state === 'error') && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* ── idle ── */}
        {state === 'idle' && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-white">Export video</h2>
            </div>

            <p className="text-sm text-white/60 leading-relaxed mb-6">
              The video (~{totalSec}s) is rendered on the server in the background —
              no screen sharing, no permission dialogs. Background music is included.
              The MP4 downloads automatically when it's ready (usually under a minute).
            </p>

            <button
              onClick={onStart}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:brightness-110 transition-all"
            >
              Start export
            </button>
          </>
        )}

        {/* ── rendering on the server ── */}
        {state === 'rendering' && (
          <div className="text-center py-4">
            <div className="w-12 h-12 border-2 border-primary/40 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">Rendering your video…</p>
            <p className="text-sm text-white/50 mt-2">
              The server is recording and converting the video. This usually takes
              under a minute — you can keep using this tab.
            </p>
            <button
              onClick={onCancel}
              className="mt-5 px-6 py-2 rounded-lg border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── done ── */}
        {state === 'done' && (
          <>
            <div className="text-center py-2 mb-5">
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                <Download className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">Download started</h2>
              <p className="text-sm text-white/50">
                Your <strong className="text-white/70">MP4</strong> file should appear in your
                downloads folder.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:brightness-110 transition-all"
            >
              Done
            </button>
          </>
        )}

        {/* ── error ── */}
        {state === 'error' && (
          <>
            <div className="text-center py-2 mb-5">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-base font-semibold text-white mb-2">Export failed</h2>
              <p className="text-sm text-white/50">{errorMessage}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-medium text-sm hover:bg-white/5 transition-all"
              >
                Close
              </button>
              <button
                onClick={onStart}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:brightness-110 transition-all"
              >
                Try again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VideoWithControls() {
  // Headless-render target used by the server-side export endpoint.
  const isExportMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('export');

  if (isExportMode) return <ExportPlayback />;

  return <InteractiveVideo />;
}

function InteractiveVideo() {
  const {
    sceneKeys,
    activeIndex,
    locked,
    mountKey,
    tick,
    durations,
    activeDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
  } = useSceneControls(SCENE_DURATIONS);

  const [muted, setMuted] = useState(true);
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const {
    state: exportState,
    errorMessage,
    startExport,
    cancelExport,
    reset: resetExport,
  } = useExportRecorder();

  const handleOpenExport = useCallback(() => {
    resetExport();
    setExportModalOpen(true);
  }, [resetExport]);

  const handleCloseExport = useCallback(() => {
    setExportModalOpen(false);
    resetExport();
  }, [resetExport]);

  // Auto-close modal when the hook returns to idle (e.g. after cancel)
  useEffect(() => {
    if (exportState === 'idle' && exportModalOpen) {
      setExportModalOpen(false);
    }
  }, [exportState, exportModalOpen]);

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse') return;
      if (collapsed) setTapPinned(true);
    },
    [collapsed],
  );
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      if (!c) {
        setHovering(false);
        setTapPinned(false);
      }
      return !c;
    });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(e.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapsed, tapPinned]);

  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative w-full h-screen">
      {/*
        Always render VideoTemplate via useSceneControls.  On initial load
        activeIndex=0 so rotateFromIndex returns the same order as
        SCENE_DURATIONS, keeping the Replit recording pipeline
        (window.startRecording / stopRecording) intact regardless of framing.
      */}
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop
        muted={muted}
        onSceneChange={onSceneChange}
      />

      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="flex-1 w-full" aria-hidden="true" />
        <ControlBar
          visible={barVisible}
          collapsed={collapsed}
          locked={locked}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          tick={tick}
          onToggleLock={toggleLock}
          onToggleMuted={() => setMuted((m) => !m)}
          onJumpTo={jumpTo}
          onToggleCollapsed={handleToggleCollapsed}
          onExport={handleOpenExport}
        />
      </div>

      {exportModalOpen && (
        <ExportModal
          state={exportState}
          errorMessage={errorMessage}
          onStart={startExport}
          onCancel={cancelExport}
          onClose={handleCloseExport}
        />
      )}
    </div>
  );
}
