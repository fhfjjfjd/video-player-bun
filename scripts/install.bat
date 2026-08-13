@echo off
setlocal EnableDelayedExpansion
rem videohub - one-command installer for the video-player-bun app.
rem
rem Usage:
rem   install.bat            install (or update if already installed)
rem   install.bat update     update the app in place
rem   install.bat reinstall  remove everything, then install fresh
rem   install.bat uninstall  remove launcher, PATH entries, and app data
rem
rem After install, `videohub update|reinstall|uninstall` run the same flows.
rem
rem Install/update pins the app to the LATEST GitHub release: the source is
rem checked out at the release tag so frontend and backend always match.
rem
rem The backend is PHP (src/server/php, run through scripts/start.ts). PHP must be
rem installed and on PATH; no binary is downloaded.
rem
rem The app lives in %USERPROFILE%\videohub.
set "REPO=fhfjjfjd/video-player-bun"
set "APP_NAME=videohub"
set "INSTALL_DIR=%USERPROFILE%\videohub"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=install"
if not "%MODE%"=="install" if not "%MODE%"=="update" if not "%MODE%"=="reinstall" if not "%MODE%"=="uninstall" (
    echo [videohub ERROR] Unknown argument: %MODE%. Usage: install.bat [install^|update^|reinstall^|uninstall]
    exit /b 1
)

echo [videohub] Detecting system...
set "OS=windows"
if /i "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set "ARCH=x64"
) else if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
    set "ARCH=arm64"
) else (
    echo [videohub ERROR] Unsupported CPU architecture: %PROCESSOR_ARCHITECTURE%
    exit /b 1
)
set "BIN_DIR=%INSTALL_DIR%\bin"
set "WINAPPS=%USERPROFILE%\AppData\Local\Microsoft\WindowsApps"
echo [videohub] Detected platform: %OS%-%ARCH%

rem --- uninstall -------------------------------------------------------------
if /i "%MODE%"=="uninstall" (
    echo [videohub] Uninstalling %APP_NAME%...
    del /f /q "%WINAPPS%\%APP_NAME%.cmd" >nul 2>nul
    del /f /q "%BIN_DIR%\%APP_NAME%.cmd" >nul 2>nul
    echo [videohub]   Removed launcher
    if exist "%INSTALL_DIR%" (
        call :ask_keep_data
        if "!KEEP_DATA!"=="1" (
            for /d %%D in ("%INSTALL_DIR%\*") do if /i not "%%~nxD"=="uploads" rmdir /s /q "%%D"
            for %%F in ("%INSTALL_DIR%\*") do if /i not "%%~nxF"=="data.db" if /i not "%%~nxF"=="data.db-wal" if /i not "%%~nxF"=="data.db-shm" if /i not "%%~nxF"==".media-secret" del /f /q "%%F"
            echo [videohub]   Kept uploads/ and data.db
        ) else (
            rmdir /s /q "%INSTALL_DIR%"
            echo [videohub]   Removed app directory
        )
    )
    echo [videohub] %APP_NAME% has been uninstalled.
    exit /b 0
)

rem --- reinstall -------------------------------------------------------------
if /i "%MODE%"=="reinstall" (
    echo [videohub] Reinstalling %APP_NAME% (fresh)...
    if exist "%INSTALL_DIR%" (
        call :ask_keep_data
        if "!KEEP_DATA!"=="1" (
            for /d %%D in ("%INSTALL_DIR%\*") do if /i not "%%~nxD"=="uploads" rmdir /s /q "%%D"
            for %%F in ("%INSTALL_DIR%\*") do if /i not "%%~nxF"=="data.db" if /i not "%%~nxF"=="data.db-wal" if /i not "%%~nxF"=="data.db-shm" if /i not "%%~nxF"==".media-secret" del /f /q "%%F"
        ) else (
            rmdir /s /q "%INSTALL_DIR%"
        )
    )
)

