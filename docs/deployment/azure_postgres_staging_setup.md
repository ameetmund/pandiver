# Azure PostgreSQL Staging Setup Guide

Complete guide for setting up Pandiver staging environment with Azure PostgreSQL Flexible Server.

## Overview

This setup creates a complete, isolated staging environment with:
- **PostgreSQL Flexible Server** (B1ms tier - cost-effective for staging)
- **Azure Container Registry** (for Docker images)
- **Key Vault** (for secrets management)
- **Container Apps Environment** (for hosting)
- **Log Analytics** (for monitoring)

All resources are in a dedicated `pandiver-staging-rg` resource group, completely separate from production.

## Prerequisites

1. **Azure CLI installed**
   ```bash
   az --version
   ```
   Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

2. **Azure Subscription** with appropriate permissions

3. **PostgreSQL client (optional)** for testing
   ```bash
   # macOS
   brew install postgresql@15

   # Ubuntu/Debian
   sudo apt-get install postgresql-client-15
   ```

## Quick Start

### Step 1: Run the Setup Script

```bash
./setup-azure-postgres-staging.sh
```

The script will:
1. ✅ Login to Azure
2. ✅ Register required providers
3. ✅ Create staging resource group
4. ✅ Create Azure Container Registry
5. ✅ Create Log Analytics workspace
6. ✅ Create Container Apps Environment
7. ✅ Create PostgreSQL Flexible Server (B1ms)
8. ✅ Create database `pandiver_staging_db`
9. ✅ Configure firewall rules
10. ✅ Create Key Vault
11. ✅ Store secrets (DATABASE_URL, SECRET_KEY, etc.)
12. ✅ Optionally create service principal for CI/CD

### Step 2: Save Important Information

The script outputs critical information at the end. **Save these details**:

- PostgreSQL connection string
- Key Vault name
- ACR name
- Resource group name

## Configuration Details

### PostgreSQL Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **Server Name** | `pandiver-staging` | Globally unique |
| **Database** | `pandiver_staging_db` | Staging database |
| **Admin User** | `pandiver` | Database admin |
| **Version** | 15 | Latest stable |
| **Tier** | Burstable | Cost-effective |
| **SKU** | Standard_B1ms | 1 vCore, 2GB RAM |
| **Storage** | 32 GB | SSD storage |
| **Backup Retention** | 7 days | Point-in-time restore |
| **High Availability** | Disabled | Not needed for staging |
| **SSL Mode** | Required | Secure connections |

### Resource Naming Convention

| Resource | Name Pattern | Example |
|----------|--------------|---------|
| Resource Group | `pandiver-staging-rg` | Fixed |
| PostgreSQL Server | `pandiver-staging` | Fixed |
| Database | `pandiver_staging_db` | Fixed |
| ACR | `pandiverstaging{suffix}` | `pandiverstaging123456` |
| Key Vault | `kv-pandiver-staging-{suffix}` | `kv-pandiver-staging-12345` |
| Container Apps Env | `pandiver-staging-env` | Fixed |
| Log Analytics | `pandiver-staging-logs` | Fixed |

## Post-Setup Steps

### 1. Test Database Connection

```bash
# Get connection string from Key Vault
az keyvault secret show \
  --vault-name <your-key-vault-name> \
  --name staging-database-url \
  --query value -o tsv

# Test connection
psql "<connection-string>"
```

### 2. Run Database Migrations

#### Option A: Using Alembic (if you have migrations)
```bash
cd backend
export DATABASE_URL="<staging-connection-string>"
alembic upgrade head
```

#### Option B: Copy Data from Development
```bash
# First, ensure your local PostgreSQL has all data
./start_pandiver_docker.sh

# Get staging DATABASE_URL from Key Vault
STAGING_DB_URL=$(az keyvault secret show \
  --vault-name <your-key-vault-name> \
  --name staging-database-url \
  --query value -o tsv)

# Update migration script to use staging URL
python3 scripts/migrate_sqlite_to_postgres.py --target-db "$STAGING_DB_URL"
```

### 3. Build and Push Docker Images

