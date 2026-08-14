import React, { ReactNode } from 'react';
import { GitBranch, GitCommit, FileText, Code, Settings } from 'lucide-react';

export function SimRepoContainer({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden font-sans shadow-xl text-left">
      {children}
    </div>
  );
}

export function SimRepoHeader({ repoName = "rts-records/company-handbook", rightSlot }: { repoName?: string, rightSlot?: ReactNode }) {
  return (
    <div className="bg-[#161b22] px-4 py-3 border-b border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-2 text-white/80">
        <span className="font-bold text-white">{repoName.split('/')[0]}</span> 
        <span className="text-white/40">/</span> 
        <span className="font-bold text-white">{repoName.split('/')[1] || ''}</span>
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
    <div className="flex justify-between items-center bg-[#161b22] border border-white/10 p-3 rounded">
      <div className="flex items-center gap-2 relative">
        {branchCallout}
        <button 
          onClick={onBranchClick}
          className={`bg-[#21262d] text-white text-sm px-3 py-1 rounded border border-white/10 flex items-center gap-1.5 font-bold ${onBranchClick ? 'hover:bg-white/10 cursor-pointer' : ''}`}
        >
          <GitBranch className="w-3.5 h-3.5" /> {branch}
        </button>
      </div>
      <button 
        onClick={onCommitsClick}
        className={`flex items-center gap-1.5 text-white/70 text-sm relative ${onCommitsClick ? 'hover:text-primary transition-colors cursor-pointer bg-white/5 hover:bg-primary/20 px-3 py-1.5 rounded border border-white/10 hover:border-primary/50' : ''}`}
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
    <div className="border border-white/10 rounded relative">
      {topCallout}
      <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-3 text-sm">
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">J</div>
        <span className="font-bold text-white">John (Contractor)</span>
        <span className="text-white/60">Updated standard operating procedures</span>
        <span className="text-white/40 ml-auto">2 days ago</span>
      </div>
      <div className="bg-[#0d1117] text-white/80 text-sm relative">
        {callout}
        {files.map((f, i) => (
          <div 
            key={i} 
            onClick={() => onFileClick?.(f)}
            className={`grid grid-cols-12 py-2 px-4 border-b last:border-b-0 border-white/5 ${onFileClick ? 'hover:bg-white/5 transition-colors cursor-pointer' : ''}`}
          >
            <div className="col-span-4 flex items-center gap-2">
              <FileText className={`w-4 h-4 ${f.isDir ? 'text-blue-400' : 'text-white/40'}`} /> {f.name}
            </div>
            <div className="col-span-5 text-white/50 truncate">{f.message}</div>
            <div className="col-span-3 text-right text-white/40">{f.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimReadme({ content, callout }: { content: string, callout?: ReactNode }) {
  return (
    <div className="border border-white/10 rounded relative mt-4">
      {callout}
      <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-2 text-sm font-bold text-white">
        <Code className="w-4 h-4" /> README.md
      </div>
      <div className="p-6 bg-[#0d1117] text-white/80 prose prose-invert max-w-none">
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
      <p className="text-white/60 text-sm leading-relaxed">
        {description}
      </p>
    </div>
  );
}
