@echo off
REM Windows wrapper — runs deploy.mk via Git Bash (ssh, tar, bash pipes).
setlocal
set "GIT=C:\Program Files\Git"
set "PATH=%GIT%\usr\bin;%GIT%\bin;%PATH%"
set "MSYSTEM=MINGW64"

set "ACTION=%~1"
if "%ACTION%"=="" goto :help
if /i "%ACTION%"=="help" goto :help
if /i "%ACTION%"=="deploy" goto :run
if /i "%ACTION%"=="update" goto :run
if /i "%ACTION%"=="restart" goto :run
if /i "%ACTION%"=="logs" goto :run
if /i "%ACTION%"=="status" goto :run
if /i "%ACTION%"=="ssh" goto :run
echo Unknown action: %ACTION%
goto :help

:help
echo Usage: deploy.cmd [deploy^|update^|restart^|logs^|status^|ssh]
echo.
echo   deploy   — sync code + .env, build, start Docker on Oracle VM
echo   restart  — docker compose restart
echo   logs     — follow container logs
echo   status   — ps + /health
echo   ssh      — shell on VM
echo.
echo Requires: Git for Windows, make apply already done.
exit /b 0

:run
REM SSH rejects overly permissive key ACLs on Windows
if exist "%~dp0..\key\vm_ssh.pem" icacls "%~dp0..\key\vm_ssh.pem" /inheritance:r /grant:r "%USERNAME%:R" >nul 2>&1
"%GIT%\bin\bash.exe" -lc "cd \"$(cygpath -u '%~dp0')\" && make SHELL='C:/Program Files/Git/usr/bin/bash.exe' -f deploy.mk %ACTION%"
exit /b %ERRORLEVEL%
