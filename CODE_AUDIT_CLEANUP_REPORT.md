# Code Audit & Cleanup Report
**Date:** 2025-10-08
**Project:** Pandiver - Smart PDF Parser
**Purpose:** Pre-PostgreSQL Migration Audit

---

## Executive Summary

This audit identifies **critical security issues**, hardcoded values, configuration inconsistencies, and technical debt that must be addressed before proceeding with the PostgreSQL migration.

**Risk Level:** 🔴 **HIGH** - Multiple critical security vulnerabilities found

---

## 🔴 CRITICAL ISSUES (Must Fix Immediately)

### 1. **Hardcoded Secret Keys in Production Code**

**Location:** Multiple files contain hardcoded SECRET_KEY values

**Files Affected:**
- [backend/app/main.py:98](backend/app/main.py#L98)
- [backend/app/auth.py:14](backend/app/auth.py#L14)
- [backend/main.py:20](backend/main.py#L20)
- [docker-compose.yml:19](docker-compose.yml#L19)
- [docker-compose.dev.yml:25](docker-compose.dev.yml#L25)

**Code Examples:**
```python
# backend/app/main.py:98
SECRET_KEY = "09af8c2e8b3a47f19c6d5e7a8b2c4d6f9e1a3b5c7d9f0e2a4b6c8d0f1e3a5b7c9d1f3e5a7b9c1d3f5e7a9b1d3f5e7a9b"

# backend/app/auth.py:14
SECRET_KEY = "09af8c2e8b3a47f19c6d5e7a8b2c4d6f9e1a3b5c7d9f0e2a4b6c8d0f1e3a5b7c9d1f3e5a7b9c1d3f5e7a9b1d3f5e7a9b"
```

**Risk:**
- JWT tokens can be forged by anyone with access to this key
- Authentication bypass vulnerability
- User account compromise

**Required Action:**
- Remove all hardcoded SECRET_KEY values
- Use environment variables with `os.getenv("SECRET_KEY")`
- Generate unique, strong keys for each environment
- Rotate all existing keys after fix

---

### 2. **Hardcoded Database URLs**

**Location:** [backend/app/main.py:92](backend/app/main.py#L92)

```python
SQLALCHEMY_DATABASE_URL = 'sqlite:///./pandiver.db'
```

**Risk:**
- Cannot switch databases without code changes
- Blocks PostgreSQL migration
- No environment-specific configuration

**Required Action:**
- Replace with: `os.getenv("DATABASE_URL", "sqlite:///./pandiver.db")`
- Ensure all environments use environment variables

---

### 3. **Hardcoded API URLs in Frontend Components**

**Locations:** 31 frontend files contain `http://localhost:8000`

**Sample Files:**
- [frontend/src/app/auth/login/page.tsx:21](frontend/src/app/auth/login/page.tsx#L21)
- All components in `frontend/src/components/pdf/*.tsx`
- All dashboard pages in `frontend/src/app/dashboard/**/*.tsx`

**Code Example:**
```typescript
// frontend/src/app/auth/login/page.tsx:21
const response = await fetch('http://localhost:8000/auth/login', {
```

**Risk:**
- Breaks in production/staging environments
- Cannot deploy without code changes
- Frontend hardcoded to localhost

**Required Action:**
- Create API configuration utility
- Use environment variable: `process.env.NEXT_PUBLIC_API_URL`
- Replace all hardcoded URLs with config

---

## 🟡 HIGH PRIORITY ISSUES

### 4. **Multiple .env Files Creating Confusion**

**Found:**
```
/.env
/.env.docker
/.env.example
/backend/.env
/backend/.env.example
/backend/app/.env
/environments/.env.development
/environments/.env.staging
/environments/.env.production
/frontend/.env.example
```

**Issues:**
- 3 different `.env` files (root, backend, backend/app) - which one is used?
- Duplicate configuration across files
- No clear hierarchy or precedence
- Risk of using wrong configuration

**Recommended Structure:**
```
/environments/
  ├── .env.development    ✅ Keep
  ├── .env.staging        ✅ Keep
  └── .env.production     ✅ Keep
/.env.example             ✅ Keep (template)
/.env                     ⚠️ Delete (use environments/)
/backend/.env             ⚠️ Delete (use root environments/)
/backend/app/.env         ⚠️ Delete (use root environments/)
/.env.docker              ⚠️ Consolidate into docker-compose files
```

---

### 5. **Docker Configuration Inconsistencies**

**Files:**
- [docker-compose.yml](docker-compose.yml) - Has hardcoded JWT_SECRET_KEY
- [docker-compose.dev.yml](docker-compose.dev.yml) - Has hardcoded SECRET_KEY
- [docker/compose/docker-compose.staging.yml](docker/compose/docker-compose.staging.yml) - Uses env vars ✅
- [docker/compose/docker-compose.prod.yml](docker/compose/docker-compose.prod.yml) - Uses env vars ✅

**Issues:**
- Dev and base docker-compose have hardcoded secrets
- Inconsistent environment variable usage
- Dev should also use environment variables

**Required Action:**
- Remove hardcoded values from docker-compose.yml and docker-compose.dev.yml
- Use `.env` file with docker-compose
- Ensure all environments follow same pattern

---

### 6. **Database Files in Wrong Locations**

**Found:**
- `/pandiver.db` (root) - 98 KB
- `/backend/pandiver.db` (backend) - 136 KB

**Issues:**
- Two database files - which is the source of truth?
- Different sizes suggest different data
- Risk of using wrong database
- Should not be in git (already in .gitignore but still present)

**Required Action:**
- Decide on single database location
- Delete duplicate
- Ensure .gitignore is respected
- Document database location in README

---

## 🟢 MEDIUM PRIORITY ISSUES

### 7. **Unused Backup and Old Files**

**Files to Remove:**
- `/frontend/src/app/dashboard/api/page.tsx.backup` (1003 lines)
- `/frontend/src/app/dashboard/bank-statement-parser/page_old.tsx` (1865 lines)
- `/backend/start.sh.backup` (155 lines)
- `/backend.log` (70 KB)
- `/frontend.log` (7.8 KB)
- `/startup_test.log` (1.4 KB)

**Issues:**
- Taking up space
- Confusing for developers
- Should use git for version control, not backup files
- Logs should be in `.gitignore` and cleaned up

**Required Action:**
- Delete all `.backup` and `_old` files
- Delete all `.log` files from git
- Ensure .gitignore covers logs properly

---

### 8. **Frontend Missing Centralized API Configuration**

**Issue:**
- No centralized API configuration file (checked `/frontend/src/lib/api.ts` - doesn't exist)
- Every component has inline API calls
- No error handling standardization
- No request/response interceptors

**Recommended Structure:**
```typescript
// frontend/src/lib/api.ts (CREATE THIS)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = {
  baseURL: API_BASE_URL,
  get: (endpoint) => fetch(`${API_BASE_URL}${endpoint}`),
  post: (endpoint, data) => fetch(`${API_BASE_URL}${endpoint}`, {...}),
  // ... etc
};
```

---

## 📋 CLEANUP RECOMMENDATIONS

### Environment Variables Strategy

**Create a single source of truth:**

1. **Use the `/environments/` directory exclusively**
   - `.env.development` - for local development
   - `.env.staging` - for staging environment
   - `.env.production` - for production

2. **Delete redundant files:**
   - `/.env` (move values to `/environments/.env.development`)
   - `/backend/.env`
   - `/backend/app/.env`
   - `/.env.docker` (merge into docker-compose)

3. **Create clear documentation:**
   - Which file is used in which scenario
   - How to switch environments
   - Required variables for each environment

---

### Docker Best Practices

**All Docker Compose files should:**

1. **Never hardcode secrets** - Always use `${VAR_NAME}`
2. **Load from .env file** - Use `env_file: .env` in docker-compose
3. **Have environment-specific files:**
   - `docker-compose.dev.yml` - for development
   - `docker-compose.staging.yml` - for staging
   - `docker-compose.prod.yml` - for production

**Example Fix for docker-compose.dev.yml:**
```yaml
services:
  backend:
    environment:
      - SECRET_KEY=${SECRET_KEY}  # NOT hardcoded
      - DATABASE_URL=${DATABASE_URL}
    env_file:
      - ./environments/.env.development
```

---

### Security Best Practices

**Immediate Actions:**

1. **Audit all SECRET_KEY occurrences:**
   ```bash
   grep -r "SECRET_KEY.*=" --include="*.py" --include="*.yml" backend/
   ```

2. **Replace with environment variables:**
   ```python
   # BEFORE (INSECURE):
   SECRET_KEY = "hardcoded-value"

   # AFTER (SECURE):
   import os
   SECRET_KEY = os.getenv("SECRET_KEY")
   if not SECRET_KEY:
       raise ValueError("SECRET_KEY environment variable not set")
   ```

3. **Generate strong keys for each environment:**
   ```python
   import secrets
   print(secrets.token_urlsafe(64))
   ```

4. **Use Azure Key Vault for production/staging** (already planned in env files)

---

### Code Organization

**Remove:**
- All `.backup` files
- All `_old.tsx` files
- All `.log` files from repository
- Test/debug files: `debug_jwt.py`, sample PDFs in root

**Update .gitignore:**
```gitignore
# Ensure these are ignored
*.log
*.backup
*_old.*
debug_*.py
*.db
*.sqlite*
pandiver.db
```

---

## 🎯 ACTION PLAN (Prioritized)

### Phase 1: Critical Security Fixes (DO THIS NOW)

- [ ] Remove all hardcoded SECRET_KEY values from code
- [ ] Update all Python files to use `os.getenv("SECRET_KEY")`
- [ ] Update all Docker compose files to use `${SECRET_KEY}`
- [ ] Generate new SECRET_KEY for each environment
- [ ] Update environment files with new keys
- [ ] Test authentication still works

### Phase 2: Database Configuration (BEFORE PostgreSQL Migration)

- [ ] Remove hardcoded DATABASE_URL from main.py
- [ ] Update to use `os.getenv("DATABASE_URL")`
- [ ] Decide on single database file location (recommend: `/backend/data/`)
- [ ] Delete duplicate database files
- [ ] Update docker-compose to mount correct database location

### Phase 3: Frontend API Configuration

- [ ] Create `/frontend/src/lib/api.ts` utility
- [ ] Add `NEXT_PUBLIC_API_URL` to all environment files
- [ ] Replace all hardcoded `http://localhost:8000` with API utility
- [ ] Test all 31 affected frontend files
- [ ] Update Docker configurations with correct API URLs

### Phase 4: Environment File Consolidation

- [ ] Move all configuration to `/environments/` directory
- [ ] Delete redundant .env files (root, backend, backend/app)
- [ ] Update documentation on which file to use
- [ ] Update Docker to use environment-specific files
- [ ] Test all three environments (dev, staging, prod)

### Phase 5: Cleanup

- [ ] Delete all .backup and _old files
- [ ] Delete all .log files
- [ ] Remove test/debug files from root
- [ ] Update .gitignore
- [ ] Run git clean to remove untracked files

---

## 📊 RISK ASSESSMENT

| Issue | Risk Level | Impact | Effort | Priority |
|-------|------------|--------|--------|----------|
| Hardcoded SECRET_KEY | 🔴 Critical | Auth bypass | 2 hours | P0 |
| Hardcoded DATABASE_URL | 🔴 Critical | Blocks migration | 1 hour | P0 |
| Hardcoded API URLs | 🟡 High | Breaks deployment | 4 hours | P1 |
| Multiple .env files | 🟡 High | Wrong config used | 2 hours | P1 |
| Docker inconsistencies | 🟡 High | Deployment issues | 2 hours | P1 |
| Duplicate databases | 🟢 Medium | Data confusion | 30 mins | P2 |
| Backup files | 🟢 Low | Technical debt | 15 mins | P3 |
| Missing API utility | 🟢 Medium | Code duplication | 3 hours | P2 |

**Total Estimated Effort:** ~15 hours
**Must complete before PostgreSQL migration:** Phase 1 & 2 (3 hours)

---

## ✅ VALIDATION CHECKLIST

After implementing fixes, verify:

- [ ] No hardcoded secrets in any Python file
- [ ] No hardcoded secrets in any Docker file
- [ ] All API calls use environment variables
- [ ] Can switch environments by changing .env file only
- [ ] Docker works in dev/staging/prod with different env files
- [ ] No sensitive files in git repository
- [ ] .gitignore properly excludes logs, databases, secrets
- [ ] Authentication works after changes
- [ ] Frontend connects to correct backend in all environments

---

## 📚 ADDITIONAL RECOMMENDATIONS

### 1. **Create a Configuration Module**

**Backend: `/backend/app/config.py`**
```python
import os
from functools import lru_cache
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    environment: str
    secret_key: str
    database_url: str
    azure_translator_key: str
    # ... all config here

    class Config:
        env_file = f"./environments/.env.{os.getenv('ENVIRONMENT', 'development')}"

@lru_cache()
def get_settings():
    return Settings()
```

### 2. **Create Environment Switcher Script**

```bash
# scripts/set-env.sh
#!/bin/bash
ENV=${1:-development}
ln -sf ./environments/.env.$ENV .env
echo "Switched to $ENV environment"
```

### 3. **Add Pre-commit Hooks**

Prevent committing secrets:
```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached | grep -E "SECRET_KEY.*=.*['\"]"; then
    echo "❌ Error: Hardcoded SECRET_KEY detected"
    exit 1
fi
```

### 4. **Documentation Updates Needed**

- [ ] Update README.md with environment setup
- [ ] Document environment variable requirements
- [ ] Add deployment guide for each environment
- [ ] Document Docker usage for each environment

---

## 🚨 BLOCKERS FOR POSTGRESQL MIGRATION

**Cannot proceed with PostgreSQL migration until:**

1. ✅ DATABASE_URL is configurable via environment variables
2. ✅ All hardcoded values are removed
3. ✅ Environment files are properly organized
4. ✅ Docker configurations are consistent across environments

**Estimated time to resolve blockers:** 3-4 hours

---

## 📝 NOTES

- This codebase has good structure but security hygiene needs improvement
- The `/environments/` directory exists with proper structure - use it!
- Staging and production Docker files are well-configured - use them as template
- Frontend needs significant refactoring for API calls
- Consider using a secrets manager (Azure Key Vault) for production

---

**Report Generated By:** Claude Code Audit
**Next Steps:** Review this report with team, prioritize Phase 1 & 2, then proceed with PostgreSQL migration.
