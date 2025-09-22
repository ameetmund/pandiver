#!/bin/bash

# Docker-specific entrypoint script for backend
# CRITICAL: This script fixes JWT authentication compatibility for Docker containers
#
# Problem: PyJWT 2.10+ in Docker requires string subjects, but our code uses integer user IDs
# Solution: Runtime patches to convert user.id to string for JWT creation and back to int for verification
#
# See DOCKER_JWT_COMPATIBILITY.md for detailed explanation
# DO NOT REMOVE - Required for Docker authentication to work

echo "🐳 Docker backend environment detected - configuring JWT secret key..."

# Read SECRET_KEY from environment variable
if [ -n "$SECRET_KEY" ]; then
    echo "🔧 Patching SECRET_KEY in main.py for Docker environment..."

    # Replace the hardcoded SECRET_KEY with the environment variable value in both files
    sed -i "s|SECRET_KEY = \"your-secret-key-here\"|SECRET_KEY = \"$SECRET_KEY\"|g" /app/app/main.py
    sed -i "s|SECRET_KEY = \"your-secret-key-here\"|SECRET_KEY = \"$SECRET_KEY\"|g" /app/app/auth.py

    # Fix JWT subject to be string instead of integer for PyJWT 2.10+ compatibility
    echo "🔧 Patching JWT subject to string for PyJWT compatibility..."
    sed -i 's|"sub": user\.id|"sub": str(user.id)|g' /app/app/main.py
    sed -i 's|user_id = payload\.get("sub")|user_id = int(payload.get("sub"))|g' /app/app/main.py
    # Also patch auth.py for PDF endpoints
    sed -i 's|user_id = payload\.get("sub")|user_id = int(payload.get("sub"))|g' /app/app/auth.py

    # Increase JWT token expiration time for Docker development (8 hours instead of 30 minutes)
    echo "🔧 Increasing JWT token expiration time for Docker development..."
    sed -i 's|ACCESS_TOKEN_EXPIRE_MINUTES = 30|ACCESS_TOKEN_EXPIRE_MINUTES = 480|g' /app/app/main.py

    # Add debug logging for API key queries (Docker only)
    echo "🔧 Adding debug logging for API key endpoint..."
    sed -i '/api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()/i\    print(f"DEBUG: API Keys - User ID: {current_user.id}, User email: {current_user.email}")' /app/app/main.py
    sed -i '/api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()/a\    print(f"DEBUG: API Keys - Found {len(api_keys)} keys for user {current_user.id}")' /app/app/main.py

    echo "✅ SECRET_KEY, JWT compatibility, token expiration, and debug logging patches complete"
else
    echo "⚠️  No SECRET_KEY environment variable found, using default"
fi

# Start the backend server
echo "🚀 Starting FastAPI backend server..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload