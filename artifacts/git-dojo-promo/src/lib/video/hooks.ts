// Video player hook - handles recording lifecycle, scene advancement, and looping

import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

declare global {
  interface Window {
    __replitVideoPlayerMounted?: boolean;
    __replitVideoTotalDurationMs?: number;
    startRecording?: () => Promise<void>;
    stopRecording?: () => void;
  }
}

export interface SceneDurations {
  [key: string]: number;
}

export interface UseVideoPlayerOptions {
  durations: SceneDurations;
  onVideoEnd?: () => void;
  loop?: boolean;
}

export interface UseVideoPlayerReturn {
  currentScene: number;
  totalScenes: number;
  currentSceneKey: string;
  hasEnded: boolean;
  /** True only when the current scene became scene 0 because the final scene's
   *  timer expired naturally.  False for every other scene advancement,
   *  including the initial mount and any externally-triggered remount. */
  isNaturalLoopRef: MutableRefObject<boolean>;
}

export function useVideoPlayer(
  options: UseVideoPlayerOptions,
): UseVideoPlayerReturn {
  const { durations, onVideoEnd, loop = true } = options;

  // Captured once on mount -- durations must be a static object
  const sceneKeys = useRef(Object.keys(durations)).current;
  const totalScenes = sceneKeys.length;
  const durationsArray = useRef(Object.values(durations)).current;

  const [currentScene, setCurrentScene] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);

  // Set to true only when the final scene's timer fires and the video loops
  // back to scene 0 naturally.  False on every other advancement, including
  // initial mount and any externally-triggered remount (jumpTo / toggleLock).
  // Consumers read this ref synchronously inside the same effect cycle that
  // responds to a currentSceneKey change, so no stale-closure risk.
  const isNaturalLoopRef = useRef(false);

  // Start recording on mount
  useEffect(() => {
    window.__replitVideoPlayerMounted = true;
    // Declares the intended video length to the export renderer so a broken
    // stop path cannot record past the end of the last scene.
    window.__replitVideoTotalDurationMs = durationsArray.reduce(
      (total, duration) => total + duration,
      0,
    );
    window.startRecording?.();

    return () => {
      window.__replitVideoPlayerMounted = false;
    };
  }, []);

  // Scene advancement -- loops independently of recording
  useEffect(() => {
    if (hasEnded && !loop) return;

    const currentDuration = durationsArray[currentScene];

    const timer = setTimeout(() => {
      // Mark the outgoing scene key BEFORE the state update so that
      // VideoTemplate's fade effect can read this flag in the same render
      // cycle where currentSceneKey flips to the incoming scene.
      //
      // The flag is true whenever the outgoing scene is the final scene,
      // regardless of whether the advance is a regular step (rotated sequence)
      // or a last-index wrap.  It is false on every fresh mount / remount
      // because useRef() reinitialises to false on each component instance.
      // Phase 2 of VideoTemplate's fade effect combines this with the
      // prevBase check (null after a remount) so that a manual jumpTo(0) is
      // never mistaken for a natural last-scene→s0 transition.
      isNaturalLoopRef.current = currentScene === totalScenes - 1;

      // Last scene just finished playing
      if (currentScene >= totalScenes - 1) {
        if (!hasEnded) {
          window.stopRecording?.();
          setHasEnded(true);
          onVideoEnd?.();
        }
        if (loop) {
          setCurrentScene(0);
        } else {
          // Not looping: no s0 entry will follow, clear the flag.
          isNaturalLoopRef.current = false;
        }
      } else {
        setCurrentScene((prev) => prev + 1);
      }
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [currentScene, totalScenes, durationsArray, hasEnded, loop, onVideoEnd]);

  return {
    currentScene,
    totalScenes,
    currentSceneKey: sceneKeys[currentScene],
    hasEnded,
    isNaturalLoopRef,
  };
}

export function useSceneTimer(
  events: Array<{ time: number; callback: () => void }>,
) {
  const firedRef = useRef<Set<number>>(new Set());
  const callbacksRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    callbacksRef.current = events.map((e) => e.callback);
  }, [events]);

  const scheduleKey = events.map((event, i) => `${i}:${event.time}`).join('|');

  useEffect(() => {
    firedRef.current = new Set();

    const timers = events.map(({ time }, index) => {
      return setTimeout(() => {
        if (!firedRef.current.has(index)) {
          firedRef.current.add(index);
          callbacksRef.current[index]?.();
        }
      }, time);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [scheduleKey]);
}
