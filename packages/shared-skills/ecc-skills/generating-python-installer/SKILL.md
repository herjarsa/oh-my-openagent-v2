---
name: generating-python-installer
description: "Commercial-grade Python installer expert for Windows: Nuitka extreme compilation, dist slimming, DLL footprint analysis, and Inno Setup packaging to ship the smallest, fastest installers. Use when a Python app must ship as a minimal, fast-starting Windows installer; not for basic script-to-exe conversion. ä¸­æ–‡è§¦å‘ï¼šNuitka æžé™ä¼˜åŒ–ã€Python å•†ä¸šæ‰“åŒ…ã€æžé™ç¼–è¯‘ Pythonã€dist ç˜¦èº«ã€DLL åˆ†æžã€æœ€å°å®‰è£…åŒ…ã€æœ€å¿«å¯åŠ¨ã€å•†ä¸šçº§æ‰“åŒ…é£Žæ ¼"
---

# Generating Python Installer (Commercial-Grade)

You are a **Python commercial deployment expert**. Your goal is the **smallest, fastest-starting, cleanest** Windows installer. The core approach is **"Nuitka folder mode (dist) + Inno Setup packaging"** â€” no single-file builds, no stray console window.

## When to Activate

Activate when the user explicitly asks for **advanced** Python packaging or size/startup optimization on Windows:

- Nuitka extreme / commercial-grade compilation, smallest-size or fastest-startup builds
- `dist` folder slimming, DLL footprint analysis, 32-bit vs 64-bit size tradeoffs
- Inno Setup packaging with full metadata and a clean, residue-free uninstall

This skill targets advanced size/startup optimization â€” not basic one-file "script to exe" conversion.

## How It Works

1. **Confirm build parameters** â€” app name, version, publisher, exe name, source/output dirs, icon. Never auto-fill; ask the user.
2. **Verify the source build** â€” console disabled, LTO enabled, VC++ runtime present.
3. **Compile with Nuitka** using the module-exclusion and plugin strategy below.
4. **Slim the `dist` folder** â€” strip debug symbols, caches, tests, and docs, with safeguards for runtime-required metadata.
5. **Analyze DLLs** to find and trim the largest dependencies.
6. **Package with Inno Setup** â€” LZMA2 ultra compression, full metadata, residue-free uninstall, and an arch-matched VC++ redistributable.

## Examples

- "ç”¨ Nuitka æŠŠè¿™ä¸ª PySide2 é¡¹ç›®æ‰“æˆæœ€å°ä½“ç§¯çš„å•†ä¸šå®‰è£…åŒ…" â†’ run the full workflow: recommend 32-bit, exclude WebEngine/3D/Charts, slim `dist`, package with Inno Setup.
- "æˆ‘çš„ exe æœ‰ 400 MBï¼Œæ€Žä¹ˆç˜¦èº«åˆ°ä¸€åŠ" â†’ analyze DLLs, switch to `opencv-python-headless`, drop `opengl32sw`, apply `dist` slimming.
- "å®‰è£…åŽåœ¨çº¯å‡€ç³»ç»Ÿæ‰“ä¸å¼€" â†’ ensure the matching-arch VC++ redistributable is bundled in the Inno Setup script.

---

## æ ¸å¿ƒç†å¿µ

åšæŒ **"Nuitka æ–‡ä»¶å¤¹æ¨¡å¼(dist) + Inno Setup å°è£…"** æ–¹æ¡ˆã€‚æ‹’ç»å•æ–‡ä»¶ç‰ˆï¼Œæ‹’ç»é»‘çª—ã€‚

---

## å®žæˆ˜å‚è€ƒæ¡ˆä¾‹ï¼ˆç”Ÿäº§çº§ PySide2 æ¡Œé¢åº”ç”¨ï¼Œ323 MBï¼Œå« OpenCV / Playwrightï¼‰

### é¡¹ç›®æ¦‚å†µ
- **æ€»ä½“ç§¯**: 323 MB
- **æ‰“åŒ…å·¥å…·**: PyInstaller 4.7 (32ä½)
- **ä¸»è¦ä¾èµ–**: PySide2 (22.52 MB), OpenCV (62.38 MB), Playwright (76.74 MB)
- **Python ç‰ˆæœ¬**: Python 3.8 (32ä½)
- **DLL æ•°é‡**: 71 ä¸ªï¼Œæ€»è®¡ 93.23 MB

### å…³é”®ä¼˜åŒ–ç­–ç•¥
1. PASS: **ä½¿ç”¨ 32 ä½ Python** â†’ ä½“ç§¯å‡å°‘ 20-30%
2. PASS: **base_library.zip åŽ‹ç¼©æ ‡å‡†åº“** â†’ 0.74 MB
3. PASS: **ç²¾ç®€æ¨¡å—æŽ’é™¤** â†’ æ—  pytest/unittest/setuptools
4. PASS: **ç²¾ç®€ Qt æ’ä»¶** â†’ åªä¿ç•™å¿…è¦æ’ä»¶

### ä½“ç§¯åˆ†å¸ƒ

| ç»„ä»¶ | ä½“ç§¯ | å æ¯” | ä¼˜åŒ–å»ºè®® |
|------|------|------|---------|
| playwright | 76.74 MB | 23.8% | éžå¿…è¦å¯ç§»é™¤ |
| OpenCV | 62.38 MB | 19.3% | ç”¨ opencv-python-headless |
| PySide2 | 22.52 MB | 7.0% | æŽ’é™¤ WebEngine/3D/Charts |
| å…¶ä»–ä¾èµ– | 161.36 MB | 49.9% | - |

### é¢„æœŸæ•ˆæžœå¯¹æ¯”

| é¡¹ç›®ç±»åž‹ | Nuitka åŽŸå§‹ | ä¼˜åŒ–åŽ | å‚è€ƒé¡¹ç›®å®žæµ‹ |
|---------|------------|--------|----------------|
| Tkinter + æ ‡å‡†åº“ | 150-250 MB | **80-120 MB** | - |
| PyQt/PySide | 200-400 MB | **120-250 MB** | 323 MB (å« OpenCV ç­‰) |
| å« numpy/pandas | 300-600 MB | **180-350 MB** | - |

---

## æ ¸å¿ƒå·¥ä½œæµ (Workflow) - WARNING: ä¸¥æ ¼æ‰§è¡Œ

å½“ç”¨æˆ·è¯·æ±‚æ‰“åŒ…æ—¶ï¼ŒæŒ‰ç…§ä»¥ä¸‹æ­¥éª¤æ“ä½œï¼š

**æ­¥éª¤ 1ï¼šå¼ºåˆ¶å‚æ•°ç¡®è®¤ï¼ˆFAIL: ç¦æ­¢ä½¿ç”¨é»˜è®¤å€¼ï¼‰**

> **WARNING: é‡è¦è§„åˆ™ï¼šä»¥ä¸‹æ‰€æœ‰å‚æ•°å¿…é¡»é€ä¸€å‘ç”¨æˆ·ç¡®è®¤ï¼Œç¦æ­¢è‡ªåŠ¨å¡«å……æˆ–ä½¿ç”¨é»˜è®¤å€¼ï¼**

