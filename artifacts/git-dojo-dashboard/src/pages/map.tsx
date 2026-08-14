import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Play, X, Map as MapIcon, Compass, PlayCircle, MousePointer2, ChevronDown } from "lucide-react";
import { mapPlaces, mapFlows, mapJourneys, W5 } from "@/content/map";
import { 
  ComputerIcon, TrayIcon, SealedBoxIcon, CloudIcon, 
  ProposalIcon, RobotIcon, UnlockIcon, LockIcon, StickerIcon
} from "@/components/git-icons";

// Diagram coordinates
const PLACES = {
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
const FLOWS: Record<string, FlowData> = {
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

export function MapView() {
  const [activePlace, setActivePlace] = useState<string | null>(null);
  const [activeFlow, setActiveFlow] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  
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
              className={`text-left px-4 py-3 min-h-[44px] rounded-xl text-sm font-bold border transition-colors flex items-center justify-between gap-4 ${
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

      <div className="flex flex-col lg:hidden w-full bg-primary/10 border border-primary/20 text-primary p-4 rounded-xl text-sm items-center justify-between gap-4 mb-4 shadow-sm">
        <span className="font-bold text-base">Explore the Map</span>
        <button 
          onClick={() => setIsZoomed(!isZoomed)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 min-h-[44px] rounded-xl font-bold transition-all w-full text-center shadow-md shadow-primary/20"
        >
          {isZoomed ? 'Show Overview' : 'Zoom in & Pan freely'}
        </button>
      </div>

      {/* Desktop Legend (Collapsible on Mobile via state, but initially shown on desktop) */}
      <div className="hidden lg:flex w-full bg-[#161b22] border border-white/10 p-4 rounded-xl flex-wrap gap-x-8 gap-y-4 items-center justify-center text-sm text-muted-foreground mb-2">
        <span className="font-bold text-foreground mr-2">Legend:</span>
        <div className="flex items-center gap-2"><ComputerIcon className="w-5 h-5 text-primary" /> Working Folder</div>
        <div className="flex items-center gap-2"><TrayIcon className="w-5 h-5 text-primary" /> Staging</div>
        <div className="flex items-center gap-2"><SealedBoxIcon className="w-5 h-5 text-primary" /> Sealed Record</div>
        <div className="flex items-center gap-2"><CloudIcon className="w-5 h-5 text-primary" /> Shared / Web</div>
        <div className="flex items-center gap-2"><ProposalIcon className="w-5 h-5 text-primary" /> Proposal (PR)</div>
        <div className="flex items-center gap-2"><RobotIcon className="w-5 h-5 text-primary" /> Automation</div>
        <div className="flex items-center gap-2"><UnlockIcon className="w-5 h-5 text-primary" /> Approval</div>
      </div>

      <div className="flex flex-col lg:hidden w-full bg-[#161b22] border border-white/10 rounded-xl mb-4 overflow-hidden">
        <button 
          onClick={() => setLegendOpen(!legendOpen)}
          className="w-full flex items-center justify-between p-4 font-bold text-foreground text-sm"
        >
          <span>Map Legend</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${legendOpen ? 'rotate-180' : ''}`} />
        </button>
        {legendOpen && (
          <div className="p-4 pt-0 grid grid-cols-2 gap-4 text-sm text-muted-foreground border-t border-white/5 mt-2 pt-4">
            <div className="flex items-center gap-2"><ComputerIcon className="w-5 h-5 text-primary" /> Working Folder</div>
            <div className="flex items-center gap-2"><TrayIcon className="w-5 h-5 text-primary" /> Staging</div>
            <div className="flex items-center gap-2"><SealedBoxIcon className="w-5 h-5 text-primary" /> Sealed Record</div>
            <div className="flex items-center gap-2"><CloudIcon className="w-5 h-5 text-primary" /> Shared / Web</div>
            <div className="flex items-center gap-2"><ProposalIcon className="w-5 h-5 text-primary" /> Proposal (PR)</div>
            <div className="flex items-center gap-2"><RobotIcon className="w-5 h-5 text-primary" /> Automation</div>
            <div className="flex items-center gap-2"><UnlockIcon className="w-5 h-5 text-primary" /> Approval</div>
          </div>
        )}
      </div>

      <div className="flex flex-col w-full gap-6">
        
        {/* The SVG Map Area */}
        <div className={`w-full bg-[#0d1117] border border-white/10 rounded-xl p-4 sm:p-8 relative shadow-2xl flex items-center justify-center ${isZoomed ? 'overflow-x-auto overflow-y-auto' : 'overflow-hidden'}`}>
          
          <svg 
            viewBox="0 0 1400 860" 
            className={`h-auto max-h-[80vh] overflow-visible select-none touch-manipulation transition-all duration-300 ${isZoomed ? 'w-[1400px] min-w-[1400px]' : 'w-full max-w-full'}`}
            aria-hidden={!isZoomed && typeof window !== 'undefined' && window.innerWidth < 1024 ? "true" : "false"}
          >
            <defs>
              <marker id="arrowhead" markerWidth="16" markerHeight="12" refX="15" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                <polygon points="0 0, 16 6, 0 12" fill="currentColor" className="text-white/40" />
              </marker>
              <marker id="arrowhead-lit" markerWidth="16" markerHeight="12" refX="15" refY="6" orient="auto" markerUnits="userSpaceOnUse">
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
              
              const isLit = isFlowLit(f.id);
              const isDimmed = !isLit && (activePlace || activeFlow);
              
              return (
                <g 
                  key={f.id} 
                  role="button"
                  tabIndex={0}
                  aria-label={`Flow: ${f.label}`}
                  aria-pressed={isLit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFlowClick(f.id);
                    }
                  }}
                  className={`transition-all duration-500 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1117] rounded-xl group ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
                  onClick={() => handleFlowClick(f.id)}
                >
                  {/* Subtle directional flow dashed line on hover (respects motion preference) */}
                  <path 
                    d={flowData.d} 
                    fill="none" 
                    className={`stroke-white/10 stroke-[4px] motion-safe:group-hover:dash-animate hidden group-hover:block transition-opacity duration-300 ${isLit ? 'opacity-0' : 'opacity-100'}`}
                    strokeDasharray="8 16" 
                  />
                  
                  <path 
                    d={flowData.d} 
                    fill="none" 
                    className={`transition-colors duration-300 stroke-[4px] ${isLit ? 'stroke-primary drop-shadow-[0_0_12px_rgba(255,107,0,0.6)]' : 'stroke-white/20 group-hover:stroke-white/40'}`} 
                    markerEnd={`url(#${isLit ? 'arrowhead-lit' : 'arrowhead'})`} 
                  />
                  {/* Invisible wider hit area for touch */}
                  <path d={flowData.d} fill="none" stroke="transparent" strokeWidth="44" />
                  
                  {/* Animated pulse for active flow (respects reduced motion implicitly via CSS) */}
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
                    className={`transition-colors ${isLit ? 'fill-[#161b22] stroke-primary shadow-[0_0_10px_rgba(255,107,0,0.3)]' : 'fill-[#161b22] stroke-white/10 group-hover:stroke-white/30'}`} 
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
              
              const isLit = isPlaceLit(p.id);
              const isDimmed = !isLit && (activePlace || activeFlow);
              const Icon = PLACE_ICONS[p.id];

              return (
                <g 
                  key={p.id} 
                  transform={`translate(${pos.cx - pos.width/2}, ${pos.cy - pos.height/2})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Place: ${p.label}`}
                  aria-pressed={isLit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handlePlaceClick(p.id);
                    }
                  }}
                  className={`transition-all duration-500 cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1117] rounded-xl group ${isDimmed ? 'opacity-30' : 'opacity-100'} ${isLit && activePlace === p.id ? 'scale-[1.05]' : 'scale-100'}`}
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
                          : 'fill-[#161b22] stroke-white/20 group-hover:stroke-white/40'
                    }`} 
                  />
                  <foreignObject x="0" y="0" width={pos.width} height={pos.height} className="pointer-events-none">
                     <div className={`w-full h-full flex items-center justify-center gap-3 px-4 ${isLit && activePlace === p.id ? 'text-primary-foreground' : isLit ? 'text-white' : 'text-white/80'}`}>
                        {Icon && <Icon className="w-6 h-6 shrink-0" />}
                        <span className="text-base font-bold whitespace-nowrap">{p.label}</span>
                     </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* Journey Overlay */}
          {activeJourney && journey && currentStep && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card border border-primary/50 p-6 rounded-xl shadow-2xl flex flex-col items-center text-center max-w-[90%] w-[400px] animate-in slide-in-from-bottom-8 z-10">
              <div className="text-primary font-bold text-xs uppercase tracking-widest mb-2">
                Step {journeyStepIndex + 1} of {journey.steps.length}
              </div>
              <div className="text-foreground font-medium mb-6 text-lg">
                {currentStep.message}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button 
                  onClick={() => setActiveJourney(null)}
                  className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-bold text-muted-foreground hover:text-foreground border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleNextStep}
                  className="flex-1 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-colors"
                >
                  {journeyStepIndex < journey.steps.length - 1 ? 'Next Step' : 'Finish'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Alternate Map UI - Chip List (only visible when unzoomed on phone) */}
        {!isZoomed && (
          <div className="lg:hidden flex flex-col gap-8 w-full animate-in fade-in">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground border-b border-white/10 pb-2">Your Computer</h3>
              <div className="grid grid-cols-1 gap-3">
                {mapPlaces.filter(p => ["workbench", "dock", "sealed"].includes(p.id)).map(p => {
                  const Icon = PLACE_ICONS[p.id];
                  const isLit = isPlaceLit(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePlaceClick(p.id)}
                      className={`min-h-[56px] flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left w-full ${isLit ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(255,107,0,0.15)]' : 'bg-[#161b22] border-white/10 text-muted-foreground hover:border-white/30 hover:text-white'}`}
                    >
                      <Icon className={`w-6 h-6 shrink-0 ${isLit ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-bold text-base">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground border-b border-white/10 pb-2">The Website (GitHub)</h3>
              <div className="grid grid-cols-1 gap-3">
                {mapPlaces.filter(p => ["front-office", "pr-desk", "robot", "review", "shared"].includes(p.id)).map(p => {
                  const Icon = PLACE_ICONS[p.id];
                  const isLit = isPlaceLit(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePlaceClick(p.id)}
                      className={`min-h-[56px] flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left w-full ${isLit ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(255,107,0,0.15)]' : 'bg-[#161b22] border-white/10 text-muted-foreground hover:border-white/30 hover:text-white'}`}
                    >
                      <Icon className={`w-6 h-6 shrink-0 ${isLit ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-bold text-base">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground border-b border-white/10 pb-2">Common Flows</h3>
              <div className="flex flex-wrap gap-3">
                {mapFlows.map(f => {
                  const isLit = isFlowLit(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleFlowClick(f.id)}
                      className={`min-h-[44px] px-5 py-2 rounded-xl font-bold font-mono text-sm border transition-all ${isLit ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'bg-[#161b22] border-white/10 text-muted-foreground hover:border-white/30 hover:text-white'}`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* W5 Information Panel */}
        <div className="xl:col-span-1 flex flex-col h-full min-h-[400px]">
          {activeW5 ? (
            <div className="bg-card border border-white/10 p-6 sm:p-8 rounded-xl shadow-xl flex-1 flex flex-col animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  {activePlace && PLACE_ICONS[activePlace] && (
                    <div className="p-3 bg-primary/10 rounded-xl text-primary border border-primary/20">
                      {(() => {
                        const ActiveIcon = PLACE_ICONS[activePlace];
                        return <ActiveIcon className="w-6 h-6" />;
                      })()}
                    </div>
                  )}
                  <div>
                    <div className="text-primary text-xs font-bold uppercase tracking-widest mb-1">
                      {activePlace ? 'Place' : 'Operation'}
                    </div>
                    <h2 className="text-2xl font-bold text-foreground capitalize-first">{activeTitle}</h2>
                  </div>
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
            <div className="bg-[#161b22]/50 border border-white/5 border-dashed p-8 rounded-xl flex-1 flex flex-col items-center justify-center text-center text-muted-foreground animate-in fade-in">
              <div className="w-full max-w-[280px] aspect-video relative flex items-center justify-between mb-8 opacity-80">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10"><ComputerIcon className="w-8 h-8" /></div>
                  <span className="font-bold text-xs uppercase tracking-widest">Local</span>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                    Push <ArrowLeft className="w-3 h-3 rotate-180" />
                  </div>
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
                    <ArrowLeft className="w-3 h-3" /> Pull
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10"><CloudIcon className="w-8 h-8" /></div>
                  <span className="font-bold text-xs uppercase tracking-widest">Remote</span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Explore the Territory</h3>
              <p className="text-sm font-medium leading-relaxed max-w-sm">
                Tap any place or arrow on the map to see exactly how it works, why it exists, and how it connects to the rest of the company's records. Or use the Legend above to decode the icons.
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
