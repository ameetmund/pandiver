# CI/CD Pipeline Documentation

Complete guide for Pandiver's automated CI/CD pipeline with 3-branch strategy and image promotion.

## Overview

Pandiver uses a **GitOps-based CI/CD pipeline** with three branches and automated deployments to Azure Container Apps.

### Branch Strategy

```
development → staging → main (production)
    ↓           ↓            ↓
  CI Only   Build & Deploy  Promote & Deploy
```

| Branch | Purpose | Deployment | When |
|--------|---------|------------|------|
| **development** | Feature development | None (CI only) | On every push |
| **staging** | Pre-production testing | Azure Staging | On PR merge |
| **main** | Production | Azure Production | On PR merge |

## Workflows

### 1. Development CI (`development-ci.yml`)

**Trigger**: Push to `development` branch or PR to `development`

**Purpose**: Validate code quality before allowing PR to staging

**Steps**:
1. ✅ Lint Python code (flake8, black)
2. ✅ Lint TypeScript/JavaScript (eslint)
3. ✅ Run unit tests (if present)
4. ✅ Build Docker images (validation only)

**Time**: ~5-10 minutes

**Note**: All checks use `continue-on-error: true` - failures warn but don't block

### 2. Staging Deployment (`staging-deploy.yml`)

**Trigger**: Push to `staging` branch (after PR merge from development)

**Purpose**: Build images and deploy to Azure Staging environment

**Steps**:
1. 🔐 Login to Azure (staging credentials)
2. 🐳 Build backend image in ACR (linux/amd64) - Tag: `staging-{SHA}`
3. 🐳 Build frontend image in ACR (linux/amd64) - Tag: `staging-{SHA}`
4. 🔑 Get secrets from Key Vault
5. 🚀 Deploy/update backend container app
6. 🚀 Deploy/update frontend container app
7. 🔧 Configure CORS and API_BASE_URL
8. ✅ Health checks (backend + frontend)
9. 📧 Send email notification

**Time**: ~30 minutes

**Image Tags**: `staging-{commit-sha}`

**Environment**: https://pandiver-backend-staging.wittysea-bbf0e6cb.centralindia.azurecontainerapps.io

### 3. Production Deployment (`production-deploy.yml`)

**Trigger**: Push to `main` branch (after PR merge from staging)

**Purpose**: Promote tested images from staging to production

**Steps**:
1. 🔐 Login to Azure (staging + production)
2. 📦 Pull images from staging ACR
3. 🏷️  Tag images for production - Tag: `production-{SHA}`
4. 📤 Push images to production ACR
5. 🔑 Get secrets from production Key Vault
6. 🚀 Deploy to production Container Apps
7. 🔧 Configure CORS and API_BASE_URL
8. ✅ Health checks (backend + frontend)
9. 🎉 Create GitHub Release
10. 📧 Send email notification

**Time**: ~5-10 minutes (no rebuild!)

**Image Tags**: `production-{commit-sha}`

**Key Advantage**: Images are promoted (not rebuilt) - exact same binaries tested in staging

## Deployment Flow

### Normal Development Workflow

```bash
# 1. Work on features in development branch
git checkout development
git pull origin development
# ... make changes ...
git add .
git commit -m "feat: add new feature"
git push origin development
# ✅ Development CI runs automatically

# 2. Create PR: development → staging
gh pr create --base staging --head development --title "Deploy to staging"
# Get approval, merge PR
# ✅ Staging deployment runs automatically (~30 min)

# 3. Test in staging
# Visit: https://pandiver-frontend-staging.wittysea-bbf0e6cb.centralindia.azurecontainerapps.io

# 4. Create PR: staging → main
gh pr create --base main --head staging --title "Deploy to production"
# Get approval, merge PR
# ✅ Production deployment runs automatically (~5 min)
```

### Hotfix Workflow

