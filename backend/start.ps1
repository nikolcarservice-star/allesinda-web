# Allesinda Backend - Start Script for Windows PowerShell
# This script starts the FastAPI development server

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Allesinda Backend - Starting Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
if (-Not (Test-Path ".venv")) {
    Write-Host "Virtual environment not found!" -ForegroundColor Yellow
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create virtual environment!" -ForegroundColor Red
        exit 1
    }
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Green

$venvActivated = $false

# Try to set execution policy for current process (if needed)
$currentPolicy = Get-ExecutionPolicy -Scope Process
if ($currentPolicy -eq "Restricted") {
    Write-Host "Setting execution policy for current process..." -ForegroundColor Yellow
    try {
        Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force -ErrorAction Stop
    } catch {
        Write-Host "Could not set execution policy automatically. Using alternative activation method..." -ForegroundColor Yellow
    }
}

# Try to activate the virtual environment
try {
    & .venv\Scripts\Activate.ps1 -ErrorAction Stop
    $venvActivated = $true
} catch {
    Write-Host "PowerShell activation failed (likely due to execution policy). Using direct method..." -ForegroundColor Yellow
    # Set Python path directly instead of activating
    $venvPath = (Resolve-Path ".venv").Path
    $env:VIRTUAL_ENV = $venvPath
    $env:PATH = "$venvPath\Scripts;$env:PATH"
    $pythonPath = "$venvPath\Scripts\python.exe"
    if (-Not (Test-Path $pythonPath)) {
        Write-Host "ERROR: Python executable not found in virtual environment!" -ForegroundColor Red
        exit 1
    }
}

# Set command paths - use direct paths if activation failed
if ($venvActivated) {
    $pythonCmd = "python"
    $pipCmd = "pip"
    $uvicornCmd = "uvicorn"
} else {
    $venvPath = (Resolve-Path ".venv").Path
    $pythonCmd = "$venvPath\Scripts\python.exe"
    $pipCmd = "$venvPath\Scripts\pip.exe"
    $uvicornCmd = "$venvPath\Scripts\uvicorn.exe"
}

# Check if .env file exists
if (-Not (Test-Path ".env")) {
    Write-Host "WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "Copying .env.example to .env..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Please edit .env file with your configuration!" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: .env.example not found!" -ForegroundColor Red
        exit 1
    }
}

# Install/upgrade dependencies
Write-Host ""
Write-Host "Installing/updating dependencies..." -ForegroundColor Green

& $pythonCmd -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to upgrade pip!" -ForegroundColor Red
    exit 1
}
& $pipCmd install -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies!" -ForegroundColor Red
    exit 1
}

# Start the server
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting FastAPI server..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server will be available at:" -ForegroundColor Green
Write-Host "  - API: http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  - Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  - ReDoc: http://127.0.0.1:8000/redoc" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

& $uvicornCmd app.main:app --reload --host 0.0.0.0 --port 8000

