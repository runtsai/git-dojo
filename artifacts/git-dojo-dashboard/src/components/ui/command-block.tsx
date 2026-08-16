import { useState } from "react";
import { Check, Copy, ArrowRight, Eye } from "lucide-react";

/**
 * WHERE/WHAT badge for git commands, using the Map's place vocabulary.
 * Auto-detected from the command text so every command block in the app
 * consistently shows which places the command touches — at a glance.
 */
type PlaceBadge =
  | { kind: "move"; from: string; to: string; what: string }
  | { kind: "look"; where: string; what: string }
  | { kind: "stay"; where: string; what: string };

const GIT_BADGES: Record<string, PlaceBadge> = {
  add: { kind: "move", from: "Workbench", to: "Loading Dock", what: "Stages a snapshot of the file — your actual file is untouched" },
  commit: { kind: "move", from: "Loading Dock", to: "Sealed Record", what: "Seals what's staged into permanent local history — GitHub doesn't know yet" },
  push: { kind: "move", from: "Sealed Record", to: "Shared Record", what: "Uploads your sealed commits to GitHub" },
  fetch: { kind: "move", from: "Shared Record", to: "Sealed Record", what: "Downloads GitHub's commits safely — never touches your Workbench files" },
  pull: { kind: "move", from: "Shared Record", to: "Sealed Record", what: "Downloads AND merges GitHub's commits into your current branch" },
  clone: { kind: "move", from: "Shared Record", to: "Workbench", what: "Copies a whole repository from GitHub onto your machine" },
  checkout: { kind: "move", from: "Sealed Record", to: "Workbench", what: "Loads a snapshot or branch onto your Workbench" },
  switch: { kind: "move", from: "Sealed Record", to: "Workbench", what: "Moves your Workbench to another branch's timeline" },
  restore: { kind: "move", from: "Sealed Record", to: "Workbench", what: "Recovers files from the record — or unstages them from the Loading Dock" },
  status: { kind: "look", where: "Workbench + Loading Dock", what: "Looks only — moves nothing" },
  log: { kind: "look", where: "Sealed Record", what: "Looks only — moves nothing" },
  diff: { kind: "look", where: "Workbench", what: "Looks only — moves nothing" },
  show: { kind: "look", where: "Sealed Record", what: "Looks only — moves nothing" },
  remote: { kind: "look", where: "Shared Record", what: "Lists or edits which GitHub copies this repo knows about" },
  branch: { kind: "stay", where: "Sealed Record", what: "Creates or lists timeline stickers — entirely on your machine" },
  merge: { kind: "stay", where: "Sealed Record", what: "Joins two timelines into your local history" },
  init: { kind: "stay", where: "Workbench", what: "Gives this folder a memory — creates an empty Sealed Record" },
};

function detectBadge(command: string): PlaceBadge | null {
  const m = /(?:^|&&|;|\|)\s*git\s+([a-z-]+)/.exec(command);
  if (!m) return null;
  return GIT_BADGES[m[1] ?? ""] ?? null;
}

export function CommandBlock({ command, step, badge = true }: { command: string; step?: number; badge?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const placeBadge = badge ? detectBadge(command) : null;

  return (
    <div className="relative group w-full min-w-0">
      {placeBadge && (
        <div className="flex justify-end mb-1" title={placeBadge.what}>
          <span
            aria-label={placeBadge.what}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-white/[0.04] border border-white/10 rounded px-1.5 py-0.5 cursor-help"
          >
            {placeBadge.kind === "move" ? (
              <>
                {placeBadge.from} <ArrowRight className="w-3 h-3 text-primary" /> {placeBadge.to}
              </>
            ) : placeBadge.kind === "look" ? (
              <>
                <Eye className="w-3 h-3 text-sky-400" /> looks at {placeBadge.where}
              </>
            ) : (
              <>acts on {placeBadge.where}</>
            )}
          </span>
        </div>
      )}
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
