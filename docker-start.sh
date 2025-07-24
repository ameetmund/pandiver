#!/bin/bash

# ============================================
# PANDIVER DOCKER STARTUP SCRIPT
# Easy Docker deployment for Smart PDF Parser
# ============================================

set -e  # Exit on any error

echo "🐳 Starting Pandiver Smart PDF Parser with Docker..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
        exit 1
    fi
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

# Main execution
main() {
    echo -e "${BLUE}🔍 Checking Docker requirements...${NC}"
    check_docker
    check_docker_compose
    
    COMPOSE_CMD=$(get_compose_command)
    echo -e "${GREEN}✅ Docker is ready${NC}"
    
    echo -e "${BLUE}🏗️  Building and starting services...${NC}"
    echo -e "${YELLOW}This may take a few minutes on first run...${NC}"
    
    # Build and start services
    $COMPOSE_CMD up --build -d
    
    echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
    
    # Wait for backend health check
    echo -e "${YELLOW}Checking backend health...${NC}"
    for i in {1..30}; do
        if docker exec pandiver-backend curl -f http://localhost:8000/docs > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend is healthy${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Backend health check failed${NC}"
            echo -e "${YELLOW}📋 Backend logs:${NC}"
            $COMPOSE_CMD logs backend
            exit 1
        fi
        sleep 2
    done
    
    # Wait for frontend health check
    echo -e "${YELLOW}Checking frontend health...${NC}"
    for i in {1..45}; do
        if docker exec pandiver-frontend curl -f http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend is healthy${NC}"
            break
        fi
        if [ $i -eq 45 ]; then
            echo -e "${RED}❌ Frontend health check failed${NC}"
            echo -e "${YELLOW}📋 Frontend logs:${NC}"
            $COMPOSE_CMD logs frontend
            exit 1
        fi
        sleep 2
    done
    
    echo ""
    echo -e "${GREEN}🎉 Pandiver Smart PDF Parser is ready!${NC}"
    echo "=================================================="
    echo -e "${BLUE}🌐 Application:${NC}     http://localhost:3000"
    echo -e "${BLUE}📊 Backend API:${NC}     http://localhost:8000"
    echo -e "${BLUE}📋 API Docs:${NC}        http://localhost:8000/docs"
    echo ""
    echo -e "${YELLOW}📝 View Logs:${NC}"
    echo -e "   All services: $COMPOSE_CMD logs -f"
    echo -e "   Backend only: $COMPOSE_CMD logs -f backend"
    echo -e "   Frontend only: $COMPOSE_CMD logs -f frontend"
    echo ""
    echo -e "${YELLOW}🛑 To stop:${NC} Run ./docker-stop.sh or $COMPOSE_CMD down"
    echo ""
}

# Run main function
main "$@"