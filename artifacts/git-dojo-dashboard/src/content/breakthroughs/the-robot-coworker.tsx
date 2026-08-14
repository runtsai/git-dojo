import { useState, useRef, useEffect } from "react";
import { BreakthroughContext } from "@/components/breakthrough-context";
import { GitPullRequest, CheckCircle2, XCircle, Terminal, RotateCcw, Merge } from "lucide-react";

type RunState = 'idle' | 'running' | 'success' | 'failed' | 'merged';

export function TheRobotCoworker() {
  const [scenario, setScenario] = useState<'clean' | 'broken'>('clean');
  const [runState, setRunState] = useState<RunState>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  const runSimulation = (willPass: boolean) => {
    clearTimeouts();
    setRunState('running');
    setLogs(['[System] Booting virtual environment...']);

    const t1 = setTimeout(() => {
      setLogs(prev => [...prev, '[Setup] Installing dependencies (npm install)...']);
      
      const t2 = setTimeout(() => {
        setLogs(prev => [...prev, '[Test] Running test suite...']);
        
        const t3 = setTimeout(() => {
          if (willPass) {
            setLogs(prev => [...prev, '[Result] ✅ All 42 tests passed.', '[System] Checks completed successfully.']);
            setRunState('success');
          } else {
            setLogs(prev => [...prev, '[Result] ❌ FAIL: src/auth.ts line 14', '       Expected user.isAuthenticated to be true, got false.', '[System] Checks failed.']);
            setRunState('failed');
          }
        }, 1500);
        timeoutsRef.current.push(t3);
      }, 1000);
      timeoutsRef.current.push(t2);
    }, 800);
    timeoutsRef.current.push(t1);
  };

  const handleOpenPR = () => runSimulation(scenario === 'clean');
  const handleFixAndPush = () => runSimulation(true);
  const handleReset = () => {
    clearTimeouts();
    setRunState('idle');
    setLogs([]);
  };

  const toggleScenario = (newScenario: 'clean' | 'broken') => {
    setScenario(newScenario);
    handleReset();
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto py-4">
      
      {/* Configuration */}
      <div className="flex justify-center">
        <div className="bg-black/40 p-1 rounded-lg border border-white/10 flex flex-col sm:flex-row w-full sm:w-auto">
          <button
            onClick={() => toggleScenario('clean')}
            disabled={runState === 'running'}
            className={`flex-1 px-6 py-2 rounded-md font-bold text-sm transition-colors ${
              scenario === 'clean' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground disabled:opacity-50'
            }`}
          >
            Send Clean Code
          </button>
          <button
            onClick={() => toggleScenario('broken')}
            disabled={runState === 'running'}
            className={`flex-1 px-6 py-2 rounded-md font-bold text-sm transition-colors ${
              scenario === 'broken' ? 'bg-secondary text-foreground border-white/10' : 'text-muted-foreground hover:text-foreground disabled:opacity-50'
            }`}
          >
            Send Broken Test
          </button>
        </div>
      </div>

      {/* PR Window Simulator */}
      <div className="bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-[#161b22] border-b border-white/10 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
              Update login flow <span className="text-muted-foreground font-normal">#42</span>
            </h3>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 text-xs">
                <GitPullRequest className="w-3 h-3" /> Open
              </span>
              <span className="text-muted-foreground font-mono">contractor-branch</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="text-muted-foreground font-mono">main</span>
            </div>
          </div>
          
          {runState === 'idle' && (
            <button 
              onClick={handleOpenPR}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shrink-0"
            >
              Open Pull Request
            </button>
          )}
          {runState === 'failed' && (
            <button 
              onClick={handleFixAndPush}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shrink-0 shadow-lg shadow-primary/20 animate-in fade-in"
            >
              <RotateCcw className="w-4 h-4" /> Fix test & push
            </button>
          )}
          {runState === 'merged' && (
            <button 
              onClick={handleReset}
              className="bg-secondary hover:bg-white/10 text-foreground px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors shrink-0 border border-white/10 animate-in fade-in"
            >
              <RotateCcw className="w-4 h-4" /> Run it again
            </button>
          )}
        </div>

        {/* Checks Section */}
        <div className="p-4 sm:p-6 flex flex-col gap-4">
          <div className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            Checks <span className="bg-white/10 text-white/70 px-2 py-0.5 rounded-full text-xs">1</span>
          </div>

          {runState === 'idle' ? (
            <div className="border border-white/5 bg-white/[0.02] p-8 rounded-lg text-center text-muted-foreground text-sm italic">
              Checks will run automatically when the Pull Request is opened.
            </div>
          ) : (
            <div className="flex flex-col gap-4 animate-in slide-in-from-top-4">
              
              <div className={`border p-4 rounded-lg flex items-center gap-3 transition-colors ${
                runState === 'running' ? 'bg-[#161b22] border-white/10' :
                runState === 'success' ? 'bg-emerald-500/5 border-emerald-500/30' :
                'bg-destructive/10 border-destructive/30'
              }`}>
                {runState === 'running' && (
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-none motion-safe:animate-spin" />
                )}
                {runState === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {runState === 'failed' && <XCircle className="w-5 h-5 text-destructive" />}
                
                <div className="flex-1 font-bold text-sm text-foreground">
                  {runState === 'running' ? 'Company Quality Gate is running...' :
                   runState === 'success' ? 'All checks have passed' :
                   'Company Quality Gate failed'}
                </div>
              </div>

              {/* Live Terminal */}
              <div className="bg-black border border-white/10 rounded-lg p-4 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto h-40 flex flex-col">
                <div className="text-muted-foreground flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                  <Terminal className="w-4 h-4" /> Build Output
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {logs.map((log, i) => (
                    <div key={i} className={`animate-in fade-in ${
                      log.includes('✅') ? 'text-emerald-400 font-bold' : 
                      log.includes('❌') ? 'text-destructive font-bold' : 
                      'text-white/70'
                    }`}>
                      {log}
                    </div>
                  ))}
                  {runState === 'running' && (
                    <div className="text-white/30 animate-pulse">_</div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer / Merge Action */}
        <div className="bg-[#161b22] p-4 sm:p-6 border-t border-white/10">
          <div className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
            runState === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 
            runState === 'merged' ? 'bg-[#8957e5]/10 border-[#8957e5]/30' : 
            'bg-black/40 border-white/5'
          }`}>
            <div className="flex items-start sm:items-center gap-3">
              <Merge className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${runState === 'success' ? 'text-emerald-400' : runState === 'merged' ? 'text-[#8957e5]' : 'text-muted-foreground'}`} />
              <div>
                <div className="font-bold text-sm sm:text-base text-foreground">
                  {runState === 'success' ? 'Pull Request successfully reviewed' : 
                   runState === 'merged' ? 'Pull Request successfully merged and closed' : 
                   'Merging is blocked'}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {runState === 'success' ? 'All requirements met.' : 
                   runState === 'merged' ? 'You’re all set—the contractor’s code is now part of the main line.' : 
                   'Required status checks must pass before merging.'}
                </div>
              </div>
            </div>
            
            {runState === 'merged' ? (
              <div className="px-6 py-2.5 rounded-lg font-bold text-sm text-[#8957e5] bg-[#8957e5]/20 border border-[#8957e5]/30 shrink-0 text-center animate-in zoom-in-95 flex items-center justify-center gap-2">
                <Merge className="w-4 h-4" /> Merged
              </div>
            ) : (
              <button 
                onClick={() => setRunState('merged')}
                disabled={runState !== 'success'}
                className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all shrink-0 ${
                  runState === 'success' 
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 cursor-pointer' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/10'
                }`}
              >
                Merge Pull Request
              </button>
            )}
          </div>
        </div>
      </div>

      <BreakthroughContext>
        <p>Those green checkmarks on GitHub aren't just aesthetic tags someone clicks. They are the output of a robot coworker (CI/CD pipelines, GitHub Actions) that automatically boots up, downloads the proposed code, and runs your company's automated tests and rules.</p>
        <p>For a business, this is the ultimate quality gate. Instead of manually checking if a contractor broke the login page, you write a test. The robot enforces that test ruthlessly on every single Pull Request, physically blocking the merge button until the code proves it is safe to join your main company timeline.</p>
      </BreakthroughContext>
    </div>
  );
}
