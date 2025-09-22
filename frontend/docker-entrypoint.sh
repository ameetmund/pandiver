#!/bin/sh

# Docker-specific entrypoint script
# This script only runs in Docker environment and replaces hardcoded API URLs

echo "🐳 Docker environment detected - configuring API URLs..."

# Set default API URL if not provided
API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}

echo "📡 Using API URL: $API_URL"

# Function to replace URLs in JavaScript/TypeScript files
replace_urls() {
    local file="$1"
    if [ -f "$file" ]; then
        sed -i "s|http://localhost:8000|$API_URL|g" "$file"
    fi
}

# Only replace URLs if we're in Docker (check for Docker-specific env var)
if [ "$DOCKER_ENV" = "true" ]; then
    echo "🔧 Replacing hardcoded API URLs in frontend files..."

    # Find and replace in all relevant files
    find /app/src -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
        if grep -q "http://localhost:8000" "$file"; then
            echo "  📝 Updating: $file"
            replace_urls "$file"
        fi
    done

    echo "✅ API URL replacement complete"

    # Start background script to keep replacing URLs when files change
    echo "🔧 Starting background URL replacement monitor..."
    {
        while true; do
            sleep 30
            find /app/src -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" | while read -r file; do
                if grep -q "http://localhost:8000" "$file" 2>/dev/null; then
                    replace_urls "$file"
                fi
            done
        done
    } &
else
    echo "ℹ️  Not in Docker environment, skipping URL replacement"
fi

# Start the Next.js development server
echo "🚀 Starting Next.js development server..."
exec npm run dev