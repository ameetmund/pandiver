# 🚀 CI/CD Pipeline Architecture for Pandiver

## Overview

Enterprise-grade deployment pipeline for seamless code movement: **Dev → Syst → Prod** using Docker containers with Azure Cloud infrastructure.

## 🏗️ Pipeline Architecture

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Development   │  System Test    │   Production    │
│      (Dev)      │     (Syst)      │      (Prod)     │
├─────────────────┼─────────────────┼─────────────────┤
│ • Local Docker  │ • Azure ACI     │ • Azure AKS     │
│ • Hot Reload    │ • Staging DB    │ • Production DB │
│ • Debug Mode    │ • UAT Testing   │ • Load Balancer │
│ • SQLite        │ • Azure SQL     │ • Auto Scaling  │
└─────────────────┴─────────────────┴─────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
    GitHub Push       Auto Deploy      Manual Approval
         │                 │                 │
         ▼                 ▼                 ▼
   GitHub Actions    Azure DevOps     Blue/Green Deploy
```

## 🌊 Deployment Stages

### Stage 1: Development (Dev)
- **Environment**: Local development with Docker Compose
- **Database**: SQLite (docker_data/database)
- **Configuration**: `.env.development`
- **Trigger**: Developer commits to `develop` branch
- **Testing**: Unit tests, integration tests
- **Approval**: Automatic (on test pass)

### Stage 2: System Test (Syst)
- **Environment**: Azure Container Instances (ACI)
- **Database**: Azure SQL Database (Test instance)
- **Configuration**: `.env.staging`
- **Trigger**: Merge to `main` branch
- **Testing**: UAT, performance testing, API validation
- **Approval**: QA team approval required

### Stage 3: Production (Prod)
- **Environment**: Azure Kubernetes Service (AKS)
- **Database**: Azure SQL Database (Production cluster)
- **Configuration**: `.env.production`
- **Trigger**: Manual release tag creation
- **Testing**: Smoke tests, health checks
- **Approval**: DevOps team + Business approval

## 🛠️ Technology Stack

### CI/CD Platform
- **Primary**: GitHub Actions (recommended for simplicity)
- **Alternative**: Azure DevOps Pipelines
- **Container Registry**: Azure Container Registry (ACR)

### Azure Services
```
Production Tier:
├── Azure Kubernetes Service (AKS)
│   ├── Backend Pods (FastAPI)
│   ├── Frontend Pods (Next.js)
│   └── Ingress Controller (NGINX)
├── Azure SQL Database
├── Azure Key Vault (secrets)
├── Azure Application Gateway (load balancer)
└── Azure Monitor (logging/metrics)

System Test Tier:
├── Azure Container Instances (ACI)
├── Azure SQL Database (smaller tier)
└── Azure Log Analytics
```

## 📁 Repository Structure

```
pandiver-new/
├── .github/
│   └── workflows/
│       ├── dev-pipeline.yml
│       ├── staging-pipeline.yml
│       └── production-pipeline.yml
├── infrastructure/
│   ├── terraform/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   └── k8s/
│       ├── configmaps/
│       ├── deployments/
│       └── services/
├── docker/
│   ├── backend/
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   └── docker-entrypoint.sh
│   ├── frontend/
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   └── docker-entrypoint.sh
│   └── compose/
│       ├── docker-compose.dev.yml
│       ├── docker-compose.staging.yml
│       └── docker-compose.prod.yml
└── environments/
    ├── .env.development
    ├── .env.staging
    └── .env.production
