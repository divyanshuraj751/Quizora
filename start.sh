#!/bin/bash

# Adaptive Learning System - Start Script
# Launches both backend (Gemini API) and frontend (React)

echo "==============================================="
echo "  Quizora — Adaptive Learning System"
echo "==============================================="

# ── Kill any stale processes on our ports ──
kill $(lsof -t -i:4000) 2>/dev/null
kill $(lsof -t -i:8080) 2>/dev/null
sleep 0.5

# ── Install backend dependencies ──
echo "📦 Checking backend dependencies..."
cd backend || { echo "Error: 'backend' directory not found."; exit 1; }
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
else
    echo "📦 Backend dependencies ready."
fi

# ── Start backend in background ──
echo "🤖 Starting Gemini API backend on port 4000..."
npm start &
BACKEND_PID=$!
cd ..

# ── Install frontend dependencies ──
echo "📦 Checking frontend dependencies..."
cd frontend || { echo "Error: 'frontend' directory not found."; exit 1; }
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
else
    echo "📦 Frontend dependencies ready."
fi

# ── Start frontend ──
echo ""
echo "==============================================="
echo "🚀 Starting frontend on http://localhost:5173"
echo "🤖 Backend running on http://localhost:4000"
echo "==============================================="
echo ""

# Trap to kill backend when script exits
trap "kill $BACKEND_PID 2>/dev/null" EXIT

npm run dev

