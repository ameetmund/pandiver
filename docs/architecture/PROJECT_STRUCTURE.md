# Pandiver - Modular Project Structure

## 🏗️ Recommended Directory Structure

```
pandiver/
├── 📁 frontend/
│   ├── 📁 src/
│   │   ├── 📁 app/                          # Next.js App Router
│   │   │   ├── 📁 (public)/                 # Public routes (no auth required)
│   │   │   │   ├── 📁 about/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── 📁 features/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── 📁 pricing/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── 📁 contact/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx                 # Landing page
│   │   │   │
│   │   │   ├── 📁 (auth)/                   # Authentication routes
│   │   │   │   ├── 📁 login/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── 📁 register/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── 📁 forgot-password/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── 📁 reset-password/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── 📁 (dashboard)/              # Protected dashboard routes
│   │   │   │   ├── 📁 dashboard/
│   │   │   │   │   ├── page.tsx             # Dashboard home
│   │   │   │   │   ├── 📁 pdf-processor/
│   │   │   │   │   │   └── page.tsx         # Current PDF functionality
│   │   │   │   │   ├── 📁 projects/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── 📁 history/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── 📁 settings/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── layout.tsx               # Dashboard layout
│   │   │   │
│   │   │   ├── 📁 api/                      # API routes
│   │   │   │   ├── 📁 auth/
│   │   │   │   │   ├── login/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   ├── register/
│   │   │   │   │   │   └── route.ts
│   │   │   │   │   └── logout/
│   │   │   │   │       └── route.ts
│   │   │   │   └── 📁 user/
│   │   │   │       └── route.ts
│   │   │   │
│   │   │   ├── globals.css
│   │   │   └── layout.tsx                   # Root layout
│   │   │
│   │   ├── 📁 components/                   # Reusable components
│   │   │   ├── 📁 common/                   # Shared components
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Navigation.tsx
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   └── Loading.tsx
│   │   │   │
│   │   │   ├── 📁 public/                   # Public page components
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── Features.tsx
│   │   │   │   ├── Testimonials.tsx
│   │   │   │   ├── CTA.tsx
│   │   │   │   └── FAQ.tsx
│   │   │   │
│   │   │   ├── 📁 auth/                     # Authentication components
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   │
│   │   │   ├── 📁 dashboard/                # Dashboard components
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopBar.tsx
│   │   │   │   ├── StatsCard.tsx
│   │   │   │   └── ProjectCard.tsx
│   │   │   │
│   │   │   └── 📁 pdf/                      # PDF processing components
│   │   │       ├── PDFUploader.tsx          # Existing
│   │   │       ├── InteractivePDFViewer.tsx # Existing
│   │   │       ├── DataTable.tsx            # Existing
│   │   │       ├── ExportData.tsx           # Existing
│   │   │       └── DraggableTextBlock.tsx   # Existing
│   │   │
│   │   ├── 📁 hooks/                        # Custom hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useTextBlocks.ts             # Existing
│   │   │   ├── useLocalStorage.ts
│   │   │   └── useApi.ts
│   │   │
│   │   ├── 📁 lib/                          # Utilities and configurations
│   │   │   ├── auth.ts
│   │   │   ├── api.ts
│   │   │   ├── utils.ts
│   │   │   ├── constants.ts
│   │   │   └── validations.ts
│   │   │
│   │   ├── 📁 styles/                       # Styles
│   │   │   ├── globals.css
│   │   │   └── components.css
│   │   │
│   │   └── 📁 types/                        # TypeScript types
│   │       ├── auth.ts
│   │       ├── pdf.ts
│   │       ├── user.ts
│   │       └── api.ts
│   │
│   ├── 📁 public/                           # Static assets
│   │   ├── logo.svg
│   │   ├── favicon.ico
│   │   └── 📁 images/
│   │       ├── hero-bg.jpg
│   │       └── features/
│   │
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── tsconfig.json
│
├── 📁 backend/
│   ├── 📁 app/                              # Main application
│   │   ├── __init__.py
│   │   ├── main.py                          # FastAPI app
│   │   │
│   │   ├── 📁 api/                          # API routes
│   │   │   ├── __init__.py
│   │   │   ├── 📁 v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── 📁 auth/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── login.py
│   │   │   │   │   ├── register.py
│   │   │   │   │   └── refresh.py
│   │   │   │   ├── 📁 pdf/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── upload.py            # Existing functionality
│   │   │   │   │   ├── process.py
│   │   │   │   │   └── export.py
│   │   │   │   ├── 📁 user/
│   │   │   │   │   ├── __init__.py
│   │   │   │   │   ├── profile.py
│   │   │   │   │   └── settings.py
│   │   │   │   └── 📁 projects/
│   │   │   │       ├── __init__.py
│   │   │   │       ├── crud.py
│   │   │   │       └── models.py
│   │   │   │
│   │   │   └── dependencies.py              # API dependencies
│   │   │
│   │   ├── 📁 core/                         # Core configuration
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   │
│   │   ├── 📁 models/                       # Database models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   └── pdf_document.py
│   │   │
│   │   ├── 📁 schemas/                      # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── project.py
│   │   │   └── pdf.py
│   │   │
│   │   ├── 📁 services/                     # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── pdf_service.py               # Existing logic
│   │   │   ├── user_service.py
│   │   │   └── email_service.py
│   │   │
│   │   └── 📁 utils/                        # Utilities
│   │       ├── __init__.py
│   │       ├── email.py
│   │       ├── file_handler.py
│   │       └── helpers.py
│   │
│   ├── 📁 tests/                            # Test files
│   │   ├── __init__.py
│   │   ├── test_auth.py
│   │   ├── test_pdf.py
│   │   └── test_user.py
│   │
│   ├── 📁 alembic/                          # Database migrations
│   │   ├── env.py
│   │   └── versions/
│   │
│   ├── requirements.txt
│   ├── .env.example
│   └── alembic.ini
│
├── 📁 shared/                               # Shared configurations
│   ├── 📁 types/                            # Shared TypeScript types
│   │   ├── api.ts
│   │   └── common.ts
│   │
│   └── 📁 constants/
│       └── api-endpoints.ts
│
├── 📁 docs/                                 # Documentation
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── DEVELOPMENT.md
│
├── 📁 .github/                              # GitHub workflows
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── docker-compose.yml                       # Development environment
├── .gitignore
└── README.md
```

