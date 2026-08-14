import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CommandBlock({ command, step }: { command: string; step?: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group w-full min-w-0">
      {step !== undefined && (
        <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">
          {step}
        </div>
      )}
      <div className="bg-black/80 border border-white/10 shadow-inner font-mono p-4 rounded-lg text-left text-sm md:text-base flex items-center justify-between w-full group-hover:border-primary/30 transition-colors min-w-0">
        <div className="flex gap-4 overflow-x-auto whitespace-nowrap pr-4 scrollbar-hide min-w-0 flex-1">
          <span className="text-primary font-bold select-none shrink-0">$</span>
          <span className="text-emerald-400">{command}</span>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors active:scale-95 ml-2"
          aria-label="Copy command"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