```

## 🔄 GitHub Actions Workflow

### Development Pipeline (.github/workflows/dev-pipeline.yml)
```yaml
name: Development Pipeline
on:
  push:
    branches: [develop]
  pull_request:
    branches: [develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Tests
        run: |
          docker-compose -f docker/compose/docker-compose.dev.yml up --build -d
          docker-compose -f docker/compose/docker-compose.dev.yml exec backend pytest
          docker-compose -f docker/compose/docker-compose.dev.yml down
```

### Staging Pipeline (.github/workflows/staging-pipeline.yml)
```yaml
name: Staging Deployment
on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - name: Build and Push to ACR
        run: |
          az acr build --registry ${{ secrets.ACR_NAME }} --image pandiver-backend:${{ github.sha }} ./backend
          az acr build --registry ${{ secrets.ACR_NAME }} --image pandiver-frontend:${{ github.sha }} ./frontend
      - name: Deploy to ACI
        run: |
          az container create \
            --resource-group rg-pandiver-staging \
            --name pandiver-staging \
            --image ${{ secrets.ACR_NAME }}.azurecr.io/pandiver-backend:${{ github.sha }} \
            --environment-variables-file environments/.env.staging
```

### Production Pipeline (.github/workflows/production-pipeline.yml)
```yaml
name: Production Deployment
on:
  release:
    types: [published]

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to AKS
        run: |
          helm upgrade pandiver ./infrastructure/k8s/helm-chart \
            --set image.tag=${{ github.sha }} \
            --namespace production
```

## 🗄️ Database Strategy

### Development
- **Type**: SQLite
- **Location**: `./docker_data/database/pandiver.db`
- **Backup**: Git ignored, recreated on fresh setup

### System Test
- **Type**: Azure SQL Database (Basic tier)
- **Connection**: Connection string in Azure Key Vault
- **Data**: Anonymized production data subset
- **Reset**: Weekly refresh from production sanitized backup

### Production
- **Type**: Azure SQL Database (Standard/Premium tier)
- **Backup**: Automated daily backups with 7-day retention
- **Scaling**: Auto-scaling based on DTU usage
- **Security**: Private endpoint, encryption at rest

## 🔐 Secrets Management

### Development
```bash
# .env.development (local only)
SECRET_KEY=dev-secret-key-not-for-production
AZURE_TRANSLATOR_KEY=dev-key
DATABASE_URL=sqlite:///./pandiver.db
```

### System Test
```bash
# Azure Key Vault: kv-pandiver-staging
# .env.staging (from Key Vault)
SECRET_KEY=$(az keyvault secret show --name secret-key --vault-name kv-pandiver-staging --query value -o tsv)
AZURE_TRANSLATOR_KEY=$(az keyvault secret show --name azure-translator-key --vault-name kv-pandiver-staging --query value -o tsv)
DATABASE_URL=$(az keyvault secret show --name database-url --vault-name kv-pandiver-staging --query value -o tsv)
```

### Production
```bash
# Azure Key Vault: kv-pandiver-production
# Managed identities for AKS pods
# No environment files - direct Key Vault integration
```

## 🐳 Docker Strategy

### Multi-Stage Builds
```dockerfile
# Production optimized build
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine AS frontend-production
COPY --from=frontend-builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### Image Tagging Strategy
- **Development**: `latest`
- **Staging**: `staging-{branch}-{commit-sha}`
- **Production**: `v{version}-{commit-sha}`

## 🚦 Deployment Gates

### Automated Gates
- ✅ Unit tests pass (100% required)
- ✅ Security scan passes (no high/critical vulnerabilities)
- ✅ Code coverage > 80%
- ✅ Performance tests within SLA
- ✅ Integration tests pass

### Manual Gates
- 👥 QA sign-off (Staging → Production)
- 👥 Security review (for major releases)
- 👥 Business approval (for feature releases)

## 📊 Monitoring & Observability

### Application Monitoring
```yaml
# Azure Application Insights integration
Metrics:
  - Request latency (p95 < 500ms)
  - Error rate (< 1%)
  - Availability (> 99.9%)
  - Database response time (< 100ms)

Alerts:
  - High error rate → Slack #alerts
  - Database connection failures → PagerDuty
  - Certificate expiry → Email DevOps team
```

### Log Aggregation
```yaml
# Azure Monitor + Application Insights
Logs:
  - Application logs (structured JSON)
  - Access logs (NGINX)
  - Security logs (authentication events)
  - Performance logs (slow queries)

Retention:
  - Development: 7 days
  - Staging: 30 days
  - Production: 90 days
```

## 💰 Cost Optimization

### Resource Sizing
```yaml
Development:
  - Local Docker (no cloud cost)

Staging:
  - Azure Container Instances: $20-40/month
  - Azure SQL Basic: $5/month
  - Azure Storage: $2/month
  - Total: ~$50/month

Production:
  - AKS cluster (2 nodes): $150/month
  - Azure SQL Standard: $100/month
  - Application Gateway: $50/month
  - Storage + monitoring: $25/month
  - Total: ~$325/month
```

### Auto-Scaling Policies
```yaml
AKS Horizontal Pod Autoscaler:
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

Azure SQL Auto-scaling:
  minDTU: 20
  maxDTU: 100
  scaleUpThreshold: 80%
  scaleDownThreshold: 20%
```

## 🚀 Migration Plan

### Phase 1: Repository Setup (Week 1)
1. Create branch structure (`develop`, `main`, `production`)
2. Set up GitHub Actions workflows
3. Create Azure resource groups and basic infrastructure

### Phase 2: Staging Environment (Week 2)
1. Deploy Azure Container Instances for staging
2. Set up Azure SQL Database for testing
3. Configure Azure Key Vault for secrets
4. Test staging deployment pipeline

### Phase 3: Production Environment (Week 3)
1. Set up Azure Kubernetes Service
2. Configure production database with backup strategy
3. Set up monitoring and alerting
4. Perform production deployment tests

### Phase 4: Go-Live (Week 4)
1. Migrate production data
2. Switch DNS to new infrastructure
3. Monitor and optimize performance
4. Train team on new deployment process

## 🔄 Rollback Strategy

### Automated Rollback Triggers
- Error rate > 5% for 5 minutes
- Response time > 2 seconds for 10 minutes
- Application availability < 99%

### Rollback Process
```bash
# Production rollback (AKS)
helm rollback pandiver

# Staging rollback (ACI)
az container restart --name pandiver-staging --resource-group rg-pandiver-staging

# Database rollback
# Point-in-time restore from automated backup
```

## 📋 Success Metrics

### Deployment KPIs
- **Deployment Frequency**: Target 2-3 times per week
- **Lead Time**: Commit to production < 4 hours
- **MTTR**: Mean time to recovery < 15 minutes
- **Change Failure Rate**: < 5%

### Quality Gates
- **Zero Downtime**: Blue/green deployments
- **Automated Testing**: 100% pipeline automation
- **Security**: All secrets in Key Vault
- **Compliance**: Audit logs for all deployments

This architecture ensures seamless movement from Dev → Syst → Prod with minimal manual intervention, leveraging Azure's enterprise-grade services for scalability and reliability.