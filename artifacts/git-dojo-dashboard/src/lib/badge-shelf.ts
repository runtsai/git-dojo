import type { TierDef } from "@workspace/course-content";
import type { CrisisMeta } from "@/content/crises";
import type { Lesson } from "@workspace/api-client-react";

export interface BadgeShelfResult {
  completedTiers: TierDef[];
  earnedCliBadges: Lesson[];
  earnedCrisisBadges: CrisisMeta[];
  hasAnyBadge: boolean;
}

/**
 * Pure computation of what appears on the badge shelf.
 * Extracted from Home so it can be unit-tested without React or a DOM.
 */
export function computeBadgeShelf({
  completedVisualModules,
  completedCliLessons,
  goLiveBadgeEarned,
  lessons,
  allTiers,
  allCrises,
}: {
  completedVisualModules: string[];
  completedCliLessons: string[];
  goLiveBadgeEarned: boolean;
  lessons: Lesson[];
  allTiers: TierDef[];
  allCrises: CrisisMeta[];
}): BadgeShelfResult {
  const completedTiers = allTiers.filter((tier) => {
    if (tier.status !== "active") return false;
    const tierModules = tier.modules || [];
    return (
      tierModules.length > 0 &&
      tierModules.every((m) => completedVisualModules.includes(m.id))
    );
  });

  const earnedCliBadges = lessons.filter((lesson) =>
    completedCliLessons.includes(lesson.id),
  );

  const earnedCrisisBadges = allCrises.filter((crisis) =>
    completedCliLessons.includes(crisis.id),
  );

  const hasAnyBadge =
    completedTiers.length > 0 ||
    earnedCliBadges.length > 0 ||
    earnedCrisisBadges.length > 0 ||
    goLiveBadgeEarned;

  return { completedTiers, earnedCliBadges, earnedCrisisBadges, hasAnyBadge };
}
