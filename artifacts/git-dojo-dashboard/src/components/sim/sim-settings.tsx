import React, { ReactNode } from 'react';
import { AlertTriangle, Lock, Globe, ShieldAlert } from 'lucide-react';

export function SimSettingsContainer({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden font-sans shadow-xl text-left">
      <div className="bg-[#161b22] px-4 py-3 border-b border-white/10">
        <span className="font-bold text-white text-sm">Settings</span>
      </div>
      <div className="p-6 md:p-8 space-y-12">
        {children}
      </div>
    </div>
  );
}

export function SimSettingsSection({ title, description, children, callout }: { title: string, description?: string, children: ReactNode, callout?: ReactNode }) {
  return (
    <div className="space-y-4 relative">
      {callout}
      <div>
        <h3 className="text-xl font-bold text-white border-b border-white/10 pb-2 mb-4">{title}</h3>
        {description && <p className="text-muted-foreground text-sm mb-4">{description}</p>}
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}

export function SimSettingsField({ 
  label, 
  helpText, 
  children,
  callout
}: { 
  label: string, 
  helpText?: string, 
  children: ReactNode,
  callout?: ReactNode
}) {
  return (
    <div className="space-y-2 relative">
      {callout}
      <label className="block font-bold text-white text-sm">{label}</label>
      {children}
      {helpText && <p className="text-muted-foreground text-xs">{helpText}</p>}
    </div>
  );
}

export function SimSettingsDangerZone({ children, callout }: { children: ReactNode, callout?: ReactNode }) {
  return (
    <div className="relative mt-8">
      {callout}
      <h3 className="text-xl font-bold text-red-500 border-b border-red-500/20 pb-2 mb-4 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5" /> Danger Zone
      </h3>
      <div className="border border-red-500/20 rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function SimSettingsDangerAction({ title, description, buttonText }: { title: string, description: string, buttonText: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-red-500/20 last:border-b-0 bg-red-950/10">
      <div>
        <h4 className="font-bold text-white text-sm">{title}</h4>
        <p className="text-muted-foreground text-xs mt-1">{description}</p>
      </div>
      <button className="mt-4 md:mt-0 whitespace-nowrap bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 px-4 py-2 rounded text-sm font-bold transition-colors">
        {buttonText}
      </button>
    </div>
  );
}

export function SimSettingsVisibilityToggle({ value, onChange }: { value: 'public' | 'private', onChange?: (v: 'public' | 'private') => void }) {
  return (
    <div className="space-y-3">
      <label 
        className={`flex items-start gap-3 p-4 rounded border cursor-pointer transition-colors ${
          value === 'public' ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/20 bg-[#161b22]'
        }`}
      >
        <input 
          type="radio" 
          name="visibility" 
          value="public" 
          checked={value === 'public'} 
          onChange={() => onChange?.('public')}
          className="mt-1 accent-primary" 
        />
        <div>
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Globe className="w-4 h-4 text-muted-foreground" /> Public
          </div>
          <p className="text-muted-foreground text-xs mt-1">Anyone on the internet can see this repository. You choose who can commit.</p>
        </div>
      </label>
      
      <label 
        className={`flex items-start gap-3 p-4 rounded border cursor-pointer transition-colors ${
          value === 'private' ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/20 bg-[#161b22]'
        }`}
      >
        <input 
          type="radio" 
          name="visibility" 
          value="private" 
          checked={value === 'private'} 
          onChange={() => onChange?.('private')}
          className="mt-1 accent-primary" 
        />
        <div>
          <div className="flex items-center gap-2 font-bold text-white text-sm">
            <Lock className="w-4 h-4 text-muted-foreground" /> Private
          </div>
          <p className="text-muted-foreground text-xs mt-1">You choose who can see and commit to this repository.</p>
        </div>
      </label>
    </div>
  );
}
