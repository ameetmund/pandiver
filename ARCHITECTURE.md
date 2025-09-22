# Pandiver Architecture Guide

## 🏗️ System Overview

Pandiver is a comprehensive document processing platform with AI-powered features for PDF analysis, translation, and data extraction.

## 📋 Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [Backend Components](#backend-components)
3. [Frontend Structure](#frontend-structure)
4. [Data Flow](#data-flow)
5. [API Endpoints](#api-endpoints)
6. [Database Schema](#database-schema)
7. [Authentication & Security](#authentication--security)
8. [External Services](#external-services)

## 🎯 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │  External APIs  │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│  Azure Services │
│   Port: 3000    │    │   Port: 8000    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         │              │   Database      │             │
         └──────────────►│   (SQLite)     │◄────────────┘
                        │                 │
                        └─────────────────┘
```

## 🔧 Backend Components

### Core Modules

#### 1. **Main Application** (`app/main.py`)
- FastAPI application entry point
- Router configuration
- CORS middleware setup
- Authentication routes

#### 2. **Authentication System** (`app/auth.py`)
- JWT token-based authentication
- API key management
- User session handling

#### 3. **Database Models** (`app/models.py`)
```python
Key Models:
├── User              # User accounts
├── ApiKey           # API key management
├── ApiUsage         # Usage tracking
├── PDFTranslationJob # Translation jobs
├── PDFSplitterJob   # PDF splitting jobs
└── IntelligentDataParserJob # Data parsing jobs
```

#### 4. **API Endpoint Groups**
```
├── Auth Endpoints           (/auth/*)
├── PDF Translator API       (/api/v1/pdf-translator-api/*)
├── PDF Splitter API         (/api/v1/pdf-splitter-api/*)
├── Intelligent Data Parser  (/api/v1/intelligent-data-parser/*)
├── PDF Translation          (/api/v1/pdf-translator/*)
└── General API              (/api/v1/*)
```

#### 5. **Service Layer**
```
Services:
├── pdf_translation_service.py    # Core translation logic
├── azure_doc_translation_service.py # Azure integration
├── pdf_splitter_service.py       # PDF splitting
├── intelligent_parser.py         # Data extraction
└── azure_document_intelligence.py # AI document analysis
```

## 🎨 Frontend Structure

### Dashboard Pages
```
dashboard/
├── /                          # Main dashboard
├── /api/pdf-translator        # Translation API interface
├── /api/pdf-splitter-api      # Splitter API interface
├── /api/intelligent-data-parser # Parser API interface
├── /pdf-translator            # Translation UI
├── /pdf-splitter              # Splitter UI
└── /intelligent-data-parser   # Parser UI
```

### Component Architecture
```
Components:
├── Authentication             # Login/logout components
├── API Interfaces            # API key management & testing
├── File Upload               # Drag & drop file handling
├── Progress Tracking         # Job status monitoring
└── Results Display           # Output visualization
```

## 🔄 Data Flow

### 1. User Authentication Flow
```
User Login → JWT Token → API Key Generation → Service Access
```

### 2. PDF Translation Flow
```
File Upload → Language Detection → Translation Job → Azure API → Result Download
```

### 3. PDF Splitting Flow
```
File Upload → Page Analysis → Page Selection → Split Job → Result Download
```

### 4. Data Parsing Flow
```
File Upload → AI Analysis → Data Extraction → Structured Output → Export
```

## 🌐 API Endpoints

### Authentication Endpoints
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user
- `POST /auth/api-keys` - Create API key
- `GET /auth/api-keys` - List API keys

### PDF Translator API
- `GET /api/v1/pdf-translator-api/languages` - Get supported languages
- `POST /api/v1/pdf-translator-api/analyze` - Analyze PDF for translation
- `POST /api/v1/pdf-translator-api/translate` - Start translation job
- `GET /api/v1/pdf-translator-api/jobs/{job_id}/status` - Check job status
- `GET /api/v1/pdf-translator-api/download/{job_id}` - Download result

### PDF Splitter API
- `POST /api/v1/pdf-splitter-api/analyze` - Analyze PDF for splitting
- `POST /api/v1/pdf-splitter-api/split` - Start splitting job
- `GET /api/v1/pdf-splitter-api/jobs/{job_id}/status` - Check job status
- `GET /api/v1/pdf-splitter-api/download/{job_id}` - Download result

## 🗄️ Database Schema

### Core Tables
```sql
users
├── id (Primary Key)
├── email (Unique)
├── username
├── password_hash
└── created_at

api_keys
├── id (Primary Key)
├── user_id (Foreign Key)
├── key_name
├── api_key (Unique)
├── is_active
├── created_at
└── last_used_at

api_usage
├── id (Primary Key)
├── api_key_id (Foreign Key)
├── user_id (Foreign Key)
├── endpoint
├── job_id
├── status
├── file_count
├── processing_time
├── created_at
└── completed_at

pdf_translation_jobs
├── id (Primary Key)
├── job_id (Unique)
├── user_id (Foreign Key)
├── original_filename
├── translated_filename
├── source_language
├── target_language
├── status
├── total_pages
├── characters_translated
├── created_at
└── completed_at
```

## 🔐 Authentication & Security

### Two-Tier Authentication
1. **JWT Tokens** - For web dashboard access
2. **API Keys** - For programmatic API access

### Security Features
- Password hashing with bcrypt
- API key generation and management
- Usage tracking and rate limiting
- CORS protection
- Input validation and sanitization

## 🌍 External Services

### Azure Services Integration
```
├── Azure Translator API      # Text translation
├── Azure Document Intelligence # PDF analysis
├── Azure Blob Storage        # File storage
└── Azure Cognitive Services  # AI capabilities
```

### Service Configuration
```python
# Environment Variables Required:
AZURE_TRANSLATOR_KEY          # Azure Translator API key
AZURE_TRANSLATOR_REGION       # Azure region
AZURE_DOC_INTELLIGENCE_KEY    # Document Intelligence key
AZURE_DOC_INTELLIGENCE_ENDPOINT # Service endpoint
```

## 🚀 Deployment Architecture

### Local Development
```
├── Backend: http://localhost:8000
├── Frontend: http://localhost:3000
├── Database: SQLite (local file)
└── File Storage: Local filesystem
```

### Production (Azure)
```
├── Frontend: Azure App Service
├── Backend: Azure App Service
├── Database: Azure PostgreSQL
├── File Storage: Azure Blob Storage
├── Secrets: Azure Key Vault
└── Monitoring: Application Insights
```

## 📊 Monitoring & Logging

### Health Checks
- Database connectivity
- External API availability
- Service responsiveness

### Metrics Tracked
- API response times
- Job completion rates
- Error frequencies
- User activity patterns

## 🔧 Development Guidelines

### Code Organization
```
backend/app/
├── main.py              # Application entry point
├── auth.py              # Authentication logic
├── models.py            # Database models
├── *_endpoints.py       # API route definitions
├── *_service.py         # Business logic
└── utils/               # Utility functions
```

### Testing Strategy
- Unit tests for service layer
- Integration tests for API endpoints
- End-to-end tests for critical flows

### Error Handling
- Structured error responses
- Logging for debugging
- User-friendly error messages
- Graceful degradation

## 📝 Getting Started Guide

### 1. Environment Setup
```bash
# Clone repository
git clone <repository-url>

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
```

### 2. Configuration
```bash
# Copy environment template
cp .env.template .env

# Update with your Azure credentials
# AZURE_TRANSLATOR_KEY=your_key_here
# AZURE_TRANSLATOR_REGION=your_region
```

### 3. Running the Application
```bash
# Start backend (Terminal 1)
cd backend && uvicorn app.main:app --reload --port 8000

# Start frontend (Terminal 2)
cd frontend && npm run dev
```

### 4. Access Points
- Dashboard: http://localhost:3000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## 🆘 Troubleshooting

### Common Issues
1. **Missing Dependencies** - Run `pip install -r requirements.txt`
2. **Port Conflicts** - Change ports in configuration
3. **Azure API Errors** - Verify credentials and quotas
4. **Database Issues** - Check SQLite file permissions

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Run with verbose output
uvicorn app.main:app --reload --log-level debug
```

## 📞 Support

For technical issues or questions:
1. Check this documentation
2. Review API documentation at `/docs`
3. Check application logs
4. Verify Azure service status

---

*Last updated: September 17, 2025*
*Version: V2025.09.17.01*