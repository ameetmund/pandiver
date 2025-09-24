# ☁️ Azure Container Apps Deployment Guide

## 🎯 Why Azure Container Apps for SaaS?

Azure Container Apps is the **perfect choice** for SaaS products like Pandiver because it provides:

- ✅ **Serverless scaling** (scale to zero when not used)
- ✅ **Built-in load balancing** and ingress
- ✅ **Microservices architecture** support
- ✅ **Pay-per-use pricing** (cost-effective for SaaS)
- ✅ **Managed infrastructure** (no Kubernetes complexity)
- ✅ **HTTPS/SSL termination** built-in
- ✅ **Blue/green deployments** built-in
- ✅ **Event-driven scaling** with KEDA

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                Azure Container Apps Environment            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │ Frontend App    │    │ Backend App     │               │
│  │ (Next.js)       │    │ (FastAPI)       │               │
│  │ • Auto-scale    │    │ • Auto-scale    │               │
│  │ • HTTPS         │    │ • Internal      │               │
│  │ • CDN Ready     │    │ • API Routes    │               │
│  └─────────────────┘    └─────────────────┘               │
├─────────────────────────────────────────────────────────────┤
│              Built-in Ingress Controller                   │
│              (HTTPS, Load Balancing, Routing)              │
├─────────────────────────────────────────────────────────────┤
│     Azure SQL Database + Azure Key Vault + ACR            │
└─────────────────────────────────────────────────────────────┘

Environments:
┌─────────────┬─────────────┬─────────────┐
│     DEV     │   STAGING   │ PRODUCTION  │
│ (Local)     │(Container   │(Container   │
│             │ Apps)       │ Apps)       │
└─────────────┴─────────────┴─────────────┘
```

## 🛠️ Step-by-Step Implementation

### Prerequisites

1. **Azure CLI** installed
2. **Docker** installed
3. **Azure subscription** with contributor access
4. **Domain name** (optional, can use provided subdomain)

### Step 1: Install Container Apps Extension

```bash
# Install the Container Apps extension
az extension add --name containerapp --upgrade

# Register required providers
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

### Step 2: Create Azure Resources

```bash
# Set variables
RESOURCE_GROUP="rg-pandiver-containerapp"
LOCATION="eastus"
ENVIRONMENT_NAME="pandiver-env"
ACR_NAME="pandiveracr"
KEY_VAULT_NAME="kv-pandiver-shared"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Create Log Analytics workspace for Container Apps
az monitor log-analytics workspace create \
  --resource-group $RESOURCE_GROUP \
  --workspace-name pandiver-logs \
  --location $LOCATION

# Get Log Analytics workspace ID
LOG_ANALYTICS_WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name pandiver-logs \
  --query customerId \
  --output tsv)

LOG_ANALYTICS_WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group $RESOURCE_GROUP \
  --workspace-name pandiver-logs \
  --query primarySharedKey \
  --output tsv)

# Create Container Apps Environment
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --logs-workspace-id $LOG_ANALYTICS_WORKSPACE_ID \
  --logs-workspace-key $LOG_ANALYTICS_WORKSPACE_KEY
```

### Step 3: Create Azure SQL Database

```bash
# Create SQL Server
az sql server create \
  --name pandiver-sql-server \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --admin-user panadmin \
  --admin-password "YourStrongPassword123!"

# Create databases for different environments
az sql db create \
  --resource-group $RESOURCE_GROUP \
  --server pandiver-sql-server \
  --name pandiver-staging-db \
  --service-objective Basic

az sql db create \
  --resource-group $RESOURCE_GROUP \
  --server pandiver-sql-server \
  --name pandiver-production-db \
  --service-objective S2

# Configure firewall (allow Azure services)
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server pandiver-sql-server \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### Step 4: Create Azure Key Vault and Store Secrets

```bash
# Create Key Vault
az keyvault create \
  --name $KEY_VAULT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Store secrets
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "secret-key" --value "your-super-secret-production-key"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "staging-database-url" --value "postgresql://panadmin:YourStrongPassword123!@pandiver-sql-server.database.windows.net:1433/pandiver-staging-db?sslmode=require"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "production-database-url" --value "postgresql://panadmin:YourStrongPassword123!@pandiver-sql-server.database.windows.net:1433/pandiver-production-db?sslmode=require"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-key" --value "your-azure-translator-key"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-region" --value "eastus"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-key" --value "your-doc-intelligence-key"
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-endpoint" --value "your-endpoint"
```

### Step 5: Build and Push Container Images

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build and push backend
docker build -f docker/backend/Dockerfile.prod -t $ACR_NAME.azurecr.io/pandiver-backend:latest ./backend
docker push $ACR_NAME.azurecr.io/pandiver-backend:latest

# Build and push frontend
docker build -f docker/frontend/Dockerfile.prod -t $ACR_NAME.azurecr.io/pandiver-frontend:latest ./frontend
docker push $ACR_NAME.azurecr.io/pandiver-frontend:latest
```

