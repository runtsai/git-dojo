import { useEffect, useRef, useState } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

import { SCENE_DURATIONS, TOTAL_RUNTIME_MS as PROMO_TOTAL_RUNTIME_MS } from '@workspace/promo-config';
export { SCENE_DURATIONS } from '@workspace/promo-config';

/** How many ms before s5 ends the fade-to-black starts. */
const LOOP_FADE_LEAD_MS = 600;
/** Duration of the fade-in (transparent → black) in ms. */
const LOOP_FADE_IN_MS = 500;
/** Duration of the fade-out (black → transparent) in ms. */
const LOOP_FADE_OUT_MS = 700;

// Startup assertion: verify the fade-in can complete before s5 ends.
//
// The fade timer fires at (s5 - LOOP_FADE_LEAD_MS) ms into the scene, so the
// fade-in finishes at (s5 - LOOP_FADE_LEAD_MS + LOOP_FADE_IN_MS).  For the
// screen to be fully black before the scene cuts:
//   LOOP_FADE_IN_MS <= LOOP_FADE_LEAD_MS
// Additionally the lead must be positive and must not exceed s5 (otherwise the
// Math.max(0, ...) clamp silently discards the lead, breaking the timing).
if (LOOP_FADE_LEAD_MS <= 0) {
  throw new Error(
    `[VideoTemplate] LOOP_FADE_LEAD_MS must be positive (got ${LOOP_FADE_LEAD_MS} ms).`
  );
}
if (LOOP_FADE_LEAD_MS > SCENE_DURATIONS.s5) {
  throw new Error(
    `[VideoTemplate] LOOP_FADE_LEAD_MS (${LOOP_FADE_LEAD_MS} ms) exceeds ` +
    `SCENE_DURATIONS.s5 (${SCENE_DURATIONS.s5} ms) — the lead would be clamped to 0 ` +
    `and the intended fade window lost.`
  );
}
if (LOOP_FADE_IN_MS > LOOP_FADE_LEAD_MS) {
  throw new Error(
    `[VideoTemplate] Invalid loop-fade timing: LOOP_FADE_IN_MS (${LOOP_FADE_IN_MS} ms) ` +
    `exceeds LOOP_FADE_LEAD_MS (${LOOP_FADE_LEAD_MS} ms). ` +
    `The fade-in starts ${LOOP_FADE_LEAD_MS} ms before the scene ends but takes ` +
    `${LOOP_FADE_IN_MS} ms to complete — it will not finish before the scene cuts. ` +
    `Either increase LOOP_FADE_LEAD_MS or reduce LOOP_FADE_IN_MS.`
  );
}

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  s0: Scene0,
  s1: Scene1,
  s2: Scene2,
  s3: Scene3,
  s4: Scene4,
  s5: Scene5,
};

const SCENE_START_SEC: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, ms] of Object.entries(SCENE_DURATIONS)) {
    out[key] = cumulativeMs / 1000;
    cumulativeMs += ms;
  }
  return out;
})();

const AUDIO_SEEK_EPSILON_SEC = 0.18;

const TOTAL_RUNTIME_MS = PROMO_TOTAL_RUNTIME_MS;

// A repo being built start-to-finish, scrolling up behind the scenes
// over the full runtime of the video in a Star Wars perspective crawl.
type RepoLine = { text: string; tone: 'cmd' | 'add' | 'commit' | 'branch' | 'merge' | 'tag' };

const REPO_TIMELINE: RepoLine[] = [
  { text: '$ git init', tone: 'cmd' },
  { text: 'Initialized empty repository', tone: 'cmd' },
  { text: '+ README.md', tone: 'add' },
  { text: '+ .gitignore', tone: 'add' },
  { text: 'commit a1f09e2  "first commit"', tone: 'commit' },
  { text: '+ index.html', tone: 'add' },
  { text: '+ styles.css', tone: 'add' },
  { text: 'commit 4c88b17  "add homepage"', tone: 'commit' },
  { text: '$ git branch feature/login', tone: 'branch' },
  { text: '$ git checkout feature/login', tone: 'branch' },
  { text: '+ login.js', tone: 'add' },
  { text: '+ auth.js', tone: 'add' },
  { text: 'commit 9d2e5a0  "build login form"', tone: 'commit' },
  { text: 'commit b7c1f44  "validate passwords"', tone: 'commit' },
  { text: '$ git push origin feature/login', tone: 'cmd' },
  { text: 'Pull request #1 opened', tone: 'merge' },
  { text: 'Review: approved', tone: 'merge' },
  { text: 'Merged #1 into main', tone: 'merge' },
  { text: '+ tests/login.test.js', tone: 'add' },
  { text: 'commit e3a9c61  "add tests"', tone: 'commit' },
  { text: 'CI: all checks passed', tone: 'merge' },
  { text: '+ LICENSE', tone: 'add' },
  { text: 'commit f0d47b8  "prepare release"', tone: 'commit' },
  { text: '$ git tag v1.0.0', tone: 'tag' },
  { text: 'Release v1.0.0 published', tone: 'tag' },
];

