# 🐳 Pandiver Docker Deployment Guide

Complete guide for running Pandiver with Docker, both locally and after cloning from GitHub.

## 📋 Prerequisites

- Docker Desktop (latest version)
- Docker Compose (included with Docker Desktop)
- Git (for cloning from GitHub)

## 🚀 Quick Start (Local Development)

### 1. Start Docker Services

```bash
# One-command startup
./docker-start.sh
```

### 2. Stop Docker Services

```bash
# Stop all services
./docker-stop.sh
```

## 📥 GitHub Deployment (Fresh Setup)

### Step 1: Clone Repository

```bash
git clone https://github.com/your-username/pandiver-new.git
cd pandiver-new
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.docker.template .env

# Edit .env file with your Azure credentials
nano .env  # or use your preferred editor
```

**Required Environment Variables:**
```env
AZURE_TRANSLATOR_KEY=your_actual_azure_translator_key
AZURE_TRANSLATOR_REGION=your_region (e.g., eastus)
AZURE_DOC_INTELLIGENCE_KEY=your_actual_doc_intelligence_key
AZURE_DOC_INTELLIGENCE_ENDPOINT=your_actual_endpoint
```

### Step 3: Start Services

```bash
# Make scripts executable (if needed)
chmod +x docker-start.sh docker-stop.sh

# Start all services
./docker-start.sh
```

### Step 4: Access Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

### Step 5: Login and Test

- **Login credentials:** `ameetmund@gmail.com` / `temp123`
- **Test features:** PDF Page Splitter, PDF Translator, API dashboards
- **Verify:** JWT authentication with 8-hour token expiration

## 🏗️ Architecture Overview

```
pandiver-new/
├── backend/
│   ├── Dockerfile.dev          # Backend Docker configuration
│   ├── app/                    # FastAPI application
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── Dockerfile.dev          # Frontend Docker configuration
│   ├── src/                    # Next.js application
│   └── package.json           # Node.js dependencies
├── docker-compose.dev.yml      # Multi-service orchestration
├── docker-start.sh            # Easy startup script
├── docker-stop.sh             # Easy shutdown script
├── .env.docker.template       # Environment template
└── docker_data/               # Persistent database storage
    └── database/
```

## 💾 Data Persistence

### Database Storage
- **Location:** `./docker_data/database/`
- **Type:** SQLite database with Docker volume mounting
- **Persistence:** Data survives container restarts and rebuilds

### File Uploads
- **Persistence:** Temporary (files are cleaned up after processing)
- **Location:** Container internal storage

## 🔧 Development Features

### Hot Reload
- **Backend:** FastAPI with `--reload` flag
- **Frontend:** Next.js development server with hot reload
- **File Watching:** Automatic rebuild on code changes

### Volume Mounting
- Source code mounted for live development
- Database persisted across restarts
- Node modules and Python cache optimized

## 🛠️ Common Commands

### View Logs
```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.dev.yml restart

# Restart specific service
docker-compose -f docker-compose.dev.yml restart backend
```

### Rebuild Images
```bash
# Stop and rebuild everything
./docker-stop.sh
docker-compose -f docker-compose.dev.yml build --no-cache
./docker-start.sh
```

### Clean Cleanup
```bash
# Remove containers, volumes, and images
docker-compose -f docker-compose.dev.yml down --volumes --rmi all

# Remove database data (WARNING: This deletes all data!)
rm -rf docker_data/
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Kill processes on ports 3000 and 8000
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9

# Or use docker-stop.sh first
./docker-stop.sh
```

#### 2. Docker Not Running
```bash
# Start Docker Desktop first, then:
./docker-start.sh
```

#### 3. Environment Variables Not Working
```bash
# Check .env file exists and has correct values
cat .env

# Restart containers to pick up changes
./docker-stop.sh
./docker-start.sh
```

