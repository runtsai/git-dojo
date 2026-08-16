import { vi } from "vitest";

// Mock UI-only modules that have no relevance to pure logic tests.
// These modules are imported by territory-strip.tsx and commit-timeline.tsx
// for their React rendering, but the unit tests only exercise the exported
// pure functions (detectMovements, layoutGraph) which do not use them.

vi.mock("lucide-react", () => ({}));
vi.mock("@/components/git-icons", () => ({}));
