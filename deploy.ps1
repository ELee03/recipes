# deploy.ps1 -- Build and push the recipe site to GitHub Pages
#
# Usage:
#   .\deploy.ps1                        # Auto-commit message: "Update recipes (YYYY-MM-DD)"
#   .\deploy.ps1 "Add gochujang salmon" # Custom commit message
#
# Requirements: git, python (with pyyaml installed)

param(
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

# Move to the script's directory
Set-Location $PSScriptRoot

# 1. Build recipes.json
Write-Host "Building recipes.json..."
python build.py
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. Stage all changes
git add -A

# 3. Commit (skip if nothing changed)
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "Nothing to commit -- already up to date."
} else {
    if ($Message -eq "") {
        $Message = "Update recipes ($(Get-Date -Format 'yyyy-MM-dd'))"
    }
    git commit -m $Message
    Write-Host "Committed: $Message"
}

# 4. Push
Write-Host "Pushing to GitHub..."
git push

Write-Host ""
Write-Host "Done! Site will update at https://elee03.github.io/recipes in about 30 seconds."