#### 4. Database Issues
```bash
# Reset database (WARNING: Deletes all data)
./docker-stop.sh
rm -rf docker_data/database/
./docker-start.sh
```

#### 5. Build Failures
```bash
# Clean rebuild
./docker-stop.sh
docker system prune -f
docker-compose -f docker-compose.dev.yml build --no-cache
./docker-start.sh
```

#### 6. Authentication Issues

**"Invalid Token" Errors:**
```bash
# Check if JWT patches were applied
docker logs pandiver-new-backend-1 | grep "JWT patches complete"
# Should see: "✅ SECRET_KEY, JWT compatibility, and token expiration patches complete"

# If patches missing, restart containers
./docker-stop.sh
./docker-start.sh
```

**Login Not Working:**
```bash
# Check if password is set correctly
# Login with: ameetmund@gmail.com / temp123

# Reset password if needed (in container)
docker exec -it pandiver-new-backend-1 python -c "
import sqlite3, bcrypt
password = 'temp123'
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
conn = sqlite3.connect('/app/pandiver.db')
conn.execute('UPDATE users SET hashed_password = ? WHERE email = ?', (hashed, 'ameetmund@gmail.com'))
conn.commit()
print('Password reset to temp123')
"
```

**API Keys Not Showing:**
```bash
# Check if API key exists for user
docker exec -it pandiver-new-backend-1 sqlite3 /app/pandiver.db \
  "SELECT * FROM api_keys WHERE user_id = 2;"

# If no API key, create one
docker exec -it pandiver-new-backend-1 python -c "
import sqlite3, secrets, string
from datetime import datetime

def generate_api_key():
    return 'pd_' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(43))

conn = sqlite3.connect('/app/pandiver.db')
api_key = generate_api_key()
conn.execute('INSERT INTO api_keys (user_id, key_name, api_key, is_active, created_at) VALUES (?, ?, ?, ?, ?)',
             (2, 'Docker Development API Key', api_key, True, datetime.now().isoformat()))
conn.commit()
print(f'Created API key: {api_key}')
"
```

**JWT Token Expiring Too Fast:**
```bash
# Check token expiration setting
docker exec pandiver-new-backend-1 grep "ACCESS_TOKEN_EXPIRE_MINUTES" /app/app/main.py
# Should show: ACCESS_TOKEN_EXPIRE_MINUTES = 480 (8 hours)

# If not 480, restart containers to apply patches
./docker-stop.sh
./docker-start.sh
```

### Health Checks

Check service status:
```bash
# Container status
docker-compose -f docker-compose.dev.yml ps

# Health status
docker-compose -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Manual health check
curl http://localhost:8000/health
curl http://localhost:3000
```

## 🌟 Benefits of Docker Setup

### ✅ Consistency
- Same environment across all machines
- Eliminates "works on my machine" issues
- Reproducible builds and deployments

### ✅ Isolation
- No conflicts with system Python/Node versions
- Clean separation of dependencies
- Easy to reset to clean state

### ✅ Portability
- Works on Windows, macOS, and Linux
- Multi-architecture support (x86_64 and ARM64)
- Easy sharing and deployment

### ✅ Development Efficiency
- One command startup
- Hot reload for rapid development
- Persistent data across restarts

## 🌍 Testing on Different Systems

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB (8GB recommended)
- Storage: 10GB free space
- OS: Linux, macOS, or Windows with WSL2

**Recommended:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 20GB+ SSD
- Network: Stable internet for Azure services

### Platform-Specific Setup

#### macOS
```bash
# Install Docker Desktop for Mac
brew install --cask docker

# Clone and run
git clone <your-repo-url>
cd pandiver-new
cp .env.docker.template .env
# Edit .env with Azure credentials
./docker-start.sh
```

