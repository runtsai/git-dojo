import { useEffect, useRef } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';

export const SCENE_DURATIONS: Record<string, number> = {
  s0: 4000,
  s1: 4500,
  s2: 4500,
  s3: 4000,
  s4: 4000,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  s0: Scene0,
  s1: Scene1,
  s2: Scene2,
  s3: Scene3,
  s4: Scene4,
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

const TOTAL_RUNTIME_MS = Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0);

// A repo being built start-to-finish, scrolling up behind the scenes
// over the full runtime of the video.
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

// Second act: after the repo finishes building, the background shifts to
// what Git Dojo offers. These lines follow the repo timeline in one
// continuous upward scroll -- no restart.
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
  cmd: 'rgba(139, 148, 158, 0.9)',
  add: 'rgba(63, 185, 80, 0.9)',
  commit: 'rgba(88, 166, 255, 0.9)',
  branch: 'rgba(210, 168, 255, 0.9)',
  merge: 'rgba(163, 113, 247, 0.9)',
  tag: 'rgba(240, 180, 41, 0.95)',
};

const FEED_LINE_HEIGHT = 56;

const RepoBuildFeed = () => {
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const contentH = FEED_LINES.length * FEED_LINE_HEIGHT;
  // One continuous pass: enters from the bottom, fully exits the top
  // exactly at the end of the video. Never restarts.
  const travel = contentH + viewportH;

  return (
    <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute left-[6%] font-mono whitespace-nowrap"
        style={{ top: '100%', fontSize: 24, lineHeight: `${FEED_LINE_HEIGHT}px`, opacity: 0.45 }}
        initial={{ y: 0 }}
        animate={{ y: -travel }}
        transition={{ duration: TOTAL_RUNTIME_MS / 1000, ease: 'linear' }}
      >
        {FEED_LINES.map((line, i) => (
          <div key={i} style={{ color: TONE_COLORS[line.tone] }}>
            {line.text}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

// Company logo: fades in at the top right and drifts to center stage by
// the very end of the video.
const CompanyLogo = () => {
  const t = TOTAL_RUNTIME_MS / 1000;
  return (
    <motion.div
      className="absolute z-[6] pointer-events-none flex flex-col items-center"
      style={{ top: '6%', right: '4%' }}
      initial={{ opacity: 0, x: 0, y: 0, scale: 0.7 }}
      animate={{
        opacity: [0, 0.35, 0.5, 0.65, 1],
        x: [0, 0, 0, '-16vw', '-40vw'],
        y: [0, 0, 0, '12vh', '58vh'],
        scale: [0.7, 0.8, 0.85, 1, 1.5],
      }}
      transition={{ duration: t, times: [0, 0.25, 0.55, 0.82, 1], ease: 'easeInOut' }}
    >
      <div
        className="font-mono font-bold tracking-widest"
        style={{ fontSize: 30, color: 'var(--color-primary, #f0b429)', textShadow: '0 0 24px rgba(240, 180, 41, 0.35)' }}
      >
        RTS.AI
      </div>
      <div
        className="tracking-[0.3em] uppercase"
        style={{ fontSize: 11, color: 'rgba(139, 148, 158, 0.95)' }}
      >
        Run Trading Systems
      </div>
    </motion.div>
  );
};

// Persistent grid background outside AnimatePresence
const PersistentBackground = ({ currentScene }: { currentScene: number }) => {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-bg-light"
      animate={{
        scale: currentScene === 3 ? 1.05 : 1,
        filter: currentScene === 3 ? 'hue-rotate(-10deg) brightness(0.8)' : 'hue-rotate(0deg) brightness(1)',
      }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(var(--color-bg-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-bg-border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Drifting gradient glow */}
      <motion.div
        className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-10"
        animate={{
          x: currentScene % 2 === 0 ? '-20%' : '20%',
          y: currentScene % 3 === 0 ? '-20%' : '10%',
          backgroundColor: currentScene === 3 ? 'var(--color-error)' : 'var(--color-primary)',
        }}
        transition={{ duration: 3, ease: 'easeInOut' }}
        style={{ top: '10%', left: '10%' }}
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
  const { currentSceneKey } = useVideoPlayer({ durations, loop });

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

  return (
    <div
      className="w-full h-screen overflow-hidden relative flex items-center justify-center bg-bg-light"
    >
      <PersistentBackground currentScene={sceneIndex} />
      <RepoBuildFeed />
      <CompanyLogo />

      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>

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
