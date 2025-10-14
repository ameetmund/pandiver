# Environment Configuration Flow Diagrams

## Azure Staging Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DEVELOPER WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

1. Developer makes code changes locally
   ↓
2. Commits to 'development' branch
   ↓
3. Creates PR: development → staging
   ↓
4. PR merged to 'staging' branch

┌─────────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS WORKFLOW                          │
│              (.github/workflows/staging-deploy.yml)                 │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Build Docker Images
┌──────────────────────────────┐
│  GitHub Actions Runner       │
│                              │
│  1. Checkout code            │
│  2. Login to Azure           │
│  3. Build in ACR             │
│     • Backend (linux/amd64)  │
│     • Frontend (linux/amd64) │
└──────────────────────────────┘
              ↓
Step 2: Fetch Secrets from Key Vault
┌──────────────────────────────────────────────────────────────┐
│  Azure Key Vault: kv-pandiver-staging-8766                   │
│                                                              │
│  Secrets Retrieved:                                          │
│  • staging-database-url                                      │
│  • secret-key                                                │
│  • azure-doc-translator-key                                  │
│  • azure-doc-translator-region                               │
│  • azure-doc-translator-endpoint                             │
│  • azure-document-intelligence-key                           │
│  • azure-document-intelligence-endpoint                      │
│  • azure-blob-connection-string                              │
│  • azure-blob-src-sas-token                                  │
│  • azure-blob-out-sas-token                                  │
│  • azure-blob-config-sas-token                               │
└──────────────────────────────────────────────────────────────┘
              ↓
Step 3: Deploy to Azure Container Apps
┌──────────────────────────────────────────────────────────────┐
│  Azure Container Apps: pandiver-backend-staging              │
│                                                              │
│  Environment Variables Set:                                  │
│  • DATABASE_URL=<from Key Vault>                             │
│  • SECRET_KEY=<from Key Vault>                               │
│  • AZURE_DOC_TRANSLATOR_KEY=<from Key Vault>                 │
│  • AZURE_DOC_TRANSLATOR_REGION=<from Key Vault>              │
│  • AZURE_DOC_TRANSLATOR_ENDPOINT=<from Key Vault>            │
│  • AZURE_DOCUMENT_INTELLIGENCE_KEY=<from Key Vault>          │
│  • AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=<from Key Vault>     │
│  • AZURE_BLOB_CONNECTION_STRING=<from Key Vault>             │
│  • AZURE_BLOB_SRC_SAS_TOKEN=<from Key Vault>                 │
│  • AZURE_BLOB_OUT_SAS_TOKEN=<from Key Vault>                 │
│  • AZURE_BLOB_CONFIG_SAS_TOKEN=<from Key Vault>              │
│  • ENVIRONMENT=staging                                       │
│  • ALLOWED_ORIGINS=<frontend URL>                            │
│  • API_BASE_URL=<backend URL>                                │
└──────────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────────────┐
│  Azure Container Apps: pandiver-frontend-staging             │
│                                                              │
│  Environment Variables Set:                                  │
│  • NEXT_PUBLIC_API_URL=<backend URL>                         │
│  • NEXT_PUBLIC_ENVIRONMENT=staging                           │
│  • DOCKER_ENV=true                                           │
└──────────────────────────────────────────────────────────────┘
              ↓
Step 4: Runtime
┌──────────────────────────────────────────────────────────────┐
│  Backend FastAPI Application                                 │
│                                                              │
│  Code reads: os.getenv('AZURE_DOCUMENT_INTELLIGENCE_KEY')   │
│  Value: <from Container App environment variables>          │
│                                                              │
│  All environment variables come from:                        │
│  Azure Container Apps → Set by GitHub Actions →             │
│  Fetched from Key Vault                                      │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        KEY POINTS                                   │
│                                                                     │
│  ✅ Single Source of Truth: Azure Key Vault                         │
│  ✅ Centralized Secret Management                                   │
│  ✅ No .env files on server                                         │
│  ✅ GitHub Actions handles all deployment                           │
│  ✅ Automatic health checks and notifications                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Local Docker Flow