#### Linux (Ubuntu/Debian)
```bash
# Install Docker and Docker Compose
sudo apt update
sudo apt install docker.io docker-compose git -y
sudo usermod -aG docker $USER
newgrp docker

# Clone and run
git clone <your-repo-url>
cd pandiver-new
cp .env.docker.template .env
# Edit .env with Azure credentials
chmod +x docker-start.sh docker-stop.sh
./docker-start.sh
```

#### Windows (WSL2)
```powershell
# Install Docker Desktop for Windows with WSL2 backend
# Download from: https://www.docker.com/products/docker-desktop

# In WSL2 terminal:
git clone <your-repo-url>
cd pandiver-new
cp .env.docker.template .env
# Edit .env with Azure credentials
./docker-start.sh
```

### Cloud Deployment Examples

#### AWS EC2
```bash
# Launch Ubuntu 22.04 LTS instance (t3.large recommended)
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose git -y
sudo usermod -aG docker ubuntu
newgrp docker

# Clone and deploy
git clone <your-repo-url>
cd pandiver-new
cp .env.docker.template .env
# Edit .env with your Azure settings
./docker-start.sh

# Configure security group to allow ports 3000 and 8000
```

#### Google Cloud Platform
```bash
# Create VM with Container-Optimized OS or Ubuntu
gcloud compute instances create pandiver-instance \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --machine-type=e2-standard-4 \
  --zone=us-central1-a

# SSH and setup
gcloud compute ssh pandiver-instance
sudo apt install docker.io docker-compose git -y
sudo usermod -aG docker $USER
newgrp docker

# Deploy application
git clone <your-repo-url>
cd pandiver-new
cp .env.docker.template .env
# Edit .env file
./docker-start.sh
```

### Cross-System Verification Checklist

**Pre-Deployment:**
- [ ] Docker and Docker Compose installed
- [ ] Git available
- [ ] Ports 3000 and 8000 available
- [ ] Internet connectivity for Docker images
- [ ] .env file configured with Azure credentials

**Post-Deployment:**
- [ ] Containers running: `docker-compose -f docker-compose.dev.yml ps`
- [ ] Backend health: `curl http://localhost:8000/`
- [ ] Frontend accessible: `curl http://localhost:3000/`
- [ ] Login working: `ameetmund@gmail.com` / `temp123`
- [ ] API keys visible in dashboards
- [ ] PDF features working without "Invalid Token" errors
- [ ] 8-hour JWT token expiration (no frequent logouts)

## 🔐 Authentication & Security

### Docker-Specific Fixes Applied

The Docker setup includes critical authentication compatibility fixes:

1. **JWT Token Compatibility** (PyJWT 2.10+ support)
   - String subject format for Docker containers
   - Extended token expiration (30min → 8 hours)
   - Cross-platform authentication consistency

2. **Secret Key Management**
   - Environment variable injection
   - Runtime patching for Docker environment
   - No source code modifications required

3. **Database Integration**
   - Shared SQLite database with host system
   - API key persistence across container restarts
   - User authentication consistency

### Default Login Credentials
- **Email:** `ameetmund@gmail.com`
- **Password:** `temp123`
- **API Key:** Auto-generated and available in dashboards

**⚠️ Important for Production:**
- Change default password immediately
- Use proper SECRET_KEY (not the development key)
- Configure HTTPS with reverse proxy
- Set up proper secret management

## 📤 Deployment to Production

For production deployment, consider:

1. **Environment Variables:** Use proper secret management
2. **Database:** Switch to PostgreSQL for production
3. **SSL/HTTPS:** Configure reverse proxy with SSL
4. **Monitoring:** Add logging and monitoring solutions
5. **Scaling:** Use Docker Swarm or Kubernetes
6. **Security:** Change default credentials and use production secrets

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `docker-compose -f docker-compose.dev.yml logs -f`
2. Verify environment variables: `cat .env`
3. Ensure Docker is running: `docker info`
4. Try a clean restart: `./docker-stop.sh && ./docker-start.sh`

---

**Happy Dockerizing! 🐳**