å¿…é¡»å‘ç”¨æˆ·è¯¢é—®å¹¶ç¡®è®¤ä»¥ä¸‹ä¿¡æ¯ï¼ˆ*ç­‰å¾…ç”¨æˆ·æ˜Žç¡®å›žå¤åŽæ‰èƒ½ç»§ç»­*ï¼‰ï¼š

| å‚æ•° | è¯´æ˜Ž | ç¤ºä¾‹ |
|------|------|------|
| **è½¯ä»¶åç§°** (App Name) | è½¯ä»¶æ˜¾ç¤ºåç§° | `çº¢å¢¨æ‰¹æ³¨` |
| **ç‰ˆæœ¬å·** (Version) | è¯­ä¹‰åŒ–ç‰ˆæœ¬å· | `1.0.0` |
| **å‘å¸ƒè€…/å…¬å¸å** (Publisher) | æŽ§åˆ¶é¢æ¿æ˜¾ç¤ºçš„å‘å¸ƒè€… | `YourCompany` |
| **ä¸»ç¨‹åº** (Exe Name) | ä¸»å¯æ‰§è¡Œæ–‡ä»¶å | `RedInk.exe` |
| **æºè·¯å¾„** (Source Dir) | Nuitka dist æ–‡ä»¶å¤¹ç»å¯¹è·¯å¾„ | `D:\project\dist` |
| **è¾“å‡ºè·¯å¾„** (Output Dir) | å®‰è£…åŒ…ç”Ÿæˆä½ç½® | `D:\project\output` |
| **å›¾æ ‡è·¯å¾„** (Icon Path) | .ico æ–‡ä»¶ç»å¯¹è·¯å¾„ï¼ˆå¯é€‰ä½†æŽ¨èï¼‰ | `D:\project\icon.ico` |
| **å®˜ç½‘åœ°å€** (URL) | å¯é€‰ï¼Œç”¨äºŽæŽ§åˆ¶é¢æ¿é“¾æŽ¥ | `https://example.com` |

**è¯¢é—®æ¨¡æ¿ï¼š**
> "è¯·æä¾›ä»¥ä¸‹æ‰“åŒ…å‚æ•°ï¼Œæˆ‘éœ€è¦æ‚¨é€ä¸€ç¡®è®¤ï¼š
> 1. è½¯ä»¶åç§°ï¼š
> 2. ç‰ˆæœ¬å·ï¼š
> 3. å‘å¸ƒè€…/å…¬å¸åï¼š
> 4. ä¸»ç¨‹åºæ–‡ä»¶åï¼ˆå¦‚ xxx.exeï¼‰ï¼š
> 5. æºè·¯å¾„ï¼ˆNuitka dist æ–‡ä»¶å¤¹ï¼‰ï¼š
> 6. è¾“å‡ºè·¯å¾„ï¼ˆå®‰è£…åŒ…ä¿å­˜ä½ç½®ï¼‰ï¼š
> 7. å›¾æ ‡è·¯å¾„ï¼ˆ.ico æ–‡ä»¶ï¼Œå¯ç•™ç©ºï¼‰ï¼š
> 8. å®˜ç½‘åœ°å€ï¼ˆå¯ç•™ç©ºï¼‰ï¼š
>
> è¯·é€ä¸€å¡«å†™ï¼Œæˆ–å›žå¤"è·³è¿‡"è¡¨ç¤ºä½¿ç”¨ç©ºå€¼ã€‚"

**æ­¥éª¤ 2ï¼šæºæ–‡ä»¶è´¨é‡ä¸Žç¼–è¯‘æ£€æŸ¥ï¼ˆå…³é”®ï¼‰**
åœ¨ç”Ÿæˆä»£ç ä¹‹å‰ï¼Œå¿…é¡»å‘ç”¨æˆ·å‘å‡ºä»¥ä¸‹**å…³é”®ç¡®è®¤**ï¼ˆå› ä¸º Inno Setup åªæ˜¯æ‰“åŒ…å·¥å…·ï¼Œæ— æ³•æ”¹å˜ç¨‹åºæœ¬èº«çš„è¿è¡Œå±žæ€§ï¼‰ï¼š

> "WARNING: **ç¼–è¯‘å‚æ•°æ£€æŸ¥**ï¼š
> 1. **åŽ»é»‘çª—**ï¼šè¯·ç¡®è®¤æ‚¨çš„ dist æ–‡ä»¶å¤¹æ˜¯ä½¿ç”¨ `nuitka --windows-console-mode=disable` ç¼–è¯‘çš„ã€‚ï¼ˆå¦åˆ™å®‰è£…åŽä¾ç„¶ä¼šæœ‰é»‘æ¡†ï¼‰
> 2. **é«˜æ€§èƒ½**ï¼šè¯·ç¡®è®¤æ˜¯å¦ä½¿ç”¨äº† `--lto=yes`ã€‚ï¼ˆå¦åˆ™å¯åŠ¨é€Ÿåº¦å¯èƒ½ä¸ç†æƒ³ï¼‰
> 3. **è¿è¡Œåº“**ï¼šè¯·ç¡®ä¿ dist æ–‡ä»¶å¤¹å†…å·²åŒ…å«å¿…è¦çš„ VC++ è¿è¡Œåº“ï¼Œé˜²æ­¢åœ¨çº¯å‡€ç³»ç»Ÿä¸Šæ— æ³•è¿è¡Œã€‚
>
> **ç¡®è®¤æºæ–‡ä»¶å·²å‡†å¤‡å¥½è¯·å›žå¤"ç¡®è®¤"ï¼Œå¦åˆ™è¯·å…ˆé‡æ–°ç¼–è¯‘ã€‚**"

**æ­¥éª¤ 3ï¼šç”Ÿæˆä»£ç **
ç”¨æˆ·ç¡®è®¤åŽï¼Œè¾“å‡ºåŒ…å« **å®Œæ•´å…ƒæ•°æ®** å’Œ **å¸è½½å›¾æ ‡ä¿®å¤** çš„ä»£ç ã€‚

---

## Nuitka æžé™ä¼˜åŒ–ç¼–è¯‘ï¼ˆåŸºäºŽ å‚è€ƒé¡¹ç›®ç»éªŒï¼‰

### ä¸€ã€32 ä½ vs 64 ä½é€‰æ‹©ç­–ç•¥

**å‚è€ƒé¡¹ç›®ä½¿ç”¨ 32 ä½ Python çš„åŽŸå› **ï¼š

| ç»„ä»¶ | 64ä½ä½“ç§¯ | 32ä½ä½“ç§¯ | èŠ‚çœ |
|------|---------|---------|------|
| python3x.dll | ~4.5 MB | ~3.8 MB | 15% |
| Qt5Core.dll | ~8 MB | ~5 MB | 37% |
| numpy | ~30 MB | ~20 MB | 33% |
| **æ€»ä½“** | åŸºå‡† | **-20~30%** | - |

