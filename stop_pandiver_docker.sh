#!/bin/bash

# ============================================
# PANDIVER DOCKER STOP SCRIPT
# Gracefully stop all Pandiver Docker services
# ============================================

set -e  # Exit on any error

echo "🛑 Stopping Pandiver Docker Environment..."
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine docker compose command
get_compose_command() {
    if command -v docker-compose > /dev/null 2>&1; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# Function to stop services
stop_services() {
    local COMPOSE_CMD=$1

    echo -e "${BLUE}🔍 Checking running containers...${NC}"

    # Check if any containers are running
    if ! docker ps --filter name=pandiver --format '{{.Names}}' | grep -q pandiver; then
        echo -e "${YELLOW}⚠️  No Pandiver containers are currently running${NC}"
        return
    fi

    # Show running containers
    echo -e "${BLUE}📦 Currently running Pandiver containers:${NC}"
    docker ps --filter name=pandiver --format "   {{.Names}} ({{.Status}})"
    echo ""

    echo -e "${YELLOW}🛑 Stopping Docker services...${NC}"
    $COMPOSE_CMD -f docker-compose.dev.yml down

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ All services stopped successfully${NC}"
    else
        echo -e "${RED}❌ Failed to stop some services${NC}"
        return 1
    fi
}

# Function to show final status
show_final_status() {
    echo ""
    echo -e "${GREEN}🎉 Pandiver Docker Environment Stopped${NC}"
    echo "=============================================="

    # Check if any containers are still running
    if docker ps --filter name=pandiver --format '{{.Names}}' | grep -q pandiver; then
        echo -e "${YELLOW}⚠️  Warning: Some containers are still running:${NC}"
        docker ps --filter name=pandiver --format "   {{.Names}} ({{.Status}})"
        echo ""
        echo -e "${BLUE}💡 To force stop: docker stop \$(docker ps --filter name=pandiver -q)${NC}"
    else
        echo -e "${GREEN}✅ All Pandiver containers stopped${NC}"
    fi

    # Show volume status
    echo ""
    echo -e "${BLUE}💾 Data Status:${NC}"
    if docker volume ls | grep -q pandiver_postgres_dev_data; then
        echo -e "   ${GREEN}✅${NC} PostgreSQL data preserved (pandiver_postgres_dev_data)"
        echo -e "      Your database data is safe and will be available when you restart"
    fi

    echo ""
    echo -e "${BLUE}🚀 To restart services:${NC} ./start_pandiver_docker.sh"
    echo ""
    echo -e "${YELLOW}📝 Additional Commands:${NC}"
    echo "   View stopped containers: docker ps -a --filter name=pandiver"
    echo "   Remove containers:       docker-compose -f docker-compose.dev.yml rm"
    echo "   Remove volumes:          docker volume rm pandiver_postgres_dev_data"
    echo "   Full cleanup:            docker-compose -f docker-compose.dev.yml down -v"
    echo ""
}

# Main execution
main() {
    # Navigate to project root (in case script is run from subdirectory)
    cd "$(dirname "$0")"

    COMPOSE_CMD=$(get_compose_command)

    # Stop services
    stop_services "$COMPOSE_CMD"

    # Show final status
    show_final_status
}

# Error handling
trap 'echo -e "${RED}❌ Script failed. Check the error messages above.${NC}"; exit 1' ERR

# Run main function
main "$@"
