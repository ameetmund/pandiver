#!/bin/bash

# ============================================
# PANDIVER DOCKER STARTUP SCRIPT
# Complete Docker setup for Pandiver Smart PDF Parser
# Run this script after machine restart to get Docker environment working
# ============================================

set -e  # Exit on any error

echo "🐳 Starting Pandiver Docker Environment..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if Docker is running
check_docker() {
    echo -e "${BLUE}🔍 Checking Docker status...${NC}"
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose is not available. Please install Docker Compose.${NC}"
        exit 1
    fi
}

# Determine docker compose command
get_compose_command() {
    if command -v docker-compose > /dev/null 2>&1; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# Function to stop any local processes that might conflict
cleanup_local_processes() {
    echo -e "${YELLOW}🧹 Cleaning up local processes...${NC}"

    # Kill any local server processes
    pkill -f "uvicorn\|python.*main" 2>/dev/null || echo "No local Python processes found"

    # Free up ports 3000 and 8000
    kill $(lsof -t -i:3000) 2>/dev/null || echo "Port 3000 is free"
    kill $(lsof -t -i:8000) 2>/dev/null || echo "Port 8000 is free"

    echo -e "${GREEN}✅ Local cleanup completed${NC}"
}

# Function to ensure required files are in place
setup_required_files() {
    echo -e "${YELLOW}📋 Setting up required files...${NC}"

    # Ensure database and env files exist in backend directory for Docker mounting
    if [ -f "pandiver.db" ]; then
        cp pandiver.db backend/ 2>/dev/null || echo "Database already in backend directory"
    else
        echo -e "${YELLOW}⚠️ Warning: pandiver.db not found in root directory${NC}"
    fi

    if [ -f ".env" ]; then
        cp .env backend/ 2>/dev/null || echo "Environment file already in backend directory"
    else
        echo -e "${YELLOW}⚠️ Warning: .env file not found in root directory${NC}"
    fi

    # Also ensure files are in app directory for complete backend
    if [ -f "pandiver.db" ] && [ -d "app" ]; then
        cp pandiver.db app/ 2>/dev/null || echo "Database already in app directory"
    fi

    if [ -f ".env" ] && [ -d "app" ]; then
        cp .env app/ 2>/dev/null || echo "Environment file already in app directory"
    fi

    echo -e "${GREEN}✅ Required files setup completed${NC}"
}

# Function to build and start Docker containers
start_docker_services() {
    local COMPOSE_CMD=$1

    echo -e "${BLUE}🏗️ Building and starting Docker services...${NC}"
    echo -e "${YELLOW}This may take a few minutes...${NC}"

    # Stop any existing containers
    $COMPOSE_CMD -f docker/compose/docker-compose.dev.yml down 2>/dev/null || echo "No existing containers to stop"

    # Build and start services
    $COMPOSE_CMD -f docker/compose/docker-compose.dev.yml up --build -d

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to start Docker services${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Docker services started${NC}"
}

# Function to wait for services to be healthy
wait_for_services() {
    echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"

    # Wait for PostgreSQL health check
    echo -e "${YELLOW}Checking PostgreSQL health...${NC}"
    for i in {1..30}; do
        if docker exec pandiver-postgres-dev pg_isready -U pandiver -d pandiver_db > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is healthy${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ PostgreSQL health check failed${NC}"
            echo -e "${YELLOW}📋 PostgreSQL logs:${NC}"
            docker logs pandiver-postgres-dev
            exit 1
        fi
        echo "Waiting for PostgreSQL... ($i/30)"
        sleep 2
    done

    # Wait for backend health check
    echo -e "${YELLOW}Checking backend health...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:8000/ > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend is healthy${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Backend health check failed${NC}"
            echo -e "${YELLOW}📋 Backend logs:${NC}"
            docker logs pandiver-backend
            exit 1
        fi
        echo "Waiting for backend... ($i/30)"
        sleep 2
    done

    # Wait for frontend health check
    echo -e "${YELLOW}Checking frontend health...${NC}"
    for i in {1..45}; do
        if curl -s http://localhost:3000/ > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend is healthy${NC}"
            break
        fi
        if [ $i -eq 45 ]; then
            echo -e "${RED}❌ Frontend health check failed${NC}"
            echo -e "${YELLOW}📋 Frontend logs:${NC}"
            docker logs pandiver-frontend
            exit 1
        fi
        echo "Waiting for frontend... ($i/45)"
        sleep 2
    done
}

# Function to test critical API endpoints
test_api_endpoints() {
    echo -e "${BLUE}🧪 Testing critical API endpoints...${NC}"

    # Test backend root endpoint
    if curl -s http://localhost:8000/ | grep -q "PDF Text Extraction API"; then
        echo -e "${GREEN}✅ Backend root endpoint working${NC}"
    else
        echo -e "${RED}❌ Backend root endpoint failed${NC}"
        return 1
    fi

    # Test authentication signup
    SIGNUP_RESPONSE=$(curl -s -X POST "http://localhost:8000/auth/signup" \
        -H "Content-Type: application/json" \
        -d '{"name":"Docker Startup Test","email":"docker_startup_test@example.com","password":"test123"}')

    if echo "$SIGNUP_RESPONSE" | grep -q "access_token"; then
        echo -e "${GREEN}✅ Authentication system working${NC}"

        # Extract token for further testing
        TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

        # Test API keys endpoint
        if curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/api-keys | grep -q '\[\]'; then
            echo -e "${GREEN}✅ API Keys endpoint working${NC}"
        else
            echo -e "${YELLOW}⚠️ API Keys endpoint returned unexpected response (but accessible)${NC}"
        fi

        # Test Azure DI endpoint (should return validation error, which means it's working)
        if curl -s -X POST -H "Authorization: Bearer $TOKEN" http://localhost:8000/azure-di/intelligent-data/start-analysis | grep -q "Field required"; then
            echo -e "${GREEN}✅ Azure Document Intelligence endpoint working${NC}"
        else
            echo -e "${YELLOW}⚠️ Azure DI endpoint may not be fully accessible${NC}"
        fi

    else
        echo -e "${RED}❌ Authentication system failed${NC}"
        return 1
    fi

    # Test frontend
    if curl -s http://localhost:3000/ | grep -q "Pandiver\|Smart PDF Parser"; then
        echo -e "${GREEN}✅ Frontend is serving content properly${NC}"
    else
        echo -e "${RED}❌ Frontend failed to serve content${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ All critical endpoints tested successfully${NC}"
}

# Function to display final status and instructions
display_final_status() {
    echo ""
    echo -e "${GREEN}🎉 Pandiver Docker Environment is Ready!${NC}"
    echo "=============================================="
    echo -e "${BLUE}🌐 Application:${NC}      http://localhost:3000"
    echo -e "${BLUE}📊 Backend API:${NC}      http://localhost:8000"
    echo -e "${BLUE}📋 API Documentation:${NC} http://localhost:8000/docs"
    echo ""
    echo -e "${YELLOW}📝 Management Commands:${NC}"
    echo "   View all logs:     docker-compose -f docker/compose/docker-compose.dev.yml logs -f"
    echo "   View backend logs: docker-compose -f docker/compose/docker-compose.dev.yml logs -f backend"
    echo "   View frontend logs:docker-compose -f docker/compose/docker-compose.dev.yml logs -f frontend"
    echo "   View postgres logs:docker-compose -f docker/compose/docker-compose.dev.yml logs -f postgres"
    echo "   Stop services:     docker-compose -f docker/compose/docker-compose.dev.yml down"
    echo "   Restart services:  docker-compose -f docker/compose/docker-compose.dev.yml restart"
    echo ""
    echo -e "${YELLOW}🔧 Container Status:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo -e "${YELLOW}💾 Database Status:${NC}"
    echo "   PostgreSQL:    ✅ Running on localhost:5432"
    echo "   Database Name: pandiver_db"
    if docker exec pandiver-postgres-dev psql -U pandiver -d pandiver_db -c "\dt" > /dev/null 2>&1; then
        echo "   Tables:        ✅ Initialized"
    else
        echo "   Tables:        ⚠️ Not initialized"
    fi
    echo ""
    echo -e "${GREEN}🚀 Ready for development and testing!${NC}"
    echo ""
    echo -e "${BLUE}💡 Tip: Use 'docker-compose -f docker/compose/docker-compose.dev.yml down && ./start_pandiver_docker.sh' to do a complete restart${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting Pandiver Docker Environment Setup...${NC}"
    echo "Current directory: $(pwd)"
    echo ""

    # Navigate to project root (in case script is run from subdirectory)
    cd "$(dirname "$0")"

    # Step 1: Verify Docker is running
    check_docker
    check_docker_compose
    COMPOSE_CMD=$(get_compose_command)

    # Step 2: Clean up any local processes
    cleanup_local_processes

    # Step 3: Setup required files
    setup_required_files

    # Step 4: Start Docker services
    start_docker_services "$COMPOSE_CMD"

    # Step 5: Wait for services to be ready
    wait_for_services

    # Step 6: Test API endpoints
    if test_api_endpoints; then
        echo -e "${GREEN}✅ All tests passed!${NC}"
    else
        echo -e "${YELLOW}⚠️ Some tests failed, but core services are running${NC}"
    fi

    # Step 7: Display final status
    display_final_status
}

# Error handling
trap 'echo -e "${RED}❌ Script failed. Check the error messages above.${NC}"; exit 1' ERR

# Run main function
main "$@"