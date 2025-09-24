#!/bin/bash

# Azure Container Apps Setup Script for Pandiver
# This script sets up the complete Azure infrastructure for Container Apps deployment

set -e

echo "🚀 Setting up Azure Container Apps for Pandiver SaaS"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first:"
    echo "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

print_success "Azure CLI found"

# Set variables (you can modify these)
RESOURCE_GROUP="pandiver-containerapp-rg"
LOCATION="centralindia"
ENVIRONMENT_NAME="pandiver-env"
ACR_NAME="pandiveracr$(date +%s | tail -c 6)"  # Add random suffix to ensure uniqueness
KEY_VAULT_NAME="kv-pandiver-$(date +%s | tail -c 6)"
SQL_SERVER_NAME="pandiver-sql-$(date +%s | tail -c 6)"

echo "🔧 Configuration:"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "ACR Name: $ACR_NAME"
echo "Key Vault: $KEY_VAULT_NAME"
echo "SQL Server: $SQL_SERVER_NAME"
echo ""

read -p "Do you want to continue with this configuration? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 1
fi

# Step 1: Login to Azure
print_step "Logging into Azure..."
az login

# Step 2: Install Container Apps extension
print_step "Installing Container Apps extension..."
az extension add --name containerapp --upgrade

# Step 3: Register providers
print_step "Registering required providers..."
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

print_success "Providers registered"

# Step 4: Create resource group
print_step "Checking if resource group exists..."
if az group show --name $RESOURCE_GROUP &>/dev/null; then
    print_success "Resource group already exists: $RESOURCE_GROUP"
else
    print_step "Creating resource group..."
    az group create --name $RESOURCE_GROUP --location $LOCATION
    print_success "Resource group created: $RESOURCE_GROUP"
fi

# Step 5: Create Azure Container Registry
print_step "Checking if Azure Container Registry exists..."
if az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    print_success "ACR already exists: $ACR_NAME"
else
    # Check if Microsoft.ContainerRegistry is registered
    REGISTRY_STATUS=$(az provider show --namespace Microsoft.ContainerRegistry --query registrationState --output tsv)
    if [ "$REGISTRY_STATUS" != "Registered" ]; then
        print_warning "Microsoft.ContainerRegistry not registered (status: $REGISTRY_STATUS)"
        print_warning "Skipping ACR creation for now. You can create it later with:"
        print_warning "az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled true"
    else
        print_step "Creating Azure Container Registry..."
        az acr create \
          --resource-group $RESOURCE_GROUP \
          --name $ACR_NAME \
          --sku Basic \
          --admin-enabled true
        print_success "ACR created: $ACR_NAME"
    fi
fi

# Step 6: Create Log Analytics workspace
print_step "Checking if Log Analytics workspace exists..."
if az monitor log-analytics workspace show --resource-group $RESOURCE_GROUP --workspace-name pandiver-logs &>/dev/null; then
    print_success "Log Analytics workspace already exists: pandiver-logs"
else
    print_step "Creating Log Analytics workspace..."
    az monitor log-analytics workspace create \
      --resource-group $RESOURCE_GROUP \
      --workspace-name pandiver-logs \
      --location $LOCATION
    print_success "Log Analytics workspace created: pandiver-logs"
fi

# Get workspace credentials
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

print_success "Log Analytics workspace created"

# Step 7: Create Container Apps Environment
print_step "Checking if Container Apps Environment exists..."
if az containerapp env show --name $ENVIRONMENT_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    print_success "Container Apps Environment already exists: $ENVIRONMENT_NAME"
else
    print_step "Creating Container Apps Environment..."
    az containerapp env create \
      --name $ENVIRONMENT_NAME \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --logs-workspace-id $LOG_ANALYTICS_WORKSPACE_ID \
      --logs-workspace-key $LOG_ANALYTICS_WORKSPACE_KEY
    print_success "Container Apps Environment created: $ENVIRONMENT_NAME"
fi

# Step 8: Create SQL Server and Databases
print_step "Checking if SQL Server exists..."
if az sql server show --name $SQL_SERVER_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    print_success "SQL Server already exists: $SQL_SERVER_NAME"
    # Still need password for database URL creation
    echo ""
    print_warning "Please enter the SQL Server admin password (for database URL creation):"
    read -s SQL_ADMIN_PASSWORD
    echo ""
