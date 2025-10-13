# GitHub Secrets Setup for CI/CD

This document lists all GitHub secrets required for the automated CI/CD pipeline.

## How to Add Secrets to GitHub

1. Go to your repository: https://github.com/ameetmund/pandiver
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret below

## Required Secrets

### 1. Staging Environment Secrets

These are already configured (verify they exist):

| Secret Name | Description | How to Get Value |
|------------|-------------|------------------|
| `AZURE_CREDENTIALS_STAGING` | Azure service principal credentials | See "Getting Azure Credentials" below |
| `ACR_NAME_STAGING` | Azure Container Registry name | `pandiverstaging88118` |
| `RESOURCE_GROUP_STAGING` | Azure resource group | `pandiver-staging-rg` |
| `KEY_VAULT_NAME_STAGING` | Azure Key Vault name | `kv-pandiver-staging-8766` |
| `CONTAINER_APPS_ENVIRONMENT_STAGING` | Container Apps Environment | `pandiver-staging-env` |
| `POSTGRES_SERVER_STAGING` | PostgreSQL server name | `pandiver-staging` |
| `POSTGRES_DB_STAGING` | PostgreSQL database name | `pandiver_staging_db` |
| `AZURE_LOCATION_STAGING` | Azure region | `centralindia` |

### 2. Production Environment Secrets (Add Later)

Add these after creating production environment:

| Secret Name | Description | Value |
|------------|-------------|-------|
| `AZURE_CREDENTIALS_PRODUCTION` | Azure service principal for production | TBD - Create when setting up production |
| `ACR_NAME_PRODUCTION` | Production ACR name | TBD |
| `RESOURCE_GROUP_PRODUCTION` | Production resource group | TBD |
| `KEY_VAULT_NAME_PRODUCTION` | Production Key Vault | TBD |
| `CONTAINER_APPS_ENVIRONMENT_PRODUCTION` | Production Container Apps Env | TBD |
| `POSTGRES_SERVER_PRODUCTION` | Production PostgreSQL server | TBD |
| `POSTGRES_DB_PRODUCTION` | Production database | TBD |
| `AZURE_LOCATION_PRODUCTION` | Production Azure region | TBD |

### 3. Email Notification Secret

| Secret Name | Description | Value |
|------------|-------------|-------|
| `DEPLOYMENT_EMAIL` | Email for deployment notifications | `pandiverpdf@gmail.com` |

### 4. Azure Blob Storage SAS Tokens (IMPORTANT)

**These are stored in Azure Key Vault, not GitHub Secrets.**

The following secrets must exist in Azure Key Vault:

| Key Vault Secret Name | Description | Environment Variable |
|----------------------|-------------|---------------------|
| `azure-blob-src-sas-token` | SAS token for 'src' container | `AZURE_BLOB_SRC_SAS_TOKEN` |
| `azure-blob-out-sas-token` | SAS token for 'out' container | `AZURE_BLOB_OUT_SAS_TOKEN` |
| `azure-blob-config-sas-token` | SAS token for 'config' container | `AZURE_BLOB_CONFIG_SAS_TOKEN` |

**To add these to Key Vault:**

```bash
# Get SAS tokens from your local .env file or generate new ones
# Then add them to Key Vault:

az keyvault secret set \
  --vault-name kv-pandiver-staging-8766 \
  --name azure-blob-src-sas-token \
  --value "YOUR_SRC_SAS_TOKEN"

az keyvault secret set \
  --vault-name kv-pandiver-staging-8766 \
  --name azure-blob-out-sas-token \
  --value "YOUR_OUT_SAS_TOKEN"

az keyvault secret set \
  --vault-name kv-pandiver-staging-8766 \
  --name azure-blob-config-sas-token \
  --value "YOUR_CONFIG_SAS_TOKEN"
```

### 5. Optional: Slack/Teams Notifications

| Secret Name | Description | Value |
|------------|-------------|-------|
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications (optional) | TBD |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams webhook (optional) | TBD |

## Getting Azure Credentials

### For Staging (Already Done)

You should already have `AZURE_CREDENTIALS_STAGING`. Verify it exists in GitHub secrets.

If missing, recreate it:

```bash
# Login to Azure
az login

# Create service principal for staging
az ad sp create-for-rbac \
  --name "pandiver-github-staging" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/pandiver-staging-rg \
  --sdk-auth

# Copy the entire JSON output and add as AZURE_CREDENTIALS_STAGING secret
```

The output should look like:
```json
{
  "clientId": "xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
  "clientSecret": "xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
  "subscriptionId": "xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
  "tenantId": "xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

### For Production (Later)

When you create production environment, run:

```bash
az ad sp create-for-rbac \
  --name "pandiver-github-production" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/pandiver-production-rg \
  --sdk-auth
```

## Verifying Secrets

Check if secrets are properly configured:

```bash
# This will be in the GitHub Actions workflow
- name: Verify secrets
  run: |
    echo "Checking staging secrets..."
    test -n "${{ secrets.AZURE_CREDENTIALS_STAGING }}" || echo "Missing AZURE_CREDENTIALS_STAGING"
    test -n "${{ secrets.ACR_NAME_STAGING }}" || echo "Missing ACR_NAME_STAGING"
    test -n "${{ secrets.DEPLOYMENT_EMAIL }}" || echo "Missing DEPLOYMENT_EMAIL"
```

## Current Secret Values (Reference)

Based on your current setup:

### Staging Environment
- **Resource Group**: `pandiver-staging-rg`
- **Location**: `centralindia`
- **ACR**: `pandiverstaging88118`
- **Key Vault**: `kv-pandiver-staging-8766`
- **Container Apps Env**: `pandiver-staging-env`
- **PostgreSQL Server**: `pandiver-staging`
- **PostgreSQL Database**: `pandiver_staging_db`

### Email
- **Deployment Email**: `pandiverpdf@gmail.com`

## Security Best Practices

1. ✅ **Never commit secrets to code** - Always use GitHub Secrets
2. ✅ **Use separate service principals** - Different credentials for staging/production
3. ✅ **Rotate credentials regularly** - Update service principal secrets every 90 days
4. ✅ **Limit permissions** - Service principals should have minimum required access
5. ✅ **Monitor secret usage** - Check GitHub Actions logs for unauthorized access

## Troubleshooting

### Secret not found error
```
Error: Secret AZURE_CREDENTIALS_STAGING not found
```
**Solution**: Ensure secret name matches exactly (case-sensitive)

### Invalid Azure credentials
```
Error: AADSTS700016: Application not found
```
**Solution**: Service principal may have been deleted. Recreate it.

### Permission denied
```
Error: The client does not have authorization to perform action
```
**Solution**: Service principal needs 'Contributor' role on resource group

## Next Steps

1. ✅ Verify all staging secrets exist in GitHub
2. ⏳ Create production environment (later)
3. ⏳ Add production secrets to GitHub (later)
4. ✅ Add `DEPLOYMENT_EMAIL` secret now
5. ⏳ Optional: Add Slack/Teams webhook for notifications

## Related Documentation

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Azure Service Principals](https://docs.microsoft.com/en-us/cli/azure/create-an-azure-service-principal-azure-cli)
- [CI/CD Pipeline Documentation](CICD_PIPELINE.md)