```bash
# For urgent production fixes
git checkout main
git checkout -b hotfix/critical-bug
# ... fix bug ...
git commit -m "hotfix: fix critical bug"
git push origin hotfix/critical-bug

# Create PR directly to main (skip staging for emergencies)
gh pr create --base main --head hotfix/critical-bug
```

## Required GitHub Secrets

### Staging Secrets (Already Configured)
- `AZURE_CREDENTIALS_STAGING` - Service principal JSON
- `ACR_NAME_STAGING` - `pandiverstaging88118`
- `RESOURCE_GROUP_STAGING` - `pandiver-staging-rg`
- `KEY_VAULT_NAME_STAGING` - `kv-pandiver-staging-8766`
- `CONTAINER_APPS_ENVIRONMENT_STAGING` - `pandiver-staging-env`
- `POSTGRES_SERVER_STAGING` - `pandiver-staging`
- `POSTGRES_DB_STAGING` - `pandiver_staging_db`
- `AZURE_LOCATION_STAGING` - `centralindia`

### Production Secrets (To Be Added)
- `AZURE_CREDENTIALS_PRODUCTION`
- `ACR_NAME_PRODUCTION`
- `RESOURCE_GROUP_PRODUCTION`
- `KEY_VAULT_NAME_PRODUCTION`
- `CONTAINER_APPS_ENVIRONMENT_PRODUCTION`
- `POSTGRES_SERVER_PRODUCTION`
- `POSTGRES_DB_PRODUCTION`
- `AZURE_LOCATION_PRODUCTION`

### Email Notifications
- `DEPLOYMENT_EMAIL` - `pandiverpdf@gmail.com`
- `GMAIL_APP_PASSWORD` - Gmail app-specific password for sending emails

## Email Notifications

All deployments send email notifications to `DEPLOYMENT_EMAIL`:

**Staging Deployment Email**:
```
Subject: Staging Deployment: success/failure
Body:
  - Image Tag: staging-abc123
  - Commit: abc123...
  - Backend URL: https://...
  - Frontend URL: https://...
  - Workflow link
```

**Production Deployment Email**:
```
Subject: Production Deployment: success/failure
Body:
  - Staging Image: staging-abc123
  - Production Tag: production-abc123
  - Commit: abc123...
  - Backend URL: https://...
  - Frontend URL: https://...
  - Workflow link
```

## Why Image Promotion? (Industry Standard)

### Traditional Approach (Rebuild)
```
Staging: Build → Test → Deploy (30 min)
Production: Build → Test → Deploy (30 min)
Risk: Different build = different bugs
```

### Modern Approach (Promote)
```
Staging: Build → Test → Deploy (30 min)
Production: Promote → Deploy (5 min)
Benefit: Exact same binaries, faster, safer
```

### Benefits of Image Promotion

1. **What You Test Is What You Deploy**
   - Exact same Docker image from staging goes to production
   - Zero risk of build differences

2. **Minimal Downtime**
   - 5 minutes vs 30 minutes deployment
   - Faster rollback if needed

3. **Cost Effective**
   - Build once, use twice
   - Less ACR build time = lower costs

4. **Industry Standard**
   - Used by Netflix, Google, Amazon, Microsoft
   - Best practice for production deployments

## Branch Protection Rules (Recommended)

Configure these in GitHub Settings → Branches:

### `development` branch
- ✅ Require PR reviews: 1 approver
- ✅ Require status checks: Development CI
- ✅ Allow force pushes: No

### `staging` branch
- ✅ Require PR reviews: 1 approver
- ✅ Require status checks: Development CI
- ✅ Allow force pushes: No
- ✅ Restrict pushes: Only from `development`

### `main` branch (production)
- ✅ Require PR reviews: 2 approvers (recommended)
- ✅ Require status checks: Staging deployment success
- ✅ Allow force pushes: No
- ✅ Restrict pushes: Only from `staging`

## Monitoring & Debugging

### View Workflow Runs
```bash
# Open GitHub Actions page
gh workflow view
gh run list
gh run view <run-id>
```

