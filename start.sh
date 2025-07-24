#!/bin/bash

# Smart PDF Parser - Production Startup Script
# Backend: Port 8000 | Frontend: Port 3000

set -e  # Exit on any error

echo "🚀 Starting Smart PDF Parser Application..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local service=$2
    if check_port $port; then
        echo -e "${YELLOW}🔄 Stopping existing $service on port $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Get project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"

echo -e "${BLUE}📁 Project directory: $PROJECT_ROOT${NC}"

# Verify project structure
if [ ! -d "$PROJECT_ROOT/backend" ] || [ ! -d "$PROJECT_ROOT/frontend" ]; then
    echo -e "${RED}❌ Error: backend or frontend directory not found!${NC}"
    echo "Make sure you're running this script from the project root directory."
    exit 1
fi

# Clean up ports (Backend: 8000, Frontend: 3000 only)
kill_port 8000 "Backend"
kill_port 3000 "Frontend"

echo -e "${BLUE}🔧 Setting up Backend (Port 8000)...${NC}"

# Setup Backend
cd "$PROJECT_ROOT/backend"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Creating Python virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1

# Verify critical dependencies
python -c "
import sys
try:
    import fastapi, uvicorn, pdfplumber, pandas, openpyxl, jwt
    print('✅ All Python dependencies verified')
except ImportError as e:
    print(f'❌ Missing dependency: {e}')
    sys.exit(1)
" || exit 1

# Start backend server
echo -e "${GREEN}🚀 Starting Backend Server on port 8000...${NC}"
nohup python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0 > ../backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 4

# Verify backend is running
if ! check_port 8000; then
    echo -e "${RED}❌ Backend failed to start on port 8000${NC}"
    cat ../backend.log
    exit 1
fi

echo -e "${GREEN}✅ Backend Server running (PID: $BACKEND_PID)${NC}"

echo -e "${BLUE}🔧 Setting up Frontend (Port 3000)...${NC}"

# Setup Frontend
cd "$PROJECT_ROOT/frontend"

# Install Node dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
    npm install > /dev/null 2>&1
fi

# Start frontend server
echo -e "${GREEN}🚀 Starting Frontend Server on port 3000...${NC}"
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 6

# Verify frontend is running on port 3000
if ! check_port 3000; then
    echo -e "${RED}❌ Frontend failed to start on port 3000${NC}"
    cat ../frontend.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Frontend Server running (PID: $FRONTEND_PID)${NC}"

# Save PIDs
echo "$BACKEND_PID" > "$PROJECT_ROOT/backend.pid"
echo "$FRONTEND_PID" > "$PROJECT_ROOT/frontend.pid"

echo ""
echo -e "${GREEN}🎉 Smart PDF Parser is Ready!${NC}"
echo "================================================"
echo -e "${BLUE}🌐 Application:${NC}     http://localhost:3000"
echo -e "${BLUE}📊 Backend API:${NC}     http://localhost:8000"
echo -e "${BLUE}📋 API Docs:${NC}        http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}📝 View Logs:${NC}"
echo -e "   Backend:  tail -f $PROJECT_ROOT/backend.log"
echo -e "   Frontend: tail -f $PROJECT_ROOT/frontend.log"
echo ""
echo -e "${YELLOW}🛑 To stop:${NC} Run ./stop.sh or press Ctrl+C"
echo ""

# Keep script running and handle cleanup
trap 'echo -e "\n${YELLOW}🛑 Shutting down...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; rm -f "$PROJECT_ROOT/backend.pid" "$PROJECT_ROOT/frontend.pid"; echo -e "${GREEN}✅ Servers stopped${NC}"; exit 0' INT

echo -e "${BLUE}Press Ctrl+C to stop both servers...${NC}"
while true; do
    sleep 1
done