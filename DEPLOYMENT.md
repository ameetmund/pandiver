# 🚀 Pandiver Smart PDF Parser - Deployment Guide

This guide explains how to deploy Pandiver Smart PDF Parser using both **Native** and **Docker** approaches.

## 📖 Overview

Pandiver offers **two deployment options**:
- **Native Setup**: Direct installation with Python and Node.js
- **Docker Setup**: Containerized deployment with Docker

Both approaches run the **exact same application** and provide identical functionality.

---

## 🔧 Native Deployment (Recommended for Development)

### Prerequisites
- **Python 3.11+** with pip
- **Node.js 18+** with npm
- **Git** for cloning the repository

### Quick Start
```bash
# Clone the repository
git clone https://github.com/ameetmund/pandiver.git
cd pandiver

# Start the application (one command!)
./start.sh
```

### What start.sh Does
- ✅ Creates Python virtual environment automatically
- ✅ Installs all Python dependencies
- ✅ Installs Node.js dependencies  
- ✅ Starts backend server on port 8000
- ✅ Starts frontend server on port 3000
- ✅ Provides health checks and error reporting

### Commands
```bash
# Start all services
./start.sh

# Stop all services  
./stop.sh

# View logs
tail -f backend.log    # Backend logs
tail -f frontend.log   # Frontend logs
```

### Access Points
- **Application**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

---

## 🐳 Docker Deployment (Recommended for Production)

### Prerequisites
- **Docker Desktop** or **Docker Engine**
- **Docker Compose** (included with Docker Desktop)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/ameetmund/pandiver.git
cd pandiver

# Start with Docker (one command!)
./docker-start.sh
```

### What docker-start.sh Does
- ✅ Checks Docker installation
- ✅ Builds backend and frontend containers
- ✅ Sets up networking between services
- ✅ Provides health checks and monitoring
- ✅ Handles service dependencies automatically

### Commands
```bash
# Start all services with Docker
./docker-start.sh

# Stop all services
./docker-stop.sh

# Alternative direct Docker Compose commands
docker-compose up --build -d    # Start services
docker-compose down             # Stop services
docker-compose logs -f          # View all logs
docker-compose logs -f backend  # Backend logs only
docker-compose logs -f frontend # Frontend logs only
```

### Access Points
- **Application**: http://localhost:3000
- **Backend API**: http://localhost:8000  
- **API Documentation**: http://localhost:8000/docs

---

## 🔄 Switching Between Deployments

You can easily switch between native and Docker deployments:

```bash
# Stop native services
./stop.sh

# Start with Docker
./docker-start.sh

# Or vice versa
./docker-stop.sh
./start.sh
```

**Important**: Both deployments use the same ports (3000, 8000), so only run one at a time.

---

## 📊 Feature Comparison

| Feature | Native Setup | Docker Setup |
|---------|-------------|-------------|
| **Startup Speed** | ⚡ Fast (after first setup) | 🐌 Slower (build time) |
| **Consistency** | ⚠️ Depends on system | ✅ Identical everywhere |
| **Dependencies** | Python + Node.js required | Only Docker required |
| **Development** | ✅ Easy debugging | ⚠️ Container debugging |
| **Production** | ⚠️ Manual scaling | ✅ Easy scaling |
| **Isolation** | ⚠️ Shared system resources | ✅ Complete isolation |
| **Resource Usage** | ✅ Lower overhead | ⚠️ Container overhead |

---

## 🛠️ Configuration

### Environment Variables

**Native Setup:**
- Edit `backend/.env.example` → `backend/.env`
- Edit `frontend/.env.example` → `frontend/.env.local`

**Docker Setup:**
- Edit `.env.docker` file
- Or modify `docker-compose.yml` environment section

### Key Configuration Options

```bash
# Backend
DATABASE_URL=sqlite:///./pandiver.db
JWT_SECRET_KEY=your-secret-key
JWT_EXPIRE_MINUTES=1440
ALLOWED_ORIGINS=["http://localhost:3000"]

# Frontend  
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Pandiver - Smart PDF Parser
```

---

## 🔍 Troubleshooting

### Native Setup Issues

**"Command not found" errors:**
```bash
chmod +x start.sh stop.sh
```

**Port already in use:**
```bash
./stop.sh  # Stop existing services
lsof -ti:8000 | xargs kill -9  # Force kill port 8000
lsof -ti:3000 | xargs kill -9  # Force kill port 3000
```

**Python/Node.js not found:**
- Install Python 3.11+ from python.org
- Install Node.js 18+ from nodejs.org

### Docker Setup Issues

**Docker not running:**
```bash
# Start Docker Desktop or Docker service
sudo systemctl start docker  # Linux
```

**Build failures:**
```bash
# Clean rebuild
docker-compose down
docker system prune -f
./docker-start.sh
```

**Port conflicts:**
```bash
# Stop all containers
docker stop $(docker ps -q)
./docker-start.sh
```

### Common Issues

**Database locked errors:**
```bash
# Stop all services first
./stop.sh  # or ./docker-stop.sh
rm backend/pandiver.db  # Delete database (data loss!)
./start.sh  # or ./docker-start.sh
```

**Frontend not loading:**
- Wait 2-3 minutes for Next.js compilation
- Check logs: `tail -f frontend.log`
- Verify both services are running

---

## 📋 Health Checks

Both deployments include automatic health checks:

**Native Setup:**
- Backend: Checks http://localhost:8000/docs
- Frontend: Checks http://localhost:3000

**Docker Setup:**
- Built-in Docker health checks
- Automatic service recovery
- Dependency management (frontend waits for backend)

---

## 🚀 Production Deployment

### Native Production
```bash
# Set production environment
export NODE_ENV=production
export DEBUG=false

# Use process manager
npm install -g pm2
pm2 start ecosystem.config.js
```

### Docker Production
```bash
# Use production compose file
docker-compose -f docker-compose.prod.yml up -d

# Or with Docker Swarm
docker stack deploy -c docker-compose.yml pandiver
```

---

## 📞 Support

**Application URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

**Repository:** https://github.com/ameetmund/pandiver

**Version:** 2025.07.24.02

---

## 🎯 Quick Reference

| Task | Native Command | Docker Command |
|------|---------------|----------------|
| **Start** | `./start.sh` | `./docker-start.sh` |
| **Stop** | `./stop.sh` | `./docker-stop.sh` |
| **Logs** | `tail -f *.log` | `docker-compose logs -f` |
| **Restart** | `./stop.sh && ./start.sh` | `docker-compose restart` |
| **Status** | `ps aux \| grep pandiver` | `docker-compose ps` |

Choose the deployment method that best fits your needs! 🎉