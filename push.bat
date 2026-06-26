@echo off
setlocal enabledelayedexpansion
cd /d C:\Amalgamate\Projects\TreadSCORE

echo.
echo ==========================================
echo   TreadSCORE - Git Push + Deploy Utility
echo ==========================================
echo.

:: ── 1. Show changed files ──────────────────
echo Changed files:
git status --short
echo.

:: ── 2. Commit message ─────────────────────
set /p MSG="Enter commit message (or press Enter for default): "
if "%MSG%"=="" set MSG=update: auto-commit from push.bat

:: ── 3. Stage + commit ─────────────────────
git add -A
git commit -m "%MSG%"
if %ERRORLEVEL%==1 (
  echo Nothing to commit.
  goto deploy_prompt
)

:: ── 4. Push to remotes ────────────────────
echo.
echo Pushing to origin (Amalgamate)...
git push origin main

git remote get-url personal >nul 2>&1
if %ERRORLEVEL%==0 (
  echo Pushing to personal remote (Ricoamal)...
  git push personal main
)

:: ── 5. Deploy prompt ──────────────────────
:deploy_prompt
echo.
set /p DODEPLOY="Deploy to schools? (y/n): "
if /i not "%DODEPLOY%"=="y" goto end

:: ── 6. Show available schools ─────────────
echo.
echo Available schools:
echo.
echo   ID                    LABEL                          DOMAIN
echo   ---------------------------------------------------------------------------
echo   demo                  Canary - Demo School           demoschool.trendscore.co.ke
echo   ighs                  IGHS                           ighs.trendscore.co.ke
echo   jrn                   JRN - Zawadi                   zawadi.trendscore.co.ke
echo   kambigarba-cs         Kambi Garba CS                 kambigarba-cs.trendscore.co.ke
echo   lionscomplex          Lions Complex                  lionscomplex.trendscore.co.ke
echo   mck                   MCK                            mck.trendscore.co.ke
echo   merti-cs              Merti Complex School           merti-cs.trendscore.co.ke
echo.
echo   all_schools           Deploy to ALL production schools
echo   pilot                 Deploy to all PILOT tier schools
echo.

:: ── 7. School selection ───────────────────
set /p SCHOOLS="Enter school IDs separated by commas (e.g. ighs,mck,merti-cs): "
if "%SCHOOLS%"=="" (
  echo No schools entered. Skipping deploy.
  goto end
)

:: ── 8. Image tag ──────────────────────────
echo.
set /p IMAGE_TAG="Enter image tag to deploy (or press Enter for 'latest'): "
if "%IMAGE_TAG%"=="" set IMAGE_TAG=latest

:: ── 9. Get GitHub repo and token ──────────
for /f "tokens=*" %%i in ('git remote get-url origin') do set ORIGIN_URL=%%i
:: Extract owner/repo from URL (handles both https and git@ formats)
set REPO=Amalgamate/trendscore

echo.
echo ==========================================
echo   Triggering GitHub Deploy Workflows
echo ==========================================
echo.

:: ── 10. Loop through school IDs ───────────
set SCHOOLS_INPUT=%SCHOOLS%

:loop
for /f "tokens=1* delims=," %%a in ("%SCHOOLS_INPUT%") do (
  set SCHOOL_ID=%%a
  set SCHOOLS_INPUT=%%b

  :: Trim spaces
  for /f "tokens=* delims= " %%x in ("!SCHOOL_ID!") do set SCHOOL_ID=%%x

  if "!SCHOOL_ID!"=="all_schools" (
    echo [!SCHOOL_ID!] Triggering deploy to ALL schools...
    call :trigger_workflow all_schools !SCHOOL_ID! %IMAGE_TAG%
  ) else if "!SCHOOL_ID!"=="pilot" (
    echo [!SCHOOL_ID!] Triggering deploy to PILOT schools...
    call :trigger_workflow pilot "" %IMAGE_TAG%
  ) else (
    echo [!SCHOOL_ID!] Triggering deploy for school: !SCHOOL_ID!...
    call :trigger_workflow selected_school !SCHOOL_ID! %IMAGE_TAG%
  )
)

if not "%SCHOOLS_INPUT%"=="" goto loop

goto end

:: ── Subroutine: trigger GitHub Actions workflow ──
:trigger_workflow
set DEPLOY_TARGET=%~1
set SCHOOL=%~2
set TAG=%~3

:: Check if gh CLI is available
where gh >nul 2>&1
if %ERRORLEVEL%==0 (
  :: Use GitHub CLI
  if "%SCHOOL%"=="" (
    gh workflow run promote-release.yml --repo %REPO% -f branch=%TAG% -f school_slug=%DEPLOY_TARGET% -f environment=production
  ) else (
    gh workflow run promote-release.yml --repo %REPO% -f branch=%TAG% -f school_slug=%SCHOOL% -f environment=production
  )
  if %ERRORLEVEL%==0 (
    echo   [OK] Workflow triggered successfully.
    echo   Monitor at: https://github.com/%REPO%/actions
  ) else (
    echo   [ERROR] Failed to trigger workflow. Check gh auth status.
  )
) else (
  echo   [INFO] GitHub CLI (gh) not found.
  echo   To trigger manually, go to:
  echo   https://github.com/%REPO%/actions/workflows/promote-release.yml
  echo   And dispatch with: school_slug=%SCHOOL% environment=production branch=%TAG%
)
goto :eof

:end
echo.
echo ==========================================
echo   All done!
echo ==========================================
echo.
pause