```
┌─────────────────────────────────────────────────���───────────────────┐
│                      DEVELOPER WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────┘

1. Developer runs: ./start_pandiver_docker.sh

┌─────────────────────────────────────────────────────────────────────┐
│                    start_pandiver_docker.sh                         │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Check Prerequisites
┌──────────────────────────────┐
│  Script Checks:              │
│  • Docker is running         │
│  • .env files exist          │
│  • Ports available           │
└──────────────────────────────┘
              ↓
Step 2: Start Services
┌──────────────────────────────────────────────────────────────────────┐
│  docker-compose up                                                   │
│  (uses: docker/compose/docker-compose.yml)                           │
└──────────────────────────────────────────────────────────────────────┘
              ↓
Step 3: Load Environment Variables
┌─────────────────────────────────────────────────────────────────────┐
│  docker-compose.yml Configuration                                   │
│                                                                     │
│  backend:                                                           │
│    env_file:                                                        │
│      - ./environments/.env.development  ← LOADS FROM HERE           │
│                                                                     │
│    environment:  ← ALSO SETS THESE DIRECTLY                         │
│      - DATABASE_URL=${DATABASE_URL}                                 │
│      - SECRET_KEY=${SECRET_KEY}                                     │
│      - ALLOWED_ORIGINS=["http://localhost:3000"]                    │
│      - HOST=0.0.0.0                                                 │
│      - PORT=8000                                                    │
└─────────────────────────────────────────────────────────────────────┘
              ↓
Step 4: Environment Variables Source
┌─────────────────────────────────────────────────────────────────────┐
│  File: environments/.env.development                                │
│                                                                     │
│  Contains:                                                          │
│  • ENVIRONMENT=development                                          │
│  • SECRET_KEY=MwVuq6SP_...                                          │
│  • DATABASE_URL=postgresql://...                                    │
│  • AZURE_DOC_TRANSLATOR_KEY=FbHKyE...                               │
│  • AZURE_DOC_TRANSLATOR_REGION=centralindia                         │
│  • AZURE_DOC_TRANSLATOR_ENDPOINT=https://...                        │
│  • AZURE_DOC_INTELLIGENCE_KEY=RjGk7S...  ⚠️ OLD NAME                │
│  • AZURE_DOC_INTELLIGENCE_ENDPOINT=https://...  ⚠️ OLD NAME         │
│  • AZURE_DOCUMENT_INTELLIGENCE_KEY=RjGk7S...  ✅ NEW (just added)   │
│  • AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://...  ✅ NEW         │
│  • AZURE_BLOB_SRC_URL=https://...                                   │
│  • AZURE_BLOB_OUT_URL=https://...                                   │
│  • AZURE_BLOB_CONFIG_URL=https://...                                │
│  • AZURE_BLOB_SRC_SAS_TOKEN=sp=rwl...                               │
│  • AZURE_BLOB_OUT_SAS_TOKEN=sp=rwl...                               │
│  • AZURE_BLOB_CONFIG_SAS_TOKEN=sp=r...                              │
│  • DEBUG=true                                                       │
│  • LOG_LEVEL=debug                                                  │
│  • ... 30+ more variables                                           │
└─────────────────────────────────────────────────────────────────────┘
              ↓
              ↓  ⚠️ ALSO READS FROM SECOND FILE
              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  File: backend/.env  (if exists)                                    │
│                                                                     │
│  ⚠️ PROBLEM: Same variables in TWO places!                          │
│  • environments/.env.development                                    │
│  • backend/.env                                                     │
│                                                                     │
│  Which one wins? Depends on how app loads them!                     │
└─────────────────────────────────────────────────────────────────────┘
              ↓
Step 5: Docker Container Starts
┌─────────────────────────────────────────────────────────────────────┐
│  Backend Docker Container: pandiver-backend                         │
│                                                                     │
│  Environment Variables Available:                                   │
│  • From environments/.env.development (via docker-compose)          │
│  • From docker-compose.yml environment section                      │
│  • Dockerfile ENV variables                                         │
│                                                                     │
│  Volumes Mounted:                                                   │
│  • ./backend/pandiver.db:/app/pandiver.db                           │
│  • ./backend/uploads:/app/uploads                                   │
│  • ./backend/temp:/app/temp                                         │
└─────────────────────────────────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────────────────────────���────────┐
│  Frontend Docker Container: pandiver-frontend                       │
│                                                                     │
│  Environment Variables Available:                                   │
│  • NODE_ENV=development                                             │
│  • NEXT_PUBLIC_API_BASE_URL=http://localhost:8000                   │
│  • NEXT_PUBLIC_API_TIMEOUT=30000                                    │
│                                                                     │
│  Volumes Mounted:                                                   │
│  • ./frontend:/app                                                  │
│  • /app/node_modules                                                │
└─────────────────────────────────────────────────────────────────────┘
              ↓
Step 6: Runtime
┌─────────────────────────────────────────────────────────────────────┐
│  Backend FastAPI Application                                        │
│                                                                     │
│  Code reads: os.getenv('AZURE_DOCUMENT_INTELLIGENCE_KEY')          │
│  Value: <from Docker container environment variables>               │
│         <loaded from environments/.env.development>                 │
│                                                                     │
│  All environment variables come from:                               │
│  .env files → docker-compose.yml → Docker container                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        KEY POINTS                                   │
│                                                                     │
│  ⚠️ Multiple Sources: .env files in different locations             │
│  ⚠️ Manual secret management (no Key Vault)                         │
│  ⚠️ Secrets committed to files (security risk)                      │
│  ⚠️ No automatic deployment                                         │
│  ✅ Fast local development iteration                                │
│  ✅ Works offline                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Side-by-Side Comparison

```
┌────────────────────────────────┬────────────────────────────────────────┐
│      AZURE STAGING             │         LOCAL DOCKER                   │
├────────────────────────────────┼────────────────────────────────────────┤
│ SECRET SOURCE                  │ SECRET SOURCE                          │
│ • Azure Key Vault              │ • .env files (multiple locations)      │
│   (single source of truth)     │   - environments/.env.development      │
│                                │   - backend/.env (redundant)           │
├────────────────────────────────┼────────────────────────────────────────┤
│ DEPLOYMENT TRIGGER             │ DEPLOYMENT TRIGGER                     │
│ • PR merged to 'staging'       │ • Manual: ./start_pandiver_docker.sh   │
│ • Automatic via GitHub Actions │ • No automation                        │
├────────────────────────────────┼────────────────────────────────────────┤
│ IMAGE BUILD                    │ IMAGE BUILD                            │
│ • Azure Container Registry     │ • Local Docker build                   │
│ • Platform: linux/amd64        │ • Platform: host architecture          │
│ • Cached in ACR                │ • Cached locally                       │
├────────────────────────────────┼────────────────────────────────────────┤
│ ENVIRONMENT VARIABLES          │ ENVIRONMENT VARIABLES                  │
│ • Set by GitHub Actions        │ • Loaded from .env files               │
│ • Fetched from Key Vault       │ • Via docker-compose.yml               │
│ • Only required vars           │ • Required + optional + debug          │
│ • ~13 variables                │ • ~40+ variables                       │
├────────────────────────────────┼────────────────────────────────────────┤
│ RUNTIME PLATFORM               │ RUNTIME PLATFORM                       │
│ • Azure Container Apps         │ • Docker Compose                       │
│ • Managed scaling              │ • Manual start/stop                    │
│ • Health checks automatic      │ • Health checks in compose             │
├────────────────────────────────┼────────────────────────────────────────┤
│ DATABASE                       │ DATABASE                               │
│ • Azure PostgreSQL             │ • Local PostgreSQL (not in compose)    │
│ • Connection from Key Vault    │ • Connection from .env                 │
├────────────────────────────────┼────────────────────────────────────────┤
│ COSTS                          │ COSTS                                  │
│ • Azure Container Apps         │ • Free (local compute)                 │
│ • Azure PostgreSQL             │ • Uses same Azure services for         │
│ • ~$X/month when running       │   Doc Intelligence, Translator, Blob   │
│ • $0 when scaled to 0          │                                        │
├────────────────────────────────┼────────────────────────────────────────┤
│ MONITORING                     │ MONITORING                             │
│ • Email notifications          │ • Console logs only                    │
│ • GitHub Actions logs          │ • Docker logs                          │
│ • Azure Portal metrics         │ • No metrics                           │
└────────────────────────────────��────────────────────────────────────────┘
```

---

## The Key Problem: Variable Name Mismatches

### Issue 1: Document Intelligence Variables
```
Azure Staging Uses:
  AZURE_DOCUMENT_INTELLIGENCE_KEY        ✅ Works
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT   ✅ Works

