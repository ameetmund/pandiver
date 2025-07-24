#!/bin/bash

# ============================================
# PANDIVER DOCKER STOP SCRIPT
# Clean shutdown of Docker services
# ============================================

set -e  # Exit on any error

echo "🐳 Stopping Pandiver Smart PDF Parser Docker services..."
echo "======================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if docker-compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose is not available.${NC}"
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
    check_docker_compose
    COMPOSE_CMD=$(get_compose_command)
    
    echo -e "${YELLOW}🔄 Stopping containers...${NC}"
    $COMPOSE_CMD down
    
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    # Remove stopped containers
    if [ "$(docker ps -aq -f status=exited -f name=pandiver)" ]; then
        docker rm $(docker ps -aq -f status=exited -f name=pandiver) 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${GREEN}✅ Pandiver Docker services stopped successfully${NC}"
    echo ""
    echo -e "${BLUE}ℹ️  Optional cleanup commands:${NC}"
    echo -e "   Remove images: docker rmi \$(docker images pandiver* -q) 2>/dev/null"
    echo -e "   Remove volumes: docker volume rm pandiver-backend-data pandiver-frontend-modules 2>/dev/null"
    echo -e "   Full cleanup: docker system prune -f"
    echo ""
}

# Run main function
main "$@"