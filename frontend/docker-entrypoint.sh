#!/bin/sh

# Docker-specific entrypoint script
# This script only runs in Docker environment and replaces hardcoded API URLs

echo "🐳 Docker environment detected - configuring API URLs..."

# Set default API URL if not provided
API_URL=${NEXT_PUBLIC_API_URL:-${NEXT_PUBLIC_API_BASE_URL:-http://localhost:8000}}

echo "📡 Using API URL: $API_URL"

# Function to replace URLs in JavaScript/TypeScript files
replace_urls() {
    local file="$1"
    if [ -f "$file" ]; then
        # Use different sed syntax for Alpine Linux
        sed -i'' -e "s|http://localhost:8000|$API_URL|g" "$file"
    fi
}

# Only replace URLs if we're in Docker (check for Docker-specific env var)
if [ "$DOCKER_ENV" = "true" ]; then
    echo "🔧 Replacing hardcoded API URLs in frontend files..."

    # Find and replace in source files
    if [ -d /app/src ]; then
        find /app/src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" \) | while read -r file; do
            if grep -q "http://localhost:8000" "$file" 2>/dev/null; then
                echo "  📝 Updating: $file"
                replace_urls "$file"
            fi
        done
    fi

    # Also check .next build directory in case it exists
    if [ -d /app/.next ]; then
        find /app/.next -type f -name "*.js" | while read -r file; do
            if grep -q "http://localhost:8000" "$file" 2>/dev/null; then
                echo "  📝 Updating build file: $file"
                replace_urls "$file"
            fi
        done
    fi

    echo "✅ API URL replacement complete"

    # Start background script to keep replacing URLs when files change (for hot reload)
    echo "🔧 Starting background URL replacement monitor..."
    {
        while true; do
            sleep 30
            if [ -d /app/src ]; then
                find /app/src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" \) | while read -r file; do
                    if grep -q "http://localhost:8000" "$file" 2>/dev/null; then
                        replace_urls "$file"
                    fi
                done
            fi
            # Also monitor build directory
            if [ -d /app/.next ]; then
                find /app/.next -type f -name "*.js" | while read -r file; do
                    if grep -q "http://localhost:8000" "$file" 2>/dev/null; then
                        replace_urls "$file"
                    fi
                done
            fi
        done
    } &
else
    echo "ℹ️  Not in Docker environment, skipping URL replacement"
fi

# Start the Next.js development server
echo "🚀 Starting Next.js development server..."
exec npm run dev