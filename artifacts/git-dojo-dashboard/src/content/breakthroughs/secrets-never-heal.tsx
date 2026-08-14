import { useState } from "react";
import { BreakthroughContext } from "@/components/breakthrough-context";
import { ShieldAlert, Trash2, Key, CheckCircle2, History, MousePointer2 } from "lucide-react";

type Phase = 'initial' | 'committed' | 'deleted' | 'revoked';

export function SecretsNeverHeal() {
  const [phase, setPhase] = useState<Phase>('initial');
  const [viewingCommit, setViewingCommit] = useState<number>(1);

  const handleCommitSecret = () => {
    setPhase('committed');
    setViewingCommit(1);
  };

  const handleDeleteAndCommit = () => {
    setPhase('deleted');
    setViewingCommit(2); // Automatically show the new commit where it's "deleted"
  };

  const handleRevoke = () => {
    setPhase('revoked');
  };

  const reset = () => {
    setPhase('initial');
    setViewingCommit(1);
  };

  // Determine what file content to show based on the commit we are VIEWING, 
  // NOT necessarily the current phase (except in initial phase before any commits).
  const showSecretInFile = (phase === 'initial') || viewingCommit === 1;

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto py-4">
      
      {/* Visceral Alert Area */}
      {phase !== 'initial' && (
        <div className={`p-4 sm:p-6 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all duration-500 animate-in slide-in-from-top-4 shadow-2xl ${
          phase === 'revoked' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10' 
            : 'bg-[#450a0a] border-[#7f1d1d] text-[#fecaca] shadow-[0_0_40px_rgba(220,38,38,0.2)]'
        }`}>
          {phase === 'revoked' ? (
            <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-8 h-8 shrink-0 text-[#f87171] animate-pulse" />
          )}
          <div className="flex-1">
            <h3 className="font-extrabold text-lg sm:text-xl mb-1">
              {phase === 'revoked' ? 'Secret Revoked Successfully' : 'CRITICAL: EXPOSED SECRET DETECTED'}
            </h3>
            <p className={`text-sm sm:text-base font-medium ${phase === 'revoked' ? 'text-emerald-400/80' : 'text-[#fca5a5]/90'}`}>
              {phase === 'revoked' 
                ? 'The exposed key is now permanently dead. Even though it remains in history, it cannot be used by attackers.'
                : 'A live API key was found in config.ts (Line 3). Automated scanning has flagged this repository as compromised.'}
            </p>
          </div>
          {phase === 'revoked' && (
            <button onClick={reset} className="mt-4 sm:mt-0 text-sm font-bold border border-emerald-500/50 px-4 py-2 rounded hover:bg-emerald-500/20 transition-colors shrink-0">
              Reset Toy
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        
        {/* Editor / File Viewer */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <div className="bg-[#21262d] border-b border-white/10 p-4 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/50" />
            <span className="font-mono text-sm text-white/60 ml-2">config.ts</span>
            {phase !== 'initial' && (
              <span className="ml-auto bg-black/50 text-muted-foreground text-xs font-bold px-2 py-1 rounded border border-white/5">
                Viewing Snapshot {viewingCommit}
              </span>
            )}
          </div>
          <div className="p-4 sm:p-6 flex-1 font-mono text-sm sm:text-base leading-relaxed overflow-x-auto text-white/80 relative">
            <div><span className="text-purple-400">export const</span> config = {'{'}</div>
            <div className="pl-4">env: <span className="text-emerald-400">'production'</span>,</div>
            
            {showSecretInFile ? (
              <div className="pl-4 bg-red-500/20 -mx-4 px-4 py-1 border-l-4 border-red-500 text-white animate-in fade-in">
                apiKey: <span className="text-red-300">'rts_live_key_EXAMPLE_0000'</span>, <span className="text-red-400/50 text-xs sm:text-sm ml-2">// &lt;-- DANGER</span>
              </div>
            ) : (
              <div className="pl-4 bg-emerald-500/10 -mx-4 px-4 py-1 border-l-4 border-emerald-500 animate-in fade-in">
                apiKey: <span className="text-emerald-300">process.env.API_KEY</span>, <span className="text-emerald-400/50 text-xs sm:text-sm ml-2">// &lt;-- Fixed</span>
              </div>
            )}
            
            <div>{'}'};</div>
          </div>
        </div>

        {/* Timeline & Controls */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-4 sm:p-6 flex flex-col gap-6">
          <div className="flex items-center gap-2 text-foreground font-bold border-b border-white/10 pb-4">
            <History className="w-5 h-5 text-primary" /> Repository History
          </div>

          <div className="space-y-4 flex-1">
            {phase === 'initial' ? (
              <div className="text-muted-foreground text-sm flex flex-col items-center justify-center h-full text-center gap-4 animate-in fade-in">
                <p>You accidentally pasted a live API key into the config file while testing.</p>
                <button 
                  onClick={handleCommitSecret}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
                >
                  <CheckCircle2 className="w-4 h-4" /> Stage & Commit
                </button>
              </div>
            ) : (
              <div className="space-y-4 relative">
                
                {/* Commit 2 (The "Fix") */}
                {(phase === 'deleted' || phase === 'revoked') && (
                  <div className="relative">
                    <div className="absolute left-6 top-full h-4 w-0.5 bg-white/10" />
                    <button 
                      onClick={() => setViewingCommit(2)}
                      className={`w-full text-left p-4 rounded-lg border transition-all flex items-center gap-4 ${
                        viewingCommit === 2 
                          ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(255,107,0,0.1)]' 
                          : 'bg-[#161b22] border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${viewingCommit === 2 ? 'bg-primary ring-4 ring-primary/20' : 'bg-white/20'}`} />
                      <div>
                        <div className="font-bold text-foreground">Remove accidentally committed API key</div>
                        <div className="text-xs font-mono text-muted-foreground mt-1">Snapshot 2</div>
                      </div>
                    </button>
                  </div>
                )}

                {/* Commit 1 (The Mistake) */}
                <div className="relative">
                  <button 
                    onClick={() => setViewingCommit(1)}
                    className={`w-full text-left p-4 rounded-lg border transition-all flex items-center gap-4 ${
                      viewingCommit === 1 
                        ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(255,107,0,0.1)]' 
                        : 'bg-[#161b22] border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${viewingCommit === 1 ? 'bg-primary ring-4 ring-primary/20' : 'bg-white/20'}`} />
                    <div className="flex-1">
                      <div className="font-bold text-foreground">Update config file</div>
                      <div className="text-xs font-mono text-muted-foreground mt-1">Snapshot 1</div>
                    </div>
                    {phase === 'deleted' && viewingCommit === 1 && (
                      <div className="text-destructive font-bold text-xs bg-destructive/20 px-2 py-1 rounded border border-destructive/30 animate-pulse">
                        Secret Still Here
                      </div>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Area */}
          {phase === 'committed' && (
            <div className="pt-4 border-t border-white/10 animate-in slide-in-from-bottom-2">
              <button 
                onClick={handleDeleteAndCommit}
                className="w-full bg-secondary hover:bg-secondary/80 text-foreground font-bold px-6 py-4 rounded-lg flex justify-center items-center gap-2 border border-white/10 transition-colors"
              >
                <Trash2 className="w-5 h-5" /> Delete key and commit again
              </button>
            </div>
          )}

          {phase === 'deleted' && (
            <div className="pt-4 border-t border-white/10 space-y-4 animate-in slide-in-from-bottom-2">
              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-start gap-3">
                <MousePointer2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-primary-foreground/90">
                  Click <span className="font-bold">Snapshot 1</span> above. The key is permanently burned into the old photograph. Deleting it in Snapshot 2 doesn't erase the past.
                </p>
              </div>
              <button 
                onClick={handleRevoke}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-4 rounded-lg flex justify-center items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Key className="w-5 h-5" /> Revoke Key in Provider Dashboard
              </button>
            </div>
          )}

        </div>
      </div>

      <BreakthroughContext>
        <p>Because Git takes permanent photographs of your repository, deleting a password in a *new* commit does absolutely nothing to protect you. The password is still perfectly readable to anyone looking at the old snapshot.</p>
        <p>For your company's security, you must treat any accidentally committed secret as permanently burned. Do not waste time trying to magically rewrite the Git history—this is extremely difficult and error-prone. Instead, immediately log into your cloud provider (AWS, Stripe, etc.) and kill (revoke) the key. A dead key in your history is perfectly safe because it no longer unlocks anything.</p>
      </BreakthroughContext>
    </div>
  );
}
