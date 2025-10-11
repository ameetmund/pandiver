#!/bin/bash

# Deploy Pandiver to Azure Container Apps (Staging)
# This script builds, pushes, and deploys both backend and frontend to staging

set -e

echo "🚀 Deploying Pandiver to Azure Container Apps (Staging)"
echo "========================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "${BLUE}📋 $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
RESOURCE_GROUP="pandiver-staging-rg"
LOCATION="centralindia"
ACR_NAME="pandiverstaging88118"
KEY_VAULT_NAME="kv-pandiver-staging-8766"
ENVIRONMENT_NAME="pandiver-staging-env"
POSTGRES_SERVER="pandiver-staging"

# Container Apps names
BACKEND_APP_NAME="pandiver-backend-staging"
FRONTEND_APP_NAME="pandiver-frontend-staging"

# Image tags
IMAGE_TAG="${1:-latest}"
BACKEND_IMAGE="$ACR_NAME.azurecr.io/pandiver-backend:$IMAGE_TAG"
FRONTEND_IMAGE="$ACR_NAME.azurecr.io/pandiver-frontend:$IMAGE_TAG"

echo ""
echo "Configuration:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  ACR: $ACR_NAME"
echo "  Environment: $ENVIRONMENT_NAME"
echo "  Image Tag: $IMAGE_TAG"
echo ""

# Skip confirmation if --yes flag is provided
if [[ "$2" != "--yes" ]]; then
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Step 1: Login to Azure
print_step "Logging into Azure..."
az account show &>/dev/null || az login
print_success "Logged into Azure"

# Step 2: Get ACR credentials
print_step "Getting ACR credentials..."
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
print_success "ACR credentials retrieved"

# Step 3: Build and push images using ACR Tasks (always builds for linux/amd64)
print_step "Building backend image in Azure (linux/amd64)..."
az acr build \
  --registry $ACR_NAME \
  --image pandiver-backend:$IMAGE_TAG \
  --file backend/Dockerfile.dev \
  --platform linux/amd64 \
  ./backend

print_success "Backend image built and pushed: $BACKEND_IMAGE"

print_step "Building frontend image in Azure (linux/amd64)..."
az acr build \
  --registry $ACR_NAME \
  --image pandiver-frontend:$IMAGE_TAG \
  --file frontend/Dockerfile.dev \
  --platform linux/amd64 \
  ./frontend

print_success "Frontend image built and pushed: $FRONTEND_IMAGE"

# Step 6: Get secrets from Key Vault
print_step "Retrieving secrets from Key Vault..."

DATABASE_URL=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name staging-database-url \
  --query value -o tsv)

SECRET_KEY=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name secret-key \
  --query value -o tsv)

AZURE_TRANSLATOR_KEY=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name azure-translator-key \
  --query value -o tsv 2>/dev/null || echo "")

AZURE_TRANSLATOR_REGION=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name azure-translator-region \
  --query value -o tsv 2>/dev/null || echo "centralindia")

AZURE_DOC_INTELLIGENCE_KEY=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name azure-doc-intelligence-key \
  --query value -o tsv 2>/dev/null || echo "")

AZURE_DOC_INTELLIGENCE_ENDPOINT=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name azure-doc-intelligence-endpoint \
  --query value -o tsv 2>/dev/null || echo "")

AZURE_BLOB_CONNECTION_STRING=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name azure-blob-connection-string \
  --query value -o tsv 2>/dev/null || echo "")

print_success "Secrets retrieved from Key Vault"

# Step 7: Deploy or update backend container app
print_step "Checking if backend container app exists..."
if az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    print_warning "Backend app exists, updating..."

    az containerapp update \
      --name $BACKEND_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --image $BACKEND_IMAGE \
      --set-env-vars \
        "DATABASE_URL=$DATABASE_URL" \
        "SECRET_KEY=$SECRET_KEY" \
        "AZURE_TRANSLATOR_KEY=$AZURE_TRANSLATOR_KEY" \
        "AZURE_TRANSLATOR_REGION=$AZURE_TRANSLATOR_REGION" \
        "AZURE_DOC_INTELLIGENCE_KEY=$AZURE_DOC_INTELLIGENCE_KEY" \
        "AZURE_DOC_INTELLIGENCE_ENDPOINT=$AZURE_DOC_INTELLIGENCE_ENDPOINT" \
        "AZURE_BLOB_CONNECTION_STRING=$AZURE_BLOB_CONNECTION_STRING" \
        "ENVIRONMENT=staging"

    print_success "Backend app updated"
