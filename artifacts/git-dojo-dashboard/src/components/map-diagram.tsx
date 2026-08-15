import { mapPlaces, mapFlows } from "@/content/map";
import {
  ComputerIcon, TrayIcon, SealedBoxIcon, CloudIcon,
  ProposalIcon, RobotIcon, UnlockIcon,
} from "@/components/git-icons";

// Diagram coordinates
export const PLACES = {
  workbench: { cx: 300, cy: 240, width: 220, height: 64 },
  dock: { cx: 300, cy: 480, width: 220, height: 64 },
  sealed: { cx: 300, cy: 720, width: 220, height: 64 },

  "front-office": { cx: 1100, cy: 240, width: 220, height: 64 },
  "pr-desk": { cx: 1100, cy: 400, width: 220, height: 64 },
  robot: { cx: 900, cy: 560, width: 220, height: 64 },
  review: { cx: 1300, cy: 560, width: 220, height: 64 },
  shared: { cx: 1100, cy: 720, width: 220, height: 64 },
};

type FlowData = { d: string; labelPos: { x: number; y: number }; labelWidth?: number };
export const FLOWS: Record<string, FlowData> = {
  edit: { d: "M 300,90 L 300,208", labelPos: { x: 300, y: 149 }, labelWidth: 60 },
  add: { d: "M 300,272 L 300,448", labelPos: { x: 300, y: 360 }, labelWidth: 64 },
  commit: { d: "M 300,512 L 300,688", labelPos: { x: 300, y: 600 }, labelWidth: 74 },
  branch: { d: "M 220,752 C 220,830 320,830 320,752", labelPos: { x: 270, y: 810 }, labelWidth: 130 },
  push: { d: "M 410,696 L 990,696", labelPos: { x: 580, y: 696 }, labelWidth: 64 },
  fetch: { d: "M 990,720 L 410,720", labelPos: { x: 700, y: 720 }, labelWidth: 64 },
  pull: { d: "M 990,744 L 410,744", labelPos: { x: 820, y: 744 }, labelWidth: 64 },
  inspect: { d: "M 190,720 C 40,720 40,240 190,240", labelPos: { x: 80, y: 480 }, labelWidth: 84 },
  issue: { d: "M 1060,208 C 800,40 500,40 360,208", labelPos: { x: 665, y: 82 }, labelWidth: 64 },
  open_pr: { d: "M 1100,688 L 1100,432", labelPos: { x: 1100, y: 560 }, labelWidth: 84 },
  checks: { d: "M 1020,432 L 960,528", labelPos: { x: 990, y: 480 }, labelWidth: 74 },
  do_review: { d: "M 1180,432 L 1240,528", labelPos: { x: 1210, y: 480 }, labelWidth: 84 },
  merge: { d: "M 1250,592 L 1150,688", labelPos: { x: 1200, y: 640 }, labelWidth: 74 },
};

export const PLACE_ICONS: Record<string, React.ElementType> = {
  workbench: ComputerIcon,
  dock: TrayIcon,
  sealed: SealedBoxIcon,
  "front-office": CloudIcon,
  "pr-desk": ProposalIcon,
  robot: RobotIcon,
  review: UnlockIcon,
  shared: CloudIcon,
};

export type MapDiagramProps = {
  /** Places currently lit (highlighted). */
  litPlaceIds: string[];
  /** Flows currently lit (highlighted). */
  litFlowIds: string[];
  /** Dim everything that is not lit. */
  dim: boolean;
  /** Place with the strongest (filled) highlight, if any. */
  emphasizedPlaceId?: string | null;
  /** Click/keyboard handlers; omit for a read-only diagram. */
  onPlaceClick?: (id: string) => void;
  onFlowClick?: (id: string) => void;
  /** Unique prefix for SVG marker ids when several diagrams coexist. */
  markerIdPrefix?: string;
  className?: string;
  ariaHidden?: boolean;
};

/**
 * The shared SVG diagram of the Git territory. Used full-size on /map
 * and compact inside the "You are here" MapPeek drawer.
 */
