#!/bin/bash
# docker-stop.sh - Stop Pandiver Docker containers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🛑 Stopping Pandiver Docker containers...${NC}"

# Stop and remove containers
docker-compose -f ../docker/compose/docker-compose.dev.yml down

# Show status
echo -e "${GREEN}✅ Pandiver Docker containers stopped${NC}"
echo ""
echo -e "${BLUE}🐳 Available commands:${NC}"
echo -e "  Start:     ./docker-start.sh"
echo -e "  Cleanup:   docker-compose -f ../docker/compose/docker-compose.dev.yml down --volumes --rmi all"
echo -e "  Logs:      docker-compose -f ../docker/compose/docker-compose.dev.yml logs"