```bash
# Login to ACR
ACR_NAME="<your-acr-name>"
az acr login --name $ACR_NAME

# Build backend
docker build \
  -f backend/Dockerfile.dev \
  -t $ACR_NAME.azurecr.io/pandiver-backend:staging \
  ./backend

# Push backend
docker push $ACR_NAME.azurecr.io/pandiver-backend:staging

# Build frontend
docker build \
  -f frontend/Dockerfile.dev \
  -t $ACR_NAME.azurecr.io/pandiver-frontend:staging \
  ./frontend

# Push frontend
docker push $ACR_NAME.azurecr.io/pandiver-frontend:staging
```

### 4. Deploy Container Apps

Create Container Apps that use the images from ACR:

```bash
# Get ACR credentials
ACR_PASSWORD=$(az acr credential show \
  --name $ACR_NAME \
  --query "passwords[0].value" -o tsv)

# Deploy backend
az containerapp create \
  --name pandiver-backend-staging \
  --resource-group pandiver-staging-rg \
  --environment pandiver-staging-env \
  --image $ACR_NAME.azurecr.io/pandiver-backend:staging \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$ACR_PASSWORD" \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 2 \
  --secrets database-url=<from-keyvault> secret-key=<from-keyvault> \
  --env-vars DATABASE_URL=secretref:database-url SECRET_KEY=secretref:secret-key

# Deploy frontend
az containerapp create \
  --name pandiver-frontend-staging \
  --resource-group pandiver-staging-rg \
  --environment pandiver-staging-env \
  --image $ACR_NAME.azurecr.io/pandiver-frontend:staging \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password "$ACR_PASSWORD" \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 2 \
  --env-vars NEXT_PUBLIC_API_URL=<backend-url>
```

## Managing Secrets

### View Secrets in Key Vault

```bash
# List all secrets
az keyvault secret list --vault-name <key-vault-name> -o table

# Get specific secret
az keyvault secret show \
  --vault-name <key-vault-name> \
  --name staging-database-url \
  --query value -o tsv
```

### Add New Secrets

```bash
# Add Azure service keys
az keyvault secret set \
  --vault-name <key-vault-name> \
  --name azure-translator-key \
  --value "<your-translator-key>"

az keyvault secret set \
  --vault-name <key-vault-name> \
  --name azure-doc-intelligence-key \
  --value "<your-doc-intelligence-key>"
```

### Update Secrets

```bash
# Update DATABASE_URL if password changes
az keyvault secret set \
  --vault-name <key-vault-name> \
  --name staging-database-url \
  --value "postgresql://pandiver:newpassword@pandiver-staging.postgres.database.azure.com:5432/pandiver_staging_db?sslmode=require"
```

## Database Management

### Connect to PostgreSQL

```bash
# Using psql
psql "host=pandiver-staging.postgres.database.azure.com port=5432 dbname=pandiver_staging_db user=pandiver password=<your-password> sslmode=require"

# Or using connection string
psql "<full-connection-string>"
```

### Backup Database

```bash
# Manual backup
pg_dump "host=pandiver-staging.postgres.database.azure.com port=5432 dbname=pandiver_staging_db user=pandiver password=<password> sslmode=require" > staging_backup_$(date +%Y%m%d).sql

# Automated backups
# Azure automatically backs up every day for 7 days (configured in setup)
```

### Restore from Backup

```bash
# Restore from local backup
psql "<connection-string>" < staging_backup_20250110.sql

# Restore from Azure backup (point-in-time)
az postgres flexible-server restore \
  --resource-group pandiver-staging-rg \
  --name pandiver-staging-restored \
  --source-server pandiver-staging \
  --restore-time "2025-01-10T10:00:00Z"
```

### View Database Metrics

```bash
# CPU, Memory, Connections
az postgres flexible-server show \
  --resource-group pandiver-staging-rg \
  --name pandiver-staging

# Query performance
# Use Azure Portal > PostgreSQL > Query Performance Insight
```

## Firewall Rules

The setup script creates two firewall rules:

1. **AllowAzureServices** (0.0.0.0 - 0.0.0.0)
   - Allows Azure Container Apps to connect

2. **AllowAllIPs** (0.0.0.0 - 255.255.255.255)
   - Allows debugging from any IP
   - ⚠️ **Remove this for production!**

### Manage Firewall Rules

```bash
# List rules
az postgres flexible-server firewall-rule list \
  --resource-group pandiver-staging-rg \
  --name pandiver-staging -o table

# Add specific IP
az postgres flexible-server firewall-rule create \
  --resource-group pandiver-staging-rg \
  --name pandiver-staging \
  --rule-name MyOfficeIP \
  --start-ip-address 203.0.113.10 \
  --end-ip-address 203.0.113.10

# Remove rule
az postgres flexible-server firewall-rule delete \
  --resource-group pandiver-staging-rg \
  --name pandiver-staging \
  --rule-name AllowAllIPs
```

