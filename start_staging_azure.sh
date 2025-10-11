#!/bin/bash

# ============================================
# START STAGING SERVICES ON AZURE
# ============================================
# This script starts all staging services that were previously stopped
# Run this when you want to resume the staging environment and save costs
#
# Cost savings: When stopped, Container Apps scale to 0 replicas (no compute costs)
# PostgreSQL remains running (cannot be paused, but on B1ms tier - minimal cost)

set -e  # Exit on error

RESOURCE_GROUP="pandiver-staging-rg"
BACKEND_APP="pandiver-backend-staging"
FRONTEND_APP="pandiver-frontend-staging"

echo "=================================================="
echo "🚀 Starting Pandiver Staging Services on Azure"
echo "=================================================="
echo ""

# Start Container Apps by setting min replicas to 1
echo "📦 Starting Container Apps..."
echo "  → Starting backend ($BACKEND_APP)..."
az containerapp update \
  --name $BACKEND_APP \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1 \
  --max-replicas 3 \
  --output none

echo "  → Starting frontend ($FRONTEND_APP)..."
az containerapp update \
  --name $FRONTEND_APP \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 1 \
  --max-replicas 3 \
  --output none

echo "  ✅ Container Apps started"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready (30 seconds)..."
sleep 30

# Get service URLs
echo "🔗 Getting service URLs..."
BACKEND_URL=$(az containerapp show --name $BACKEND_APP --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)
FRONTEND_URL=$(az containerapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)

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
echo "💰 Cost Information:"
echo "  - Container Apps: Now incurring compute costs (running)"
echo "  - PostgreSQL: Always running (B1ms tier - ~$13/month)"
echo "  - Container Registry: Storage costs only (~$5/month)"
echo ""
