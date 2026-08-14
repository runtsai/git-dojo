import { useState } from "react";
import { ShieldAlert, Check, X, FileEdit } from "lucide-react";
import { BreakthroughContext } from "@/components/breakthrough-context";

export function ConflictsAreQuestions() {
  const [resolved, setResolved] = useState(false);
  const [finalText, setFinalText] = useState("");

  const handleResolve = (choice: 'A' | 'B' | 'Both') => {
    if (choice === 'A') setFinalText("Lunch is at noon.");
    if (choice === 'B') setFinalText("Lunch is at 1 PM.");
    if (choice === 'Both') setFinalText("Lunch is at noon for Group A, 1 PM for Group B.");
    setResolved(true);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto py-4">
      
      {!resolved ? (
        <div className="bg-[#161b22] border border-destructive/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(220,38,38,0.1)]">
          <div className="bg-destructive/10 border-b border-destructive/20 p-4 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            <h3 className="font-bold text-destructive">Merge Conflict in policy.md</h3>
          </div>
          
          <div className="p-4 sm:p-6 font-mono text-sm leading-loose">
            <div className="text-muted-foreground">Company Policy:</div>
            
            <div className="mt-4 relative flex flex-col md:block">
              <div className="text-blue-400 bg-blue-500/10 px-2 py-1 -mx-2 rounded-t font-bold">&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD (Your current version)</div>
              <div className="bg-blue-500/5 px-2 py-3 sm:py-2 -mx-2 text-white font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>Lunch is at noon.</span>
                <button onClick={() => handleResolve('A')} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 sm:py-1 rounded text-xs font-bold font-sans w-max">Keep Yours</button>
              </div>
            </div>
            
            <div className="text-muted-foreground bg-white/5 px-2 py-3 sm:py-1 -mx-2 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>=======</span>
              <button onClick={() => handleResolve('Both')} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 sm:py-0.5 rounded text-xs font-bold font-sans w-max">Combine Both</button>
            </div>
            
            <div className="relative flex flex-col md:block">
              <div className="bg-emerald-500/5 px-2 py-3 sm:py-2 -mx-2 text-white font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>Lunch is at 1 PM.</span>
                <button onClick={() => handleResolve('B')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 sm:py-1 rounded text-xs font-bold font-sans w-max">Keep Theirs</button>
              </div>
              <div className="text-emerald-400 bg-emerald-500/10 px-2 py-1 -mx-2 rounded-b font-bold">&gt;&gt;&gt;&gt;&gt;&gt;&gt; contractor-branch</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-primary/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(255,107,0,0.1)] animate-in zoom-in-95">
          <div className="bg-primary/10 border-b border-primary/20 p-4 flex items-center gap-3">
            <Check className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-primary">Conflict Resolved</h3>
          </div>
          <div className="p-6 font-mono text-sm leading-loose">
            <div className="text-muted-foreground">Company Policy:</div>
            <div className="text-white mt-2 font-medium">{finalText}</div>
          </div>
          <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
            <button onClick={() => setResolved(false)} className="text-xs text-muted-foreground hover:text-foreground font-bold font-sans">Undo (Reset Toy)</button>
          </div>
        </div>
      )}

      <div className="bg-black/40 border border-white/10 p-6 rounded-lg flex items-start gap-4">
        <FileEdit className="w-6 h-6 text-primary shrink-0" />
        <p className="text-sm text-foreground/90 leading-relaxed font-medium">
          A conflict isn't an error. It's Git saying, <span className="text-primary italic">"Two people changed the exact same line, and I refuse to guess who is right."</span> It literally pauses the merge, inserts those markers into the text file, and hands you the pen. You just delete the markers, leave the text you want, and hit save.
        </p>
      </div>

      <BreakthroughContext>
        <p>Git is designed with absolute paranoia about losing your data. If two people edit the exact same line of the compliance manual in different ways, Git refuses to guess which one is correct because guessing wrong means destroying company records.</p>
        <p>It safely pauses the merge, highlights the exact disagreement, and hands you the pen. This fail-closed design guarantees that no contractor or employee can silently overwrite someone else's work—a human owner always has to make the final call.</p>
      </BreakthroughContext>
    </div>
  );
}