else
    print_step "Creating SQL Server..."
    # Prompt for SQL admin password
    echo ""
    print_warning "Please enter a strong password for SQL Server admin (minimum 8 characters, must include uppercase, lowercase, digit, and special character):"
    read -s SQL_ADMIN_PASSWORD
    echo ""

    az sql server create \
      --name $SQL_SERVER_NAME \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --admin-user panadmin \
      --admin-password "$SQL_ADMIN_PASSWORD"
    print_success "SQL Server created: $SQL_SERVER_NAME"
fi

# Create databases
print_step "Checking if staging database exists..."
if az sql db show --resource-group $RESOURCE_GROUP --server $SQL_SERVER_NAME --name pandiver-staging-db &>/dev/null; then
    print_success "Staging database already exists: pandiver-staging-db"
else
    print_step "Creating staging database..."
    az sql db create \
      --resource-group $RESOURCE_GROUP \
      --server $SQL_SERVER_NAME \
      --name pandiver-staging-db \
      --service-objective Basic
    print_success "Staging database created: pandiver-staging-db"
fi

print_step "Checking if production database exists..."
if az sql db show --resource-group $RESOURCE_GROUP --server $SQL_SERVER_NAME --name pandiver-production-db &>/dev/null; then
    print_success "Production database already exists: pandiver-production-db"
else
    print_step "Creating production database..."
    az sql db create \
      --resource-group $RESOURCE_GROUP \
      --server $SQL_SERVER_NAME \
      --name pandiver-production-db \
      --service-objective S2
    print_success "Production database created: pandiver-production-db"
fi

# Configure firewall
print_step "Checking firewall rule..."
if az sql server firewall-rule show --resource-group $RESOURCE_GROUP --server $SQL_SERVER_NAME --name AllowAzureServices &>/dev/null; then
    print_success "Firewall rule already exists: AllowAzureServices"
else
    print_step "Creating firewall rule..."
    az sql server firewall-rule create \
      --resource-group $RESOURCE_GROUP \
      --server $SQL_SERVER_NAME \
      --name AllowAzureServices \
      --start-ip-address 0.0.0.0 \
      --end-ip-address 0.0.0.0
    print_success "Firewall rule created: AllowAzureServices"
fi

# Step 9: Create Key Vault
print_step "Checking if Key Vault exists..."
if az keyvault show --name $KEY_VAULT_NAME --resource-group $RESOURCE_GROUP &>/dev/null; then
    print_success "Key Vault already exists: $KEY_VAULT_NAME"
else
    print_step "Creating Key Vault..."
    az keyvault create \
      --name $KEY_VAULT_NAME \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION
    print_success "Key Vault created: $KEY_VAULT_NAME"

    # Add permissions for current user
    print_step "Adding Key Vault permissions for current user..."
    USER_ID=$(az ad signed-in-user show --query id --output tsv)
    az role assignment create \
      --role "Key Vault Administrator" \
      --assignee $USER_ID \
      --scope "/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"
    print_success "Key Vault permissions added"

    print_warning "Waiting 30 seconds for permissions to propagate..."
    sleep 30
fi

# Step 10: Store secrets in Key Vault
print_step "Checking and storing secrets in Key Vault..."

# Check if secret-key exists
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "secret-key" &>/dev/null; then
    print_success "Secret 'secret-key' already exists in Key Vault"
else
    print_step "Generating and storing secret-key..."
    # Generate a strong secret key
    SECRET_KEY=$(openssl rand -base64 32)
    # Store secrets
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "secret-key" --value "$SECRET_KEY"
    print_success "Secret 'secret-key' stored in Key Vault"
fi

# Database URLs
STAGING_DB_URL="postgresql://panadmin:$SQL_ADMIN_PASSWORD@$SQL_SERVER_NAME.database.windows.net:1433/pandiver-staging-db?sslmode=require"
PRODUCTION_DB_URL="postgresql://panadmin:$SQL_ADMIN_PASSWORD@$SQL_SERVER_NAME.database.windows.net:1433/pandiver-production-db?sslmode=require"

