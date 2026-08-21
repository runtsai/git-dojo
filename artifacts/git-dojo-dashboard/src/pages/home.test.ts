import { describe, it, expect } from "vitest";
import { computeBadgeShelf } from "@/lib/badge-shelf";
import type { TierDef } from "@workspace/api-client-react";
import type { CrisisMeta } from "@/content/crises";
import type { Lesson } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTier(overrides: Partial<TierDef> & { id: string }): TierDef {
  return {
    id: overrides.id,
    title: overrides.title ?? `Tier ${overrides.id}`,
    description: overrides.description ?? "A tier.",
    status: overrides.status ?? "active",
    modules: overrides.modules ?? [],
  };
}

function makeLesson(id: string, title = `Lesson ${id}`): Lesson {
  return {
    id,
    number: 1,
    title,
    folderName: `lesson-${id}`,
    hasPlayground: false,
    initialized: false,
  } as Lesson;
}

function makeCrisis(id: string, title = `Crisis ${id}`): CrisisMeta {
  return {
    id,
    number: 1,
    title,
    tagline: "",
    briefing: [],
    goal: "",
    hints: { nudge: "", concept: "", command: "" },
    debrief: "",
    breakthroughId: "",
    breakthroughTitle: "",
  };
}

const TIER_WITH_MODULES = makeTier({
  id: "tier-1",
  title: "The Ground Truth",
  status: "active",
  modules: [
    { id: "1.1", title: "Module 1.1", path: "/learn/1-1" },
    { id: "1.2", title: "Module 1.2", path: "/learn/1-2" },
  ],
});

const LESSONS = [makeLesson("lesson-01"), makeLesson("lesson-02")];
const CRISES = [makeCrisis("crisis-01"), makeCrisis("crisis-02")];

// ---------------------------------------------------------------------------
// Zero badges — shelf hidden
// ---------------------------------------------------------------------------