## Cost Estimation

### Monthly Costs (Approximate in USD)

| Resource | Tier/SKU | Estimated Cost |
|----------|----------|----------------|
| PostgreSQL B1ms | 1 vCore, 2GB RAM, 32GB storage | ~$15-20/month |
| Container Apps | 2 apps × 1 instance each | ~$20-30/month |
| Container Registry | Basic | ~$5/month |
| Log Analytics | Basic | ~$2-5/month |
| Key Vault | Standard | ~$1/month |
| **Total** | | **~$45-60/month** |

### Cost Optimization Tips

1. **Stop resources when not in use**
   ```bash
   # Stop PostgreSQL
   az postgres flexible-server stop \
     --resource-group pandiver-staging-rg \
     --name pandiver-staging

   # Start when needed
   az postgres flexible-server start \
     --resource-group pandiver-staging-rg \
     --name pandiver-staging
   ```

2. **Scale down Container Apps to 0 replicas** when not testing

3. **Delete entire resource group** when staging environment is not needed
   ```bash
   az group delete --name pandiver-staging-rg --yes
   ```

## Monitoring and Troubleshooting

### View Logs

```bash
# PostgreSQL logs
az postgres flexible-server server-logs list \
  --resource-group pandiver-staging-rg \
  --name pandiver-staging

# Container Apps logs
az containerapp logs show \
  --name pandiver-backend-staging \
  --resource-group pandiver-staging-rg \
  --follow
```

### Common Issues

#### 1. Cannot connect to PostgreSQL

**Problem**: Connection timeout or refused

**Solutions**:
- Check firewall rules include your IP
- Verify server is running: `az postgres flexible-server show ...`
- Check SSL mode is set to `require` or `prefer`
- Wait 5-10 minutes after server creation

#### 2. Authentication failed

**Problem**: Password authentication failed

**Solutions**:
- Verify username is `pandiver@pandiver-staging` (full format)
- Or use short format `pandiver` with newer psql clients
- Check password is correct
- Verify database name is `pandiver_staging_db`

#### 3. SSL connection error

**Problem**: SSL required but not configured

**Solution**: Always use `?sslmode=require` in connection string

#### 4. Out of connections

**Problem**: Max connections reached

**Solutions**:
- Check for connection leaks in application
- Scale up to higher tier if needed
- Configure connection pooling

## Security Best Practices

1. ✅ **Use Key Vault for all secrets** - Never hardcode credentials
2. ✅ **Enable SSL/TLS** - Always use `sslmode=require`
3. ✅ **Restrict firewall rules** - Remove AllowAllIPs for production
4. ✅ **Use managed identities** - For Container Apps to Key Vault access
5. ✅ **Regular backups** - Test restore process regularly
6. ✅ **Monitor access logs** - Use Azure Monitor
7. ✅ **Rotate passwords** - Change admin password periodically
8. ✅ **Use separate resource groups** - Staging vs Production

## Cleanup

### Delete Entire Staging Environment

```bash
# This deletes EVERYTHING in the staging resource group
az group delete --name pandiver-staging-rg --yes --no-wait
```

### Delete Only Database (keep other resources)

```bash
az postgres flexible-server delete \
  --resource-group pandiver-staging-rg \
  --name pandiver-staging \
  --yes
```

## Next Steps

1. ✅ Set up CI/CD pipeline with GitHub Actions
2. ✅ Configure monitoring alerts
3. ✅ Set up automated database backups to separate storage
4. ✅ Create production environment with similar script
5. ✅ Document deployment procedures

## Related Documentation

- [PostgreSQL Local Access Guide](../setup/POSTGRESQL_ACCESS_GUIDE.md)
- [Azure Container Apps Deployment](azure_container_apps_deployment.md)
- [Production Setup](PRODUCTION_SETUP.md)

## Support

For issues or questions:
- Azure PostgreSQL: https://docs.microsoft.com/azure/postgresql/
- Azure Container Apps: https://docs.microsoft.com/azure/container-apps/
- GitHub Issues: https://github.com/ameetmund/pandiver/issues
