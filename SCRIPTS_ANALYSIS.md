# Scripts Analysis & Recommendations

Based on the CI/CD pipeline setup, here's an analysis of all deployment scripts and their relevance.

## Summary

| Script | Status | Purpose | Recommendation |
|--------|--------|---------|----------------|
| `deploy-staging-azure.sh` | ⚠️ **Partially Obsolete** | Manual staging deployment | **KEEP** for emergency/manual deployments only |
| `setup-azure-container-apps.sh` | ✅ **Keep** | One-time Azure infrastructure setup | **KEEP** - needed for initial setup |
| `setup-azure-postgres-staging.sh` | ✅ **Keep** | One-time PostgreSQL setup | **KEEP** - needed for database setup |
| `start_pandiver_docker.sh` | ✅ **Keep** | Start local Docker development | **KEEP** - for local development |
| `start_pandiver_local.sh` | ✅ **Keep** | Start local non-Docker development | **KEEP** - for local development |
| `start_staging_azure.sh` | ✅ **Keep** | Start/scale up staging services | **KEEP** - useful for cost management |
| `stop_pandiver_docker.sh` | ✅ **Keep** | Stop local Docker services | **KEEP** - for local development |
| `stop_pandiver_local.sh` | ✅ **Keep** | Stop local services | **KEEP** - for local development |
| `stop_staging_azure.sh` | ✅ **Keep** | Stop/scale down staging services | **KEEP** - useful for cost management |

---

## Detailed Analysis

### 1. ⚠️ `deploy-staging-azure.sh` - Partially Obsolete

**Current Purpose:** Manual deployment to Azure staging

**With CI/CD:**
- GitHub Actions now handles all staging deployments automatically
- Workflow builds images in Azure Container Registry (ACR)
- Workflow deploys to Azure Container Apps
- Includes health checks and notifications

**Recommendation:** **KEEP but mark as "Emergency/Manual Use Only"**

**Why Keep:**
- Useful for emergency deployments when CI/CD is down
- Useful for testing local changes before committing
- Useful for hotfixes that bypass PR process

**Updates Needed:**
1. Add warning banner at the top
2. Update to fetch secrets from Key Vault (like workflow does)
3. Ensure it matches the workflow's deployment logic

---

### 2. ✅ `setup-azure-container-apps.sh` - Keep As-Is

**Purpose:** One-time setup of Azure infrastructure

**Why Keep:**
- Needed for initial Azure infrastructure creation
- Creates Container Apps Environment
- Creates resource groups
- Configures networking

**Recommendation:** **KEEP** - No changes needed

**When to Use:**
- Initial project setup
- Setting up new environments (future production setup)
- Disaster recovery

---

### 3. ✅ `setup-azure-postgres-staging.sh` - Keep As-Is

**Purpose:** One-time PostgreSQL database setup

**Why Keep:**
- Needed for initial database creation
- Configures firewall rules
- Sets up database users and permissions

**Recommendation:** **KEEP** - No changes needed

**When to Use:**
- Initial project setup
- Database migration/upgrade
- Setting up new environments

---

### 4. ✅ `start_pandiver_docker.sh` - Keep As-Is

**Purpose:** Start local Docker development environment

**Why Keep:**
- Used for local development and testing
- Independent from CI/CD
- Allows testing before pushing to Git

**Recommendation:** **KEEP** - No changes needed

**When to Use:**
- Local development
- Testing changes before committing
- Debugging issues locally

---

### 5. ✅ `start_pandiver_local.sh` - Keep As-Is

**Purpose:** Start local non-Docker development (direct Python/Node)

**Why Keep:**
- Alternative to Docker for faster iteration
- Useful for debugging
- Independent from CI/CD

**Recommendation:** **KEEP** - No changes needed

**When to Use:**
- Fast local development iterations
- Debugging Python/Node code directly
- When Docker overhead is not needed

---

### 6. ✅ `start_staging_azure.sh` - Keep and Improve

**Purpose:** Start/scale up Azure staging services

**Why Keep:**
- Cost savings: scale down when not in use
- CI/CD doesn't handle service scaling
- Quick way to start services for testing

**Current Implementation:** ✅ Good

**Updates Recommended:**
- ✅ Already scales MinReplicas from 0 to 1
- ✅ Already checks service status
- No changes needed

**When to Use:**
- Before testing staging after PR merge
- After running `stop_staging_azure.sh` to save costs
- When staging services are scaled down

---

### 7. ✅ `stop_pandiver_docker.sh` - Keep As-Is

**Purpose:** Stop local Docker services

**Why Keep:**
- Cleans up local Docker containers
- Frees system resources
- Independent from CI/CD

**Recommendation:** **KEEP** - No changes needed

