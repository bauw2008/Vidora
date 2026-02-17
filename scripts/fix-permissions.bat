@echo off
REM Windows batch script - Fix Git permissions configuration

echo Starting Git permissions configuration...

REM Set core configuration
git config core.filemode false
git config core.autocrlf true
git config core.symlinks false
git config core.ignorecase true

echo Git core configuration updated

REM Check and fix script file permissions (run in WSL or Git Bash)
echo Please run the following commands in Git Bash or WSL to fix script execution permissions:
echo    chmod +x scripts/fix-permissions.sh
echo    chmod +x scripts/docker-entrypoint.sh (if exists)

REM Normalize line endings for all files
git add .
git add -u
git commit -m "Fix: Normalize line endings and permissions for cross-platform compatibility" --allow-empty

echo Windows Git permissions configuration completed!