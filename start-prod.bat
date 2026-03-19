@echo off
cd /d %~dp0
if not exist node_modules (
  echo Installing dependencies...
  cmd /c npm.cmd install
  if errorlevel 1 pause & exit /b 1
)

echo Building app...
cmd /c npm.cmd run build
if errorlevel 1 pause & exit /b 1

echo Starting production server...
cmd /c npm.cmd start