Local Docker Had:
  AZURE_DOC_INTELLIGENCE_KEY             ❌ Wrong name (now fixed)
  AZURE_DOC_INTELLIGENCE_ENDPOINT        ❌ Wrong name (now fixed)

Code Expects:
  os.getenv('AZURE_DOCUMENT_INTELLIGENCE_KEY')
  os.getenv('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')

Solution Applied:
  ✅ Added both names to .env files for compatibility
```

### Issue 2: Missing Required Variables
```
Azure Staging Has:
  ENVIRONMENT=staging                    ✅ Set by workflow
  ALLOWED_ORIGINS=[...]                  ✅ Set by workflow
  API_BASE_URL=https://...               ✅ Set by workflow

Local Docker:
  ENVIRONMENT=development                ✅ In .env
  ALLOWED_ORIGINS=[...]                  ⚠️ Hardcoded in docker-compose
  API_BASE_URL=...                       ❌ Missing (should add)
```

---

## Root Cause Summary

| Problem | Azure Staging | Local Docker | Impact |
|---------|--------------|--------------|--------|
| **Variable names** | Uses DOCUMENT (with UMENT) | Used DOC (without UMENT) | ❌ Local broke |
| **Source of truth** | Azure Key Vault | .env files | ⚠️ Drift over time |
| **Number of places** | 1 (Key Vault) | 2 (backend/.env + environments/.env.development) | ⚠️ Confusion |
| **Validation** | GitHub Actions validates | No validation | ⚠️ Silent failures |
| **Updates** | Update Key Vault → auto deploy | Update .env → manual restart | ⚠️ Maintenance |

---

## Recommended Fix

### Short Term (Already Done) ✅
- Added `AZURE_DOCUMENT_INTELLIGENCE_*` to local .env files
- Local Docker now works

### Long Term (Proposed)
1. **Consolidate .env files**
   - Remove `backend/.env` (redundant)
   - Use only `environments/.env.development`

2. **Match variable names exactly**
   - Local Docker should use same variable names as Azure
   - Remove duplicates

3. **Add validation script**
   - Check all required variables present
   - Warn about missing variables

4. **Document variable list**
   - Single source of truth for variable names
   - Both Azure and Local refer to this list

---

## Questions

1. **Do you want to keep both .env files or consolidate?**
   - Keep: `backend/.env` + `environments/.env.development`
   - Consolidate: Only `environments/.env.development`

2. **Should we add a validation script?**
   - Script to check if all required variables are set
   - Run before starting Docker

3. **Do you want local Docker to be exactly like Azure?**
   - Same variable names only (different values)
   - Same variable names + same number of variables (remove extras)

Let me know your preference and I'll implement the solution!
