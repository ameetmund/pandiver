# ☁️ Azure Cloud Deployment Guide

## 🏗️ Azure Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Architecture                  │
├─────────────────────────────────────────────────────────────┤
│  Azure Application Gateway (Load Balancer + SSL)           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Region 1  │  │   Region 2  │  │   Region 3  │        │
│  │     AKS     │  │     AKS     │  │     AKS     │        │
│  │   Cluster   │  │   Cluster   │  │   Cluster   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│          Azure SQL Database (Geo-Replicated)               │
│          Azure Key Vault (Secrets Management)              │
│          Azure Container Registry (ACR)                    │
│          Azure Monitor + Application Insights              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Staging Architecture                     │
├─────────────────────────────────────────────────────────────┤
│           Azure Container Instances (ACI)                  │
│  ┌─────────────┐  ┌─────────────┐                         │
│  │   Backend   │  │  Frontend   │                         │
│  │ Container   │  │ Container   │                         │
│  └─────────────┘  └─────────────┘                         │
├─────────────────────────────────────────────────────────────┤
│          Azure SQL Database (Basic Tier)                   │
│          Azure Key Vault (Shared with Prod)                │
│          Azure Container Registry (Shared)                 │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Deployment Strategies

### Strategy 1: Azure Container Instances (ACI) - Simplest
**Best for**: Small to medium workloads, testing, staging environments
**Cost**: ~$50-100/month
**Complexity**: Low

### Strategy 2: Azure App Service - Managed Platform
**Best for**: Standard web applications with moderate scaling needs
**Cost**: ~$100-300/month
**Complexity**: Medium

### Strategy 3: Azure Kubernetes Service (AKS) - Enterprise
**Best for**: High-availability, auto-scaling, multi-region deployments
**Cost**: ~$300-1000/month
**Complexity**: High

## 📁 Azure Resource Organization

```
Resource Groups:
├── rg-pandiver-shared
│   ├── Azure Container Registry (pandiveracr)
│   ├── Azure Key Vault (kv-pandiver-shared)
│   └── Azure Log Analytics Workspace
├── rg-pandiver-staging
│   ├── Azure Container Instances
│   ├── Azure SQL Database (Basic)
│   └── Azure Application Insights
└── rg-pandiver-production
    ├── Azure Kubernetes Service
    ├── Azure SQL Database (Standard/Premium)
    ├── Azure Application Gateway
    └── Azure Application Insights
```

## 🏗️ Strategy 1: Azure Container Instances (ACI)

### Prerequisites
1. Azure CLI installed and configured
2. Azure subscription with contributor access
3. Domain name (optional)

### Step 1: Create Shared Resources
```bash
# Login to Azure
az login

# Create shared resource group
az group create --name rg-pandiver-shared --location eastus

# Create Azure Container Registry
az acr create \
  --resource-group rg-pandiver-shared \
  --name pandiveracr \
  --sku Basic \
  --admin-enabled true

# Create Azure Key Vault
az keyvault create \
  --name kv-pandiver-shared \
  --resource-group rg-pandiver-shared \
  --location eastus
```

### Step 2: Store Secrets in Key Vault
```bash
# Store application secrets
az keyvault secret set --vault-name kv-pandiver-shared --name "secret-key" --value "your-super-secret-key-here"
az keyvault secret set --vault-name kv-pandiver-shared --name "azure-translator-key" --value "your-azure-translator-key"
az keyvault secret set --vault-name kv-pandiver-shared --name "azure-translator-region" --value "eastus"
az keyvault secret set --vault-name kv-pandiver-shared --name "azure-doc-intelligence-key" --value "your-doc-intelligence-key"
az keyvault secret set --vault-name kv-pandiver-shared --name "azure-doc-intelligence-endpoint" --value "your-endpoint"
```

### Step 3: Build and Push Images
```bash
# Login to ACR
az acr login --name pandiveracr

# Build and push backend image
docker build -f docker/backend/Dockerfile.prod -t pandiveracr.azurecr.io/pandiver-backend:latest ./backend
docker push pandiveracr.azurecr.io/pandiver-backend:latest

# Build and push frontend image
docker build -f docker/frontend/Dockerfile.prod -t pandiveracr.azurecr.io/pandiver-frontend:latest ./frontend
docker push pandiveracr.azurecr.io/pandiver-frontend:latest
```

