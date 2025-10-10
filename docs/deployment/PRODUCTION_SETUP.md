# Production Setup Guide

## 🏗️ Production-Grade Project Structure

```
pandiver-new/
├── README.md                    # Main project documentation
├── DEPLOYMENT_GUIDE.md          # Deployment instructions
├── PRODUCTION_SETUP.md          # This file
├── .gitignore                   # Global gitignore
├── start.sh                     # Production startup script
├── stop.sh                      # Production shutdown script
│
├── backend/                     # Python FastAPI backend
│   ├── .gitignore              # Backend-specific gitignore
│   ├── requirements.txt        # Python dependencies
│   ├── README.md               # Backend documentation
│   └── app/                    # Application code
│       ├── __init__.py
│       ├── main.py             # FastAPI app entry point
│       ├── models.py           # Data models
│       ├── pdf_processor.py    # PDF processing logic
│       ├── universal_parser.py # Smart parsing engine
│       └── export_utils.py     # Export functionality
│
├── frontend/                   # Next.js React frontend
│   ├── README.md               # Frontend documentation
│   ├── package.json            # Node.js dependencies
│   ├── next.config.js          # Next.js configuration
│   ├── tailwind.config.ts      # Tailwind CSS configuration
│   ├── tsconfig.json           # TypeScript configuration
│   ├── public/                 # Static assets
│   │   ├── images/             # Application images
│   │   └── static/             # PDF.js worker files
│   └── src/                    # Source code
│       ├── app/                # Next.js 13+ app directory
│       ├── components/         # Reusable components
│       ├── hooks/              # Custom React hooks
│       └── styles/             # CSS files
│
└── docs/                       # Additional documentation
    ├── API.md                  # API documentation
    ├── DEPLOYMENT.md           # Deployment specifics
    └── ARCHITECTURE.md         # System architecture
```

## 🚀 Production Deployment Checklist

### Prerequisites
- [ ] Python 3.8+ installed
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] Production server configured

### Environment Setup
- [ ] Create `.env` files for both frontend and backend
- [ ] Configure production database (if applicable)
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx/apache)

### Security
- [ ] Remove all test files and debug code
- [ ] Secure API endpoints with proper authentication
- [ ] Configure CORS properly for production domain
- [ ] Set up proper logging and monitoring
- [ ] Enable rate limiting

### Performance
- [ ] Build frontend for production
- [ ] Optimize images and static assets
- [ ] Configure CDN for static files
- [ ] Set up caching strategies
- [ ] Monitor performance metrics

## 🔧 Environment Configuration

### Backend Environment Variables
Create `backend/.env`:
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost/pandiver_prod

# JWT Secret
JWT_SECRET_KEY=your-super-secret-jwt-key-here

# CORS
ALLOWED_ORIGINS=["https://yourdomain.com"]

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=/var/uploads/pandiver

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/pandiver/backend.log
```

### Frontend Environment Variables
Create `frontend/.env.local`:
```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_DEBUG=false
```

## 📁 Files Removed for Production

The following files were removed as they're not needed for production:

### Test/Debug Files
- All `.log` files
- `backend/test*.py`
- `backend/debug*.py`
- `backend/test*.html`
- `frontend/public/test*.html`

### Development Data
- Database files (`*.db`)
- Sample PDF statements (moved to separate testing repo)
- Empty directories (infrastructure/, logs/, uploads/)

### Duplicate Configurations
- `frontend/next.config.mjs` (kept .js version with PDF.js config)
- `frontend/tailwind.config.js` (kept .ts version)
- `backend/main.py` duplicate
- `backend/package.json` (not needed for Python backend)

## 🏭 Production Deployment Commands

### Quick Start (Development)
```bash
./start.sh
```

### Production Deployment
```bash
# 1. Clone repository
git clone https://github.com/yourusername/pandiver-new.git
cd pandiver-new

# 2. Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Configure production settings
nano backend/.env
nano frontend/.env.local

# 4. Start in production mode
chmod +x start.sh stop.sh
./start.sh

# 5. Configure reverse proxy (nginx example)
# Add to /etc/nginx/sites-available/pandiver
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📊 Monitoring and Maintenance

### Log Files
- Backend: Monitor `/var/log/pandiver/backend.log`
- Frontend: Monitor via pm2 or systemd logs
- Access logs: Monitor nginx/apache access logs

### Health Checks
- Backend health: `GET http://localhost:8000/health`
- Frontend health: `GET http://localhost:3000/api/health`

### Backup Strategy
- Database backups (if applicable)
- Configuration files backup
- Application logs rotation

## 🔒 Security Considerations

1. **API Security**: All endpoints require proper authentication
2. **File Upload**: Validate file types and sizes
3. **CORS**: Configured for production domain only
4. **Headers**: Security headers configured in Next.js
5. **Dependencies**: Regularly update to patch vulnerabilities

## 📈 Performance Optimization

1. **Frontend**: Built with Next.js production optimizations
2. **Backend**: FastAPI with async/await for better performance
3. **PDF Processing**: Optimized PDF.js worker configuration
4. **Caching**: Implement Redis for session and data caching
5. **CDN**: Use CDN for static assets in production