import { useQuery } from "@tanstack/react-query";
import { useGetProgress, getDueDrills } from "@workspace/api-client-react";
import type { DrillDueResult, DrillFrictionEntry } from "@workspace/api-client-react";
import { useMemo } from "react";
import { eligibleDrills, type DrillItem } from "@/content/drills";

/**
 * Shared source of truth for the warm-up system: which drill items the
 * learner has unlocked (from completed progress) and, from the server,
 * which are due plus their honest practice stats.
 */
export function useDrillStatus() {
  const { data: progress, isLoading: progressLoading } = useGetProgress();

  const eligible: DrillItem[] = useMemo(() => {
    if (!progress) return [];
    return eligibleDrills(new Set(progress.entries.map((e) => e.moduleId)));
  }, [progress]);

  const candidateKey = useMemo(() => eligible.map((i) => i.id).join(","), [eligible]);

  const dueQuery = useQuery<DrillDueResult>({
    queryKey: ["drills", "due", candidateKey],
    enabled: eligible.length > 0,
    refetchInterval: 60_000,
    queryFn: () =>
      getDueDrills({
        candidates: eligible.map((i) => ({ id: i.id, sourceId: i.sourceId ?? null })),
      }),
  });

  return {
    isLoading: progressLoading || (eligible.length > 0 && dueQuery.isLoading),
    eligible,
    stats: dueQuery.data?.items ?? [],
    dueCount: dueQuery.data?.dueCount ?? 0,
    friction: dueQuery.data?.friction ?? ([] as DrillFrictionEntry[]),
    refetchDue: dueQuery.refetch,
  };
}
