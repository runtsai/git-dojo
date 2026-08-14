import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Play, X, Map as MapIcon, Compass, PlayCircle, MousePointer2 } from "lucide-react";
import { mapPlaces, mapFlows, mapJourneys, W5 } from "@/content/map";
import { 
  ComputerIcon, TrayIcon, SealedBoxIcon, CloudIcon, 
  ProposalIcon, RobotIcon, UnlockIcon, LockIcon 
} from "@/components/git-icons";

// Diagram coordinates
const PLACES = {
  workbench: { cx: 220, cy: 140, width: 140, height: 44 },
  dock: { cx: 220, cy: 320, width: 140, height: 44 },
  sealed: { cx: 220, cy: 500, width: 140, height: 44 },
  
  "front-office": { cx: 780, cy: 140, width: 140, height: 44 },
  "pr-desk": { cx: 780, cy: 260, width: 140, height: 44 },
  robot: { cx: 650, cy: 380, width: 140, height: 44 },
  review: { cx: 910, cy: 380, width: 140, height: 44 },
  shared: { cx: 780, cy: 500, width: 140, height: 44 },
};

type FlowData = { d: string; labelPos: { x: number; y: number }; labelWidth?: number };
const FLOWS: Record<string, FlowData> = {
  edit: { d: "M 220,40 L 220,110", labelPos: { x: 260, y: 75 }, labelWidth: 50 },
  add: { d: "M 220,170 L 220,290", labelPos: { x: 220, y: 230 }, labelWidth: 50 },
  commit: { d: "M 220,350 L 220,470", labelPos: { x: 220, y: 410 }, labelWidth: 64 },
  branch: { d: "M 295,500 C 360,500 360,440 305,470", labelPos: { x: 345, y: 470 }, labelWidth: 104 },
  push: { d: "M 300,470 L 700,470", labelPos: { x: 500, y: 470 }, labelWidth: 50 },
  fetch: { d: "M 700,500 L 300,500", labelPos: { x: 500, y: 500 }, labelWidth: 50 },
  pull: { d: "M 700,530 L 300,530", labelPos: { x: 500, y: 530 }, labelWidth: 50 },
  inspect: { d: "M 140,500 C 40,500 40,140 140,140", labelPos: { x: 75, y: 320 }, labelWidth: 64 },
  issue: { d: "M 740,115 C 500,20 300,20 230,35", labelPos: { x: 480, y: 35 }, labelWidth: 50 },
  open_pr: { d: "M 780,470 L 780,290", labelPos: { x: 780, y: 320 }, labelWidth: 70 },
  checks: { d: "M 730,285 L 670,355", labelPos: { x: 685, y: 310 }, labelWidth: 60 },
  do_review: { d: "M 730,380 L 830,380", labelPos: { x: 780, y: 395 }, labelWidth: 60 },
  merge: { d: "M 880,410 L 810,475", labelPos: { x: 865, y: 455 }, labelWidth: 54 },
};