### Step 4: Deploy to ACI (Staging)
```bash
# Create staging resource group
az group create --name rg-pandiver-staging --location eastus

# Create Azure SQL Database for staging
az sql server create \
  --name pandiver-sql-staging \
  --resource-group rg-pandiver-staging \
  --location eastus \
  --admin-user panadmin \
  --admin-password "YourStrongPassword123!"

az sql db create \
  --resource-group rg-pandiver-staging \
  --server pandiver-sql-staging \
  --name pandiver-staging-db \
  --service-objective Basic

# Deploy backend container
az container create \
  --resource-group rg-pandiver-staging \
  --name pandiver-backend-staging \
  --image pandiveracr.azurecr.io/pandiver-backend:latest \
  --registry-login-server pandiveracr.azurecr.io \
  --registry-username pandiveracr \
  --registry-password $(az acr credential show --name pandiveracr --query passwords[0].value -o tsv) \
  --dns-name-label pandiver-backend-staging \
  --ports 8000 \
  --environment-variables \
    SECRET_KEY="$(az keyvault secret show --vault-name kv-pandiver-shared --name secret-key --query value -o tsv)" \
    DATABASE_URL="postgresql://panadmin:YourStrongPassword123!@pandiver-sql-staging.database.windows.net:1433/pandiver-staging-db?sslmode=require" \
    AZURE_TRANSLATOR_KEY="$(az keyvault secret show --vault-name kv-pandiver-shared --name azure-translator-key --query value -o tsv)" \
    AZURE_TRANSLATOR_REGION="$(az keyvault secret show --vault-name kv-pandiver-shared --name azure-translator-region --query value -o tsv)" \
    AZURE_DOC_INTELLIGENCE_KEY="$(az keyvault secret show --vault-name kv-pandiver-shared --name azure-doc-intelligence-key --query value -o tsv)" \
    AZURE_DOC_INTELLIGENCE_ENDPOINT="$(az keyvault secret show --vault-name kv-pandiver-shared --name azure-doc-intelligence-endpoint --query value -o tsv)"

# Deploy frontend container
az container create \
  --resource-group rg-pandiver-staging \
  --name pandiver-frontend-staging \
  --image pandiveracr.azurecr.io/pandiver-frontend:latest \
  --registry-login-server pandiveracr.azurecr.io \
  --registry-username pandiveracr \
  --registry-password $(az acr credential show --name pandiveracr --query passwords[0].value -o tsv) \
  --dns-name-label pandiver-frontend-staging \
  --ports 80 \
  --environment-variables \
    BACKEND_URL="http://pandiver-backend-staging.eastus.azurecontainer.io:8000"
```

### Step 5: Access Staging Environment
- **Frontend**: `http://pandiver-frontend-staging.eastus.azurecontainer.io`
- **Backend API**: `http://pandiver-backend-staging.eastus.azurecontainer.io:8000`
- **API Docs**: `http://pandiver-backend-staging.eastus.azurecontainer.io:8000/docs`

## 🏗️ Strategy 2: Azure App Service

### Step 1: Create App Service Plans
```bash
# Create App Service resource group
az group create --name rg-pandiver-appservice --location eastus

# Create App Service Plan (Linux)
az appservice plan create \
  --name pandiver-app-plan \
  --resource-group rg-pandiver-appservice \
  --sku B1 \
  --is-linux

# Create backend web app
az webapp create \
  --resource-group rg-pandiver-appservice \
  --plan pandiver-app-plan \
  --name pandiver-backend-app \
  --deployment-container-image-name pandiveracr.azurecr.io/pandiver-backend:latest

# Create frontend web app
az webapp create \
  --resource-group rg-pandiver-appservice \
  --plan pandiver-app-plan \
  --name pandiver-frontend-app \
  --deployment-container-image-name pandiveracr.azurecr.io/pandiver-frontend:latest
```

