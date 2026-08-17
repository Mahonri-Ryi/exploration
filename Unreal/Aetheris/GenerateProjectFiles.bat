@echo off
setlocal
set "UEBAT=C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat"
if not exist "%UEBAT%" (
  echo Could not find UE 5.8 at:
  echo   %UEBAT%
  echo Install Unreal Engine 5.8 from the Epic Games Launcher first.
  pause
  exit /b 1
)
echo Generating Visual Studio files for Aetheris...
echo If this fails, install Visual Studio 2022 with "Game development with C++"
echo and the latest MSVC v143 toolset plus the Windows 10/11 SDK.
echo.
call "%UEBAT%" -projectfiles -project="%~dp0Aetheris.uproject" -game -rocket -progress
echo.
echo Exit code %ERRORLEVEL%
echo Full log: %%LOCALAPPDATA%%\UnrealBuildTool\Log.txt
pause
endlocal