**æŽ¨èä½¿ç”¨ 32 ä½æ¡ä»¶**ï¼š
- PASS: ç¨‹åºå†…å­˜å ç”¨ < 2GB
- PASS: ä¸å¤„ç†è¶…å¤§æ–‡ä»¶ï¼ˆ< 2GBï¼‰
- PASS: ç›®æ ‡ç”¨æˆ·æ˜¯æ™®é€šåŠžå…¬ç”µè„‘

**32 ä½ç¼–è¯‘æ–¹æ³•**ï¼š
```bash
# 1. å®‰è£… 32 ä½ Pythonï¼ˆå’Œ 64 ä½å¯ä»¥å…±å­˜ï¼‰
# ä¸‹è½½åœ°å€ï¼šhttps://www.python.org/downloads/windows/

# 2. ç”¨ 32 ä½ Python å®‰è£…ä¾èµ–
py -3.12-32 -m pip install -r requirements.txt

# 3. ç”¨ 32 ä½ Python ç¼–è¯‘
py -3.12-32 -m nuitka --standalone ...ä½ çš„å‚æ•°
```

### äºŒã€æ¨¡å—æŽ’é™¤æ¸…å•ï¼ˆå‚è€ƒé¡¹ç›®éªŒè¯è¿‡çš„ï¼‰

**å®‰å…¨æŽ’é™¤åˆ—è¡¨**ï¼ˆè¿è¡Œæ—¶ä¸éœ€è¦ï¼‰ï¼š
```
unittest,test,pytest,_pytest,doctest,pdb,pdbpp,
setuptools,pip,distutils,pkg_resources,
email.mime,http.server,xmlrpc,pydoc
```

**é¢„æœŸæ•ˆæžœ**ï¼šèŠ‚çœ **30-50 MB**

### ä¸‰ã€GUI æ¡†æž¶ä¸“ç”¨ä¼˜åŒ–

#### Tkinter æžé™ä¼˜åŒ–ï¼ˆæŽ¨èï¼Œæœ€è½»é‡ï¼‰
```bash
nuitka --standalone --windows-console-mode=disable ^
    --lto=yes ^
    --jobs=8 ^
    --enable-plugin=tk-inter ^
    --enable-plugin=anti-bloat ^
    --noinclude-pytest-mode=nofollow ^
    --noinclude-setuptools-mode=nofollow ^
    --nofollow-import-to=unittest,test,pytest,_pytest,doctest,pdb,pdbpp ^
    --nofollow-import-to=setuptools,pip,distutils,pkg_resources ^
    --nofollow-import-to=email.mime,http.server,xmlrpc,pydoc ^
    --python-flag=no_docstrings ^
    --output-dir=dist ^
    --windows-icon-from-ico=icon.ico ^
    --remove-output ^
    main.py
```

**é¢„æœŸä½“ç§¯**ï¼š80-120 MBï¼ˆä¼˜åŒ–åŽï¼‰

#### PyQt5 / PySide2 ä¼˜åŒ–
```bash
nuitka --standalone --windows-console-mode=disable ^
    --lto=yes ^
    --jobs=8 ^
    --enable-plugin=pyqt5 ^
    --enable-plugin=anti-bloat ^
    --noinclude-pytest-mode=nofollow ^
    --noinclude-setuptools-mode=nofollow ^
    --nofollow-import-to=unittest,test,pytest,_pytest,doctest,pdb ^
    --nofollow-import-to=setuptools,pip,distutils,pkg_resources ^
    --nofollow-import-to=PyQt5.QtWebEngine,PyQt5.QtWebEngineWidgets ^
    --nofollow-import-to=PyQt5.Qt3D,PyQt5.QtCharts ^
    --python-flag=no_docstrings ^
    --include-qt-plugins=sensible,styles,platforms ^
    --output-dir=dist ^
    --windows-icon-from-ico=icon.ico ^
    --remove-output ^
    main.py
```

**é¢„æœŸä½“ç§¯**ï¼š120-250 MBï¼ˆä¼˜åŒ–åŽï¼‰

### å››ã€ä¸€é”®ç¼–è¯‘è„šæœ¬æ¨¡æ¿

**ä¿å­˜ä¸º `build_optimized.bat`ï¼ˆé¡¹ç›®æ ¹ç›®å½•ï¼‰**ï¼š

```batch
@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo Nuitka æžé™ä¼˜åŒ–ç¼–è¯‘ï¼ˆå‚è€ƒ å‚è€ƒé¡¹ç›®ï¼‰
echo ========================================

REM === é…ç½®åŒºåŸŸï¼ˆè¯·ä¿®æ”¹ä¸ºä½ çš„å®žé™…å€¼ï¼‰ ===
set APP_NAME=ä½ çš„è½¯ä»¶å
set MAIN_FILE=main.py
set ICON_FILE=icon.ico

REM === è‡ªåŠ¨æ£€æµ‹ CPU æ ¸å¿ƒæ•° ===
REM ç”¨ Windows è‡ªå¸¦çŽ¯å¢ƒå˜é‡ï¼ˆwmic åœ¨ Win11 22H2+ å·²ç§»é™¤ï¼ŒæŽ¢ä¸åˆ°ä¼šè®© --jobs=0 å•çº¿ç¨‹ç¼–è¯‘ï¼‰
set CPU_CORES=%NUMBER_OF_PROCESSORS%
if not defined CPU_CORES set CPU_CORES=4
set /a BUILD_JOBS=%CPU_CORES%

REM === å‚è€ƒé¡¹ç›®çš„æ¨¡å—æŽ’é™¤æ¸…å• ===
set EXCLUDE_MODULES=unittest,test,pytest,_pytest,doctest,pdb,pdbpp
set EXCLUDE_MODULES=%EXCLUDE_MODULES%,setuptools,pip,distutils,pkg_resources
set EXCLUDE_MODULES=%EXCLUDE_MODULES%,email.mime,http.server,xmlrpc,pydoc

echo.
echo [1/4] æ¸…ç†æ—§ç¼–è¯‘...
if exist dist rd /s /q dist
if exist build rd /s /q build

echo.
echo [2/4] Nuitka ç¼–è¯‘ä¸­ï¼ˆåº”ç”¨ å‚è€ƒé¡¹ç›®ä¼˜åŒ–ç­–ç•¥ï¼‰...
echo - CPU æ ¸å¿ƒ: %CPU_CORES% (ä½¿ç”¨ %BUILD_JOBS% çº¿ç¨‹)
echo - æ¨¡å—æŽ’é™¤: %EXCLUDE_MODULES%
echo.

nuitka --standalone ^
    --windows-console-mode=disable ^
    --lto=yes ^
    --jobs=%BUILD_JOBS% ^
    --enable-plugin=anti-bloat ^
    --enable-plugin=tk-inter ^
    --noinclude-pytest-mode=nofollow ^
    --noinclude-setuptools-mode=nofollow ^
    --nofollow-import-to=%EXCLUDE_MODULES% ^
    --python-flag=no_docstrings ^
    --output-dir=dist ^
    --windows-icon-from-ico=%ICON_FILE% ^
    --remove-output ^
    %MAIN_FILE%

if %errorlevel% neq 0 (
    echo.
    echo [é”™è¯¯] ç¼–è¯‘å¤±è´¥ï¼
    pause
    exit /b 1
)

echo.
echo [3/4] ç»Ÿè®¡ç¼–è¯‘ç»“æžœ...
for /f %%a in ('powershell -NoProfile -Command "(Get-ChildItem -LiteralPath 'dist\%APP_NAME%.dist' -Recurse -File | Measure-Object -Property Length -Sum).Sum"') do set TOTAL_SIZE=%%a
set TOTAL_SIZE=%TOTAL_SIZE:,=%
set /a SIZE_MB=%TOTAL_SIZE% / 1048576
echo - ç¼–è¯‘åŽä½“ç§¯: %SIZE_MB% MB

echo.
echo [4/4] æ‰§è¡Œç˜¦èº«æ¸…ç†ï¼ˆå‚è€ƒ å‚è€ƒé¡¹ç›®ç­–ç•¥ï¼‰...
powershell -ExecutionPolicy Bypass -File slim_dist.ps1 -DistPath "dist\%APP_NAME%.dist"

echo.
echo ========================================
echo ç¼–è¯‘å®Œæˆï¼
echo ========================================
pause
```

