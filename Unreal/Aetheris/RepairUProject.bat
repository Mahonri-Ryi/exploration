@echo off
setlocal
set "DEST=%~dp0Aetheris.uproject"
echo Rewriting Aetheris.uproject as UTF-8 JSON (no BOM)...
> "%DEST%" (
echo {
echo   "FileVersion": 3,
echo   "EngineAssociation": "5.8",
echo   "Category": "Games",
echo   "Description": "Aetheris native Unreal Engine 5.8 city builder.",
echo   "Modules": [
echo     {
echo       "Name": "Aetheris",
echo       "Type": "Runtime",
echo       "LoadingPhase": "Default",
echo       "AdditionalDependencies": [
echo         "Engine"
echo       ]
echo     }
echo   ],
echo   "Plugins": [
echo     {
echo       "Name": "ProceduralMeshComponent",
echo       "Enabled": true
echo     }
echo   ]
echo }
)
echo Wrote %DEST%
echo Open that file in Unreal 5.8 again.
pause
endlocal
