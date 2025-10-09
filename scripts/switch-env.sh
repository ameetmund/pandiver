#!/bin/bash
##############################################################################
# Environment Switcher for Pandiver
#
# Usage:
#   ./scripts/switch-env.sh [development|staging|production]
#
# This script switches the environment by updating the .env symlink
# to point to the correct environment file in the environments/ directory.
##############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Parse environment argument
ENV="${1:-development}"

# Validate environment
case "$ENV" in
    dev|development)
        ENV_FILE="environments/.env.development"
        ENV_NAME="Development"
        ;;
    stage|staging)
        ENV_FILE="environments/.env.staging"
        ENV_NAME="Staging"
        ;;
    prod|production)
        ENV_FILE="environments/.env.production"
        ENV_NAME="Production"
        ;;
    *)
        echo -e "${RED}Error: Invalid environment '${ENV}'${NC}"
        echo ""
        echo "Usage: $0 [development|staging|production]"
        echo ""
        echo "Examples:"
        echo "  $0 development    # Switch to development environment"
        echo "  $0 dev            # Short form"
        echo "  $0 staging        # Switch to staging environment"
        echo "  $0 production     # Switch to production environment"
        exit 1
        ;;
esac

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Environment file not found: $ENV_FILE${NC}"
    exit 1
fi

# Remove existing .env symlink or file
if [ -L ".env" ]; then
    rm ".env"
    echo -e "${YELLOW}Removed existing .env symlink${NC}"
elif [ -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env is a regular file, not a symlink. Backing up...${NC}"
    mv ".env" ".env.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Create new symlink
ln -sf "$ENV_FILE" ".env"

echo -e "${GREEN}✅ Switched to $ENV_NAME environment${NC}"
echo ""
echo "Environment file: $ENV_FILE"
echo "Symlink: .env -> $ENV_FILE"
echo ""

# Show key configuration
echo "Key Configuration:"
echo "  ENVIRONMENT: $(grep -E '^ENVIRONMENT=' "$ENV_FILE" | cut -d'=' -f2)"
echo "  NODE_ENV: $(grep -E '^NODE_ENV=' "$ENV_FILE" | cut -d'=' -f2)"
echo "  BACKEND_URL: $(grep -E '^BACKEND_URL=' "$ENV_FILE" | cut -d'=' -f2)"
echo "  NEXT_PUBLIC_API_URL: $(grep -E '^NEXT_PUBLIC_API_URL=' "$ENV_FILE" | cut -d'=' -f2)"
echo ""

if [ "$ENV" = "production" ] || [ "$ENV" = "prod" ]; then
    echo -e "${RED}⚠️  WARNING: Production environment active${NC}"
    echo -e "${YELLOW}Please ensure all secrets are properly configured.${NC}"
    echo ""
fi

echo -e "${GREEN}Environment switch complete!${NC}"