const FEATURE_LINES: RepoLine[] = [
  { text: 'Learn Git & GitHub like a pro', tone: 'tag' },
  { text: 'The Map: watch your skills light up', tone: 'branch' },
  { text: 'Real terminal practice, zero risk', tone: 'add' },
  { text: 'Warm-up drills that adapt to you', tone: 'commit' },
  { text: 'Open pull requests with a virtual teammate', tone: 'merge' },
  { text: 'WHAT / WHERE / WHY / WHEN / HOW', tone: 'cmd' },
  { text: 'No paywalls. No gating. Ever.', tone: 'tag' },
  { text: 'Free and open source', tone: 'add' },
];

const FEED_LINES: RepoLine[] = [...REPO_TIMELINE, ...FEATURE_LINES];

const TONE_COLORS: Record<RepoLine['tone'], string> = {
  cmd: 'rgba(139, 148, 158, 0.88)',
  add: 'rgba(63, 185, 80, 0.88)',
  commit: 'rgba(88, 166, 255, 0.88)',
  branch: 'rgba(210, 168, 255, 0.88)',
  merge: 'rgba(163, 113, 247, 0.88)',
  tag: 'rgba(240, 180, 41, 0.95)',
};

const FEED_LINE_HEIGHT = 72;

const RepoBuildFeed = ({ hidden }: { hidden: boolean }) => {
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const contentH = FEED_LINES.length * FEED_LINE_HEIGHT;

  return (
    <motion.div 
      className="absolute inset-0 pointer-events-none z-[1] overflow-hidden flex justify-center" 
      aria-hidden="true"
      style={{ perspective: '800px' }}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: 1 }}
    >
      {/* 
        This div does the 3D rotation to lay it flat like Star Wars.
        We position it near the bottom so it crawls "away" and "up".
      */}
      <div 
        className="absolute bottom-[-20%] w-full h-[150%] flex justify-center origin-bottom"
        style={{ transform: 'rotateX(50deg)' }}
      >
        <motion.div
          className="absolute font-mono whitespace-nowrap text-center flex flex-col items-center"
          style={{ 
            top: '100%', 
            fontSize: 42, 
            lineHeight: `${FEED_LINE_HEIGHT}px`,
            fontWeight: 700,
            textShadow: '0 0 22px currentColor, 0 0 8px currentColor'
          }}
          initial={{ y: 0 }}
          animate={{ y: -(contentH + viewportH * 1.5) }}
          transition={{ duration: TOTAL_RUNTIME_MS / 1000, ease: 'linear' }}
        >
          {FEED_LINES.map((line, i) => (
            <div key={i} style={{ color: TONE_COLORS[line.tone] }} className="my-2">
              {line.text}
            </div>
          ))}
        </motion.div>
      </div>
      {/* Gradient fade out at the top to make it disappear into space */}
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-bg-light to-transparent z-[2]" />
    </motion.div>
  );
};

// Brand corner: RTS mark + destination URL, visible the whole video so
// it always reads as an ad for git-dojo.com. Hidden during the stinger.
const BrandCorner = ({ hidden }: { hidden: boolean }) => (
  <motion.div
    className="absolute z-[6] pointer-events-none flex flex-col items-end gap-2"
    style={{ top: '5%', right: '4%' }}
    initial={{ opacity: 0 }}
    animate={{ opacity: hidden ? 0 : 1 }}
    transition={{ duration: hidden ? 0.15 : 1.2, ease: 'easeOut' }}
  >
    <img
      src={`${import.meta.env.BASE_URL}rts-logo.png`}
      alt="RTS"
      style={{ width: 92, height: 92, borderRadius: 14, objectFit: 'contain', opacity: 0.9 }}
    />
    <div
      className="font-mono font-bold"
      style={{
        fontSize: 24,
        letterSpacing: '0.05em',
        color: 'rgba(240, 180, 41, 0.95)',
        textShadow: '0 0 20px rgba(240, 180, 41, 0.5)',
      }}
    >
      git-dojo.com
    </div>
  </motion.div>
);

