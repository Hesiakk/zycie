@echo off
setlocal
cd /d "%~dp0.."

if not exist node_modules\express goto install
if not exist node_modules\dotenv goto install
goto start

:install
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )

:start
call npm start
pause