**When to Use:**
- After local development session
- To free up system resources
- Before switching projects

---

### 8. ✅ `stop_pandiver_local.sh` - Keep As-Is

**Purpose:** Stop local non-Docker services

**Why Keep:**
- Stops Python/Node processes
- Frees system resources
- Independent from CI/CD

**Recommendation:** **KEEP** - No changes needed

**When to Use:**
- After local development session
- To free up system resources

---

### 9. ✅ `stop_staging_azure.sh` - Keep and Improve

**Purpose:** Stop/scale down Azure staging services to save costs

**Why Keep:**
- **Important for cost savings!**
- Scales MinReplicas to 0 when not in use
- CI/CD doesn't handle service stopping

**Current Implementation:** ✅ Good

**Updates Recommended:**
- ✅ Already scales MinReplicas from 1 to 0
- ✅ Already checks service status
- No changes needed

**When to Use:**
- After testing session to save Azure costs
- End of day if staging not needed overnight
- During weekends/holidays

---

## Recommended Script Updates

### Update `deploy-staging-azure.sh` Header

```bash
#!/bin/bash

# ⚠️  WARNING: Manual Deployment Script ⚠️
#
# This script is for EMERGENCY/MANUAL use only!
#
# Normal deployments should use GitHub Actions CI/CD:
#   1. Push to 'development' branch → runs CI checks
#   2. Create PR to 'staging' → deploys to staging automatically
#   3. Create PR to 'main' → deploys to production automatically
#
# Use this script only for:
#   - Emergency hotfixes
#   - Testing local changes before commit
#   - When GitHub Actions is unavailable
#
# This script should match the logic in .github/workflows/staging-deploy.yml

set -e
...
```

### Add Check to `deploy-staging-azure.sh`

Add this after line 50:

```bash
# Warn if GitHub Actions exists and is active
if [ -f ".github/workflows/staging-deploy.yml" ]; then
    print_warning "GitHub Actions CI/CD pipeline exists!"
    print_warning "Consider using: git push origin development → create PR to staging"
    print_warning "Manual deployment bypasses CI checks and notifications."
    echo ""
    read -p "Are you sure you want to deploy manually? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Manual deployment cancelled"
        exit 1
    fi
fi
```

---

## Workflow Chart

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Workflow                     │
└─────────────────────────────────────────────────────────────┘

Local Development:
  start_pandiver_local.sh  ─────┐
  start_pandiver_docker.sh ─────┼─→ Local Testing
  stop_pandiver_local.sh   ─────┤
  stop_pandiver_docker.sh  ─────┘

Push to GitHub:
  ./push-to-development.sh "commit message"
       ↓
  GitHub Actions: Development CI
   • Linting
   • Testing
   • Code validation
       ↓
  Create PR: development → staging
       ↓
  GitHub Actions: Staging Deploy
   • Build images in ACR
   • Deploy to Azure Container Apps
   • Health checks
   • Email notification
       ↓
  Test on Staging:
    start_staging_azure.sh  ────→ Scale up services
    (manual testing)
    stop_staging_azure.sh   ────→ Scale down to save costs
       ↓
  Create PR: staging → main
       ↓
  GitHub Actions: Production Deploy
   • Promote images (no rebuild)
   • Deploy to production
   • Health checks
   • Email notification

Emergency Only:
  deploy-staging-azure.sh ────→ Manual deployment (bypass CI/CD)
```

---

## Cost Optimization Tip

**Important:** Use `stop_staging_azure.sh` when staging is not in use!

- Staging services cost money even when idle
- `stop_staging_azure.sh` scales MinReplicas to 0 (zero cost when stopped)
- `start_staging_azure.sh` scales back up when needed

**Recommended practice:**
```bash
# End of day
./stop_staging_azure.sh

# Next morning or when testing needed
./start_staging_azure.sh
```

This can save **60-80% on staging costs** by only running services when actively testing.

---

## Summary of Actions

### ✅ Keep All Scripts
All 9 scripts serve valid purposes and should be kept.

### ⚠️ Update 1 Script
- `deploy-staging-azure.sh` → Add warning banner and CI/CD bypass confirmation

### ✅ No Changes Needed for 8 Scripts
- `setup-azure-container-apps.sh`
- `setup-azure-postgres-staging.sh`
- `start_pandiver_docker.sh`
- `start_pandiver_local.sh`
- `start_staging_azure.sh`
- `stop_pandiver_docker.sh`
- `stop_pandiver_local.sh`
- `stop_staging_azure.sh`

### 📝 New Scripts Created
- ✅ `sync-secrets-to-keyvault.sh` → Consolidated secret sync script
- ✅ `push-to-development.sh` → Helper for pushing to development branch
