#!/bin/bash

# Pandiver Local Development Stop Script
# Usage: ./stop_pandiver_local.sh

echo "🛑 Stopping Pandiver Local Development Environment..."

cd "$(dirname "$0")"

# Stop services using saved PIDs
if [ -f ".backend_pid" ]; then
    BACKEND_PID=$(cat .backend_pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "✅ Backend stopped (PID: $BACKEND_PID)"
    else
        echo "⚠️ Backend process not running"
    fi
    rm -f .backend_pid
fi

if [ -f ".frontend_pid" ]; then
    FRONTEND_PID=$(cat .frontend_pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        echo "✅ Frontend stopped (PID: $FRONTEND_PID)"
    else
        echo "⚠️ Frontend process not running"
    fi
    rm -f .frontend_pid
fi

# Force kill any remaining processes on ports
echo "🔄 Force cleaning ports 3000 and 8000..."
kill $(lsof -t -i:3000) 2>/dev/null || echo "Port 3000 is free"
kill $(lsof -t -i:8000) 2>/dev/null || echo "Port 8000 is free"

echo "✅ All services stopped!"