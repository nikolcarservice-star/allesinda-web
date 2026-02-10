# Allesinda Local Testing Setup Script (PowerShell)
# This script helps verify your local testing environment on Windows

Write-Host "🧪 Allesinda Local Testing Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "1. Checking backend API..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Backend API is running on http://localhost:8000" -ForegroundColor Green
} catch {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
        Write-Host "✅ Backend API is running on http://localhost:8000/api/health" -ForegroundColor Green
    } catch {
        Write-Host "❌ Backend API is not running on http://localhost:8000" -ForegroundColor Red
        Write-Host "   Please start your backend server first" -ForegroundColor Yellow
        $BackendError = $true
    }
}

Write-Host ""

# Check if frontend is running
Write-Host "2. Checking frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Frontend is running on http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Frontend is not running on http://localhost:3000" -ForegroundColor Yellow
    Write-Host "   Start it with: npm run dev" -ForegroundColor Yellow
}

Write-Host ""

# Check environment variables
Write-Host "3. Checking environment variables..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local file exists" -ForegroundColor Green
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "NEXT_PUBLIC_API_URL") {
        $apiUrl = ($envContent -split "`n" | Where-Object { $_ -match "NEXT_PUBLIC_API_URL" }) -replace ".*=(.*)", '$1' -replace '"', '' -replace "'", '' -replace '\s', ''
        Write-Host "✅ NEXT_PUBLIC_API_URL is set to: $apiUrl" -ForegroundColor Green
    } else {
        Write-Host "❌ NEXT_PUBLIC_API_URL is not set in .env.local" -ForegroundColor Red
        Write-Host "   Add: NEXT_PUBLIC_API_URL=http://localhost:8000" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  .env.local file not found" -ForegroundColor Yellow
    Write-Host "   Creating .env.local with default values..." -ForegroundColor Yellow
    @"
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "✅ Created .env.local file" -ForegroundColor Green
    Write-Host "   Please review and update the values if needed" -ForegroundColor Yellow
}

Write-Host ""

# Check Node.js version
Write-Host "4. Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js is installed: $nodeVersion" -ForegroundColor Green
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -ge 18) {
        Write-Host "✅ Node.js version is 18+ (required)" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js version is below 18 (current: $nodeVersion)" -ForegroundColor Red
        Write-Host "   Please upgrade to Node.js 18 or higher" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    Write-Host "   Please install Node.js 18 or higher" -ForegroundColor Yellow
}

Write-Host ""

# Check if dependencies are installed
Write-Host "5. Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✅ Dependencies are installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Dependencies are not installed" -ForegroundColor Yellow
    Write-Host "   Run: npm install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
if ($BackendError) {
    Write-Host "❌ Setup incomplete. Please fix the issues above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Setup looks good!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Make sure backend is running on http://localhost:8000"
    Write-Host "2. Start frontend: npm run dev"
    Write-Host "3. Open http://localhost:3000 in your browser"
    Write-Host "4. Check browser console for any errors"
    Write-Host ""
    Write-Host "For detailed testing guide, see LOCAL_TESTING.md" -ForegroundColor Cyan
}