rem --- prerequisites ---------------------------------------------------------
where git >nul 2>nul || (
    echo [videohub ERROR] Git not found. Install it from https://git-scm.com
    exit /b 1
)
where curl.exe >nul 2>nul || (
    echo [videohub ERROR] curl.exe not found.
    exit /b 1
)
where bun >nul 2>nul || (
    echo [videohub] Bun not found - installing it...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex" >nul 2>nul
    set "PATH=%USERPROFILE%\.bun\bin;%USERPROFILE%\AppData\Local\bun;%PATH%"
    where bun >nul 2>nul || (
        echo [videohub ERROR] Bun install failed. Install it manually from https://bun.sh
        exit /b 1
    )
)
where php >nul 2>nul || (
    echo [videohub] PHP not found - installing it via winget...
    powershell -NoProfile -Command "winget install --id PHP.PHP -e --accept-package-agreements --accept-source-agreements" >nul 2>nul
    set "PATH=%ProgramFiles%\PHP;%PATH%"
    where php >nul 2>nul || (
        echo [videohub ERROR] PHP not found. Install PHP ^(>= 8.1^) from https://windows.php.net/download, add it to PATH, and re-run.
        exit /b 1
    )
)
php -r "exit(extension_loaded('pdo_sqlite') ? 0 : 1);" >nul 2>nul || (
    echo [videohub ERROR] PHP is missing the pdo_sqlite extension.
    exit /b 1
)
where ffmpeg >nul 2>nul || (
    echo [videohub] Warning: ffmpeg not found - automatic thumbnails will be skipped.
)

rem --- latest release ---------------------------------------------------------
echo [videohub] Fetching the latest release tag...
for /f %%T in ('powershell -NoProfile -Command "$r=irm https://api.github.com/repos/%REPO%/releases/latest; $r.tag_name"') do set "LATEST_TAG=%%T"
if "%LATEST_TAG%"=="" (
    echo [videohub ERROR] Failed to fetch the latest release tag from GitHub API
    exit /b 1
)
echo [videohub] Latest release: %LATEST_TAG%

rem --- source code (pinned to the latest release tag) -------------------------
if exist "%INSTALL_DIR%\.git" (
    echo [videohub] Updating source to %LATEST_TAG%...
    pushd "%INSTALL_DIR%"
    git fetch --depth 1 origin tag "%LATEST_TAG%" >nul || exit /b 1
    git checkout --detach "%LATEST_TAG%" >nul || exit /b 1
    popd
) else (
    if /i "%MODE%"=="update" (
        echo [videohub ERROR] App is not installed yet. Run: install.bat
        exit /b 1
    )
    echo [videohub] Cloning source at %LATEST_TAG%...
    git clone --depth 1 --branch "%LATEST_TAG%" "https://github.com/%REPO%.git" "%INSTALL_DIR%" || exit /b 1
)

pushd "%INSTALL_DIR%"

rem --- frontend ---------------------------------------------------------------
echo [videohub] Installing frontend dependencies...
call bun install || exit /b 1
echo [videohub] Building frontend...
call bun run build || exit /b 1

rem --- backend (PHP) ----------------------------------------------------------
rem The backend is the PHP router in src/server/php, started by scripts/start.ts
rem via `php -S`. No binary is downloaded; the runtime was checked above.
echo [videohub] Backend: PHP (src/server/php)

rem --- launcher command ------------------------------------------------------
echo [videohub] Creating %APP_NAME% command...
(
    echo @echo off
    echo if /i "%%~1"=="update" call "%INSTALL_DIR%\scripts\install.bat" update ^& exit /b
    echo if /i "%%~1"=="reinstall" call "%INSTALL_DIR%\scripts\install.bat" reinstall ^& exit /b
    echo if /i "%%~1"=="uninstall" call "%INSTALL_DIR%\scripts\install.bat" uninstall ^& exit /b
    echo cd /d "%INSTALL_DIR%"
    echo call bun start %%*
) > "%BIN_DIR%\%APP_NAME%.cmd"

copy /y "%BIN_DIR%\%APP_NAME%.cmd" "%WINAPPS%\%APP_NAME%.cmd" >nul 2>nul
if exist "%WINAPPS%\%APP_NAME%.cmd" (
    echo [videohub] Command installed at %WINAPPS%\%APP_NAME%.cmd
) else (
    echo [videohub] Adding %BIN_DIR% to your user PATH...
    setx PATH "%BIN_DIR%;%PATH%" >nul
)

popd

echo.
echo [videohub] Install complete!
echo [videohub]   App directory : %INSTALL_DIR%
echo [videohub]   Run          : %APP_NAME%
echo.
echo [videohub] Open a NEW terminal, then run:  %APP_NAME%
endlocal
exit /b 0

rem --- helper: ask whether to keep uploaded videos ---------------------------
:ask_keep_data
set "KEEP_DATA=0"
set /p KEEP_DATA="[videohub] Keep uploaded videos (uploads/ + data.db)? [y/N] "
if /i "%KEEP_DATA%"=="y" set "KEEP_DATA=1"
exit /b 0
