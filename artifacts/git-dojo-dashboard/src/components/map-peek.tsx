import { Link } from "wouter";
import { Map as MapIcon, MapPin, ArrowRight } from "lucide-react";
import { lessonLocations, mapPlaces } from "@/content/map";
import { isValidStepChip } from "@/lib/step-chip";
import { MapDiagram, PLACE_ICONS } from "@/components/map-diagram";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type MapPeekProps = {
  /** Lesson / module / breakthrough id, matched against lessonLocations. */
  locationId: string;
  /** "inline" renders a normal button; "floating" pins a compact button bottom-right. */
  variant?: "inline" | "floating";
  /**
   * 1-based step index inside a visual module.
   * When provided and the location has per-step overrides, the drawer narrows
   * its highlight to that step's territory.  Falls back to the whole-lesson
   * highlight when no step data is available.
   */
  stepIndex?: number;
};

/**
 * "You are here" — a compact Map drawer that lights up the territory the
 * current lesson lives in, with everything else dimmed.
 */
export function MapPeek({ locationId, variant = "inline", stepIndex }: MapPeekProps) {
  const location = lessonLocations[locationId];
  if (!location) return null;

  // Resolve per-step overrides (stepIndex is 1-based; steps array is 0-based)
  const stepOverride = (stepIndex != null && location.steps)
    ? location.steps[stepIndex - 1]
    : undefined;

  const activePlaceIds = stepOverride?.placeIds ?? location.placeIds;
  const activeFlowIds  = stepOverride?.flowIds  ?? location.flowIds;
  const activeCaption  = stepOverride?.caption  ?? location.caption;

  const litPlaces = mapPlaces.filter(p => activePlaceIds.includes(p.id));

  const triggerClasses =
    variant === "floating"
      ? "fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 min-h-[44px] bg-[#161b22] text-foreground text-sm font-bold rounded-full border border-primary/40 shadow-lg shadow-black/40 hover:border-primary transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      : "inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-secondary text-secondary-foreground text-sm font-bold rounded-lg hover:bg-secondary/80 transition-all active:scale-95 border border-white/10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <Sheet>
      <SheetTrigger className={triggerClasses} aria-label="Open the Map: where am I?">
        <MapIcon className="w-4 h-4 text-primary" />
        <span>Where am I?</span>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="bg-[#0d1117] border-white/10 rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6"
      >
        <SheetHeader className="text-left mb-4 pr-8">
          <SheetTitle className="flex items-center gap-2 text-foreground flex-wrap">
            <span className="p-1.5 bg-primary/10 rounded-lg text-primary border border-primary/20">
              <MapPin className="w-4 h-4" />
            </span>
            You are here
            {isValidStepChip(stepIndex, location.steps?.length ?? 0) && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold tabular-nums">
                Step {stepIndex} of {location.steps!.length}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground leading-relaxed">
            {activeCaption}
          </SheetDescription>
        </SheetHeader>

        {/* Lit place chips — icon vocabulary, readable at 390px */}
        <div className="flex flex-wrap gap-2 mb-4">
          {litPlaces.map(p => {
            const Icon = PLACE_ICONS[p.id];
            return (
              <span
                key={p.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold"
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                {p.label}
              </span>
            );
          })}
        </div>

        <div className="bg-black/40 border border-white/10 rounded-xl p-2 sm:p-4 overflow-x-auto">
          <MapDiagram
            litPlaceIds={activePlaceIds}
            litFlowIds={activeFlowIds}
            dim
            markerIdPrefix="peek"
            className="w-full min-w-[560px] sm:min-w-0 h-auto"
            ariaHidden
          />
        </div>

        <Link
          href="/map"
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Open the full Map <ArrowRight className="w-4 h-4" />
        </Link>
      </SheetContent>
    </Sheet>
  );
}
