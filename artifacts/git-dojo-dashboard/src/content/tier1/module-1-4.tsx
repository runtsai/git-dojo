import { useState } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";

import { visualModuleSteps as _steps } from "../visual-module-steps";
export const TOTAL_STEPS = _steps["1.4"];
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2 } from "lucide-react";
import { SimSettingsContainer, SimSettingsSection, SimSettingsField, SimSettingsVisibilityToggle, SimSettingsDangerZone, SimSettingsDangerAction } from "@/components/sim/sim-settings";
import { VisualModuleShell } from "@/components/visual-module-shell";

export function Module1_4({ onStepChange }: VisualModuleProps = {}) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();
  
  // Interactive state
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<'public' | 'private' | null>(null);
  const [branch, setBranch] = useState("main");
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => { const next = Math.min(step + 1, TOTAL_STEPS); setStep(next); onStepChange?.(next); window.scrollTo(0, 0); };
  const handlePrev = () => { const prev = Math.max(step - 1, 1); setStep(prev); onStepChange?.(prev); window.scrollTo(0, 0); };

  const handleQuizSubmit = () => {
    if (visibility !== 'private') {
      setShowError("This repository holds internal pay records. It must be set to Private.");
      return;
    }
    if (description.trim().length < 5) {
      setShowError("Please write a sensible description (at least a few words) so others know what this repository is for.");
      return;
    }
    if (branch !== 'main') {
      setShowError("You changed the default branch. The instructions said to leave the default branch alone (main).");
      return;
    }
    if (!quizAnswer) {
      setShowError("Please answer the judgment question at the bottom.");
      return;
    }
    if (quizAnswer !== "delete") {
      setShowError("Incorrect. Renaming a repo can cause broken links, but deleting it completely erases the history permanently.");
      return;
    }

    setShowError(null);
    completeModule.mutate(
      { data: { moduleId: "1.4", track: "visual" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          setStep(6); onStepChange?.(6);
        }
      }
    );
  };

  const Callout = ({ num }: { num: number }) => (
    <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">{num}</div>
  );

  return (
    <VisualModuleShell
      title="Repo settings basics"
      step={step}
      completionTitle="Module Passed!"
      completionText="You know how to lock the vault. You understand the difference between public visibility and the permanent destruction of history."
      nextModuleHref="/learn/1-5"
      nextModuleLabel="Next: Global Nav →"
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={step < TOTAL_STEPS ? handleNext : undefined}
      nextLabel={step === 4 ? "Begin Hands-On Task" : "Continue"}
      onSubmit={step === TOTAL_STEPS ? handleQuizSubmit : undefined}
      submitLabel="Submit Answers"
      isPending={completeModule.isPending}
      error={showError}
    >
      {step === 1 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Vault</div>
          <h2 className="text-3xl font-bold">Configuring the Vault</h2>
          
          <p className="text-muted-foreground reading-text text-lg">
            The settings screen is where you control the meta-rules of your repository. It defines who is allowed to look at your files, what the repository is called, and how dangerous actions are handled.
          </p>
          <p className="text-muted-foreground reading-text text-lg">
            By default, repositories should be locked down. You only open them up when absolutely necessary.
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 2: The Interface</div>
          <h2 className="text-3xl font-bold">The Controls</h2>
          <p className="text-muted-foreground reading-text text-lg max-w-2xl">
            Let's look at the basic settings screen for a typical repository. Notice how the most destructive actions are grouped at the very bottom.
          </p>

          <div className="mt-8 relative pointer-events-none opacity-90">
            <SimSettingsContainer>
              <SimSettingsSection 
                title="General" 
                callout={<Callout num={1} />}
              >
                <SimSettingsField label="Repository Name">
                  <input type="text" value="company-handbook" readOnly className="w-full bg-[#010409] border border-white/10 rounded-md px-3 py-2 text-white text-sm" />
                </SimSettingsField>
                <SimSettingsField label="Description">
                  <input type="text" value="The official company record for RTS.AI" readOnly className="w-full bg-[#010409] border border-white/10 rounded-md px-3 py-2 text-white text-sm" />
                </SimSettingsField>
              </SimSettingsSection>

              <SimSettingsSection 
                title="Default Branch" 
                description="The default branch is considered the base branch in your repository."
                callout={<Callout num={2} />}
              >
                <select className="bg-[#21262d] border border-white/10 rounded-md px-3 py-2 text-white text-sm outline-none">
                  <option>main</option>
                </select>
              </SimSettingsSection>

              <SimSettingsSection 
                title="Visibility" 
                description="Choose who can see this repository."
                callout={<Callout num={3} />}
              >
                <SimSettingsVisibilityToggle value="public" />
              </SimSettingsSection>

              <SimSettingsDangerZone callout={<Callout num={4} />}>
                <SimSettingsDangerAction 
                  title="Change repository visibility"
                  description="This repository is currently public."
                  buttonText="Change visibility"
                />
                <SimSettingsDangerAction 
                  title="Delete this repository"
                  description="Once you delete a repository, there is no going back. Please be certain."
                  buttonText="Delete this repository"
                />
              </SimSettingsDangerZone>
            </SimSettingsContainer>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">1. General:</span> The name and description that appear on the repo home screen.
            </div>
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">2. Default Branch:</span> The timeline everyone sees first. Always leave this as 'main'.
            </div>
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">3. Visibility:</span> Public (everyone sees it) vs Private (only you and invited people).
            </div>
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">4. Danger Zone:</span> Actions that can break links or permanently destroy history.
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 3: The Point</div>
          <h2 className="text-3xl font-bold">Why protect it so heavily?</h2>
          
          <div className="space-y-6 mt-8">
            <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
              <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                <Shield className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Default to Closed</h3>
                <p className="text-muted-foreground reading-text">
                  A company handbook might be public, but internal pay records or API keys should never be. Setting a repo to private ensures that even if you make a mistake, the outside world cannot see it.
                </p>
              </div>
            </div>
            
            <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
              <div className="bg-red-500/20 p-3 rounded-lg border border-red-500/30">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">The Danger Zone is Real</h3>
                <p className="text-muted-foreground reading-text">
                  Deleting a repository destroys the entire custody trail forever. There is no undo. GitHub puts these actions in a red box at the bottom for a reason — to make you pause.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 4: The Trigger</div>
          <h2 className="text-3xl font-bold">When to reach for it</h2>
          
          <div className="bg-primary border border-primary-foreground/20 text-primary-foreground p-8 rounded-lg mt-8 text-xl font-bold leading-relaxed shadow-lg shadow-primary/20">
            "You reach for settings the day you create a repository to ensure it's locked down, or the day you finally retire a project and need to archive or delete it."
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
          <h2 className="text-3xl font-bold mb-2">Configure the Vault</h2>
          <p className="text-muted-foreground text-lg mb-8 reading-text">
            This repository (<code>rts-records/pay-records</code>) will hold your company's internal payroll data. 
            Configure it correctly below. Leave the default branch alone.
          </p>

          <div className="mt-8">
            <SimSettingsContainer>
              <SimSettingsSection title="General">
                <SimSettingsField label="Description">
                  <input 
                    type="text" 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What is this repository for?"
                    className="w-full bg-[#010409] border border-white/20 focus:border-primary focus:ring-1 focus:ring-primary rounded-md px-3 py-2 text-white text-sm outline-none transition-all" 
                  />
                </SimSettingsField>
              </SimSettingsSection>

              <SimSettingsSection title="Default Branch" description="The default branch is considered the base branch in your repository.">
                <select 
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  className="bg-[#21262d] border border-white/20 focus:border-primary rounded-md px-3 py-2 text-white text-sm outline-none cursor-pointer"
                >
                  <option value="main">main</option>
                  <option value="master">master</option>
                  <option value="development">development</option>
                </select>
              </SimSettingsSection>

              <SimSettingsSection title="Visibility" description="Choose who can see this repository.">
                <SimSettingsVisibilityToggle 
                  value={visibility as 'public' | 'private'} 
                  onChange={v => setVisibility(v)} 
                />
              </SimSettingsSection>
            </SimSettingsContainer>
          </div>

          <div className="mt-8 bg-black/30 border border-white/5 p-6 rounded-lg">
            <h3 className="font-bold text-foreground mb-4">Judgment Question: Why is deleting a repository placed in the "Danger Zone" red box?</h3>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${quizAnswer === 'name' ? 'bg-primary/10 border-primary' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                <input type="radio" name="quiz" value="name" checked={quizAnswer === 'name'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary" />
                <span className="text-sm">Because it frees up the repository name for someone else to steal.</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${quizAnswer === 'delete' ? 'bg-primary/10 border-primary' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                <input type="radio" name="quiz" value="delete" checked={quizAnswer === 'delete'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary" />
                <span className="text-sm">Because it permanently destroys the sealed record of history and cannot be easily undone.</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${quizAnswer === 'admin' ? 'bg-primary/10 border-primary' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                <input type="radio" name="quiz" value="admin" checked={quizAnswer === 'admin'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary" />
                <span className="text-sm">Because it emails the administrators to ask for permission.</span>
              </label>
            </div>
          </div>
        </>
      )}
    </VisualModuleShell>
  );
}
