import { vi } from "vitest";

// Stub the recording APIs that useVideoPlayer calls during its lifecycle.
// These don't exist in jsdom, so tests would throw without them.
Object.assign(window, {
  startRecording: vi.fn().mockResolvedValue(undefined),
  stopRecording: vi.fn(),
  __replitVideoPlayerMounted: false,
  __replitVideoTotalDurationMs: 0,
});

// jsdom stubs for HTMLMediaElement (audio element used by VideoTemplate)
Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
});
Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: vi.fn(),
});
