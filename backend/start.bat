@echo off
REM Allesinda Backend - Start Script for Windows
REM This script starts the FastAPI development server

echo ========================================
echo  Allesinda Backend - Starting Server
echo ========================================
echo.

REM Check if virtual environment exists
if not exist ".venv" (
    echo Virtual environment not found!
    echo Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo Failed to create virtual environment!
        pause
        exit /b 1
    )
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo Failed to activate virtual environment!
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo WARNING: .env file not found!
    echo Copying .env.example to .env...
    if exist ".env.example" (
        copy .env.example .env
        echo Please edit .env file with your configuration!
    ) else (
        echo ERROR: .env.example not found!
        pause
        exit /b 1
    )
)

REM Install/upgrade dependencies
echo.
echo Installing/updating dependencies...
pip install --upgrade pip
pip install -r requirements.txt
if errorlevel 1 (
    echo Failed to install dependencies!
    pause
    exit /b 1
)

REM Start the server
echo.
echo ========================================
echo  Starting FastAPI server...
echo ========================================
echo.
echo Server will be available at:
echo   - API: http://127.0.0.1:8000
echo   - Docs: http://127.0.0.1:8000/docs
echo   - ReDoc: http://127.0.0.1:8000/redoc
echo.
echo Press Ctrl+C to stop the server
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause

