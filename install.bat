@echo off
setlocal EnableDelayedExpansion
set "REPO=fhfjjfjd/video-player-bun"
set "APP_NAME=videohub"
set "INSTALL_DIR=%USERPROFILE%\videohub"
set "BASE_URL=https://github.com/%REPO%/releases/latest/download"

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
echo [videohub] Detected platform: %OS%-%ARCH%

rem --- prerequisites --------------------------------------------------------
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

rem --- source code ----------------------------------------------------------
if exist "%INSTALL_DIR%\.git" (
    echo [videohub] Updating source...
    pushd "%INSTALL_DIR%"
    git pull --ff-only
    popd
) else (
    echo [videohub] Cloning source...
    git clone --depth 1 "https://github.com/%REPO%.git" "%INSTALL_DIR%" || exit /b 1
)

pushd "%INSTALL_DIR%"

rem --- frontend -------------------------------------------------------------
echo [videohub] Installing frontend dependencies...
call bun install || exit /b 1
echo [videohub] Building frontend...
call bun run build || exit /b 1

rem --- backend binary -------------------------------------------------------
set "BIN_DIR=%INSTALL_DIR%\bin\%OS%-%ARCH%"
mkdir "%BIN_DIR%" 2>nul
set "ASSET=video-server-%OS%-%ARCH%.exe"
echo [videohub] Downloading %ASSET%...
curl.exe -fsSL -o "%BIN_DIR%\video-server.exe" "%BASE_URL%/%ASSET%" || exit /b 1

rem --- launcher command -----------------------------------------------------
echo [videohub] Creating %APP_NAME% command...
(
    echo @echo off
    echo cd /d "%INSTALL_DIR%"
    echo call bun start %%*
) > "%BIN_DIR%\%APP_NAME%.cmd"

set "WINAPPS=%USERPROFILE%\AppData\Local\Microsoft\WindowsApps"
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
