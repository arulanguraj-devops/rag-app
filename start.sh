#!/bin/bash

# QurHealth RAG App Startup Script
# This script starts both the backend and frontend services

echo "🚀 Starting QurHealth RAG Application..."

# Check if we're in the correct directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the rag-app root directory"
    echo "   Expected structure: rag-app/backend and rag-app/frontend"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists python3; then
    echo "❌ Python 3 is required but not found"
    exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is required but not found"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is required but not found"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Check if virtual environment exists
if [ ! -d "rag-venv" ]; then
    echo "❌ Virtual environment 'rag-venv' not found"
    echo "   Please create it first: python3 -m venv rag-venv"
    exit 1
fi

# Check if backend dependencies are installed
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Warning: Backend .env file not found"
    echo "   Please create backend/.env with your API_KEY and OPENAI_API_KEY"
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install frontend dependencies"
        exit 1
    fi
    cd ..
fi

echo "🔧 Starting services..."

# Start backend in background
echo "🖥️  Starting backend server..."
cd backend
source ../rag-venv/bin/activate
python ask.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend
echo "🌐 Starting frontend server..."
cd frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 QurHealth RAG Application is starting up!"
echo ""
echo "📍 Services:"
echo "   Backend:  http://127.0.0.1:8000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "📋 Setup Steps:"
echo "   1. Wait for both services to start completely"
echo "   2. Open http://localhost:3000 in your browser"
echo "   3. Click 'Settings' and configure your API key"
echo "   4. Start chatting with QurHealth Assistant!"
echo ""
echo "🛑 To stop both services, press Ctrl+C"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "👋 Goodbye!"
    exit 0
}

# Trap Ctrl+C and call cleanup
trap cleanup INT

# Wait for user to interrupt
wait