export function MapView() {
  const [activePlace, setActivePlace] = useState<string | null>(null);
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  
  // Journey state
  const [activeJourney, setActiveJourney] = useState<string | null>(null);
  const [journeyStepIndex, setJourneyStepIndex] = useState(0);

  const journey = activeJourney ? mapJourneys.find(j => j.id === activeJourney) : null;
  const currentStep = journey ? journey.steps[journeyStepIndex] : null;

  // Sync active flow with journey step
  useEffect(() => {
    if (currentStep) {
      setActiveFlow(currentStep.flowId);
      setActivePlace(null);
    }
  }, [currentStep]);

  const handlePlaceClick = (id: string) => {
    if (activeJourney) return;
    setActivePlace(id);
    setActiveFlow(null);
  };

  const handleFlowClick = (id: string) => {
    if (activeJourney) return;
    setActiveFlow(id);
    setActivePlace(null);
  };

  const handleNextStep = () => {
    if (journey && journeyStepIndex < journey.steps.length - 1) {
      setJourneyStepIndex(s => s + 1);
    } else {
      setActiveJourney(null);
      setActiveFlow(null);
    }
  };

  const startJourney = (id: string) => {
    setActiveJourney(id);
    setJourneyStepIndex(0);
  };

  // Determine what is highlighted
  const isPlaceLit = (id: string) => {
    if (activePlace === id) return true;
    if (activeFlow) {
      const flow = mapFlows.find(f => f.id === activeFlow);
      return flow?.from === id || flow?.to === id;
    }
    return !activePlace && !activeFlow;
  };

  const isFlowLit = (id: string) => {
    if (activeFlow === id) return true;
    if (activePlace) {
      const flow = mapFlows.find(f => f.id === id);
      return flow?.from === activePlace || flow?.to === activePlace;
    }
    return !activePlace && !activeFlow;
  };

  const activeW5 = activePlace 
    ? mapPlaces.find(p => p.id === activePlace)?.w5 
    : activeFlow 
      ? mapFlows.find(f => f.id === activeFlow)?.w5 
      : null;

  const activeTitle = activePlace 
    ? mapPlaces.find(p => p.id === activePlace)?.label 
    : activeFlow 
      ? mapFlows.find(f => f.id === activeFlow)?.label 
      : null;

  const PLACE_ICONS: Record<string, React.ElementType> = {
    workbench: ComputerIcon,
    dock: TrayIcon,
    sealed: SealedBoxIcon,
    "front-office": CloudIcon,
    "pr-desk": ProposalIcon,
    robot: RobotIcon,
    review: UnlockIcon,
    shared: CloudIcon,
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-2 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded w-max focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-[0_0_20px_rgba(255,107,0,0.15)] border border-primary/20">
              <MapIcon className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            The Map
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            The zoomed-out forest view. Tap any place or arrow to see how it connects, or take a guided journey through the territory.
          </p>
        </div>

        {/* Journey Buttons */}
        <div className="flex flex-col gap-2 shrink-0">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1">
            <Compass className="w-3.5 h-3.5" /> Journeys
          </div>
          {mapJourneys.map(j => (
            <button 
              key={j.id}
              onClick={() => startJourney(j.id)}
              className={`text-left px-4 py-2 rounded-lg text-sm font-bold border transition-colors flex items-center justify-between gap-4 ${
                activeJourney === j.id 
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' 
                  : 'bg-black/40 border-white/10 hover:border-primary/50 text-foreground'
              }`}
            >
              {j.label}
              {activeJourney !== j.id && <PlayCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* The SVG Map Area */}
        <div className="xl:col-span-2 bg-[#0d1117] border border-white/10 rounded-xl p-4 sm:p-8 relative overflow-hidden shadow-2xl flex items-center justify-center">
          
          <svg viewBox="0 0 1000 600" className="w-full h-auto max-h-[70vh] xl:max-h-none overflow-visible select-none touch-manipulation">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-white/40" />
              </marker>
              <marker id="arrowhead-lit" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" className="text-primary" />
              </marker>
            </defs>

            {/* Regions */}
            <rect x="40" y="60" width="360" height="520" rx="16" className="fill-white/[0.02] stroke-white/10" strokeWidth="2" strokeDasharray="8 8" />
            <text x="220" y="90" className="fill-white/30 text-xs font-bold uppercase tracking-widest" textAnchor="middle">Your Computer</text>
            
            <rect x="600" y="60" width="360" height="520" rx="16" className="fill-white/[0.02] stroke-white/10" strokeWidth="2" strokeDasharray="8 8" />
            <text x="780" y="90" className="fill-white/30 text-xs font-bold uppercase tracking-widest" textAnchor="middle">The Website (GitHub)</text>

            {/* Flows */}
            {mapFlows.map(f => {
              const flowData = FLOWS[f.id];
              if (!flowData) return null;
              
              const isLit = isFlowLit(f.id);
              const isDimmed = !isLit && (activePlace || activeFlow);
              
              return (
                <g 
                  key={f.id} 
                  className={`transition-all duration-500 cursor-pointer ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
                  onClick={() => handleFlowClick(f.id)}
                >
                  <path 
                    d={flowData.d} 
                    fill="none" 
                    className={`transition-colors duration-300 stroke-[4px] ${isLit ? 'stroke-primary drop-shadow-[0_0_8px_rgba(255,107,0,0.5)]' : 'stroke-white/20 hover:stroke-white/40'}`} 
                    markerEnd={`url(#${isLit ? 'arrowhead-lit' : 'arrowhead'})`} 
                  />
                  {/* Invisible wider hit area for touch */}
                  <path d={flowData.d} fill="none" stroke="transparent" strokeWidth="30" />
                  
                  {/* Animated pulse for active flow (respects reduced motion implicitly via CSS) */}
                  {isLit && (
                    <path 
                      d={flowData.d} 
                      fill="none" 
                      className="stroke-primary stroke-[4px] opacity-60 dash-animate" 
                      strokeDasharray="15 30" 
                    />
                  )}

                  <rect 
                    x={flowData.labelPos.x - (flowData.labelWidth || 70) / 2} 
                    y={flowData.labelPos.y - 12} 
                    width={flowData.labelWidth || 70} 
                    height="24" 
                    rx="12" 
                    className={`transition-colors ${isLit ? 'fill-primary' : 'fill-[#161b22] stroke-white/10 hover:stroke-white/30'}`} 
                  />
                  <text 
                    x={flowData.labelPos.x} 
                    y={flowData.labelPos.y + 4} 
                    className={`text-[11px] font-bold font-mono transition-colors ${isLit ? 'fill-primary-foreground' : 'fill-white/60'}`} 
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
              
              const isLit = isPlaceLit(p.id);
              const isDimmed = !isLit && (activePlace || activeFlow);

              return (
                <g 
                  key={p.id} 
                  transform={`translate(${pos.cx - pos.width/2}, ${pos.cy - pos.height/2})`}
                  className={`transition-all duration-500 cursor-pointer ${isDimmed ? 'opacity-30' : 'opacity-100'} ${isLit && activePlace === p.id ? 'scale-[1.05]' : 'scale-100'}`}
                  style={{ transformOrigin: `${pos.cx}px ${pos.cy}px` }}
                  onClick={() => handlePlaceClick(p.id)}
                >
                  <rect 
                    width={pos.width} 
                    height={pos.height} 
                    rx="8" 
                    className={`transition-all duration-300 ${
                      isLit && activePlace === p.id 
                        ? 'fill-primary stroke-primary drop-shadow-[0_0_15px_rgba(255,107,0,0.4)]' 
                        : isLit 
                          ? 'fill-[#21262d] stroke-primary stroke-2 drop-shadow-[0_0_8px_rgba(255,107,0,0.2)]'
                          : 'fill-[#161b22] stroke-white/20 hover:stroke-white/40'
                    }`} 
                  />
                  <text 
                    x={pos.width/2} 
                    y={pos.height/2 + 5} 
                    className={`text-sm font-bold transition-colors ${isLit && activePlace === p.id ? 'fill-primary-foreground' : 'fill-white'}`} 
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Journey Overlay */}
          {activeJourney && journey && currentStep && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card border border-primary/50 p-4 rounded-xl shadow-2xl flex flex-col items-center text-center max-w-[90%] w-[400px] animate-in slide-in-from-bottom-8">
              <div className="text-primary font-bold text-xs uppercase tracking-widest mb-2">
                Step {journeyStepIndex + 1} of {journey.steps.length}
              </div>
              <div className="text-foreground font-medium mb-6">
                {currentStep.message}
              </div>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setActiveJourney(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:text-foreground border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleNextStep}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-colors"
                >
                  {journeyStepIndex < journey.steps.length - 1 ? 'Next Step' : 'Finish'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* W5 Information Panel */}
        <div className="xl:col-span-1 flex flex-col h-full min-h-[400px]">
          {activeW5 ? (
            <div className="bg-card border border-white/10 p-6 sm:p-8 rounded-xl shadow-xl flex-1 flex flex-col animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-primary text-xs font-bold uppercase tracking-widest mb-1">
                    {activePlace ? 'Place' : 'Operation'}
                  </div>
                  <h2 className="text-2xl font-bold text-foreground capitalize-first">{activeTitle}</h2>
                </div>
                <button 
                  onClick={() => { setActivePlace(null); setActiveFlow(null); }}
                  className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5 flex-1 text-sm sm:text-base">
                <div>
                  <span className="font-bold text-foreground block mb-1">What is it?</span>
                  <span className="text-muted-foreground">{activeW5.what}</span>
                </div>
                <div>
                  <span className="font-bold text-foreground block mb-1">Where is it?</span>
                  <span className="text-muted-foreground">{activeW5.where}</span>
                </div>
                <div>
                  <span className="font-bold text-foreground block mb-1">Why use it?</span>
                  <span className="text-muted-foreground">{activeW5.why}</span>
                </div>
                <div>
                  <span className="font-bold text-foreground block mb-1">When does this happen?</span>
                  <span className="text-muted-foreground">{activeW5.when}</span>
                </div>
                <div>
                  <span className="font-bold text-foreground block mb-1">How do you do it?</span>
                  <span className="text-muted-foreground font-mono bg-black/30 px-2 py-1 rounded text-xs">{activeW5.how}</span>
                </div>
                {activeW5.never && (
                  <div className="pt-2">
                    <span className="font-bold text-primary block mb-1">What does it NEVER do?</span>
                    <span className="text-primary/80">{activeW5.never}</span>
                  </div>
                )}
              </div>

              {activeW5.links && activeW5.links.length > 0 && (
                <div className="pt-6 mt-6 border-t border-white/10 space-y-2">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Dive Deeper</div>
                  {activeW5.links.map(l => (
                    <Link key={l.url} href={l.url} className="block w-full text-left p-3 rounded-lg bg-black/40 border border-white/5 hover:border-primary/50 text-foreground font-medium text-sm transition-colors group">
                      <div className="flex justify-between items-center">
                        {l.label}
                        <Play className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#161b22]/50 border border-white/5 border-dashed p-8 rounded-xl flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
              <MousePointer2 className="w-10 h-10 mb-4 opacity-20" />
              <p className="text-sm font-medium">
                Tap any place or arrow on the map to see exactly how it works, why it exists, and how it connects to the rest of the company's records.
              </p>
            </div>
          )}
        </div>

      </div>

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
        .capitalize-first {
          text-transform: capitalize;
        }
      `}</style>
    </div>
  );
}