### äº”ã€dist ç˜¦èº«è„šæœ¬ï¼ˆå‚è€ƒé¡¹ç›®çº§åˆ«æ¸…ç†ï¼‰

**ä¿å­˜ä¸º `slim_dist.ps1`ï¼ˆå’Œ build_optimized.bat åŒç›®å½•ï¼‰**ï¼š

```powershell
param(
    [string]$DistPath
)

$ErrorActionPreference = "Continue"  # ä¸é™é»˜åžé”™ï¼šåˆ é™¤å¤±è´¥ä¼šæ˜¾ç¤ºå‡ºæ¥ï¼Œé¿å…å‡æˆåŠŸ

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "dist ç˜¦èº«æ¸…ç†ï¼ˆå‚è€ƒ å‚è€ƒé¡¹ç›®ç­–ç•¥ï¼‰" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not (Test-Path $DistPath)) {
    Write-Host "[é”™è¯¯] æ‰¾ä¸åˆ°ç›®å½•: $DistPath" -ForegroundColor Red
    exit 1
}

# ç»Ÿè®¡åˆå§‹ä½“ç§¯
$InitialSize = (Get-ChildItem -Path $DistPath -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "`nåˆå§‹ä½“ç§¯: $([math]::Round($InitialSize, 2)) MB" -ForegroundColor Yellow

# å‚è€ƒé¡¹ç›®ç‰¹å¾ï¼šæ²¡æœ‰ .pdb, .pyi, __pycache__, test ç­‰
Write-Host "`n[åº”ç”¨ å‚è€ƒé¡¹ç›®çš„æ¸…ç†ç­–ç•¥...]" -ForegroundColor Green

# 1. åˆ é™¤è°ƒè¯•ç¬¦å·
Write-Host "`n[1/7] åˆ é™¤ .pdb è°ƒè¯•ç¬¦å·..." -ForegroundColor Green
$pdbFiles = Get-ChildItem -Path $DistPath -Recurse -Include *.pdb -File
$pdbSize = ($pdbFiles | Measure-Object -Property Length -Sum).Sum / 1MB
if ($pdbFiles.Count -gt 0) {
    $pdbFiles | Remove-Item -Force
    Write-Host "  åˆ é™¤ $($pdbFiles.Count) ä¸ªæ–‡ä»¶ï¼ŒèŠ‚çœ $([math]::Round($pdbSize, 2)) MB"
} else {
    Write-Host "  æœªå‘çŽ° .pdb æ–‡ä»¶ï¼ˆå·²ä¼˜åŒ–ï¼‰" -ForegroundColor Gray
}

# 2. åˆ é™¤ç±»åž‹æç¤º
Write-Host "`n[2/7] åˆ é™¤ .pyi ç±»åž‹æç¤º..." -ForegroundColor Green
$pyiFiles = Get-ChildItem -Path $DistPath -Recurse -Include *.pyi -File
$pyiSize = ($pyiFiles | Measure-Object -Property Length -Sum).Sum / 1MB
if ($pyiFiles.Count -gt 0) {
    $pyiFiles | Remove-Item -Force
    Write-Host "  åˆ é™¤ $($pyiFiles.Count) ä¸ªæ–‡ä»¶ï¼ŒèŠ‚çœ $([math]::Round($pyiSize, 2)) MB"
} else {
    Write-Host "  æœªå‘çŽ° .pyi æ–‡ä»¶ï¼ˆå·²ä¼˜åŒ–ï¼‰" -ForegroundColor Gray
}