export function MapDiagram({
  litPlaceIds,
  litFlowIds,
  dim,
  emphasizedPlaceId = null,
  onPlaceClick,
  onFlowClick,
  markerIdPrefix = "map",
  className = "",
  ariaHidden,
}: MapDiagramProps) {
  const interactive = !!(onPlaceClick || onFlowClick);
  const litPlaces = new Set(litPlaceIds);
  const litFlows = new Set(litFlowIds);

  return (
    <>
      <svg
        viewBox="0 0 1400 860"
        className={`select-none touch-manipulation ${className}`}
        aria-hidden={ariaHidden ? "true" : "false"}
      >
        <defs>
          <marker id={`${markerIdPrefix}-arrowhead`} markerWidth="16" markerHeight="12" refX="15" refY="6" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="0 0, 16 6, 0 12" fill="currentColor" className="text-white/40" />
          </marker>
          <marker id={`${markerIdPrefix}-arrowhead-lit`} markerWidth="16" markerHeight="12" refX="15" refY="6" orient="auto" markerUnits="userSpaceOnUse">
            <polygon points="0 0, 16 6, 0 12" fill="currentColor" className="text-primary" />
          </marker>
        </defs>

        {/* Regions */}
        <rect x="60" y="120" width="480" height="720" rx="24" className="fill-white/[0.02] stroke-white/10" strokeWidth="3" strokeDasharray="12 12" />
        <text x="90" y="160" className="fill-white/30 text-sm font-bold uppercase tracking-widest" textAnchor="start">Your Computer</text>

        <rect x="860" y="120" width="480" height="720" rx="24" className="fill-white/[0.02] stroke-white/10" strokeWidth="3" strokeDasharray="12 12" />
        <text x="890" y="160" className="fill-white/30 text-sm font-bold uppercase tracking-widest" textAnchor="start">The Website (GitHub)</text>

        {/* Flows */}
        {mapFlows.map(f => {
          const flowData = FLOWS[f.id];
          if (!flowData) return null;

          const isLit = litFlows.has(f.id);
          const isDimmed = !isLit && dim;

          return (
            <g
              key={f.id}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`Flow: ${f.label}`}
              aria-pressed={interactive ? isLit : undefined}
              onKeyDown={interactive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onFlowClick?.(f.id);
                }
              } : undefined}
              className={`transition-all duration-500 outline-none rounded-xl group ${interactive ? 'cursor-pointer focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1117]' : ''} ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
              onClick={interactive ? () => onFlowClick?.(f.id) : undefined}
            >
              {/* Subtle directional flow dashed line on hover (respects motion preference) */}
              {interactive && (
                <path
                  d={flowData.d}
                  fill="none"
                  className={`stroke-white/10 stroke-[4px] motion-safe:group-hover:dash-animate hidden group-hover:block transition-opacity duration-300 ${isLit ? 'opacity-0' : 'opacity-100'}`}
                  strokeDasharray="8 16"
                />
              )}

              <path
                d={flowData.d}
                fill="none"
                className={`transition-colors duration-300 stroke-[4px] ${isLit ? 'stroke-primary drop-shadow-[0_0_12px_rgba(255,107,0,0.6)]' : `stroke-white/20 ${interactive ? 'group-hover:stroke-white/40' : ''}`}`}
                markerEnd={`url(#${markerIdPrefix}-arrowhead${isLit ? '-lit' : ''})`}
              />
              {/* Invisible wider hit area for touch */}
              {interactive && <path d={flowData.d} fill="none" stroke="transparent" strokeWidth="44" />}

              {/* Animated pulse for lit flow (gated by prefers-reduced-motion via CSS) */}
              {isLit && (
                <path
                  d={flowData.d}
                  fill="none"
                  className="stroke-primary stroke-[4px] opacity-80 dash-animate"
                  strokeDasharray="12 24"
                />
              )}

              <rect
                x={flowData.labelPos.x - (flowData.labelWidth || 80) / 2}
                y={flowData.labelPos.y - 14}
                width={flowData.labelWidth || 80}
                height="28"
                rx="14"
                strokeWidth="2"
                className={`transition-colors ${isLit ? 'fill-[#161b22] stroke-primary shadow-[0_0_10px_rgba(255,107,0,0.3)]' : `fill-[#161b22] stroke-white/10 ${interactive ? 'group-hover:stroke-white/30' : ''}`}`}
              />
              <text
                x={flowData.labelPos.x}
                y={flowData.labelPos.y + 4}
                className={`text-xs font-bold font-mono transition-colors ${isLit ? 'fill-primary' : 'fill-white/60'}`}
                textAnchor="middle"
              >
                {f.label}
              </text>
            </g>
          );
        })}

        {/* Places */}
        {mapPlaces.map(p => {
          const pos = PLACES[p.id as keyof typeof PLACES];
          if (!pos) return null;

          const isLit = litPlaces.has(p.id);
          const isDimmed = !isLit && dim;
          const isEmphasized = isLit && emphasizedPlaceId === p.id;
          const Icon = PLACE_ICONS[p.id];

          return (
            <g
              key={p.id}
              transform={`translate(${pos.cx - pos.width / 2}, ${pos.cy - pos.height / 2})`}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`Place: ${p.label}`}
              aria-pressed={interactive ? isLit : undefined}
              onKeyDown={interactive ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPlaceClick?.(p.id);
                }
              } : undefined}
              className={`transition-all duration-500 outline-none rounded-xl group ${interactive ? 'cursor-pointer focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1117]' : ''} ${isDimmed ? 'opacity-30' : 'opacity-100'} ${isEmphasized ? 'scale-[1.05]' : 'scale-100'}`}
              style={{ transformOrigin: `${pos.cx}px ${pos.cy}px` }}
              onClick={interactive ? () => onPlaceClick?.(p.id) : undefined}
            >
              <rect
                width={pos.width}
                height={pos.height}
                rx="8"
                className={`transition-all duration-300 ${
                  isEmphasized
                    ? 'fill-primary stroke-primary drop-shadow-[0_0_15px_rgba(255,107,0,0.4)]'
                    : isLit
                      ? 'fill-[#21262d] stroke-primary stroke-2 drop-shadow-[0_0_8px_rgba(255,107,0,0.2)]'
                      : `fill-[#161b22] stroke-white/20 ${interactive ? 'group-hover:stroke-white/40' : ''}`
                }`}
              />
              <foreignObject x="0" y="0" width={pos.width} height={pos.height} className="pointer-events-none">
                <div className={`w-full h-full flex items-center justify-center gap-3 px-4 ${isEmphasized ? 'text-primary-foreground' : isLit ? 'text-white' : 'text-white/80'}`}>
                  {Icon && <Icon className="w-6 h-6 shrink-0" />}
                  <span className="text-base font-bold whitespace-nowrap">{p.label}</span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -45;
          }
        }
        @media (prefers-reduced-motion: no-preference) {
          .dash-animate {
            animation: dash 1s linear infinite;
          }
        }
      `}</style>
    </>
  );
}
