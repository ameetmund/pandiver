#!/bin/bash

# ============================================
# START STAGING SERVICES ON AZURE
# ============================================
# This script starts all staging services that were previously stopped
# Run this when you want to resume the staging environment

set -e  # Exit on error

RESOURCE_GROUP="pandiver-containerapp-rg"

echo "=================================================="
echo "🚀 Starting Pandiver Staging Services on Azure"
echo "=================================================="
echo ""

# Resume SQL Databases (must be done first as apps depend on it)
echo "🗄️  Resuming SQL Databases..."
echo "  → Resuming staging database..."
az sql db resume \
  --name pandiver-staging-db \
  --server pandiver-sql-30421 \
  --resource-group $RESOURCE_GROUP \
  --output none

echo "  → Resuming production database..."
az sql db resume \
  --name pandiver-production-db \
  --server pandiver-sql-30421 \
  --resource-group $RESOURCE_GROUP \
  --output none

echo "  ✅ SQL Databases resumed"
echo ""

# Start Container Apps
echo "📦 Starting Container Apps..."
echo "  → Starting backend (pandiver-backend-staging)..."
az containerapp update \
  --name pandiver-backend-staging \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1 \
  --max-replicas 3 \
  --output none

echo "  → Starting frontend (pandiver-frontend-staging)..."
az containerapp update \
  --name pandiver-frontend-staging \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1 \
  --max-replicas 2 \
  --output none

echo "  ✅ Container Apps started"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready (30 seconds)..."
sleep 30

# Get service URLs
echo "🔗 Getting service URLs..."
BACKEND_URL=$(az containerapp show --name pandiver-backend-staging --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
FRONTEND_URL=$(az containerapp show --name pandiver-frontend-staging --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo "=================================================="
echo "✅ All staging services started successfully!"
echo "=================================================="
echo ""
echo "🌐 Service URLs:"
echo "  - Frontend: https://$FRONTEND_URL"
echo "  - Backend:  https://$BACKEND_URL"
echo "  - API Docs: https://$BACKEND_URL/docs"
echo ""
echo "💡 Note: Services may take 1-2 minutes to be fully responsive"
echo "📝 To stop services, run: ./stop_staging_azure.sh"
echo ""
