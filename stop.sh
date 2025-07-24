#!/bin/bash

# Smart PDF Parser - Stop Script
# Stops Backend (Port 8000) and Frontend (Port 3000)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping Smart PDF Parser...${NC}"

# Get project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"

# Function to kill process on port
kill_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}🔄 Stopping $service on port $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        echo -e "${GREEN}✅ $service stopped${NC}"
    else
        echo -e "${BLUE}ℹ️  $service was not running on port $port${NC}"
    fi
}

# Stop servers on specific ports only
kill_port 8000 "Backend Server"
kill_port 3000 "Frontend Server"

# Stop servers by PID if available
if [ -f "$PROJECT_ROOT/backend.pid" ]; then
    BACKEND_PID=$(cat "$PROJECT_ROOT/backend.pid")
    echo -e "${YELLOW}🔄 Stopping backend process (PID: $BACKEND_PID)...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    rm -f "$PROJECT_ROOT/backend.pid"
fi

if [ -f "$PROJECT_ROOT/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$PROJECT_ROOT/frontend.pid")
    echo -e "${YELLOW}🔄 Stopping frontend process (PID: $FRONTEND_PID)...${NC}"
    kill $FRONTEND_PID 2>/dev/null || true
    rm -f "$PROJECT_ROOT/frontend.pid"
fi

echo -e "${GREEN}✅ Smart PDF Parser stopped successfully${NC}"

# Show log locations
if [ -f "$PROJECT_ROOT/backend.log" ]; then
    echo -e "${BLUE}📄 Backend logs: $PROJECT_ROOT/backend.log${NC}"
fi

if [ -f "$PROJECT_ROOT/frontend.log" ]; then
    echo -e "${BLUE}📄 Frontend logs: $PROJECT_ROOT/frontend.log${NC}"
fi