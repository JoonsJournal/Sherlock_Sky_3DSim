@echo off
REM Conda 환경 자동 설정 스크립트 (Windows)
REM 사용법: setup_conda_env.bat

echo ================================================
echo   SHERLOCK_SKY_3DSIM 백엔드 환경 설정
echo ================================================
echo.

REM 1. Conda 설치 확인
echo [1/5] Conda 설치 확인 중…
where conda >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
echo ❌ Conda가 설치되어 있지 않습니다.
echo    https://docs.conda.io/en/latest/miniconda.html 에서 설치하세요.
pause
exit /b 1
)
conda –version
echo ✓ Conda 설치 확인 완료
echo.

REM 2. environment.yml 확인
echo [2/5] environment.yml 파일 확인 중…
if not exist “environment.yml” (
echo ❌ environment.yml 파일을 찾을 수 없습니다.
echo    현재 디렉토리: %CD%
pause
exit /b 1
)
echo ✓ environment.yml 파일 발견
echo.

REM 3. 기존 환경 확인
echo [3/5] 기존 환경 확인 중…
conda env list | findstr “sherlockSky3DSimBackend” >nul 2>nul
if %ERRORLEVEL% EQU 0 (
echo ⚠️  ‘sherlockSky3DSimBackend’ 환경이 이미 존재합니다.
set /p REPLY=”   삭제하고 다시 생성하시겠습니까? (y/N): “
if /i “%REPLY%”==“y” (
echo    기존 환경 삭제 중…
conda env remove -n sherlockSky3DSimBackend -y
echo    ✓ 삭제 완료
) else (
echo    환경 생성을 건너뜁니다.
pause
exit /b 0
)
)
echo.

REM 4. 환경 생성
echo [4/5] Conda 환경 생성 중… (5-10분 소요)
echo    환경 이름: sherlockSky3DSimBackend
echo    Python 버전: 3.11
echo.

conda env create -f environment.yml

if %ERRORLEVEL% NEQ 0 (
echo ❌ 환경 생성 실패
pause
exit /b 1
)

echo.
echo ✓ 환경 생성 완료
echo.

REM 5. 설치 확인
echo [5/5] 설치 확인 중…

REM 임시 테스트 스크립트 생성
echo import sys > %TEMP%\test_imports.py
echo try: >> %TEMP%\test_imports.py
echo     import fastapi >> %TEMP%\test_imports.py
echo     import simpy >> %TEMP%\test_imports.py
echo     import asyncpg >> %TEMP%\test_imports.py
echo     import redis >> %TEMP%\test_imports.py
echo     import numpy >> %TEMP%\test_imports.py
echo     print(“✓ 모든 주요 패키지 설치 완료”) >> %TEMP%\test_imports.py
echo     print(f”  - FastAPI: {fastapi.**version**}”) >> %TEMP%\test_imports.py
echo     print(f”  - SimPy: {simpy.**version**}”) >> %TEMP%\test_imports.py
echo     print(f”  - NumPy: {numpy.**version**}”) >> %TEMP%\test_imports.py
echo except ImportError as e: >> %TEMP%\test_imports.py
echo     print(f”❌ 패키지 import 실패: {e}”) >> %TEMP%\test_imports.py
echo     sys.exit(1) >> %TEMP%\test_imports.py

conda run -n sherlockSky3DSimBackend python %TEMP%\test_imports.py

del %TEMP%\test_imports.py

echo.
echo ================================================
echo   설치 완료!
echo ================================================
echo.
echo 다음 명령어로 환경을 활성화하세요:
echo.
echo   conda activate sherlockSky3DSimBackend
echo.
echo 환경 비활성화:
echo   conda deactivate
echo.
echo 설치된 패키지 확인:
echo   conda list
echo.
echo ================================================
pause