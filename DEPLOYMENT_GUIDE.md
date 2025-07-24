# 🚀 Smart PDF Parser - Production Ready

**Drag-and-drop PDF text extraction with intelligent table creation and export functionality.**

## ✨ Features
- **Interactive PDF Viewer** with text block selection
- **Drag & Drop Interface** for organizing data into tables
- **Multi-block Selection** with choice dialog (rows/columns)
- **Excel & CSV Export** functionality
- **Authentication System** with JWT tokens
- **Optimized Performance** with zero lag drag operations

---

## 🎯 **One-Command Deployment**

### **Prerequisites**
- **Python 3.8+** installed
- **Node.js 16+** and **npm** installed
- **macOS/Linux** system (bash support)

### **Quick Start**
```bash
# 1. Clone the repository
git clone <your-repo-url>
cd pandiver-new

# 2. Start the application (ONE COMMAND!)
./start.sh
```

**That's it!** The application will be running on:
- 🌐 **Frontend**: http://localhost:3000
- 📊 **Backend API**: http://localhost:8000
- 📋 **API Docs**: http://localhost:8000/docs

---

## 🛠️ **Management Commands**

### Start Application
```bash
./start.sh
```
- ✅ **Backend**: Always starts on port **8000**
- ✅ **Frontend**: Always starts on port **3000**
- ✅ **Auto-installs** all dependencies
- ✅ **Creates** virtual environments automatically
- ✅ **Verifies** all services are running

### Stop Application
```bash
./stop.sh
```
- 🛑 Cleanly stops both servers
- 📄 Shows log file locations

### View Logs
```bash
# Backend logs
tail -f backend.log

# Frontend logs  
tail -f frontend.log
```

---

## 📦 **What Happens During Startup**

The `start.sh` script automatically:

1. **🔍 Validates** project structure
2. **🧹 Cleans up** any existing processes on ports 8000/3000
3. **🐍 Sets up** Python virtual environment (`backend/venv/`)
4. **📦 Installs** all Python dependencies from `requirements.txt`
5. **✅ Verifies** critical imports (FastAPI, PDFplumber, etc.)
6. **🚀 Starts** backend server on port 8000
7. **📦 Installs** Node.js dependencies if needed
8. **🚀 Starts** frontend server on port 3000
9. **✅ Confirms** both servers are responding
10. **📝 Provides** access URLs and management info

---

## 🎮 **How to Use Smart PDF Parser**

### 1. **Upload PDF**
- Click "Choose File" and select your PDF
- PDF will be processed and text blocks extracted

### 2. **Select Text Blocks**
- **Single Block**: Click and drag any blue text block
- **Multiple Blocks**: 
  - Click "Selection ON" button
  - Drag to select multiple blocks
  - Drag selection to table

### 3. **Organize Data**
- **Headers**: Drag field names to column headers (blue highlight)
- **Data**: Drag values to table cells (green highlight)
- **Multi-block Dialog**: Choose "Add as Rows" or "Add as Columns"

### 4. **Export Data**
- Click "Export to Excel" or "Export to CSV"
- Files download automatically with timestamp

---

## 🏗️ **Project Structure**
```
pandiver-new/
├── start.sh              # 🚀 Main startup script
├── stop.sh               # 🛑 Stop script
├── DEPLOYMENT_GUIDE.md   # 📖 This file
├── backend/
│   ├── app/
│   │   ├── main.py      # FastAPI application
│   │   └── ...
│   ├── requirements.txt  # Python dependencies
│   └── venv/            # Virtual environment (auto-created)
├── frontend/
│   ├── src/
│   │   ├── app/         # Next.js pages
│   │   └── components/  # React components
│   ├── package.json     # Node.js dependencies
│   └── node_modules/    # Dependencies (auto-created)
├── backend.log          # Backend logs (auto-created)
└── frontend.log         # Frontend logs (auto-created)
```

---

## 🔧 **Configuration**

### **Fixed Ports** (Cannot be changed)
- **Backend**: Port 8000 (hardcoded)
- **Frontend**: Port 3000 (hardcoded in package.json)

### **Dependencies**
All dependencies are locked and automatically managed:

**Backend** (`requirements.txt`):
- FastAPI 0.110.1
- PDFplumber 0.10.2
- Pandas 2.2.2
- OpenPyXL 3.1.2
- And more...

**Frontend** (`package.json`):
- Next.js 14.2.5  
- React 18
- React DND 16.0.1
- TailwindCSS 3.4.1
- And more...

---

## 🚨 **Troubleshooting**

### **Port Already in Use**
```bash
# The script automatically handles this, but if needed:
./stop.sh
./start.sh
```

### **Python Issues**
```bash
# If Python dependencies fail:
cd backend
rm -rf venv
cd ..
./start.sh
```

### **Node.js Issues**
```bash
# If Node dependencies fail:
cd frontend
rm -rf node_modules package-lock.json
cd ..
./start.sh
```

### **Check Logs**
```bash
# Backend errors
cat backend.log

# Frontend errors  
cat frontend.log
```

### **Complete Reset**
```bash
# Nuclear option - clean everything
./stop.sh
rm -rf backend/venv frontend/node_modules
rm -f backend.log frontend.log *.pid
./start.sh
```

---

## ✅ **Production Checklist**

Before deploying to a new system:

- [ ] **Python 3.8+** installed (`python3 --version`)
- [ ] **Node.js 16+** installed (`node --version`)
- [ ] **npm** available (`npm --version`)
- [ ] **Ports 3000 & 8000** available
- [ ] **Internet connection** (for dependency downloads)
- [ ] **Sufficient disk space** (~500MB for dependencies)

---

## 🔒 **Security Notes**

- **Development Mode**: Uses default JWT secret (change for production)
- **Local Access**: Servers bind to localhost only
- **No HTTPS**: Uses HTTP for local development
- **In-Memory Auth**: User data not persisted (restart = logout)

---

## 📈 **Performance Optimizations**

This version includes:
- ✅ **Zero-lag drag operations** (all transitions removed)
- ✅ **Optimized z-index management** (no overlapping dialogs)
- ✅ **Efficient table operations** (minimal re-renders)
- ✅ **Disabled console logging** (production performance)
- ✅ **Smart dependency caching** (faster subsequent starts)

---

## 🤝 **Support**

If you encounter issues:
1. **Check logs** first (`backend.log` and `frontend.log`)
2. **Try complete reset** (see troubleshooting)
3. **Verify prerequisites** (Python, Node.js versions)
4. **Check port availability** (`lsof -i :3000 -i :8000`)

---

## 🏁 **Quick Reference**

| Command | Purpose |
|---------|---------|
| `./start.sh` | Start everything |
| `./stop.sh` | Stop everything |
| `tail -f backend.log` | Watch backend logs |
| `tail -f frontend.log` | Watch frontend logs |
| `http://localhost:3000` | Access application |
| `http://localhost:8000/docs` | API documentation |

**🎉 Happy PDF Parsing!**