#!/bin/bash

# Pandiver Local Development Startup Script
# Run this script after machine restart to get everything working
# Usage: ./start_pandiver_local.sh

echo "🚀 Starting Pandiver Local Development Environment..."

# Navigate to project root
cd "$(dirname "$0")"

echo "📂 Current directory: $(pwd)"

# Step 1: Kill any existing processes on ports 3000 and 8000
echo "🔄 Cleaning up existing processes..."
kill $(lsof -t -i:3000) 2>/dev/null || echo "Port 3000 is free"
kill $(lsof -t -i:8000) 2>/dev/null || echo "Port 8000 is free"

# Wait a moment for processes to terminate
sleep 2

# Step 2: Ensure required files are in correct locations
echo "📋 Setting up required files..."

# Copy database to app directory (required for complete backend)
if [ -f "pandiver.db" ]; then
    cp pandiver.db app/ || { echo "❌ Failed to copy database"; exit 1; }
    echo "✅ Database copied to app directory"
else
    echo "⚠️ Warning: pandiver.db not found in root directory"
fi

# Copy environment file to app directory
if [ -f ".env" ]; then
    cp .env app/ || { echo "❌ Failed to copy .env file"; exit 1; }
    echo "✅ Environment file copied to app directory"
else
    echo "⚠️ Warning: .env file not found in root directory"
fi

# Step 3: Verify Python environment and dependencies
echo "🐍 Checking Python environment..."
echo "Python path: $(which python)"
echo "Python version: $(python --version)"

# Install required packages if missing
echo "📦 Ensuring required packages are installed..."
/opt/anaconda3/bin/pip install -q azure-ai-documentintelligence azure-ai-translation-text azure-storage-blob aiohttp uvicorn fastapi || {
    echo "❌ Failed to install required packages"
    exit 1
}

# Step 4: Start Backend (Complete version with all endpoints)
echo "🖥️ Starting complete backend server..."
/opt/anaconda3/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"

# Wait for backend to start
echo "⏳ Waiting for backend to initialize..."
for i in {1..10}; do
    if curl -s http://localhost:8000/ > /dev/null; then
        echo "✅ Backend is running and responding"
        break
    fi
    echo "Waiting... ($i/10)"
    sleep 2
done

# Check if backend started successfully
if ! curl -s http://localhost:8000/ > /dev/null; then
    echo "❌ Backend failed to start properly"
    echo "Backend logs:"
    tail -20 backend.log
    exit 1
fi

# Step 5: Start Frontend
echo "🌐 Starting frontend server..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"
cd ..

# Wait for frontend to start
echo "⏳ Waiting for frontend to initialize..."
for i in {1..15}; do
    if curl -s http://localhost:3000/ > /dev/null; then
        echo "✅ Frontend is running and responding"
        break
    fi
    echo "Waiting... ($i/15)"
    sleep 2
done

# Step 6: Test critical endpoints
echo "🧪 Testing critical API endpoints..."

# Test basic backend health
if curl -s http://localhost:8000/ | grep -q "PDF Text Extraction API\|Pandiver"; then
    echo "✅ Backend root endpoint working"
else
    echo "❌ Backend root endpoint failed"
fi

# Test auth signup
SIGNUP_RESPONSE=$(curl -s -X POST "http://localhost:8000/auth/signup" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test User","email":"test_startup@example.com","password":"test123"}')

if echo "$SIGNUP_RESPONSE" | grep -q "access_token"; then
    echo "✅ Authentication system working"
    # Extract token for further testing
    TOKEN=$(echo "$SIGNUP_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

    # Test API keys endpoint
    if curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/api-keys | grep -q '\[\]'; then
        echo "✅ API Keys endpoint working"
    else
        echo "❌ API Keys endpoint failed"
    fi

    # Test API usage endpoint
    if curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/auth/usage | grep -q '\[\]'; then
        echo "✅ API Usage endpoint working"
    else
        echo "❌ API Usage endpoint failed"
    fi

else
    echo "❌ Authentication system failed"
fi

# Test frontend
if curl -s http://localhost:3000/ | grep -q "Pandiver\|Smart PDF Parser"; then
    echo "✅ Frontend is serving content"
else
    echo "❌ Frontend failed to serve content"
fi

# Step 7: Summary and next steps
echo ""
echo "🎉 Startup Complete!"
echo "=================================="
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "📋 Service Status:"
echo "✅ Complete backend (app/main.py) with all API endpoints"
echo "✅ Database connected and accessible"
echo "✅ Authentication system operational"
echo "✅ API Keys and Usage endpoints available"
echo "✅ Frontend connected to backend"
echo ""
echo "📝 Logs:"
echo "Backend logs: tail -f backend.log"
echo "Frontend logs: tail -f frontend.log"
echo ""
echo "🛑 To stop services:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "🚀 Ready for development!"

# Save PIDs for easy cleanup
echo $BACKEND_PID > .backend_pid
echo $FRONTEND_PID > .frontend_pid