describe("computeBadgeShelf — no badges earned", () => {
  it("hasAnyBadge is false when nothing is completed", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.hasAnyBadge).toBe(false);
  });

  it("all badge lists are empty when nothing is completed", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.completedTiers).toHaveLength(0);
    expect(result.earnedCliBadges).toHaveLength(0);
    expect(result.earnedCrisisBadges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Only a tier trophy
// ---------------------------------------------------------------------------

describe("computeBadgeShelf — only a tier trophy earned", () => {
  it("hasAnyBadge is true when all tier modules are completed", () => {
    const result = computeBadgeShelf({
      completedVisualModules: ["1.1", "1.2"],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.hasAnyBadge).toBe(true);
  });

  it("completedTiers contains the finished tier", () => {
    const result = computeBadgeShelf({
      completedVisualModules: ["1.1", "1.2"],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.completedTiers).toHaveLength(1);
    expect(result.completedTiers[0].id).toBe("tier-1");
  });

  it("no CLI or crisis badges appear alongside a lone tier trophy", () => {
    const result = computeBadgeShelf({
      completedVisualModules: ["1.1", "1.2"],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.earnedCliBadges).toHaveLength(0);
    expect(result.earnedCrisisBadges).toHaveLength(0);
  });

  it("a coming_soon tier is never counted even if its modules are listed as complete", () => {
    const lockedTier = makeTier({
      id: "tier-locked",
      status: "coming_soon",
      modules: [{ id: "x.1", title: "Hidden", path: "/learn/x-1" }],
    });
    const result = computeBadgeShelf({
      completedVisualModules: ["x.1"],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: [],
      allTiers: [lockedTier],
      allCrises: [],
    });
    expect(result.completedTiers).toHaveLength(0);
    expect(result.hasAnyBadge).toBe(false);
  });

  it("a tier with no modules is never counted even when marked active", () => {
    const emptyTier = makeTier({ id: "tier-empty", status: "active", modules: [] });
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: [],
      allTiers: [emptyTier],
      allCrises: [],
    });
    expect(result.completedTiers).toHaveLength(0);
    expect(result.hasAnyBadge).toBe(false);
  });

  it("a partially completed tier does not appear in completedTiers", () => {
    const result = computeBadgeShelf({
      completedVisualModules: ["1.1"], // 1.2 still missing
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.completedTiers).toHaveLength(0);
    expect(result.hasAnyBadge).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Only CLI badges
// ---------------------------------------------------------------------------

describe("computeBadgeShelf — only CLI badges earned", () => {
  it("hasAnyBadge is true when at least one CLI lesson is completed", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: ["lesson-01"],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.hasAnyBadge).toBe(true);
  });

  it("earnedCliBadges contains only the completed lessons", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: ["lesson-01"],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.earnedCliBadges).toHaveLength(1);
    expect(result.earnedCliBadges[0].id).toBe("lesson-01");
  });

  it("no tier or crisis badges appear alongside lone CLI badges", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: ["lesson-01"],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.completedTiers).toHaveLength(0);
    expect(result.earnedCrisisBadges).toHaveLength(0);
  });

  it("all completed lessons appear when multiple CLI badges are earned", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: ["lesson-01", "lesson-02"],
      goLiveBadgeEarned: false,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.earnedCliBadges).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Only the Go Live badge
// ---------------------------------------------------------------------------

describe("computeBadgeShelf — only Go Live badge earned", () => {
  it("hasAnyBadge is true when goLiveBadgeEarned is true", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: [],
      goLiveBadgeEarned: true,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.hasAnyBadge).toBe(true);
  });

  it("no tier, CLI, or crisis badges appear alongside a lone Go Live badge", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: [],
      goLiveBadgeEarned: true,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.completedTiers).toHaveLength(0);
    expect(result.earnedCliBadges).toHaveLength(0);
    expect(result.earnedCrisisBadges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Only crisis badges
// ---------------------------------------------------------------------------

describe("computeBadgeShelf — only crisis badges earned", () => {
  it("hasAnyBadge is true when a crisis is completed", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: ["crisis-01"],
      goLiveBadgeEarned: false,
      lessons: [],
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.hasAnyBadge).toBe(true);
  });

  it("earnedCrisisBadges contains only the completed crisis", () => {
    const result = computeBadgeShelf({
      completedVisualModules: [],
      completedCliLessons: ["crisis-01"],
      goLiveBadgeEarned: false,
      lessons: [],
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.earnedCrisisBadges).toHaveLength(1);
    expect(result.earnedCrisisBadges[0].id).toBe("crisis-01");
  });
});

// ---------------------------------------------------------------------------
// Tier status rollback: active → coming_soon
// ---------------------------------------------------------------------------

describe("computeBadgeShelf — tier reverted from active to coming_soon", () => {
  it("completedTiers does not include a tier whose status is rolled back to coming_soon", () => {
    // Simulate a tier that was previously active (all modules complete) but
    // whose status has since been set back to coming_soon (e.g. after a failed
    // launch).
    const rolledBackTier = makeTier({
      id: "tier-rollback",
      status: "coming_soon",
      modules: [
        { id: "rb.1", title: "Module rb.1", path: "/learn/rb-1" },
        { id: "rb.2", title: "Module rb.2", path: "/learn/rb-2" },
      ],
    });
    const result = computeBadgeShelf({
      completedVisualModules: ["rb.1", "rb.2"],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: [],
      allTiers: [rolledBackTier],
      allCrises: [],
    });
    expect(result.completedTiers).toHaveLength(0);
  });

  it("hasAnyBadge is false when the only completed tier is rolled back to coming_soon", () => {
    const rolledBackTier = makeTier({
      id: "tier-rollback",
      status: "coming_soon",
      modules: [
        { id: "rb.1", title: "Module rb.1", path: "/learn/rb-1" },
        { id: "rb.2", title: "Module rb.2", path: "/learn/rb-2" },
      ],
    });
    const result = computeBadgeShelf({
      completedVisualModules: ["rb.1", "rb.2"],
      completedCliLessons: [],
      goLiveBadgeEarned: false,
      lessons: [],
      allTiers: [rolledBackTier],
      allCrises: [],
    });
    expect(result.hasAnyBadge).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// All three badge types together
// ---------------------------------------------------------------------------

describe("computeBadgeShelf — all badge types earned simultaneously", () => {
  it("hasAnyBadge is true", () => {
    const result = computeBadgeShelf({
      completedVisualModules: ["1.1", "1.2"],
      completedCliLessons: ["lesson-01", "crisis-01"],
      goLiveBadgeEarned: true,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.hasAnyBadge).toBe(true);
  });

  it("completedTiers, earnedCliBadges, earnedCrisisBadges are all non-empty", () => {
    const result = computeBadgeShelf({
      completedVisualModules: ["1.1", "1.2"],
      completedCliLessons: ["lesson-01", "crisis-01"],
      goLiveBadgeEarned: true,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.completedTiers).toHaveLength(1);
    expect(result.earnedCliBadges).toHaveLength(1);
    expect(result.earnedCrisisBadges).toHaveLength(1);
  });

  it("each badge list contains exactly the right items", () => {
    const result = computeBadgeShelf({
      completedVisualModules: ["1.1", "1.2"],
      completedCliLessons: ["lesson-02", "crisis-02"],
      goLiveBadgeEarned: true,
      lessons: LESSONS,
      allTiers: [TIER_WITH_MODULES],
      allCrises: CRISES,
    });
    expect(result.completedTiers[0].id).toBe("tier-1");
    expect(result.earnedCliBadges[0].id).toBe("lesson-02");
    expect(result.earnedCrisisBadges[0].id).toBe("crisis-02");
  });
});