// Persistent grid background outside AnimatePresence
const PersistentBackground = ({ currentScene }: { currentScene: number }) => {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#050914]"
      animate={{
        filter: currentScene === 3 ? 'hue-rotate(20deg) brightness(0.9)' : 'hue-rotate(0deg) brightness(1)',
      }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      {/* High-tech radial grid */}
      <div 
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(circle at center, var(--color-primary) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* HUD-like corner accents */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-primary/40 rounded-tl-lg" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-primary/40 rounded-br-lg" />
      
      {/* Drifting gradient glow for depth */}
      <motion.div
        className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] opacity-20"
        animate={{
          x: currentScene % 2 === 0 ? '-30%' : '10%',
          y: currentScene % 3 === 0 ? '-20%' : '20%',
          scale: currentScene === 3 ? 1.2 : 1,
          backgroundColor: currentScene === 3 ? 'var(--color-accent)' : 'var(--color-primary)',
        }}
        transition={{ duration: 4, ease: 'easeInOut' }}
        style={{ top: '0%', left: '20%' }}
      />
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full blur-[100px] opacity-[0.15]"
        animate={{
          x: currentScene % 2 === 0 ? '40%' : '-10%',
          y: currentScene % 3 === 0 ? '40%' : '-10%',
          backgroundColor: 'var(--color-success)',
        }}
        transition={{ duration: 5, ease: 'easeInOut', delay: 0.5 }}
        style={{ bottom: '-10%', right: '-10%' }}
      />
    </motion.div>
  );
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey, isNaturalLoopRef } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
    if (Math.abs(audio.currentTime - targetTime) > AUDIO_SEEK_EPSILON_SEC) {
      audio.currentTime = targetTime;
    }
    audio.play().catch(() => {});
  }, [currentSceneKey, baseSceneKey, muted]);

  // ── Smooth loop: fade to black between last scene and scene 0 ──────────────
  // Strategy: start fading to black 600 ms before s5 ends so the screen is
  // already opaque by the time s0 replaces s5. On s0 entry, reset the feed
  // scroll (invisible under the overlay) and fade back out.
  //
  // 'idle' = overlay fully transparent
  // 'in'   = fading to black (0 → 1 over 500 ms)
  // 'out'  = fading back to clear (1 → 0 over 600 ms)
  const [loopFading, setLoopFading] = useState<'idle' | 'in' | 'out'>('idle');
  // Bumped each loop so RepoBuildFeed remounts (resets scroll) while hidden
  const [feedKey, setFeedKey] = useState(0);
  const prevSceneKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevSceneKeyRef.current;
    prevSceneKeyRef.current = currentSceneKey;

    const baseKey = currentSceneKey.replace(/_r[12]$/, '');
    const prevBase = prev?.replace(/_r[12]$/, '') ?? null;

    // --- Phase 1: entering the last scene — schedule the fade-in so it peaks
    //     just before the scene timer fires and advances to s0.
    if (baseKey === 's5') {
      const fadeInDelay = Math.max(0, durations.s5 - LOOP_FADE_LEAD_MS);
      const t1 = setTimeout(() => setLoopFading('in'), fadeInDelay);
      return () => clearTimeout(t1);
    }

    // --- Phase 2: s0 has just started (overlay is already black from Phase 1).
    //     Only fire the fade-out when the transition came from the natural scene
    //     timer (isNaturalLoopRef.current === true).  Manual jumps to scene 0
    //     always remount VideoTemplate via mountKey, which resets the ref to its
    //     initial false value, so this guard prevents spurious fades on seeks.
    if (
      baseKey === 's0' &&
      prevBase !== null &&
      prevBase !== 's0' &&
      isNaturalLoopRef.current
    ) {
      setFeedKey((k) => k + 1);
      setLoopFading('out');
      const t1 = setTimeout(() => setLoopFading('idle'), LOOP_FADE_OUT_MS);
      return () => clearTimeout(t1);
    }

    return undefined;
  }, [currentSceneKey]);
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="w-full h-screen overflow-hidden relative flex items-center justify-center bg-[#050914]"
    >
      <PersistentBackground currentScene={sceneIndex} />
      <RepoBuildFeed key={feedKey} hidden={sceneIndex === 5} />
      <BrandCorner hidden={sceneIndex === 5} />

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

      {/* Fade-to-black overlay for smooth looping */}
      <motion.div
        className="absolute inset-0 z-50 bg-black pointer-events-none"
        animate={{ opacity: loopFading === 'in' ? 1 : 0 }}
        transition={{
          duration: loopFading === 'in' ? LOOP_FADE_IN_MS / 1000 : LOOP_FADE_OUT_MS / 1000,
          ease: 'easeInOut',
        }}
      />

      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </div>
  );
}
