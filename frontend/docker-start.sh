#!/bin/bash
# docker-start.sh - Start Pandiver with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Starting Pandiver with Docker...${NC}"
echo "======================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️ .env file not found!${NC}"
    echo -e "${BLUE}Creating .env from template...${NC}"

    if [ -f ".env.docker.template" ]; then
        cp .env.docker.template .env
        echo -e "${GREEN}✅ .env file created from template${NC}"
        echo -e "${YELLOW}⚠️ Please update .env with your Azure credentials before continuing${NC}"
        echo -e "${BLUE}Required variables:${NC}"
        echo "  - AZURE_TRANSLATOR_KEY"
        echo "  - AZURE_TRANSLATOR_REGION"
        echo "  - AZURE_DOC_INTELLIGENCE_KEY"
        echo "  - AZURE_DOC_INTELLIGENCE_ENDPOINT"
        echo ""
        read -p "Press Enter after updating .env file..."
    else
        echo -e "${RED}❌ .env.docker.template not found!${NC}"
        exit 1
    fi
fi

# Validate Azure credentials
source .env
if [[ "$AZURE_TRANSLATOR_KEY" == "your_azure_translator_key_here" || -z "$AZURE_TRANSLATOR_KEY" ]]; then
    echo -e "${RED}❌ Please update AZURE_TRANSLATOR_KEY in .env file${NC}"
    exit 1
fi

if [[ "$AZURE_DOC_INTELLIGENCE_KEY" == "your_doc_intelligence_key_here" || -z "$AZURE_DOC_INTELLIGENCE_KEY" ]]; then
    echo -e "${RED}❌ Please update AZURE_DOC_INTELLIGENCE_KEY in .env file${NC}"
    exit 1
fi

# Generate JWT secret if not present
if [[ -z "$JWT_SECRET_KEY" ]]; then
    echo -e "${YELLOW}🔐 Generating JWT secret key...${NC}"
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || openssl rand -base64 64)

    # Update .env file with JWT secret
    if grep -q "JWT_SECRET_KEY=" .env; then
        sed -i.bak "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$JWT_SECRET/" .env
    else
        echo "JWT_SECRET_KEY=$JWT_SECRET" >> .env
    fi
    echo -e "${GREEN}✅ JWT secret key generated${NC}"
fi

# Create database directory if it doesn't exist
echo -e "${BLUE}📁 Setting up database directory...${NC}"
mkdir -p docker_data/database

# Stop any existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f ../docker/compose/docker-compose.dev.yml down 2>/dev/null || true

# Build and start containers
echo -e "${BLUE}🔨 Building Docker images...${NC}"
docker-compose -f ../docker/compose/docker-compose.dev.yml build

echo -e "${BLUE}🚀 Starting services...${NC}"
docker-compose -f ../docker/compose/docker-compose.dev.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

echo ""
echo -e "${GREEN}🎉 Pandiver Docker Setup Complete!${NC}"
echo "======================================"
echo -e "${BLUE}📍 Access Points:${NC}"
echo -e "  🌐 Frontend: http://localhost:3000"
echo -e "  📊 Backend:  http://localhost:8000"
echo -e "  📋 API Docs: http://localhost:8000/docs"
echo ""
echo -e "${BLUE}🐳 Docker Commands:${NC}"
echo -e "  Stop:      ./docker-stop.sh"
echo -e "  Logs:      docker-compose -f ../docker/compose/docker-compose.dev.yml logs -f"
echo -e "  Restart:   docker-compose -f ../docker/compose/docker-compose.dev.yml restart"
echo ""
echo -e "${GREEN}✅ Development environment ready!${NC}"
