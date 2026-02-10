#!/bin/bash
# Allesinda Backend - Start Script for Linux/Mac
# This script starts the FastAPI development server

set -e  # Exit on error

echo "========================================"
echo " Allesinda Backend - Starting Server"
echo "========================================"
echo ""

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Virtual environment not found!"
    echo "Creating virtual environment..."
    python3 -m venv .venv
    if [ $? -ne 0 ]; then
        echo "Failed to create virtual environment!"
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate
if [ $? -ne 0 ]; then
    echo "Failed to activate virtual environment!"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found!"
    echo "Copying .env.example to .env..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Please edit .env file with your configuration!"
    else
        echo "ERROR: .env.example not found!"
        exit 1
    fi
fi

# Install/upgrade dependencies
echo ""
echo "Installing/updating dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies!"
    exit 1
fi

# Start the server
echo ""
echo "========================================"
echo " Starting FastAPI server..."
echo "========================================"
echo ""
echo "Server will be available at:"
echo "  - API: http://127.0.0.1:8000"
echo "  - Docs: http://127.0.0.1:8000/docs"
echo "  - ReDoc: http://127.0.0.1:8000/redoc"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

