import React, { ReactNode } from 'react';
import { GitBranch, GitCommit, FileText, Code, Settings } from 'lucide-react';

export function SimRepoContainer({ children }: { children: ReactNode }) {
  return (
    <div className="sim-window text-left">
      {children}
    </div>
  );
}

export function SimRepoHeader({ repoName = "rts-records/company-handbook", rightSlot }: { repoName?: string, rightSlot?: ReactNode }) {
  return (
    <div className="sim-chrome justify-between">
      <div className="flex items-center gap-2">
        <div className="sim-chrome-dots">
          <div className="close"></div>
          <div className="min"></div>
          <div className="max"></div>
        </div>
        <div className="flex items-center gap-2 text-white/80 text-sm ml-2">
          <span className="font-bold text-white">{repoName.split('/')[0]}</span> 
          <span className="text-muted-foreground">/</span> 
          <span className="font-bold text-white">{repoName.split('/')[1] || ''}</span>
        </div>
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </div>
  );
}

export function SimRepoPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
      {children}
    </div>
  );
}

export function SimRepoMain({ children }: { children: ReactNode }) {
  return <div className="md:col-span-3 space-y-4">{children}</div>;
}

export function SimRepoSidebar({ children }: { children: ReactNode }) {
  return <div className="md:col-span-1 space-y-4">{children}</div>;
}

export function SimRepoStats({ 
  branch = "main", 
  commits = 42, 
  onBranchClick,
  onCommitsClick,
  branchCallout,
  commitsCallout
}: { 
  branch?: string; 
  commits?: number; 
  onBranchClick?: () => void;
  onCommitsClick?: () => void;
  branchCallout?: ReactNode;
  commitsCallout?: ReactNode;
}) {
  return (
    <div className="flex justify-between items-center bg-[#161b22] border border-white/10 p-3 rounded-lg shadow-inner">
      <div className="flex items-center gap-2 relative">
        {branchCallout}
        <button 
          onClick={onBranchClick}
          className={`bg-[#21262d] text-white text-sm px-3 py-1.5 rounded border border-white/10 flex items-center gap-1.5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${onBranchClick ? 'hover:bg-white/10 cursor-pointer active:scale-95 transition-all' : ''}`}
        >
          <GitBranch className="w-3.5 h-3.5 text-white/70" /> {branch}
        </button>
      </div>
      <button 
        onClick={onCommitsClick}
        className={`flex items-center gap-1.5 text-white/70 text-sm relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${onCommitsClick ? 'hover:text-primary transition-all active:scale-95 cursor-pointer bg-white/5 hover:bg-primary/20 px-3 py-1.5 rounded border border-white/10 hover:border-primary/50' : 'px-3 py-1.5'}`}
      >
        {commitsCallout}
        <GitCommit className="w-4 h-4" /> <span className="font-bold">{commits}</span> Commits
      </button>
    </div>
  );
}

export function SimFileTree({ files, onFileClick, callout, topCallout }: { 
  files: { name: string, message: string, time: string, isDir?: boolean }[],
  onFileClick?: (file: any) => void;
  callout?: ReactNode;
  topCallout?: ReactNode;
}) {
  return (
    <div className="border border-white/10 rounded-lg relative overflow-hidden">
      {topCallout}
      <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-3 text-sm">
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-inner">J</div>
        <span className="font-bold text-white">John (Contractor)</span>
        <span className="text-muted-foreground hidden sm:inline">Updated standard operating procedures</span>
        <span className="text-muted-foreground ml-auto">2 days ago</span>
      </div>
      <div className="bg-[#0d1117] text-white/80 text-sm relative">
        {callout}
        {files.map((f, i) => (
          <div 
            key={i} 
            onClick={() => onFileClick?.(f)}
            className={`grid grid-cols-12 py-2.5 px-4 border-b last:border-b-0 border-white/5 ${onFileClick ? 'hover:bg-white/5 transition-colors cursor-pointer active:bg-white/10' : ''}`}
          >
            <div className="col-span-12 sm:col-span-4 flex items-center gap-2 font-medium">
              <FileText className={`w-4 h-4 ${f.isDir ? 'text-blue-400' : 'text-muted-foreground'}`} /> {f.name}
            </div>
            <div className="col-span-12 sm:col-span-5 text-muted-foreground truncate pl-6 sm:pl-0 mt-1 sm:mt-0">{f.message}</div>
            <div className="col-span-12 sm:col-span-3 text-left sm:text-right text-muted-foreground pl-6 sm:pl-0 mt-1 sm:mt-0">{f.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimReadme({ content, callout }: { content: string, callout?: ReactNode }) {
  return (
    <div className="border border-white/10 rounded-lg relative mt-4 overflow-hidden">
      {callout}
      <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-2 text-sm font-bold text-white">
        <Code className="w-4 h-4 text-muted-foreground" /> README.md
      </div>
      <div className="p-6 sm:p-8 bg-[#0d1117] text-white/80 prose prose-invert max-w-none reading-text">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </div>
  );
}

export function SimSidebarAbout({ description, callout }: { description: string, callout?: ReactNode }) {
  return (
    <div className="border-b border-white/10 pb-4 relative">
      {callout}
      <h3 className="font-bold text-white mb-2">About</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