## 🚀 Deployment Configurations

### Staging Environment Deployment

```bash
# Deploy Backend to Container Apps (Staging)
az containerapp create \
  --name pandiver-backend-staging \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/pandiver-backend:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $(az acr credential show --name $ACR_NAME --query username -o tsv) \
  --registry-password $(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv) \
  --target-port 8000 \
  --ingress internal \
  --secrets \
    secret-key=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name secret-key --query value -o tsv) \
    database-url=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name staging-database-url --query value -o tsv) \
    azure-translator-key=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name azure-translator-key --query value -o tsv) \
  --env-vars \
    SECRET_KEY=secretref:secret-key \
    DATABASE_URL=secretref:database-url \
    AZURE_TRANSLATOR_KEY=secretref:azure-translator-key \
    AZURE_TRANSLATOR_REGION=eastus \
    ENVIRONMENT=staging \
  --min-replicas 0 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2Gi

# Deploy Frontend to Container Apps (Staging)
az containerapp create \
  --name pandiver-frontend-staging \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/pandiver-frontend:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $(az acr credential show --name $ACR_NAME --query username -o tsv) \
  --registry-password $(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv) \
  --target-port 80 \
  --ingress external \
  --env-vars \
    BACKEND_URL=https://pandiver-backend-staging.internal.$ENVIRONMENT_NAME.eastus.azurecontainerapps.io \
    ENVIRONMENT=staging \
  --min-replicas 0 \
  --max-replicas 2 \
  --cpu 0.5 \
  --memory 1Gi
```

### Production Environment Deployment

```bash
# Deploy Backend to Container Apps (Production)
az containerapp create \
  --name pandiver-backend-prod \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/pandiver-backend:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $(az acr credential show --name $ACR_NAME --query username -o tsv) \
  --registry-password $(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv) \
  --target-port 8000 \
  --ingress internal \
  --secrets \
    secret-key=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name secret-key --query value -o tsv) \
    database-url=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name production-database-url --query value -o tsv) \
    azure-translator-key=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name azure-translator-key --query value -o tsv) \
  --env-vars \
    SECRET_KEY=secretref:secret-key \
    DATABASE_URL=secretref:database-url \
    AZURE_TRANSLATOR_KEY=secretref:azure-translator-key \
    AZURE_TRANSLATOR_REGION=eastus \
    ENVIRONMENT=production \
  --min-replicas 1 \
  --max-replicas 10 \
  --cpu 1.0 \
  --memory 2Gi

# Deploy Frontend to Container Apps (Production)
az containerapp create \
  --name pandiver-frontend-prod \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/pandiver-frontend:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $(az acr credential show --name $ACR_NAME --query username -o tsv) \
  --registry-password $(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv) \
  --target-port 80 \
  --ingress external \
  --env-vars \
    BACKEND_URL=https://pandiver-backend-prod.internal.$ENVIRONMENT_NAME.eastus.azurecontainerapps.io \
    ENVIRONMENT=production \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1Gi
```

## 📋 GitHub Actions for Container Apps

### Updated Staging Pipeline

```yaml
# .github/workflows/staging-containerapp.yml
name: Deploy to Azure Container Apps (Staging)

on:
  push:
    branches: [main]

env:
  AZURE_RESOURCE_GROUP: rg-pandiver-containerapp
  AZURE_CONTAINER_ENV: pandiver-env
  ACR_NAME: pandiveracr

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging

    steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Log in to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Build and deploy Container App
      uses: azure/container-apps-deploy-action@v1
      with:
        appSourcePath: ${{ github.workspace }}
        acrName: ${{ env.ACR_NAME }}
        containerAppName: pandiver-backend-staging
        resourceGroup: ${{ env.AZURE_RESOURCE_GROUP }}
        containerAppEnvironment: ${{ env.AZURE_CONTAINER_ENV }}
        targetPort: 8000
        ingress: internal
        dockerfilePath: docker/backend/Dockerfile.prod
```

### Updated Production Pipeline

