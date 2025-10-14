#!/bin/bash

# Helper script to commit and push changes to development branch
# This will trigger the GitHub Actions development CI workflow

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Push Changes to Development Branch                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if on development branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "development" ]; then
    echo -e "${YELLOW}⚠  Current branch: $CURRENT_BRANCH${NC}"
    echo -e "Switching to development branch..."
    git checkout development
fi

# Show status
echo -e "${BLUE}━━━ Git Status ━━━${NC}"
git status --short
echo ""

# Ask for commit message if not provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Enter commit message:${NC}"
    read -r COMMIT_MESSAGE
else
    COMMIT_MESSAGE="$1"
fi

# Stage all changes
echo -e "${BLUE}━━━ Staging Changes ━━━${NC}"
git add .
echo -e "${GREEN}✓${NC} All changes staged"
echo ""

# Commit
echo -e "${BLUE}━━━ Creating Commit ━━━${NC}"
git commit -m "$COMMIT_MESSAGE

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
echo -e "${GREEN}✓${NC} Commit created"
echo ""

# Push
echo -e "${BLUE}━━━ Pushing to GitHub ━━━${NC}"
git push origin development
echo -e "${GREEN}✓${NC} Pushed to development branch"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                          SUCCESS!                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "✓ Changes pushed to development branch"
echo "✓ GitHub Actions development CI workflow will start automatically"
echo ""
echo "View workflow at:"
echo -e "  ${BLUE}https://github.com/ameetmund/pandiver/actions${NC}"
