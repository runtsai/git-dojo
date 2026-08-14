import React, { ReactNode, useState } from 'react';
import { Menu, Search, Bell, Plus, User, Inbox, X, FileText, ChevronRight } from 'lucide-react';

export function SimGlobalNav({ 
  onMenuClick, 
  onSearchClick, 
  onBellClick,
  onAvatarClick,
  calloutMenu,
  calloutSearch,
  calloutBell,
  calloutBreadcrumbs,
  breadcrumbs = ["rts-records", "company-handbook"]
}: {
  onMenuClick?: () => void,
  onSearchClick?: () => void,
  onBellClick?: () => void,
  onAvatarClick?: () => void,
  calloutMenu?: ReactNode,
  calloutSearch?: ReactNode,
  calloutBell?: ReactNode,
  calloutBreadcrumbs?: ReactNode,
  breadcrumbs?: string[]
}) {
  return (
    <div className="bg-[#161b22] border border-white/10 rounded-lg overflow-hidden font-sans shadow-xl text-left flex flex-col h-[600px] max-h-[70vh]">
      {/* Top Nav Bar */}
      <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between bg-[#010409]">
        <div className="flex items-center gap-4">
          <div className="relative">
            {calloutMenu}
            <button onClick={onMenuClick} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
          
          <div className="hidden md:flex items-center gap-2 text-white/80 font-medium text-sm relative">
            {calloutBreadcrumbs}
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-white/40">/</span>}
                <span className={i === breadcrumbs.length - 1 ? "font-bold text-white" : "hover:text-primary cursor-pointer transition-colors"}>{crumb}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            {calloutSearch}
            <button 
              onClick={onSearchClick} 
              className="flex items-center gap-2 bg-[#0d1117] border border-white/10 hover:border-white/30 text-white/50 px-3 py-1.5 rounded-md text-sm transition-colors w-[200px]"
            >
              <Search className="w-4 h-4" />
              <span>Search or jump to...</span>
              <span className="ml-auto text-xs border border-white/20 px-1.5 rounded bg-white/5">/</span>
            </button>
          </div>
          
          <div className="relative mx-1">
            {calloutBell}
            <button onClick={onBellClick} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border border-[#010409]"></span>
            </button>
          </div>

          <button className="hidden md:flex p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors">
            <Plus className="w-5 h-5" />
          </button>
          
          <button onClick={onAvatarClick} className="ml-2 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
            A
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#0d1117] relative flex">
        <div className="flex-1 p-8 text-center text-white/40 flex flex-col items-center justify-center">
          <FileText className="w-16 h-16 mb-4 opacity-20" />
          <p>Repository Content</p>
        </div>
      </div>
    </div>
  );
}

export function SimSearchOverlay({ onClose, onSelect }: { onClose: () => void, onSelect: (file: string) => void }) {
  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-start justify-center pt-16 px-4">
      <div className="bg-[#161b22] border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-3 border-b border-white/10 flex items-center gap-3">
          <Search className="w-5 h-5 text-white/40" />
          <input 
            autoFocus
            type="text" 
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent border-none outline-none text-white text-base"
          />
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 max-h-[300px] overflow-y-auto">
          <div className="text-xs font-bold text-white/40 px-3 py-2 uppercase tracking-wider">Recent</div>
          <button onClick={() => onSelect('onboarding.md')} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/20 hover:text-white rounded-md text-white/70 group transition-colors">
            <FileText className="w-4 h-4 text-white/40 group-hover:text-primary" />
            <div className="flex-1">
              <span className="font-medium">onboarding.md</span>
              <span className="text-white/40 text-xs ml-2">rts-records/company-handbook</span>
            </div>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/20 hover:text-white rounded-md text-white/70 group transition-colors">
            <FileText className="w-4 h-4 text-white/40 group-hover:text-primary" />
            <div className="flex-1">
              <span className="font-medium">safety-protocols.pdf</span>
              <span className="text-white/40 text-xs ml-2">rts-records/company-handbook</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export function SimNotificationsOverlay({ onClose, onSelect }: { onClose: () => void, onSelect: () => void }) {
  return (
    <div className="absolute top-16 right-4 z-50 w-80 bg-[#161b22] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
      <div className="p-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="font-bold text-white">Notifications</h3>
        <button onClick={onClose} className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="divide-y divide-white/5">
        <button onClick={onSelect} className="w-full text-left p-4 hover:bg-white/5 transition-colors flex gap-4">
          <div className="mt-1"><Inbox className="w-5 h-5 text-blue-400" /></div>
          <div>
            <div className="text-sm font-medium text-white mb-1">John (Contractor) commented on handbook.md</div>
            <div className="text-xs text-white/60">"Are we sure this is the right procedure for section 4?"</div>
            <div className="text-xs text-blue-400 mt-2">rts-records/company-handbook</div>
          </div>
        </button>
        <button className="w-full text-left p-4 hover:bg-white/5 transition-colors flex gap-4 opacity-50">
          <div className="mt-1"><Inbox className="w-5 h-5 text-emerald-400" /></div>
          <div>
            <div className="text-sm font-medium text-white mb-1">Safety protocols merged</div>
            <div className="text-xs text-white/60">Pull request #42 was merged by Admin</div>
            <div className="text-xs text-emerald-400 mt-2">rts-records/company-handbook</div>
          </div>
        </button>
      </div>
    </div>
  );
}