### Step 2: Configure App Service Settings
```bash
# Configure backend app settings
az webapp config appsettings set \
  --resource-group rg-pandiver-appservice \
  --name pandiver-backend-app \
  --settings \
    SECRET_KEY="@Microsoft.KeyVault(SecretUri=https://kv-pandiver-shared.vault.azure.net/secrets/secret-key/)" \
    DATABASE_URL="@Microsoft.KeyVault(SecretUri=https://kv-pandiver-shared.vault.azure.net/secrets/database-url/)" \
    AZURE_TRANSLATOR_KEY="@Microsoft.KeyVault(SecretUri=https://kv-pandiver-shared.vault.azure.net/secrets/azure-translator-key/)"

# Configure frontend app settings
az webapp config appsettings set \
  --resource-group rg-pandiver-appservice \
  --name pandiver-frontend-app \
  --settings \
    BACKEND_URL="https://pandiver-backend-app.azurewebsites.net"
```

## 🏗️ Strategy 3: Azure Kubernetes Service (AKS) - Production

### Step 1: Create AKS Cluster
```bash
# Create production resource group
az group create --name rg-pandiver-production --location eastus

# Create AKS cluster
az aks create \
  --resource-group rg-pandiver-production \
  --name pandiver-aks-cluster \
  --node-count 3 \
  --node-vm-size Standard_B2s \
  --enable-addons monitoring \
  --attach-acr pandiveracr \
  --enable-managed-identity \
  --kubernetes-version 1.28

# Get AKS credentials
az aks get-credentials --resource-group rg-pandiver-production --name pandiver-aks-cluster
```

### Step 2: Create Kubernetes Manifests

Create `k8s/namespace.yaml`:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: pandiver-production
```

Create `k8s/secret.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: pandiver-secrets
  namespace: pandiver-production
type: Opaque
data:
  secret-key: <base64-encoded-secret>
  database-url: <base64-encoded-database-url>
  azure-translator-key: <base64-encoded-translator-key>
```

Create `k8s/backend-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pandiver-backend
  namespace: pandiver-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pandiver-backend
  template:
    metadata:
      labels:
        app: pandiver-backend
    spec:
      containers:
      - name: backend
        image: pandiveracr.azurecr.io/pandiver-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: pandiver-secrets
              key: secret-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: pandiver-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: pandiver-backend-service
  namespace: pandiver-production
spec:
  selector:
    app: pandiver-backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### Step 3: Deploy to AKS
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment status
kubectl get pods -n pandiver-production
kubectl get services -n pandiver-production
```

## 📊 Cost Optimization

### ACI Pricing (Staging)
```
Backend Container:
- 1 vCPU, 1GB RAM, 24/7: ~$30/month
- Data transfer: ~$5/month

Frontend Container:
- 0.5 vCPU, 0.5GB RAM, 24/7: ~$15/month

Azure SQL Basic: ~$5/month
Total Staging: ~$55/month
```

### AKS Pricing (Production)
```
AKS Cluster (3 nodes, Standard_B2s):
- Node cost: 3 × $30 = $90/month
- Azure SQL Standard: ~$100/month
- Application Gateway: ~$50/month
- Storage and monitoring: ~$25/month
Total Production: ~$265/month
```

## 🔐 Security Best Practices

### Network Security
```bash
# Create private endpoints for SQL Database
az network private-endpoint create \
  --name pandiver-sql-pe \
  --resource-group rg-pandiver-production \
  --vnet-name pandiver-vnet \
  --subnet pandiver-subnet \
  --private-connection-resource-id $(az sql server show --name pandiver-sql-prod --resource-group rg-pandiver-production --query id -o tsv) \
  --group-ids sqlServer \
  --connection-name pandiver-sql-connection
```

### Identity and Access Management
```bash
# Create managed identity for AKS
az aks update \
  --resource-group rg-pandiver-production \
  --name pandiver-aks-cluster \
  --enable-managed-identity

# Grant Key Vault access to AKS managed identity
MANAGED_IDENTITY_ID=$(az aks show --resource-group rg-pandiver-production --name pandiver-aks-cluster --query identityProfile.kubeletidentity.clientId -o tsv)

az keyvault set-policy \
  --name kv-pandiver-shared \
  --object-id $MANAGED_IDENTITY_ID \
  --secret-permissions get list
```

## 📈 Monitoring and Logging

### Application Insights Setup
```bash
# Create Application Insights
az monitor app-insights component create \
  --app pandiver-insights \
  --location eastus \
  --resource-group rg-pandiver-production \
  --kind web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show --app pandiver-insights --resource-group rg-pandiver-production --query instrumentationKey -o tsv)