```yaml
# .github/workflows/production-containerapp.yml
name: Deploy to Azure Container Apps (Production)

on:
  release:
    types: [published]

env:
  AZURE_RESOURCE_GROUP: rg-pandiver-containerapp
  AZURE_CONTAINER_ENV: pandiver-env
  ACR_NAME: pandiveracr

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production

    steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Log in to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Deploy Backend
      uses: azure/container-apps-deploy-action@v1
      with:
        appSourcePath: ${{ github.workspace }}
        acrName: ${{ env.ACR_NAME }}
        containerAppName: pandiver-backend-prod
        resourceGroup: ${{ env.AZURE_RESOURCE_GROUP }}
        containerAppEnvironment: ${{ env.AZURE_CONTAINER_ENV }}
        targetPort: 8000
        ingress: internal
        dockerfilePath: docker/backend/Dockerfile.prod

    - name: Deploy Frontend
      uses: azure/container-apps-deploy-action@v1
      with:
        appSourcePath: ${{ github.workspace }}
        acrName: ${{ env.ACR_NAME }}
        containerAppName: pandiver-frontend-prod
        resourceGroup: ${{ env.AZURE_RESOURCE_GROUP }}
        containerAppEnvironment: ${{ env.AZURE_CONTAINER_ENV }}
        targetPort: 80
        ingress: external
        dockerfilePath: docker/frontend/Dockerfile.prod
```

## 💰 Cost Comparison (Monthly)

| Environment | ACI | App Service | **Container Apps** | AKS |
|-------------|-----|-------------|-------------------|-----|
| **Staging** | $55 | $75 | **$25** | $150 |
| **Production** | $200 | $300 | **$100** | $400 |
| **Total** | $255 | $375 | **$125** | $550 |

**Container Apps Pricing Benefits:**
- ✅ **Scale to zero** (no cost when idle)
- ✅ **Per-second billing** (pay only for actual usage)
- ✅ **No infrastructure costs** (fully managed)

## 🔍 Monitoring and Management

### Container Apps Insights

```bash
# View app status
az containerapp show --name pandiver-frontend-prod --resource-group $RESOURCE_GROUP

# View logs
az containerapp logs show --name pandiver-backend-prod --resource-group $RESOURCE_GROUP

# Scale manually if needed
az containerapp update --name pandiver-backend-prod --resource-group $RESOURCE_GROUP --min-replicas 2 --max-replicas 20
```

### Custom Domain Setup

```bash
# Add custom domain (if you have one)
az containerapp hostname add \
  --name pandiver-frontend-prod \
  --resource-group $RESOURCE_GROUP \
  --hostname app.yourdomain.com

# Bind SSL certificate
az containerapp ssl upload \
  --name pandiver-frontend-prod \
  --resource-group $RESOURCE_GROUP \
  --hostname app.yourdomain.com \
  --certificate-file certificate.pfx \
  --password certificatePassword
```

## 🚀 Advanced Features

### 1. Traffic Splitting (Blue/Green Deployment)

```bash
# Deploy new version to a revision
az containerapp revision copy \
  --name pandiver-frontend-prod \
  --resource-group $RESOURCE_GROUP \
  --from-revision pandiver-frontend-prod--old-revision

# Split traffic between revisions
az containerapp ingress traffic set \
  --name pandiver-frontend-prod \
  --resource-group $RESOURCE_GROUP \
  --revision-weight pandiver-frontend-prod--old-revision=10 pandiver-frontend-prod--new-revision=90
```

### 2. Event-Driven Scaling

```bash
# Scale based on HTTP requests
az containerapp update \
  --name pandiver-backend-prod \
  --resource-group $RESOURCE_GROUP \
  --scale-rule-name http-scale \
  --scale-rule-type http \
  --scale-rule-metadata concurrentRequests=10
```

### 3. Health Probes

Add to container app deployment:
```bash
--health-probe-type liveness \
--health-probe-path /health \
--health-probe-interval 30 \
--health-probe-timeout 5 \
--health-probe-retries 3
```

## 📋 Complete Dev → Staging → Production Workflow

### 1. **Development** (Local)
```bash
# Work locally with Docker Compose
docker-compose -f docker-compose.dev.yml up
```

### 2. **Staging** (Auto-deploy on main branch)
- Push to `main` branch triggers GitHub Action
- Builds images and deploys to Container Apps staging
- Automatic testing and validation

### 3. **Production** (Release-based)
- Create release tag triggers production deployment
- Blue/green deployment with traffic splitting
- Automatic rollback on failure

## 🎯 Benefits of Container Apps for Pandiver SaaS

1. **Cost Efficiency**: Scale to zero when not used
2. **Simplicity**: No Kubernetes complexity
3. **Auto-scaling**: Handle traffic spikes automatically
4. **Built-in HTTPS**: SSL termination included
5. **Microservices Ready**: Easy multi-container deployment
6. **Developer Friendly**: Simple CLI and GitHub Actions
7. **Enterprise Ready**: Built-in monitoring and logging

This approach gives you enterprise-grade deployment with minimal operational overhead and maximum cost efficiency for your SaaS product!