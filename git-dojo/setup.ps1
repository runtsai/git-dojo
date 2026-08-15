# Git Dojo setup check (PowerShell edition).
# Fixes the nested-folder problem from zip extraction, verifies Git is
# installed and new enough, then points you to Git Bash — the terminal this
# course is written for. Safe to run any number of times.

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Here

Write-Host "== Git Dojo setup check =="
Write-Host ""

function Flatten-Into($Inner, $Outer) {
    $leftovers = $false
    Get-ChildItem -Force $Inner | ForEach-Object {
        $dest = Join-Path $Outer $_.Name
        if (-not (Test-Path $dest)) { Move-Item $_.FullName $Outer } else { $leftovers = $true }
    }
    if (-not (Get-ChildItem -Force $Inner)) {
        Remove-Item $Inner
        return $true
    }
    if ($leftovers) {
        Write-Host "Moved what was safe to move; some items were left in '$Inner' because files with the same name already exist in '$Outer'. Compare and clean up by hand."
    }
    return $false
}

$flattened = $false

# --- 1a. This script itself may be inside the nested duplicate ---
# Layout: ~\git-dojo\git-dojo\setup.ps1
$parent = Split-Path -Parent $Here
$base = Split-Path -Leaf $Here
$parentBase = Split-Path -Leaf $parent
if (@("git-dojo", "git-dojo-main") -contains $base -and
    @("git-dojo", "git-dojo-main") -contains $parentBase -and
    -not (Test-Path (Join-Path $parent "reset.sh"))) {
    Write-Host "This copy of the dojo is nested inside an extra '$parentBase' folder (a zip-extraction artifact)."
    Write-Host "Flattening it now..."
    if (Flatten-Into $Here $parent) {
        Write-Host "Fixed. Lessons now live directly in: $parent"
    }
    Set-Location $parent
    $Here = $parent
    $flattened = $true
    Write-Host ""
}

# --- 1b. Or the nested duplicate may be a child of this folder ---
if (-not $flattened) {
    foreach ($candidate in @("git-dojo", "git-dojo-main")) {
        $nested = Join-Path $Here $candidate
        if ((Test-Path $nested -PathType Container) -and
            (Test-Path (Join-Path $nested "reset.sh")) -and
            -not (Test-Path (Join-Path $Here "reset.sh"))) {
            Write-Host "Found a nested '$candidate' folder (this happens with some zip extractors)."
            Write-Host "Flattening it now..."
            if (Flatten-Into $nested $Here) {
                Write-Host "Fixed. Lessons now live directly in: $Here"
            }
            Write-Host ""
            break
        }
    }
}

# --- 2. Verify the structure ---
if (Test-Path (Join-Path $Here "lesson-01-first-snapshot\setup.sh")) {
    Write-Host "[PASS] Folder structure looks right (lesson-01 found)."
} else {
    Write-Host "[FAIL] Can't find the lesson folders. Check for a nested folder and move its contents up one level."
}

# --- 3. Verify Git is installed and new enough ---
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    $v = (git --version) -replace "git version ", ""
    $parts = $v.Split(".")
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    if ($major -gt 2 -or ($major -eq 2 -and $minor -ge 23)) {
        Write-Host "[PASS] Git is installed (version $v)."
    } else {
        Write-Host "[FAIL] Git $v is too old - this course needs 2.23 or newer (for 'git switch'). Please update Git."
    }
} else {
    Write-Host "[FAIL] Git is not installed (or PowerShell can't see it yet)."
    Write-Host "       Install Git for Windows: https://git-scm.com/download/win"
    Write-Host "       Then close ALL terminal windows and reopen."
    exit 1
}

# --- 4. Check identity config (needed before your first commit) ---
$name = git config --global user.name 2>$null
$email = git config --global user.email 2>$null
if ($name -and $email) {
    Write-Host "[PASS] Git knows who you are ($name <$email>)."
} else {
    Write-Host "[TODO] Tell Git who you are (goes into every commit you seal):"
    Write-Host '       git config --global user.name  "Your Name"'
    Write-Host '       git config --global user.email "you@yourdomain.com"'
    Write-Host '       git config --global init.defaultBranch main'
}

Write-Host ""
Write-Host "IMPORTANT: this course is written for Git Bash, not PowerShell."
Write-Host "Open 'Git Bash' from the Start menu (it was installed with Git for"
Write-Host "Windows), then run:"
Write-Host ""
Write-Host "    cd ~/git-dojo"
Write-Host "    bash setup.sh"
Write-Host ""
Write-Host "Tip: in Git Bash, paste with Shift+Insert or right-click (not Ctrl+V)."