# 3. åˆ é™¤ __pycache__
Write-Host "`n[3/7] åˆ é™¤ __pycache__ ç¼“å­˜..." -ForegroundColor Green
$pycacheDirs = Get-ChildItem -Path $DistPath -Recurse -Directory -Filter "__pycache__"
$pycacheSize = 0
foreach ($dir in $pycacheDirs) {
    $size = (Get-ChildItem -Path $dir.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $pycacheSize += $size
    Remove-Item -Path $dir.FullName -Recurse -Force
}
if ($pycacheDirs.Count -gt 0) {
    Write-Host "  åˆ é™¤ $($pycacheDirs.Count) ä¸ªç›®å½•ï¼ŒèŠ‚çœ $([math]::Round($pycacheSize / 1MB, 2)) MB"
} else {
    Write-Host "  æœªå‘çŽ° __pycache__ï¼ˆå·²ä¼˜åŒ–ï¼‰" -ForegroundColor Gray
}

# 4. åˆ é™¤æµ‹è¯•ç›®å½•
Write-Host "`n[4/7] åˆ é™¤ test/tests æµ‹è¯•ç›®å½•..." -ForegroundColor Green
$testDirs = Get-ChildItem -Path $DistPath -Recurse -Directory | Where-Object { $_.Name -match '^tests?$' }
$testSize = 0
foreach ($dir in $testDirs) {
    $size = (Get-ChildItem -Path $dir.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $testSize += $size
    Remove-Item -Path $dir.FullName -Recurse -Force
}
if ($testDirs.Count -gt 0) {
    Write-Host "  åˆ é™¤ $($testDirs.Count) ä¸ªç›®å½•ï¼ŒèŠ‚çœ $([math]::Round($testSize / 1MB, 2)) MB"
} else {
    Write-Host "  æœªå‘çŽ°æµ‹è¯•ç›®å½•ï¼ˆå·²ä¼˜åŒ–ï¼‰" -ForegroundColor Gray
}

# 5. åˆ é™¤æ–‡æ¡£å’Œç¤ºä¾‹
Write-Host "`n[5/7] åˆ é™¤ docs/examples æ–‡æ¡£ç›®å½•..." -ForegroundColor Green
$docDirs = Get-ChildItem -Path $DistPath -Recurse -Directory | Where-Object { $_.Name -match '^(docs|examples|samples|demo)$' }
$docSize = 0
foreach ($dir in $docDirs) {
    $size = (Get-ChildItem -Path $dir.FullName -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $docSize += $size
    Remove-Item -Path $dir.FullName -Recurse -Force
}
if ($docDirs.Count -gt 0) {
    Write-Host "  åˆ é™¤ $($docDirs.Count) ä¸ªç›®å½•ï¼ŒèŠ‚çœ $([math]::Round($docSize / 1MB, 2)) MB"
} else {
    Write-Host "  æœªå‘çŽ°æ–‡æ¡£ç›®å½•ï¼ˆå·²ä¼˜åŒ–ï¼‰" -ForegroundColor Gray
}

# 6. åˆ é™¤ .pyc æ–‡ä»¶
Write-Host "`n[6/7] åˆ é™¤ .pyc å­—èŠ‚ç ..." -ForegroundColor Green
$pycFiles = Get-ChildItem -Path $DistPath -Recurse -Include *.pyc -File
$pycSize = ($pycFiles | Measure-Object -Property Length -Sum).Sum / 1MB
if ($pycFiles.Count -gt 0) {
    $pycFiles | Remove-Item -Force
    Write-Host "  åˆ é™¤ $($pycFiles.Count) ä¸ªæ–‡ä»¶ï¼ŒèŠ‚çœ $([math]::Round($pycSize, 2)) MB"
} else {
    Write-Host "  æœªå‘çŽ° .pyc æ–‡ä»¶ï¼ˆå·²ä¼˜åŒ–ï¼‰" -ForegroundColor Gray
}

# 7. ç²¾ç®€ .dist-info å…ƒæ•°æ®
Write-Host "`n[7/7] ç²¾ç®€ .dist-info å…ƒæ•°æ®..." -ForegroundColor Green
$distInfoDirs = Get-ChildItem -Path $DistPath -Recurse -Directory -Filter "*.dist-info"
$removedCount = 0
$removedSize = 0
foreach ($infoDir in $distInfoDirs) {
    # ä»…åˆ å®‰è£…æœŸè®°è´¦æ–‡ä»¶ï¼›ä¿ç•™ METADATA ä¸Ž entry_points.txtï¼ˆè¿è¡ŒæœŸè¢« importlib.metadata è¯»å–ï¼Œåˆ é™¤ä¼šç ´åæ’ä»¶å‘çŽ°ï¼‰
    $filesToRemove = @("RECORD", "INSTALLER", "direct_url.json")
    foreach ($fileName in $filesToRemove) {
        $file = Join-Path $infoDir.FullName $fileName
        if (Test-Path $file) {
            $size = (Get-Item $file).Length
            $removedSize += $size
            Remove-Item $file -Force
            $removedCount++
        }
    }
}
if ($removedCount -gt 0) {
    Write-Host "  åˆ é™¤ $removedCount ä¸ªå…ƒæ•°æ®æ–‡ä»¶ï¼ŒèŠ‚çœ $([math]::Round($removedSize / 1MB, 2)) MB"
} else {
    Write-Host "  æœªå‘çŽ°å¯æ¸…ç†çš„å…ƒæ•°æ®ï¼ˆå·²ä¼˜åŒ–ï¼‰" -ForegroundColor Gray
}

# ç»Ÿè®¡æœ€ç»ˆä½“ç§¯
$FinalSize = (Get-ChildItem -Path $DistPath -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
$SavedSize = $InitialSize - $FinalSize
$SavedPercent = if ($InitialSize -gt 0) { ($SavedSize / $InitialSize) * 100 } else { 0 }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "æ¸…ç†å®Œæˆï¼" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "åˆå§‹ä½“ç§¯: $([math]::Round($InitialSize, 2)) MB" -ForegroundColor Yellow
Write-Host "æœ€ç»ˆä½“ç§¯: $([math]::Round($FinalSize, 2)) MB" -ForegroundColor Green
Write-Host "èŠ‚çœç©ºé—´: $([math]::Round($SavedSize, 2)) MB ($([math]::Round($SavedPercent, 1))%)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# å¯¹æ¯” å‚è€ƒé¡¹ç›®
Write-Host "[å¯¹æ¯”å‚è€ƒ]" -ForegroundColor Yellow
Write-Host "å‚è€ƒé¡¹ç›®æ€»ä½“ç§¯: 323 MB (åŒ…å« PyQt, OpenCV, Playwright ç­‰é‡é‡çº§åº“)" -ForegroundColor Gray
Write-Host "å¦‚æžœä½ çš„é¡¹ç›®æ˜¯çº¯ Tkinter + æ ‡å‡†åº“ï¼Œç›®æ ‡åº”è¯¥åœ¨ 80-150 MB" -ForegroundColor Gray
```

**é¢„æœŸæ•ˆæžœ**ï¼šèŠ‚çœ **15-30%** ä½“ç§¯

### å…­ã€DLL ä¾èµ–åˆ†æžå·¥å…·

**ä¿å­˜ä¸º `analyze_dlls.py`ï¼ˆç”¨äºŽæ‰¾å‡ºä½“ç§¯å¤§æˆ·ï¼‰**ï¼š

```python
"""
DLL ä¾èµ–åˆ†æžå·¥å…·
å‚è€ƒ å‚è€ƒé¡¹ç›®çš„ DLL ç®¡ç†ç­–ç•¥ï¼Œå¸®åŠ©è¯†åˆ«ä½“ç§¯å¤§æˆ·å’Œä¼˜åŒ–å»ºè®®
"""
import sys
from pathlib import Path

def analyze_dlls(dist_path: str):
    """åˆ†æž dist ç›®å½•ä¸­çš„ DLL ä¾èµ–"""
    dist_dir = Path(dist_path)

    if not dist_dir.exists():
        print(f"[é”™è¯¯] ç›®å½•ä¸å­˜åœ¨: {dist_path}")
        return

    print("=" * 70)
    print("DLL ä¾èµ–åˆ†æžï¼ˆå‚è€ƒ å‚è€ƒé¡¹ç›®ç­–ç•¥ï¼‰")
    print("=" * 70)

    # æ”¶é›†æ‰€æœ‰ DLL
    dll_files = list(dist_dir.rglob("*.dll"))

    if not dll_files:
        print("\næœªå‘çŽ° DLL æ–‡ä»¶")
        return

    # æŒ‰å¤§å°æŽ’åº
    dll_data = [(dll, dll.stat().st_size) for dll in dll_files]
    dll_data.sort(key=lambda x: x[1], reverse=True)

    total_size = sum(size for _, size in dll_data)

    print(f"\næ€» DLL æ•°é‡: {len(dll_files)}")
    print(f"æ€» DLL ä½“ç§¯: {total_size / 1024 / 1024:.2f} MB\n")

    # å‚è€ƒé¡¹ç›®å¯¹æ¯”
    print("[å¯¹æ¯”å‚è€ƒ] å‚è€ƒé¡¹ç›®çš„ DLL æƒ…å†µ:")
    print("  - æ€»æ•°é‡: 71 ä¸ª")
    print("  - æ€»ä½“ç§¯: 93.23 MB")
    print("  - æœ€å¤§çš„: libopenblas (26.85 MB), opengl32sw (15.25 MB)\n")

    # åˆ†æžå¤§äºŽ 3MB çš„ DLL
    large_dlls = [(dll, size) for dll, size in dll_data if size > 3 * 1024 * 1024]

    if large_dlls:
        print("=" * 70)
        print("WARNING:  å¤§äºŽ 3MB çš„ DLLï¼ˆéœ€é‡ç‚¹å…³æ³¨ï¼‰")
        print("=" * 70)

        for dll, size in large_dlls:
            size_mb = size / 1024 / 1024
            relative_path = dll.relative_to(dist_dir)
            name_lower = dll.name.lower()

            print(f"\n{size_mb:8.2f} MB  {dll.name}")
            print(f"           ä½ç½®: {relative_path.parent}")

            # ä¼˜åŒ–å»ºè®®
            suggestions = get_optimization_suggestion(name_lower)
            if suggestions:
                for suggestion in suggestions:
                    print(f"            {suggestion}")

    # æ£€æŸ¥å†—ä½™ DLL
    print("\n" + "=" * 70)
    print(" å†—ä½™æ£€æŸ¥")
    print("=" * 70)

    # æ£€æŸ¥è°ƒè¯•ç‰ˆæœ¬
    debug_dlls = [dll for dll, _ in dll_data if dll.stem.endswith('d')]
    if debug_dlls:
        print(f"\nWARNING:  å‘çŽ° {len(debug_dlls)} ä¸ªè°ƒè¯•ç‰ˆæœ¬ DLLï¼ˆå¯ä»¥åˆ é™¤ï¼‰:")
        for dll in debug_dlls:
            print(f"  - {dll.name}")
    else:
        print("\nPASS: æœªå‘çŽ°è°ƒè¯•ç‰ˆæœ¬ DLLï¼ˆå·²ä¼˜åŒ–ï¼‰")

    # VC++ Runtime
    vc_runtimes = [dll for dll, _ in dll_data if 'vcruntime' in dll.name.lower() or 'msvcp' in dll.name.lower()]
    if vc_runtimes:
        print(f"\n[VC++ Runtime åº“] å‘çŽ° {len(vc_runtimes)} ä¸ª:")
        for dll in vc_runtimes:
            size_mb = dll.stat().st_size / 1024 / 1024
            print(f"  - {dll.name} ({size_mb:.2f} MB)")
        print("   è¿™äº›æ˜¯å¿…éœ€çš„ï¼Œå‚è€ƒé¡¹ç›®ä¹ŸåŒ…å«äº†è¿™äº›æ–‡ä»¶")

    # å…¨éƒ¨ DLL åˆ—è¡¨
    print("\n" + "=" * 70)
    print(" å®Œæ•´ DLL åˆ—è¡¨ï¼ˆæŒ‰ä½“ç§¯æŽ’åºï¼Œå‰ 20ï¼‰")
    print("=" * 70)
    print(f"\n{'ä½“ç§¯ (MB)':>10}  {'æ–‡ä»¶å':<30}  ä½ç½®")
    print("-" * 70)

    for dll, size in dll_data[:20]:
        size_mb = size / 1024 / 1024
        relative_path = dll.relative_to(dist_dir)
        location = str(relative_path.parent) if relative_path.parent != Path('.') else "æ ¹ç›®å½•"
        print(f"{size_mb:10.2f}  {dll.name:<30}  {location}")

    if len(dll_data) > 20:
        remaining_size = sum(size for _, size in dll_data[20:]) / 1024 / 1024
        print(f"... è¿˜æœ‰ {len(dll_data) - 20} ä¸ª DLLï¼Œå…± {remaining_size:.2f} MB")


def get_optimization_suggestion(dll_name: str) -> list:
    """æ ¹æ® DLL åç§°ç»™å‡ºä¼˜åŒ–å»ºè®®"""
    suggestions = []

    if "openblas" in dll_name or "mkl" in dll_name:
        suggestions.append("æ•°å­¦è¿ç®—åº“ï¼Œå‚è€ƒé¡¹ç›®çš„ libopenblas æœ‰ 26.85 MB")
        suggestions.append("å¦‚ä¸éœ€è¦é«˜æ€§èƒ½è®¡ç®—å¯è€ƒè™‘è½»é‡ç‰ˆ")

    elif "opencv" in dll_name or "ffmpeg" in dll_name:
        suggestions.append("OpenCV ç›¸å…³ï¼Œå‚è€ƒé¡¹ç›®çš„ opencv_videoio_ffmpeg æœ‰ 18.48 MB")
        suggestions.append("è€ƒè™‘ç”¨ opencv-python-headless")

    elif "qt5" in dll_name or "qt6" in dll_name or "pyside" in dll_name:
        suggestions.append("Qt åº“ï¼Œå‚è€ƒé¡¹ç›®çš„ Qt5Core æœ‰ 5.13 MB")
        suggestions.append("å¯æŽ’é™¤ä¸éœ€è¦çš„æ¨¡å—ï¼ˆWebEngine, 3D, Chartsï¼‰")

    elif "opengl" in dll_name and "sw" in dll_name:
        suggestions.append("OpenGL è½¯ä»¶æ¸²æŸ“å™¨ï¼Œå‚è€ƒé¡¹ç›®ä¿ç•™äº† 15.25 MB")
        suggestions.append("é€šå¸¸å¯ä»¥åˆ é™¤ï¼ˆä½¿ç”¨ç¡¬ä»¶æ¸²æŸ“ï¼‰")

    elif "d3dcompiler" in dll_name:
        suggestions.append("DirectX ç¼–è¯‘å™¨ï¼Œå‚è€ƒé¡¹ç›®æœ‰ 3.53 MB")

    elif "mfc140" in dll_name:
        suggestions.append("MFC åº“ï¼Œå‚è€ƒé¡¹ç›®æœ‰ 4.89 MB")

    return suggestions


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ç”¨æ³•: python analyze_dlls.py <distç›®å½•è·¯å¾„>")
        print("ç¤ºä¾‹: python analyze_dlls.py dist/main.dist")
        sys.exit(1)

    analyze_dlls(sys.argv[1])
```

**ä½¿ç”¨æ–¹æ³•**ï¼š
```bash
python analyze_dlls.py dist/ä½ çš„è½¯ä»¶å.dist
```

---

## å®Œæ•´ä¼˜åŒ–å·¥ä½œæµ

### æ­¥éª¤ 1ï¼šä¿®æ”¹ç¼–è¯‘è„šæœ¬é…ç½®

ç¼–è¾‘ `build_optimized.bat`ï¼Œä¿®æ”¹è¿™ 3 è¡Œï¼š

```batch
set APP_NAME=ä½ çš„è½¯ä»¶å      REM æ”¹æˆå®žé™…åç§°
set MAIN_FILE=main.py        REM ä½ çš„ä¸»ç¨‹åºæ–‡ä»¶
set ICON_FILE=icon.ico       REM ä½ çš„å›¾æ ‡æ–‡ä»¶
```

### æ­¥éª¤ 2ï¼šä¸€é”®ç¼–è¯‘+ç˜¦èº«

```bash
# åœ¨é¡¹ç›®æ ¹ç›®å½•æ‰§è¡Œ
build_optimized.bat
```

### æ­¥éª¤ 3ï¼šåˆ†æž DLL ä¾èµ–

```bash
python analyze_dlls.py dist/ä½ çš„è½¯ä»¶å.dist
```

### æ­¥éª¤ 4ï¼šæ ¹æ®åˆ†æžç»“æžœä¼˜åŒ–

**å¦‚æžœç”¨äº† OpenCV** â†’ æ”¹ç”¨æ— å¤´ç‰ˆ
```bash
pip uninstall opencv-python
pip install opencv-python-headless
```

**å¦‚æžœç”¨äº† Qt** â†’ æŽ’é™¤ä¸éœ€è¦çš„æ¨¡å—
```batch
# åœ¨ç¼–è¯‘å‘½ä»¤ä¸­æ·»åŠ 
--nofollow-import-to=PyQt5.QtWebEngine,PyQt5.Qt3D,PyQt5.QtCharts
```

**åˆ é™¤è½¯ä»¶æ¸²æŸ“å™¨**ï¼ˆå¦‚æžœä¸éœ€è¦ï¼‰
```powershell
# åœ¨ dist ç›®å½•æ‰§è¡Œ
Remove-Item "opengl32sw.dll" -Force
```

---

## VC++ è¿è¡Œåº“å¤„ç†æ–¹æ¡ˆ

### æ–¹æ¡ˆä¸€ï¼šé™æ€é“¾æŽ¥ï¼ˆæŽ¨èï¼‰
```bash
nuitka --static-libpython=yes ...
```

### æ–¹æ¡ˆäºŒï¼šæ†ç»‘è¿è¡Œåº“å®‰è£…ï¼ˆå•†ä¸šå‘å¸ƒæŽ¨èï¼‰
åœ¨ Inno Setup è„šæœ¬ä¸­æ·»åŠ ï¼š

```iss
; WARNING: VC++ è¿è¡Œåº“æž¶æž„å¿…é¡»ä¸Ž Python/Nuitka æž„å»ºæž¶æž„ä¸€è‡´ã€‚
; æœ¬ skill æŽ¨è 32 ä½ Pythonï¼Œæ•…é»˜è®¤æ†ç»‘ vc_redist.x86.exeï¼›
; è‹¥ç”¨ 64 ä½ Python ç¼–è¯‘ï¼Œè¯·æŠŠä¸‹é¢ä¸¤å¤„æ”¹ä¸º vc_redist.x64.exeã€‚
[Files]
Source: "{#MySourceDir}\..\vc_redist.x86.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Run]
Filename: "{tmp}\vc_redist.x86.exe"; Parameters: "/quiet /norestart"; StatusMsg: "æ­£åœ¨å®‰è£…è¿è¡Œåº“..."; Flags: waituntilterminated
```

> ä¸‹è½½åœ°å€ï¼š[Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)

---

## Inno Setup è„šæœ¬æ¨¡æ¿ï¼ˆå•†ä¸šç»ˆæžç‰ˆï¼‰

```iss
; =====================================================================
;  WARNING: å•†ä¸šçº§ Python å®‰è£…è„šæœ¬ (Inno Setup 6.x)
;  ç‰¹æ€§ï¼šLZMA2 æžé™åŽ‹ç¼© | å…¨ä¸­æ–‡ | å®Œæ•´å…ƒæ•°æ® | æ— æ®‹ç•™å¸è½½
;  å‚è€ƒï¼šå‚è€ƒé¡¹ç›®(323 MB, LZMA2 åŽ‹ç¼©)
; =====================================================================

; --- 1. å‚æ•°å®šä¹‰ ---
#define MyAppName        "{{APP_NAME}}"
#define MyAppVersion     "{{APP_VERSION}}"
#define MyAppPublisher   "{{PUBLISHER}}"
#define MyAppURL         "{{APP_URL}}"
#define MyAppExeName     "{{EXE_NAME}}"
#define MySourceDir      "{{SOURCE_DIR}}"
#define MyOutputDir      "{{OUTPUT_DIR}}"
;#define MyIconPath      "{{ICON_PATH}}"

[Setup]
; --- èº«ä»½è¯†åˆ« ---
AppId={{GENERATE_RANDOM_GUID}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; --- å®‰è£…è·¯å¾„ä¸Žæƒé™ ---
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableDirPage=no
DisableProgramGroupPage=no
PrivilegesRequired=admin

; --- è¾“å‡ºè®¾ç½® ---
OutputDir={#MyOutputDir}
OutputBaseFilename=Setup_{#MyAppName}_v{#MyAppVersion}

; --- è§†è§‰ä½“éªŒ ---
WizardStyle=modern
#ifdef MyIconPath
SetupIconFile={#MyIconPath}
UninstallDisplayIcon={app}\{#MyAppExeName}
#endif

; ---  æ ¸å¿ƒåŽ‹ç¼© (å‚è€ƒ å‚è€ƒé¡¹ç›®) ---
Compression=lzma2/ultra64
SolidCompression=yes
LZMAUseSeparateProcess=yes

; --- æž¶æž„ ---
; æ³¨æ„ï¼šä»… 64 ä½ Python æž„å»ºæ‰è®¾æ­¤é¡¹ã€‚æœ¬ skill æŽ¨è 32 ä½ Pythonâ€”â€”
; 32 ä½æž„å»ºè¯·ä¿æŒæ³¨é‡Šï¼Œä½¿åº”ç”¨æŒ‰ 32 ä½å®‰è£…å¹¶ä¸Žä¸Šé¢æ†ç»‘çš„ vc_redist.x86.exe åŒ¹é…ã€‚
; ä»…å½“ç”¨ 64 ä½ Python ç¼–è¯‘æ—¶æ‰å–æ¶ˆæ³¨é‡Šã€‚
;ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Files]
Source: "{#MySourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[UninstallDelete]
Type: filesandordirs; Name: "{app}\*"

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\å¸è½½ {#MyAppName}"; Filename: "{uninstallexe}"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
```

---

## å ä½ç¬¦è¯´æ˜Ž

| å ä½ç¬¦ | è¯´æ˜Ž | ç¤ºä¾‹å€¼ |
|--------|------|--------|
| `{{APP_NAME}}` | è½¯ä»¶æ˜¾ç¤ºåç§° | `çº¢å¢¨æ‰¹æ³¨` |
| `{{APP_VERSION}}` | ç‰ˆæœ¬å· | `1.0.0` |
| `{{PUBLISHER}}` | å‘å¸ƒè€…/å…¬å¸å | `MyCompany` |
| `{{APP_URL}}` | å®˜ç½‘åœ°å€ | `https://example.com` |
| `{{EXE_NAME}}` | ä¸»ç¨‹åºæ–‡ä»¶å | `RedInk.exe` |
| `{{SOURCE_DIR}}` | Nuitka dist æ–‡ä»¶å¤¹è·¯å¾„ | `D:\project\dist\RedInk.dist` |
| `{{OUTPUT_DIR}}` | å®‰è£…åŒ…è¾“å‡ºè·¯å¾„ | `D:\project\output` |
| `{{ICON_PATH}}` | å›¾æ ‡æ–‡ä»¶è·¯å¾„ | `D:\project\icon.ico` |
| `{{GENERATE_RANDOM_GUID}}` | **éœ€ç”Ÿæˆå”¯ä¸€GUID** | ä½¿ç”¨ Inno Setup "Tools > Generate GUID" |

---

## å¸¸è§é—®é¢˜ (FAQ)

### Q1: å®‰è£…åŽåŒå‡»ç¨‹åºæ— ååº”ï¼Ÿ
1. æ‰“å¼€ CMDï¼Œæ‰‹åŠ¨è¿è¡Œ exe æŸ¥çœ‹é”™è¯¯ä¿¡æ¯
2. æ£€æŸ¥æ˜¯å¦ç¼ºå°‘ VC++ è¿è¡Œåº“
3. æ£€æŸ¥ Nuitka ç¼–è¯‘æ˜¯å¦æˆåŠŸ

### Q2: å®‰è£…åŒ…ä½“ç§¯è¿‡å¤§ï¼Ÿ
**ä¼˜åŒ–æ–¹æ³•**ï¼š
1. ä½¿ç”¨ 32 ä½ Python ç¼–è¯‘ï¼ˆèŠ‚çœ 20-30%ï¼‰
2. åº”ç”¨ å‚è€ƒé¡¹ç›®çš„æ¨¡å—æŽ’é™¤æ¸…å•
3. å¯ç”¨ Anti-Bloat æ’ä»¶
4. æ‰§è¡Œ dist æ–‡ä»¶å¤¹ç˜¦èº«è„šæœ¬
5. åˆ†æž DLLï¼Œç§»é™¤ä¸å¿…è¦çš„å¤§æ–‡ä»¶

### Q3: æ€æ¯’è½¯ä»¶è¯¯æŠ¥ï¼Ÿ
**è§£å†³æ–¹æ¡ˆ**ï¼š
- æäº¤åˆ°ä¸»æµæ€æ¯’åŽ‚å•†è¿›è¡Œç™½åå•ç”³è¯·
- è´­ä¹°ä»£ç ç­¾åè¯ä¹¦ï¼ˆæŽ¨èï¼šSectigo, DigiCertï¼‰
- é¿å…ä½¿ç”¨ UPX åŽ‹ç¼©

### Q4: å®‰è£…æ—¶æç¤º Windows å·²ä¿æŠ¤ä½ çš„ç”µè„‘ï¼Ÿ
- è´­ä¹° EV ä»£ç ç­¾åè¯ä¹¦ï¼ˆå¯ç«‹å³èŽ·å¾—ä¿¡ä»»ï¼‰
- æ™®é€šä»£ç ç­¾åè¯ä¹¦éœ€è¦ç§¯ç´¯å®‰è£…é‡åŽé€æ¸èŽ·å¾—ä¿¡ä»»

---

## å®žæˆ˜é—®é¢˜å¤„ç†è®°å½•ï¼ˆæ›´æ–° 2026-02-07ï¼‰

- **å®‰è£…åŽæç¤ºç¼ºå°‘ python3xx.dll**ï¼šå¿…é¡»ä½¿ç”¨ Nuitka `--standalone`ï¼›ç¡®è®¤ dist å†…å­˜åœ¨è¯¥ dllï¼›ä¸è¦æ‰“å•æ–‡ä»¶ç‰ˆã€‚
- **å®‰è£…åŽç‚¹å‡»æ— ååº”**ï¼šGUI å¯åŠ¨æœŸå¯èƒ½è¢«é‡ä¾èµ–é˜»å¡žï¼›å°†é‡ä¾èµ–å»¶è¿Ÿåˆ°"å¼€å§‹å¯¼å‡º"å† importï¼›æ·»åŠ æ—¥å¿—æŽ’æŸ¥ã€‚
- **Nuitka + MinGW åœ¨éž ASCII è·¯å¾„æŠ¥é”™**ï¼šæŠŠæºç å¤åˆ¶åˆ° ASCII ç›®å½•å†ç¼–è¯‘ï¼›è®¾ç½® `PYTHONIOENCODING=utf-8`ã€‚
- **Inno Setup è­¦å‘Š `x64` å·²å¼ƒç”¨ï¼ˆä»… 64 ä½æž„å»ºéœ€è¦ 64 ä½å®‰è£…æ¨¡å¼æ—¶ï¼‰**ï¼šæ”¹ä¸º `ArchitecturesInstallIn64BitMode=x64compatible`ï¼›32 ä½æž„å»ºæ— éœ€æ­¤é¡¹ã€‚
- **`--disable-console` å·²åºŸå¼ƒ**ï¼šæ”¹ç”¨ `--windows-console-mode=disable`ã€‚
- **dist å‡ºçŽ° `_nuitka_temp.exe`**ï¼šåœ¨ [Files] ä¸­æŽ’é™¤å®ƒã€‚

---

## ä¼˜åŒ–æ•ˆæžœé¢„æœŸ

| ä¼˜åŒ–ç»„åˆ | ä½“ç§¯å‡å°‘ | å¯åŠ¨æå‡ | é£Žé™©ç­‰çº§ |
|----------|----------|----------|----------|
| åŸºç¡€ç¼–è¯‘ | åŸºå‡† | åŸºå‡† | æ—  |
| + `--lto=yes` | 5-10% | 10-20% | PASS: æ—  |
| + anti-bloat | 15-25% | - | PASS: æ—  |
| + æ¨¡å—æŽ’é™¤ | 20-35% | 5% | PASS: æ—  |
| + dist ç˜¦èº« | 25-40% | - | PASS: æ—  |
| + 32 ä½ç¼–è¯‘ | 40-60% | - | PASS: æ—  |
| **å…¨éƒ¨ç»„åˆ** | **45-65%** | **15-25%** | PASS: **æ— é£Žé™©** |

> WARNING: **ä¸å»ºè®®ä½¿ç”¨ UPX åŽ‹ç¼©**ï¼Œè™½ç„¶èƒ½è¿›ä¸€æ­¥å‡å°ä½“ç§¯ï¼Œä½†æžæ˜“è§¦å‘æ€æ¯’è½¯ä»¶è¯¯æŠ¥ã€‚

---

**åŸºäºŽ å‚è€ƒé¡¹ç›®å®žæˆ˜ç»éªŒä¼˜åŒ–ï¼ŒåŠ©ä½ æ‰“é€ å•†ä¸šçº§å®‰è£…åŒ…ï¼**