## 🎯 Key Features of This Structure

### 1. **Route Organization (Next.js App Router)**
- **Public routes**: `(public)` - Landing, about, features, pricing
- **Auth routes**: `(auth)` - Login, register, password reset
- **Dashboard routes**: `(dashboard)` - Protected app functionality
- **API routes**: `api/` - Frontend API endpoints

### 2. **Component Organization**
- **common/**: Shared UI components (Header, Footer, Button, etc.)
- **public/**: Landing page specific components (Hero, Features, etc.)
- **auth/**: Authentication forms and components
- **dashboard/**: Dashboard-specific components
- **pdf/**: PDF processing components (existing functionality)

### 3. **Backend Modular Structure**
- **api/v1/**: Versioned API routes organized by feature
- **core/**: Configuration, security, database setup
- **models/**: Database models (User, Project, PDF Document)
- **schemas/**: Pydantic models for API validation
- **services/**: Business logic layer
- **utils/**: Helper functions and utilities

### 4. **Shared Resources**
- **types/**: Shared TypeScript definitions
- **constants/**: API endpoints and configuration
- **hooks/**: Custom React hooks
- **lib/**: Utility functions and configurations

## 🚀 Migration Benefits

1. **Scalability**: Easy to add new features and modules
2. **Maintainability**: Clear separation of concerns
3. **Team Collaboration**: Different teams can work on different modules
4. **Code Reusability**: Shared components and utilities
5. **Security**: Proper authentication and authorization layers
6. **Performance**: Optimized routing and lazy loading

## 📋 Implementation Plan

The TODO list above outlines the step-by-step implementation of this structure, starting with frontend restructuring and moving to backend improvements.

Would you like me to start implementing this modular structure? I can begin with any specific module you'd like to prioritize. 