### Check Deployment Logs
```bash
# Backend logs
az containerapp logs show \
  --name pandiver-backend-staging \
  --resource-group pandiver-staging-rg \
  --follow

# Frontend logs
az containerapp logs show \
  --name pandiver-frontend-staging \
  --resource-group pandiver-staging-rg \
  --follow
```

### Manual Deployment Trigger
```bash
# Trigger staging deployment manually
gh workflow run staging-deploy.yml

# Trigger production deployment with specific staging image
gh workflow run production-deploy.yml \
  -f staging_image_tag=staging-abc123
```

## Rollback Procedures

### Quick Rollback (Production)
```bash
# 1. Find previous working image tag
az acr repository show-tags \
  --name <prod-acr-name> \
  --repository pandiver-backend \
  --orderby time_desc

# 2. Manually trigger deployment with old tag
gh workflow run production-deploy.yml \
  -f staging_image_tag=staging-previous-working-sha

# Or use Azure CLI directly
az containerapp update \
  --name pandiver-backend-production \
  --resource-group pandiver-production-rg \
  --image <acr>.azurecr.io/pandiver-backend:production-old-sha
```

### Rollback with Git
```bash
# Revert the merge commit
git revert <merge-commit-sha>
git push origin main
# This triggers new production deployment
```

## Troubleshooting

### Build Fails in Staging
**Problem**: ACR build fails with timeout or errors

**Solutions**:
1. Check ACR logs: `az acr task logs --registry <acr-name>`
2. Verify Dockerfile.dev builds locally
3. Check ACR storage quota
4. Retry workflow manually

### Deployment Fails - Invalid Credentials
**Problem**: `AADSTS700016: Application not found`

**Solutions**:
1. Verify service principal exists
2. Check secret expiration
3. Regenerate `AZURE_CREDENTIALS_*` secret

### Health Check Fails
**Problem**: Container deployed but health check fails

**Solutions**:
1. Check container logs
2. Verify environment variables
3. Check database connectivity
4. Increase health check timeout

### Email Not Received
**Problem**: Deployment succeeds but no email

**Solutions**:
1. Verify `DEPLOYMENT_EMAIL` secret
2. Check `GMAIL_APP_PASSWORD` is valid
3. Check Gmail spam folder
4. Verify Gmail "Less secure app access" settings

## Cost Optimization

### Staging Environment
- **Running**: ~$50-100/month
- **Stopped**: ~$18/month (PostgreSQL + ACR only)

**To save costs**:
```bash
# Stop when not testing
./stop_staging_azure.sh

# Start when needed
./start_staging_azure.sh
```

### Production Environment
- **Running**: ~$150-300/month (depends on traffic)
- Should remain running 24/7

## Security Best Practices

1. ✅ **Never commit secrets** - Always use GitHub Secrets
2. ✅ **Rotate credentials** every 90 days
3. ✅ **Use separate service principals** for staging/production
4. ✅ **Enable branch protection** rules
5. ✅ **Require PR reviews** before merging
6. ✅ **Monitor deployment logs** for suspicious activity
7. ✅ **Use Azure Key Vault** for all application secrets

## Next Steps

1. ✅ Create production Azure environment
2. ✅ Add production GitHub secrets
3. ✅ Test staging deployment
4. ✅ Configure branch protection rules
5. ✅ Set up Slack/Teams notifications (optional)
6. ✅ Configure monitoring alerts

## Related Documentation

- [GitHub Secrets Setup](GITHUB_SECRETS_SETUP.md)
- [Azure PostgreSQL Staging Setup](azure_postgres_staging_setup.md)
- [Deployment Scripts](azure_postgres_staging_setup.md#deployment-scripts)

## Support

For issues or questions:
- GitHub Actions: https://docs.github.com/en/actions
- Azure Container Apps: https://docs.microsoft.com/azure/container-apps/
- Azure ACR: https://docs.microsoft.com/azure/container-registry/
- Project Issues: https://github.com/ameetmund/pandiver/issues