# Check and store staging database URL
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "staging-database-url" &>/dev/null; then
    print_success "Secret 'staging-database-url' already exists in Key Vault"
else
    print_step "Storing staging database URL..."
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "staging-database-url" --value "$STAGING_DB_URL"
    print_success "Secret 'staging-database-url' stored in Key Vault"
fi

# Check and store production database URL
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "production-database-url" &>/dev/null; then
    print_success "Secret 'production-database-url' already exists in Key Vault"
else
    print_step "Storing production database URL..."
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "production-database-url" --value "$PRODUCTION_DB_URL"
    print_success "Secret 'production-database-url' stored in Key Vault"
fi

# Prompt for Azure service keys
echo ""
print_warning "Please enter your Azure service keys (press Enter to skip and add later):"

# Set your Azure service keys (replace with your actual keys)
AZURE_TRANSLATOR_KEY="${AZURE_TRANSLATOR_KEY:-your-translator-key-here}"
AZURE_TRANSLATOR_REGION="${AZURE_TRANSLATOR_REGION:-centralindia}"
AZURE_DOC_INTELLIGENCE_KEY="${AZURE_DOC_INTELLIGENCE_KEY:-your-doc-intelligence-key-here}"
AZURE_DOC_INTELLIGENCE_ENDPOINT="${AZURE_DOC_INTELLIGENCE_ENDPOINT:-https://pandiver-pdf-extract.cognitiveservices.azure.com/}"

read -p "Azure Translator Key: " AZURE_TRANSLATOR_KEY
read -p "Azure Translator Region (e.g., centralindia): " AZURE_TRANSLATOR_REGION
read -p "Azure Doc Intelligence Key: " AZURE_DOC_INTELLIGENCE_KEY
read -p "Azure Doc Intelligence Endpoint: " AZURE_DOC_INTELLIGENCE_ENDPOINT

# Store Azure service keys only if provided and not already existing
if [ ! -z "$AZURE_TRANSLATOR_KEY" ]; then
    if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "azure-translator-key" &>/dev/null; then
        print_success "Secret 'azure-translator-key' already exists in Key Vault"
    else
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-key" --value "$AZURE_TRANSLATOR_KEY"
        print_success "Secret 'azure-translator-key' stored in Key Vault"
    fi
fi

if [ ! -z "$AZURE_TRANSLATOR_REGION" ]; then
    if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "azure-translator-region" &>/dev/null; then
        print_success "Secret 'azure-translator-region' already exists in Key Vault"
    else
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-region" --value "$AZURE_TRANSLATOR_REGION"
        print_success "Secret 'azure-translator-region' stored in Key Vault"
    fi
fi

if [ ! -z "$AZURE_DOC_INTELLIGENCE_KEY" ]; then
    if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-key" &>/dev/null; then
        print_success "Secret 'azure-doc-intelligence-key' already exists in Key Vault"
    else
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-key" --value "$AZURE_DOC_INTELLIGENCE_KEY"
        print_success "Secret 'azure-doc-intelligence-key' stored in Key Vault"
    fi
fi

if [ ! -z "$AZURE_DOC_INTELLIGENCE_ENDPOINT" ]; then
    if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-endpoint" &>/dev/null; then
        print_success "Secret 'azure-doc-intelligence-endpoint' already exists in Key Vault"
    else
        az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-endpoint" --value "$AZURE_DOC_INTELLIGENCE_ENDPOINT"
        print_success "Secret 'azure-doc-intelligence-endpoint' stored in Key Vault"
    fi
fi

print_success "Secrets stored in Key Vault"

# Step 11: Create service principal for GitHub Actions
print_step "Checking if service principal exists..."

SUBSCRIPTION_ID=$(az account show --query id --output tsv)
SP_NAME="pandiver-github-actions"

# Check if service principal already exists
if SP_ID=$(az ad sp list --display-name $SP_NAME --query '[0].appId' --output tsv) && [ ! -z "$SP_ID" ]; then
    print_success "Service principal already exists: $SP_NAME"
    # Get existing service principal details
    SP_OUTPUT=$(az ad sp show --id $SP_ID --query '{"clientId":appId,"displayName":displayName,"name":servicePrincipalNames[0],"tenantId":"'$(az account show --query tenantId --output tsv)'"}')
    print_warning "Note: Cannot retrieve client secret for existing service principal. You may need to create new credentials if needed."
