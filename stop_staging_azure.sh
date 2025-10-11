#!/bin/bash

# ============================================
# STOP STAGING SERVICES ON AZURE
# ============================================
# This script stops all staging services to save costs
# Run this when you want to pause the staging environment
#
# Cost savings: Container Apps scaled to 0 replicas = no compute costs
# PostgreSQL cannot be stopped (remains on B1ms tier - minimal cost)

set -e  # Exit on error

RESOURCE_GROUP="pandiver-staging-rg"
BACKEND_APP="pandiver-backend-staging"
FRONTEND_APP="pandiver-frontend-staging"

echo "=================================================="
echo "🛑 Stopping Pandiver Staging Services on Azure"
echo "=================================================="
echo ""

# Stop Container Apps by setting min replicas to 0
echo "📦 Stopping Container Apps..."
echo "  → Stopping backend ($BACKEND_APP)..."
az containerapp update \
  --name $BACKEND_APP \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 0 \
  --max-replicas 3 \
  --output none

echo "  → Stopping frontend ($FRONTEND_APP)..."
az containerapp update \
  --name $FRONTEND_APP \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 0 \
  --max-replicas 3 \
  --output none

echo "  ✅ Container Apps stopped (scaled to 0 replicas)"
echo ""

# Note: PostgreSQL Flexible Server cannot be paused
# It remains running on B1ms tier (minimal cost)
echo "💡 PostgreSQL Database remains active (cannot pause Flexible Server)"
echo "   Database: pandiver-staging (B1ms tier - ~$13/month)"
echo "   To fully stop: delete server and restore from backup when needed"
echo ""

echo "=================================================="
echo "✅ All staging services stopped successfully!"
echo "=================================================="
echo ""
echo "💰 Cost savings achieved:"
echo "  - Backend Container App (0 replicas) ✅ - No compute costs"
echo "  - Frontend Container App (0 replicas) ✅ - No compute costs"
echo "  - PostgreSQL (still running) - Minimal cost (~$13/month)"
echo "  - Container Registry (storage only) - ~$5/month"
echo ""
echo "📝 To restart services, run: ./start_staging_azure.sh"
echo ""
