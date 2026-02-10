#!/bin/bash

# Allesinda Local Testing Setup Script
# This script helps verify your local testing environment

echo "🧪 Allesinda Local Testing Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1. Checking backend API..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API is running on http://localhost:8000${NC}"
else
    if curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API is running on http://localhost:8000/api/health${NC}"
    else
        echo -e "${RED}❌ Backend API is not running on http://localhost:8000${NC}"
        echo -e "${YELLOW}   Please start your backend server first${NC}"
        BACKEND_ERROR=true
    fi
fi

echo ""

# Check if frontend is running
echo "2. Checking frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running on http://localhost:3000${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is not running on http://localhost:3000${NC}"
    echo -e "${YELLOW}   Start it with: npm run dev${NC}"
fi

echo ""

# Check environment variables
echo "3. Checking environment variables..."
if [ -f .env.local ]; then
    echo -e "${GREEN}✅ .env.local file exists${NC}"
    if grep -q "NEXT_PUBLIC_API_URL" .env.local; then
        API_URL=$(grep "NEXT_PUBLIC_API_URL" .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
        echo -e "${GREEN}✅ NEXT_PUBLIC_API_URL is set to: ${API_URL}${NC}"
    else
        echo -e "${RED}❌ NEXT_PUBLIC_API_URL is not set in .env.local${NC}"
        echo -e "${YELLOW}   Add: NEXT_PUBLIC_API_URL=http://localhost:8000${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local file not found${NC}"
    echo -e "${YELLOW}   Creating .env.local with default values...${NC}"
    cat > .env.local << EOF
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
EOF
    echo -e "${GREEN}✅ Created .env.local file${NC}"
    echo -e "${YELLOW}   Please review and update the values if needed${NC}"
fi

echo ""

# Check Node.js version
echo "4. Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Node.js is installed: ${NODE_VERSION}${NC}"
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✅ Node.js version is 18+ (required)${NC}"
    else
        echo -e "${RED}❌ Node.js version is below 18 (current: ${NODE_VERSION})${NC}"
        echo -e "${YELLOW}   Please upgrade to Node.js 18 or higher${NC}"
    fi
else
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo -e "${YELLOW}   Please install Node.js 18 or higher${NC}"
fi

echo ""

# Check if dependencies are installed
echo "5. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ Dependencies are installed${NC}"
else
    echo -e "${YELLOW}⚠️  Dependencies are not installed${NC}"
    echo -e "${YELLOW}   Run: npm install${NC}"
fi

echo ""

# Summary
echo "=================================="
if [ "$BACKEND_ERROR" = true ]; then
    echo -e "${RED}❌ Setup incomplete. Please fix the issues above.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Setup looks good!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Make sure backend is running on http://localhost:8000"
    echo "2. Start frontend: npm run dev"
    echo "3. Open http://localhost:3000 in your browser"
    echo "4. Check browser console for any errors"
    echo ""
    echo "For detailed testing guide, see LOCAL_TESTING.md"
fi

