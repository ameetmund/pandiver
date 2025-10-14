# Complete .env Files Usage Map

## All .env Files in the Project

```
project/
├── backend/.env                        ← REAL VALUES (gitignored)
├── backend/.env.example                ← TEMPLATE ONLY
├── environments/.env.development       ← REAL VALUES (gitignored)
├── environments/.env.staging           ← TEMPLATE with ${VAR} placeholders
├── environments/.env.production        ← TEMPLATE with ${VAR} placeholders
└── frontend/.env.example               ← TEMPLATE ONLY
```

---

## Detailed Analysis for Each File

### 1. `backend/.env` ✅ USED

**Purpose:** Local development environment variables

**Used By:**
- ✅ **Key Vault Sync Script** (`sync-secrets-to-keyvault.sh`)
  - This script reads from `backend/.env`
  - Uploads secrets to Azure Key Vault
  - This is how Azure gets its secrets!

- ✅ **FastAPI Backend** (when running locally without Docker)
  - `backend/app/main.py` has: `load_dotenv()`
  - This loads `.env` from the current directory
  - When you run `./start_pandiver_local.sh`, it uses this file

**NOT Used By:**
- ❌ Docker Compose (doesn't reference this file)
- ❌ Azure Staging (gets values from Key Vault instead)
- ❌ GitHub Actions (uses Key Vault)

**Content:** Full real values (secrets, keys, tokens)

**Git Status:** ✅ Gitignored (secure)

---

### 2. `environments/.env.development` ✅ USED

**Purpose:** Local Docker development environment variables

**Used By:**
- ✅ **Docker Compose**
  - `docker/compose/docker-compose.yml` line 28: `env_file: - ./environments/.env.development`
  - When you run `./start_pandiver_docker.sh`, Docker loads this file
  - All variables become environment variables in the container

**NOT Used By:**
- ❌ Azure Staging (gets values from Key Vault)
- ❌ Local non-Docker Python (uses `backend/.env` instead)
- ❌ Key Vault sync script (uses `backend/.env` instead)

**Content:** Full real values (secrets, keys, tokens)

**Git Status:** ✅ Gitignored (secure)

---

### 3. `environments/.env.staging` ⚠️ NOT REALLY USED (Template Only)

**Purpose:** Template/reference for staging environment variables

**Used By:**
- ⚠️ **Technically:** `scripts/switch-env.sh` references it
  - But this script may not be used in practice

**NOT Used By:**
- ❌ Azure Staging (gets values from Key Vault via GitHub Actions)
- ❌ Docker Compose
- ❌ Key Vault sync

**Content:** Template with placeholders like `${DATABASE_URL}`
- Not real values!
- Uses syntax like: `SECRET_KEY=${SECRET_KEY}`
- This means "use the value from environment, don't hardcode"

**Git Status:** ✅ Committed to git (safe, no real secrets)

**Actual Purpose:**
- Documentation/reference showing what variables staging needs
- Shows structure but not real values
- Real values come from Key Vault in Azure

---

### 4. `environments/.env.production` ⚠️ NOT REALLY USED (Template Only)

**Purpose:** Template/reference for production environment variables

**Used By:**
- ⚠️ **Technically:** `scripts/switch-env.sh` references it
  - But this script may not be used in practice

**NOT Used By:**
- ❌ Azure Production (would get values from Key Vault via GitHub Actions)
- ❌ Docker Compose
- ❌ Key Vault sync

**Content:** Template with placeholders like `${DATABASE_URL}`
- Not real values!
- Same as `.env.staging` but with production settings (e.g., `DEBUG=false`)

**Git Status:** ✅ Committed to git (safe, no real secrets)

---

### 5. `backend/.env.example` 📄 TEMPLATE ONLY

**Purpose:** Template showing what variables are needed

**Used By:**
- ❌ Nothing uses this directly
- Documentation for developers

**Content:** Variable names with example/placeholder values

**Git Status:** ✅ Committed to git (safe)

---

### 6. `frontend/.env.example` 📄 TEMPLATE ONLY

**Purpose:** Template showing frontend environment variables

**Used By:**
- ❌ Nothing uses this directly
- Documentation for developers

**Content:** Variable names with example values

**Git Status:** ✅ Committed to git (safe)

---

## Complete Usage Flow

### Scenario 1: Local Development (Non-Docker)

```
Developer runs: python backend/app/main.py
              ↓
backend/app/main.py: load_dotenv()
              ↓
Loads: backend/.env
              ↓
Application has all environment variables
```

**Uses:** `backend/.env` ✅

---

### Scenario 2: Local Development (Docker)

```
Developer runs: ./start_pandiver_docker.sh
              ↓
Executes: docker-compose -f docker/compose/docker-compose.yml up
              ↓
docker-compose.yml loads: environments/.env.development
              ↓
Docker container has all environment variables
              ↓
FastAPI app: load_dotenv() (finds nothing, uses container env vars)
              ↓
Application has all environment variables
```

**Uses:** `environments/.env.development` ✅

---

### Scenario 3: Sync Secrets to Azure Key Vault

```
Developer runs: ./sync-secrets-to-keyvault.sh
              ↓
Script reads: backend/.env
              ↓
Uploads to: Azure Key Vault (kv-pandiver-staging-8766)
              ↓
Secrets stored in Key Vault:
  • azure-blob-src-sas-token
  • azure-doc-translator-key
  • azure-document-intelligence-key
  • etc.
```

**Uses:** `backend/.env` ✅

---

### Scenario 4: Azure Staging Deployment

```
PR merged to staging branch
              ↓
GitHub Actions: .github/workflows/staging-deploy.yml
              ↓
Step 1: Login to Azure
Step 2: Fetch secrets from Azure Key Vault
  • staging-database-url
  • secret-key
  • azure-doc-translator-key
  • azure-document-intelligence-key
  • etc.
              ↓
Step 3: Deploy to Azure Container Apps
  Set environment variables from Key Vault values
              ↓
Container starts with environment variables
              ↓
FastAPI app: load_dotenv() (finds nothing, uses container env vars)
              ↓
Application has all environment variables
```

**Uses:** None of the .env files! Uses Azure Key Vault ✅

---

## The Problem: Two Sources with Same Variables

### Current Situation (Causing Confusion)

```
backend/.env
  • Has: AZURE_DOCUMENT_INTELLIGENCE_KEY=RjGk7S...
  • Used for: Local non-Docker + Key Vault sync

environments/.env.development
  • Has: AZURE_DOCUMENT_INTELLIGENCE_KEY=RjGk7S...
  • Used for: Local Docker

⚠️ SAME VARIABLE IN TWO PLACES!
```

If you update one and forget the other → things break!

---

## Answers to Your Questions

### Q1: "Which .env is used to push variables to Key Vault?"

**Answer:** `backend/.env`

The script `sync-secrets-to-keyvault.sh` reads from:
```bash
ENV_FILE="backend/.env"
```

This is the **source of truth** for Azure Key Vault secrets.

---

### Q2: "Are environments/.env.* used for development, staging, production?"

**Answer:**

| File | Development | Staging | Production |
|------|------------|---------|------------|
| `environments/.env.development` | ✅ YES (Local Docker) | ❌ NO | ❌ NO |
| `environments/.env.staging` | ❌ NO | ⚠️ Template only | ❌ NO |
| `environments/.env.production` | ❌ NO | ❌ NO | ⚠️ Template only |

**Details:**
- `.env.development` → Used by local Docker (`docker-compose.yml` loads it)
- `.env.staging` → NOT used! Just a template/reference
- `.env.production` → NOT used! Just a template/reference

Azure staging and production get their values from **Key Vault**, not these files.

---

### Q3: "Where is backend/.env used?"

**Answer:** `backend/.env` is used in **2 places**:

1. **Local non-Docker development**
   - When you run Python directly (not in Docker)
   - `python backend/app/main.py` loads this file via `load_dotenv()`

2. **Sync to Azure Key Vault**
   - `./sync-secrets-to-keyvault.sh` reads this file
   - Uploads secrets to Azure Key Vault
   - Azure staging then uses those Key Vault values

---

## Summary Table

| File | Azure Staging | Local Docker | Local Non-Docker | Key Vault Sync |
|------|--------------|--------------|------------------|----------------|
| `backend/.env` | ❌ | ❌ | ✅ YES | ✅ YES (source) |
| `environments/.env.development` | ❌ | ✅ YES | ❌ | ❌ |
| `environments/.env.staging` | ❌ | ❌ | ❌ | ❌ |
| `environments/.env.production` | ❌ | ❌ | ❌ | ❌ |

---

## The Core Problem

### You Have Duplicate Variables in Two Files!

```
backend/.env:
  AZURE_DOCUMENT_INTELLIGENCE_KEY=RjGk7S...
  AZURE_DOC_TRANSLATOR_KEY=FbHKyE...
  AZURE_BLOB_SRC_SAS_TOKEN=sp=rwl...
  ... (all 40+ variables)

environments/.env.development:
  AZURE_DOCUMENT_INTELLIGENCE_KEY=RjGk7S...  ← SAME!
  AZURE_DOC_TRANSLATOR_KEY=FbHKyE...         ← SAME!
  AZURE_BLOB_SRC_SAS_TOKEN=sp=rwl...         ← SAME!
  ... (all 40+ variables)                    ← SAME!
```

**Problem:**
- If you update `backend/.env` and forget `environments/.env.development` → Local Docker breaks
- If you update `environments/.env.development` and forget `backend/.env` → Key Vault sync sends old values

---

## Recommended Fix

### Option A: Single Source of Truth (Recommended)

**Use ONLY `backend/.env` for everything:**

1. Local non-Docker: Uses `backend/.env` ✅ (already works)
2. Local Docker: Change docker-compose to use `backend/.env`
3. Key Vault sync: Uses `backend/.env` ✅ (already works)

**Changes Needed:**
```yaml
# docker/compose/docker-compose.yml
backend:
  env_file:
    - ../../backend/.env  # Changed from ./environments/.env.development
```

**Benefit:** ONE file to maintain!

---

### Option B: Keep Separate (Current, but risky)

Keep both files, but you must remember to update BOTH when making changes.

**Risk:** High chance of drift and breakage

---

## Recommendation

**Consolidate to `backend/.env` as the single source:**

1. ✅ Update docker-compose.yml to use `backend/.env`
2. ✅ Delete `environments/.env.development` (no longer needed)
3. ✅ Keep `environments/.env.staging` and `.env.production` as reference/templates
4. ✅ Update documentation

**Result:**
- ONE file to maintain (`backend/.env`)
- Used by: Local Docker + Local non-Docker + Key Vault sync
- No more duplicate variable confusion!

Would you like me to implement Option A?
