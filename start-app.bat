@echo off
setlocal

cd /d "%~dp0"

echo [ai-sift] workspace: %cd%

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not available in PATH.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ai-sift] node_modules was not found. Running npm install...
  call cmd /c npm.cmd install
  if errorlevel 1 (
    echo [ai-sift] npm install failed.
    pause
    exit /b 1
  )
)

echo [ai-sift] starting Next.js development server...
call cmd /c npm.cmd run dev

if errorlevel 1 (
  echo [ai-sift] app startup failed.
  pause
  exit /b 1
)
