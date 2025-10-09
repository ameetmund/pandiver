#!/bin/bash

# ============================================
# STOP STAGING SERVICES ON AZURE
# ============================================
# This script stops all staging services to save costs
# Run this when you want to pause the staging environment

set -e  # Exit on error

RESOURCE_GROUP="pandiver-containerapp-rg"

echo "=================================================="
echo "🛑 Stopping Pandiver Staging Services on Azure"
echo "=================================================="
echo ""

# Stop Container Apps
echo "📦 Stopping Container Apps..."
echo "  → Stopping backend (pandiver-backend-staging)..."
az containerapp update \
  --name pandiver-backend-staging \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 0 \
  --max-replicas 1 \
  --output none

echo "  → Stopping frontend (pandiver-frontend-staging)..."
az containerapp update \
  --name pandiver-frontend-staging \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 0 \
  --max-replicas 1 \
  --output none

echo "  ✅ Container Apps stopped"
echo ""

# Note: SQL Databases cannot be paused (only Data Warehouse can)
# They are kept running but already on minimal tier
# To fully stop, you would need to delete and recreate from backups
echo "💡 SQL Databases remain active (cannot pause regular SQL DB)"
echo "   Databases are already on Basic tier (minimal cost)"
echo "   To fully stop: delete databases and restore from backup when needed"
echo ""

echo "=================================================="
echo "✅ All staging services stopped successfully!"
echo "=================================================="
echo ""
echo "💰 Services stopped:"
echo "  - Backend Container App (0 replicas) ✅"
echo "  - Frontend Container App (0 replicas) ✅"
echo "  - SQL Databases (still active - minimal cost)"
echo ""
echo "📝 To restart services, run: ./start_staging_azure.sh"
echo ""
