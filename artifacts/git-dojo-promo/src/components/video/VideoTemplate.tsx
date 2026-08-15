import { useEffect, useRef } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

export const SCENE_DURATIONS: Record<string, number> = {
  s0: 4000,
  s1: 4500,
  s2: 4500,
  s3: 4000,
  s4: 4000,
  s5: 1500,
};

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

const TOTAL_RUNTIME_MS = Object.values(SCENE_DURATIONS).reduce((a, b) => a + b, 0);

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
  cmd: 'rgba(139, 148, 158, 0.7)',
  add: 'rgba(63, 185, 80, 0.7)',
  commit: 'rgba(88, 166, 255, 0.7)',
  branch: 'rgba(210, 168, 255, 0.7)',
  merge: 'rgba(163, 113, 247, 0.7)',
  tag: 'rgba(240, 180, 41, 0.8)',
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
            textShadow: '0 0 15px currentColor'
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
      className="w-full h-screen overflow-hidden relative flex items-center justify-center bg-[#050914]"
    >
      <PersistentBackground currentScene={sceneIndex} />
      <RepoBuildFeed hidden={sceneIndex === 5} />

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
