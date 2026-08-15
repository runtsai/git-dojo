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