else
    print_step "Creating backend container app..."

    az containerapp create \
      --name $BACKEND_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --environment $ENVIRONMENT_NAME \
      --image $BACKEND_IMAGE \
      --registry-server $ACR_NAME.azurecr.io \
      --registry-username $ACR_USERNAME \
      --registry-password "$ACR_PASSWORD" \
      --target-port 8000 \
      --ingress external \
      --min-replicas 1 \
      --max-replicas 3 \
      --cpu 0.5 \
      --memory 1Gi \
      --env-vars \
        "DATABASE_URL=$DATABASE_URL" \
        "SECRET_KEY=$SECRET_KEY" \
        "AZURE_TRANSLATOR_KEY=$AZURE_TRANSLATOR_KEY" \
        "AZURE_TRANSLATOR_REGION=$AZURE_TRANSLATOR_REGION" \
        "AZURE_DOC_INTELLIGENCE_KEY=$AZURE_DOC_INTELLIGENCE_KEY" \
        "AZURE_DOC_INTELLIGENCE_ENDPOINT=$AZURE_DOC_INTELLIGENCE_ENDPOINT" \
        "AZURE_BLOB_CONNECTION_STRING=$AZURE_BLOB_CONNECTION_STRING" \
        "ENVIRONMENT=staging"

    print_success "Backend app created"
fi

# Get backend URL
BACKEND_URL=$(az containerapp show \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

BACKEND_URL="https://$BACKEND_URL"
print_success "Backend URL: $BACKEND_URL"

# Step 8: Deploy or update frontend container app
print_step "Checking if frontend container app exists..."
if az containerapp show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    print_warning "Frontend app exists, updating..."

    az containerapp update \
      --name $FRONTEND_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --image $FRONTEND_IMAGE \
      --set-env-vars \
        "NEXT_PUBLIC_API_URL=$BACKEND_URL" \
        "NEXT_PUBLIC_ENVIRONMENT=staging" \
        "DOCKER_ENV=true"

    print_success "Frontend app updated"
else
    print_step "Creating frontend container app..."

    az containerapp create \
      --name $FRONTEND_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --environment $ENVIRONMENT_NAME \
      --image $FRONTEND_IMAGE \
      --registry-server $ACR_NAME.azurecr.io \
      --registry-username $ACR_USERNAME \
      --registry-password "$ACR_PASSWORD" \
      --target-port 3000 \
      --ingress external \
      --min-replicas 1 \
      --max-replicas 3 \
      --cpu 0.5 \
      --memory 1Gi \
      --env-vars \
        "NEXT_PUBLIC_API_URL=$BACKEND_URL" \
        "NEXT_PUBLIC_ENVIRONMENT=staging" \
        "DOCKER_ENV=true"

    print_success "Frontend app created"
fi

# Get frontend URL
FRONTEND_URL=$(az containerapp show \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

FRONTEND_URL="https://$FRONTEND_URL"
print_success "Frontend URL: $FRONTEND_URL"

# Step 9: Update backend CORS and API_BASE_URL
print_step "Updating backend CORS settings and API_BASE_URL..."

# Get current backend environment and update ALLOWED_ORIGINS and API_BASE_URL
ALLOWED_ORIGINS="[\"$FRONTEND_URL\",\"http://localhost:3000\",\"http://localhost:8000\"]"

az containerapp update \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    "ALLOWED_ORIGINS=$ALLOWED_ORIGINS" \
    "API_BASE_URL=$BACKEND_URL"

print_success "Backend CORS and API_BASE_URL updated"

# Step 10: Wait for deployments to be ready
print_step "Waiting for containers to be ready..."
sleep 10

# Check backend health
print_step "Checking backend health..."
if curl -f -s "$BACKEND_URL/" > /dev/null; then
    print_success "Backend is healthy!"
else
    print_warning "Backend may not be ready yet. Check logs with:"
    echo "  az containerapp logs show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --follow"
fi

# Check frontend health
print_step "Checking frontend health..."
if curl -f -s "$FRONTEND_URL" > /dev/null; then
    print_success "Frontend is healthy!"
else
    print_warning "Frontend may not be ready yet. Check logs with:"
    echo "  az containerapp logs show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --follow"
fi

# Step 11: Display deployment summary
echo ""
echo "🎉 Deployment Complete!"
echo "======================="
echo ""
echo "📋 Deployment Summary:"
echo "====================="
echo "Resource Group:    $RESOURCE_GROUP"
echo "Environment:       $ENVIRONMENT_NAME"
echo "Image Tag:         $IMAGE_TAG"
echo ""
echo "🌐 Application URLs:"
echo "==================="
echo "Frontend:  $FRONTEND_URL"
echo "Backend:   $BACKEND_URL"
echo "API Docs:  $BACKEND_URL/docs"
echo ""
echo "📊 Monitoring Commands:"
echo "======================"
echo "View backend logs:"
echo "  az containerapp logs show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
echo "View frontend logs:"
echo "  az containerapp logs show --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
echo "View backend metrics:"
echo "  az containerapp show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --query properties.latestRevisionName -o tsv"
echo ""
echo "Scale backend manually:"
echo "  az containerapp update --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --min-replicas 2 --max-replicas 5"
echo ""
echo "💡 Next Steps:"
echo "============="
echo "1. Test the application: $FRONTEND_URL"
echo "2. Check API documentation: $BACKEND_URL/docs"
echo "3. Run database migrations if needed"
echo "4. Monitor logs for any errors"
echo "5. Set up custom domain (optional)"
echo ""

print_success "Staging deployment successful! 🚀"