else
    print_step "Creating service principal for GitHub Actions..."
    # Create service principal with contributor role
    SP_OUTPUT=$(az ad sp create-for-rbac \
      --name $SP_NAME \
      --role contributor \
      --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
      --sdk-auth)
    print_success "Service principal created: $SP_NAME"
fi

# Step 12: Grant Key Vault access to service principal
print_step "Checking Key Vault access for service principal..."

# Extract the clientId from the service principal output
CLIENT_ID=$(echo $SP_OUTPUT | jq -r '.clientId')

# Check if Key Vault uses RBAC or access policies
KEY_VAULT_RBAC=$(az keyvault show --name $KEY_VAULT_NAME --query properties.enableRbacAuthorization --output tsv)

if [ "$KEY_VAULT_RBAC" = "true" ]; then
    print_step "Key Vault uses RBAC authorization - assigning role..."

    # Get Key Vault resource ID
    KEY_VAULT_RESOURCE_ID="/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"

    # Check if role assignment already exists
    if az role assignment list --assignee $CLIENT_ID --scope $KEY_VAULT_RESOURCE_ID --role "Key Vault Secrets User" --query '[0].id' --output tsv | grep -q "/"; then
        print_success "RBAC role already assigned for service principal"
    else
        # Assign Key Vault Secrets User role
        az role assignment create \
          --role "Key Vault Secrets User" \
          --assignee $CLIENT_ID \
          --scope $KEY_VAULT_RESOURCE_ID
        print_success "RBAC role 'Key Vault Secrets User' assigned to service principal"
    fi
else
    print_step "Key Vault uses access policies - setting policy..."

    # Check if policy already exists
    if az keyvault show --name $KEY_VAULT_NAME --query "properties.accessPolicies[?objectId=='$(az ad sp show --id $CLIENT_ID --query id --output tsv)']" --output tsv | grep -q "get"; then
        print_success "Key Vault access policy already exists for service principal"
    else
        # Grant Key Vault permissions using access policy
        az keyvault set-policy \
          --name $KEY_VAULT_NAME \
          --spn $CLIENT_ID \
          --secret-permissions get list
        print_success "Key Vault access policy granted to service principal"
    fi
fi

# Step 13: Display configuration summary
echo ""
echo "🎉 Azure Container Apps setup completed successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "========================"
echo "Resource Group: $RESOURCE_GROUP"
echo "ACR Name: $ACR_NAME"
echo "Key Vault Name: $KEY_VAULT_NAME"
echo "SQL Server: $SQL_SERVER_NAME"
echo "Container Apps Environment: $ENVIRONMENT_NAME"
echo ""

echo "🔑 GitHub Secrets to Configure:"
echo "==============================="
echo "AZURE_CREDENTIALS: (copy the entire JSON below)"
echo "$SP_OUTPUT"
echo ""
echo "KEY_VAULT_NAME: $KEY_VAULT_NAME"
echo "ACR_NAME: $ACR_NAME"
echo "PRODUCTION_SQL_SERVER: $SQL_SERVER_NAME"
echo "PRODUCTION_DATABASE: pandiver-production-db"
echo "SQL_ADMIN_USER: panadmin"
echo "SQL_ADMIN_PASSWORD: [your password]"
echo ""

echo "📝 Next Steps:"
echo "============="
echo "1. Add the above secrets to your GitHub repository settings"
echo "2. Build and push your first images:"
echo "   az acr login --name $ACR_NAME"
echo "   docker build -f docker/backend/Dockerfile.prod -t $ACR_NAME.azurecr.io/pandiver-backend:latest ./backend"
echo "   docker push $ACR_NAME.azurecr.io/pandiver-backend:latest"
echo "   docker build -f docker/frontend/Dockerfile.prod -t $ACR_NAME.azurecr.io/pandiver-frontend:latest ./frontend"
echo "   docker push $ACR_NAME.azurecr.io/pandiver-frontend:latest"
echo ""
echo "3. Push to 'main' branch to trigger staging deployment"
echo "4. Create a release to trigger production deployment"
echo ""

print_success "Setup complete! Your Azure Container Apps infrastructure is ready."