```

### Log Analytics
```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group rg-pandiver-production \
  --workspace-name pandiver-logs \
  --location eastus

# Link AKS to Log Analytics
az aks enable-addons \
  --resource-group rg-pandiver-production \
  --name pandiver-aks-cluster \
  --addons monitoring \
  --workspace-resource-id $(az monitor log-analytics workspace show --resource-group rg-pandiver-production --workspace-name pandiver-logs --query id -o tsv)
```

## 🚀 CI/CD Integration with Azure DevOps

### Azure DevOps Pipeline (azure-pipelines.yml)
```yaml
trigger:
  branches:
    include:
    - main
    - develop

variables:
  azureSubscription: 'YourAzureSubscription'
  containerRegistry: 'pandiveracr.azurecr.io'
  imageRepository: 'pandiver'
  dockerfilePath: '$(Build.SourcesDirectory)/docker/backend/Dockerfile.prod'

stages:
- stage: Build
  displayName: Build and push image
  jobs:
  - job: Build
    displayName: Build
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - task: Docker@2
      displayName: Build and push backend image
      inputs:
        command: buildAndPush
        repository: $(imageRepository)-backend
        dockerfile: $(dockerfilePath)
        containerRegistry: $(azureSubscription)
        tags: |
          $(Build.BuildId)
          latest

- stage: DeployStaging
  displayName: Deploy to Staging
  dependsOn: Build
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: DeployStaging
    displayName: Deploy to ACI Staging
    environment: 'staging'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureCLI@2
            displayName: Deploy to ACI
            inputs:
              azureSubscription: $(azureSubscription)
              scriptType: bash
              scriptLocation: inlineScript
              inlineScript: |
                az container restart --name pandiver-backend-staging --resource-group rg-pandiver-staging

- stage: DeployProduction
  displayName: Deploy to Production
  dependsOn: DeployStaging
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: DeployProduction
    displayName: Deploy to AKS Production
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: KubernetesManifest@0
            displayName: Deploy to AKS
            inputs:
              action: deploy
              manifests: |
                k8s/backend-deployment.yaml
                k8s/frontend-deployment.yaml
```

## 🔄 Backup and Disaster Recovery

### Database Backup
```bash
# Configure automated backups for Azure SQL
az sql db-backup-create \
  --resource-group rg-pandiver-production \
  --server pandiver-sql-prod \
  --database pandiver-prod-db \
  --backup-name "daily-backup-$(date +%Y%m%d)"

# Configure geo-replication
az sql db replica create \
  --resource-group rg-pandiver-production \
  --server pandiver-sql-prod \
  --name pandiver-prod-db \
  --partner-server pandiver-sql-dr \
  --partner-resource-group rg-pandiver-dr \
  --service-objective S2
```

### Container Image Backup
```bash
# Enable geo-replication for ACR
az acr replication create \
  --registry pandiveracr \
  --location westus2
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Azure subscription and permissions configured
- [ ] Domain name purchased and DNS configured
- [ ] SSL certificates obtained
- [ ] Secrets stored in Azure Key Vault
- [ ] CI/CD pipeline tested
- [ ] Monitoring and alerting configured

### Post-Deployment
- [ ] Application health checks passing
- [ ] Database connections working
- [ ] SSL certificates valid
- [ ] Monitoring dashboards functional
- [ ] Backup procedures tested
- [ ] Disaster recovery plan documented

## 🆘 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check container logs
az container logs --resource-group rg-pandiver-staging --name pandiver-backend-staging

# Check container events
az container show --resource-group rg-pandiver-staging --name pandiver-backend-staging --query instanceView.events
```

#### Database Connection Issues
```bash
# Test database connectivity
az sql db show-connection-string \
  --server pandiver-sql-staging \
  --name pandiver-staging-db \
  --client ado.net

# Check firewall rules
az sql server firewall-rule list \
  --resource-group rg-pandiver-staging \
  --server pandiver-sql-staging
```

#### Key Vault Access Issues
```bash
# Check Key Vault permissions
az keyvault show --name kv-pandiver-shared --query properties.accessPolicies

# Test secret retrieval
az keyvault secret show --vault-name kv-pandiver-shared --name secret-key
```

This comprehensive guide provides multiple deployment strategies for Azure, from simple ACI deployments to enterprise-grade AKS clusters with full CI/CD integration.