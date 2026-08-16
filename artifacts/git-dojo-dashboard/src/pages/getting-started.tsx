import { Link } from "wouter";
import { useEffect } from "react";
import { ArrowLeft, Download, Terminal, CheckCircle2, AlertTriangle, FolderTree, Keyboard, Play, Cloud } from "lucide-react";
import { CommandBlock } from "@/components/ui/command-block";

function StepCard({
  number,
  title,
  icon,
  children,
}: {
  number: number;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-6 md:p-8 space-y-4">
      <div className="flex items-center gap-3">
        <span className="bg-primary/20 text-primary w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">
          {number}
        </span>
        <div className="text-primary">{icon}</div>
        <h2 className="text-lg md:text-xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="text-muted-foreground text-sm md:text-base leading-relaxed space-y-3 min-w-0">
        {children}
      </div>
    </div>
  );
}

export function GettingStarted() {
  useEffect(() => {
    document.title = "Getting Started | Git Dojo";
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <Link
        href="/test-center"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Command Test Center
      </Link>

      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          Getting started on your own computer
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Six steps, about five minutes on a fresh machine. Do them in order —
          each step checks the one before it, so you'll never wonder whether
          something silently failed.
        </p>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">On Windows, use Git Bash — not PowerShell.</strong>{" "}
          The course uses Unix-style paths (<code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">~/git-dojo/...</code>)
          and commands (<code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">ls</code>) that
          Git Bash understands natively. PowerShell will half-work and then confuse you.
          Git Bash is installed automatically with Git for Windows in Step 1.
        </p>
      </div>

      <StepCard number={1} title="Install Git" icon={<Download className="w-5 h-5" />}>
        <ul className="space-y-2 list-disc pl-5">
          <li>
            <strong className="text-foreground">Windows:</strong> download{" "}
            <a
              href="https://git-scm.com/download/win"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-bold hover:underline"
            >
              Git for Windows
            </a>{" "}
            and run the installer with the default settings. It installs the{" "}
            <strong className="text-foreground">Git Bash</strong> terminal you'll use for the whole course.
          </li>
          <li>
            <strong className="text-foreground">Mac:</strong> open Terminal and type{" "}
            <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">git --version</code> — macOS
            will offer to install it.
          </li>
        </ul>
      </StepCard>

      <StepCard number={2} title="Verify Git is installed" icon={<CheckCircle2 className="w-5 h-5" />}>
        <p>Open Git Bash (Windows) or Terminal (Mac) and run:</p>
        <CommandBlock command="git --version" />
        <p>
          A version number means you're good. "Command not found" means close
          the terminal, reopen it, and try again — or reinstall.
        </p>
      </StepCard>

      <StepCard number={3} title="Download and extract the dojo" icon={<FolderTree className="w-5 h-5" />}>
        <ul className="space-y-2 list-disc pl-5">
          <li>
            Go to{" "}
            <a
              href="https://github.com/runtsai/git-dojo-course"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-bold hover:underline"
            >
              github.com/runtsai/git-dojo-course
            </a>{" "}
            — the course-only repo (lessons and setup scripts, nothing else).
          </li>
          <li>Click the green <strong className="text-foreground">Code</strong> button → <strong className="text-foreground">Download ZIP</strong>.</li>
          <li>Extract it into your home folder (<code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">~</code>).</li>
          <li>
            If the folder is named{" "}
            <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">git-dojo-course-main</code>,
            rename it to <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">git-dojo</code>.
          </li>
        </ul>
      </StepCard>

      <StepCard number={4} title="Verify the folder structure" icon={<CheckCircle2 className="w-5 h-5" />}>
        <p>Check what your download contains:</p>
        <CommandBlock command="ls ~/git-dojo" />
        <p>
          You should see the lesson folders and{" "}
          <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">setup.sh</code>. Run the
          setup script to confirm your Git install:
        </p>
        <CommandBlock command="cd ~/git-dojo && bash setup.sh" />
        <p>
          <strong className="text-foreground">Downloaded the wrong repo?</strong>{" "}
          If you see app files (<code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">artifacts</code>,{" "}
          <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">package.json</code>, a{" "}
          <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">git-dojo</code> folder) instead,
          one command fixes it — it moves the lessons up and checks your Git install:
        </p>
        <CommandBlock command="cd ~/git-dojo && bash git-dojo/setup.sh" />
      </StepCard>

      <StepCard number={5} title="Tell Git who you are" icon={<Terminal className="w-5 h-5" />}>
        <p>This goes into every commit you seal. One-time setup:</p>
        <CommandBlock command={'git config --global user.name "Your Name"'} />
        <CommandBlock command={'git config --global user.email "you@yourdomain.com"'} />
        <CommandBlock command="git config --global init.defaultBranch main" />
      </StepCard>

      <StepCard number={6} title="Start Lesson 1" icon={<Play className="w-5 h-5" />}>
        <CommandBlock command="cd ~/git-dojo/lesson-01-first-snapshot" />
        <CommandBlock command="bash setup.sh" />
        <p>
          Then open{" "}
          <Link href="/test-center" className="text-primary font-bold hover:underline">
            the Command Test Center
          </Link>{" "}
          and pick Lesson 1 — this app watches your practice folder and updates
          live as you type commands.
        </p>
      </StepCard>

      <div className="surface-card p-6 space-y-3">
        <div className="flex items-center gap-3">
          <Keyboard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Git Bash tips</h2>
        </div>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5 leading-relaxed">
          <li>
            <strong className="text-foreground">Pasting:</strong> Ctrl+V does not paste. Use{" "}
            <strong className="text-foreground">Shift+Insert</strong> or <strong className="text-foreground">right-click</strong> inside the terminal.
          </li>
          <li>
            To enable Ctrl+Shift+V: right-click the title bar → Options → Keys →
            check "Ctrl+Shift+C/V".
          </li>
        </ul>
      </div>

      <div className="bg-secondary/30 border border-white/5 rounded-xl p-5 flex items-start gap-3">
        <Cloud className="w-5 h-5 text-secondary-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Local setup fighting you?</strong> You can do the whole
          course in the cloud instead — the Replit Shell or GitHub Codespaces
          both have Git pre-installed, no download needed.
        </p>
      </div>
    </div>
  );
}
