#!/bin/bash

# Azure PostgreSQL Flexible Server Setup for Pandiver Staging
# This script creates a complete staging environment with PostgreSQL

set -e

echo "🚀 Setting up Azure PostgreSQL Staging Environment for Pandiver"

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

# Set variables for staging
RESOURCE_GROUP="pandiver-staging-rg"
LOCATION="centralindia"
ENVIRONMENT_NAME="pandiver-staging-env"
ACR_NAME="pandiverstaging$(date +%s | tail -c 6)"
KEY_VAULT_NAME="kv-pandiver-staging-$(date +%s | tail -c 5)"
POSTGRES_SERVER_NAME="pandiver-staging"
POSTGRES_DB_NAME="pandiver_staging_db"
POSTGRES_ADMIN_USER="pandiver"
LOG_WORKSPACE_NAME="pandiver-staging-logs"

# PostgreSQL Configuration
POSTGRES_VERSION="15"
POSTGRES_TIER="Burstable"
POSTGRES_SKU="Standard_B1ms"
POSTGRES_STORAGE_SIZE=32  # GB
BACKUP_RETENTION_DAYS=7

echo ""
echo "🔧 Configuration Summary:"
echo "========================="
echo "Resource Group:        $RESOURCE_GROUP"
echo "Location:              $LOCATION"
echo "PostgreSQL Server:     $POSTGRES_SERVER_NAME"
echo "PostgreSQL Database:   $POSTGRES_DB_NAME"
echo "PostgreSQL Tier:       $POSTGRES_TIER ($POSTGRES_SKU)"
echo "PostgreSQL Version:    $POSTGRES_VERSION"
echo "Storage Size:          ${POSTGRES_STORAGE_SIZE}GB"
echo "Backup Retention:      ${BACKUP_RETENTION_DAYS} days"
echo "ACR Name:              $ACR_NAME"
echo "Key Vault:             $KEY_VAULT_NAME"
echo "Container Apps Env:    $ENVIRONMENT_NAME"
echo "Log Analytics:         $LOG_WORKSPACE_NAME"
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

# Step 2: Install/Update Container Apps extension
print_step "Installing/updating Container Apps extension..."
az extension add --name containerapp --upgrade --only-show-errors

# Step 3: Register required providers
print_step "Registering required providers..."
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.DBforPostgreSQL --wait

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
EXISTING_ACR=$(az acr list --resource-group $RESOURCE_GROUP --query "[?contains(name, 'pandiverstaging')].name" -o tsv | head -1)

if [ ! -z "$EXISTING_ACR" ]; then
    print_success "Found existing ACR: $EXISTING_ACR"
    ACR_NAME=$EXISTING_ACR
else
    print_step "Creating Azure Container Registry..."
    az acr create \
      --resource-group $RESOURCE_GROUP \
      --name $ACR_NAME \
      --sku Basic \
      --admin-enabled true
    print_success "ACR created: $ACR_NAME"
fi

# Step 6: Create Log Analytics workspace
print_step "Checking if Log Analytics workspace exists..."
if az monitor log-analytics workspace show --resource-group $RESOURCE_GROUP --workspace-name $LOG_WORKSPACE_NAME &>/dev/null; then
    print_success "Log Analytics workspace already exists: $LOG_WORKSPACE_NAME"
else
    print_step "Creating Log Analytics workspace..."
    az monitor log-analytics workspace create \
      --resource-group $RESOURCE_GROUP \
      --workspace-name $LOG_WORKSPACE_NAME \
      --location $LOCATION
    print_success "Log Analytics workspace created: $LOG_WORKSPACE_NAME"
fi

# Get workspace credentials
LOG_ANALYTICS_WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_WORKSPACE_NAME \
  --query customerId \
  --output tsv)

LOG_ANALYTICS_WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group $RESOURCE_GROUP \
  --workspace-name $LOG_WORKSPACE_NAME \
  --query primarySharedKey \
  --output tsv)

print_success "Log Analytics workspace configured"

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

# Step 8: Create PostgreSQL Flexible Server
print_step "Checking if PostgreSQL server exists..."
if az postgres flexible-server show --resource-group $RESOURCE_GROUP --name $POSTGRES_SERVER_NAME &>/dev/null; then
    print_success "PostgreSQL server already exists: $POSTGRES_SERVER_NAME"
    print_warning "Please enter the PostgreSQL admin password (for database URL creation):"
    read -s POSTGRES_ADMIN_PASSWORD
    echo ""
else
    print_step "Creating PostgreSQL Flexible Server..."
    echo ""
    print_warning "Please enter a strong password for PostgreSQL admin user '$POSTGRES_ADMIN_USER':"
    print_warning "(Minimum 8 characters, must include uppercase, lowercase, and digit)"
    read -s POSTGRES_ADMIN_PASSWORD
    echo ""

    print_step "This may take 5-10 minutes..."
    az postgres flexible-server create \
      --resource-group $RESOURCE_GROUP \
      --name $POSTGRES_SERVER_NAME \
      --location $LOCATION \
      --admin-user $POSTGRES_ADMIN_USER \
      --admin-password "$POSTGRES_ADMIN_PASSWORD" \
      --version $POSTGRES_VERSION \
      --tier $POSTGRES_TIER \
      --sku-name $POSTGRES_SKU \
      --storage-size $POSTGRES_STORAGE_SIZE \
      --backup-retention $BACKUP_RETENTION_DAYS \
      --high-availability Disabled \
      --public-access 0.0.0.0 \
      --yes

    print_success "PostgreSQL server created: $POSTGRES_SERVER_NAME"
fi

# Step 9: Create Database
print_step "Checking if database exists..."
if az postgres flexible-server db show --resource-group $RESOURCE_GROUP --server-name $POSTGRES_SERVER_NAME --database-name $POSTGRES_DB_NAME &>/dev/null; then
    print_success "Database already exists: $POSTGRES_DB_NAME"
else
    print_step "Creating database..."
    az postgres flexible-server db create \
      --resource-group $RESOURCE_GROUP \
      --server-name $POSTGRES_SERVER_NAME \
      --database-name $POSTGRES_DB_NAME
    print_success "Database created: $POSTGRES_DB_NAME"
fi

# Step 10: Configure firewall rules
print_step "Configuring firewall rules..."

# Allow Azure services
if az postgres flexible-server firewall-rule show \
    --resource-group $RESOURCE_GROUP \
    --name $POSTGRES_SERVER_NAME \
    --rule-name AllowAzureServices &>/dev/null; then
    print_success "Firewall rule 'AllowAzureServices' already exists"
else
    az postgres flexible-server firewall-rule create \
      --resource-group $RESOURCE_GROUP \
      --name $POSTGRES_SERVER_NAME \
      --rule-name AllowAzureServices \
      --start-ip-address 0.0.0.0 \
      --end-ip-address 0.0.0.0
    print_success "Firewall rule 'AllowAzureServices' created"
fi

# Allow all IPs (for development/debugging - remove in production)
print_warning "Creating firewall rule to allow all IPs (for staging debugging)"
if az postgres flexible-server firewall-rule show \
    --resource-group $RESOURCE_GROUP \
    --name $POSTGRES_SERVER_NAME \
    --rule-name AllowAllIPs &>/dev/null; then
    print_success "Firewall rule 'AllowAllIPs' already exists"
else
    az postgres flexible-server firewall-rule create \
      --resource-group $RESOURCE_GROUP \
      --name $POSTGRES_SERVER_NAME \
      --rule-name AllowAllIPs \
      --start-ip-address 0.0.0.0 \
      --end-ip-address 255.255.255.255
    print_success "Firewall rule 'AllowAllIPs' created"
fi

# Step 11: Get PostgreSQL connection details
print_step "Retrieving PostgreSQL connection details..."
POSTGRES_HOST="${POSTGRES_SERVER_NAME}.postgres.database.azure.com"
POSTGRES_PORT=5432

# Build connection string with SSL
DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB_NAME}?sslmode=require"

print_success "PostgreSQL connection string created"

# Step 12: Create Key Vault
print_step "Checking if Key Vault exists..."
EXISTING_KV=$(az keyvault list --resource-group $RESOURCE_GROUP --query "[?contains(name, 'kv-pandiver-staging')].name" -o tsv | head -1)

if [ ! -z "$EXISTING_KV" ]; then
    print_success "Found existing Key Vault: $EXISTING_KV"
    KEY_VAULT_NAME=$EXISTING_KV
else
    print_step "Creating Key Vault..."
    az keyvault create \
      --name $KEY_VAULT_NAME \
      --resource-group $RESOURCE_GROUP \
      --location $LOCATION \
      --enable-rbac-authorization true
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

# Step 13: Store secrets in Key Vault
print_step "Storing secrets in Key Vault..."

# Generate SECRET_KEY if not exists
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "secret-key" &>/dev/null; then
    print_success "Secret 'secret-key' already exists in Key Vault"
else
    print_step "Generating and storing secret-key..."
    SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "secret-key" --value "$SECRET_KEY"
    print_success "Secret 'secret-key' stored in Key Vault"
fi

# Store DATABASE_URL
if az keyvault secret show --vault-name $KEY_VAULT_NAME --name "staging-database-url" &>/dev/null; then
    print_warning "Updating existing 'staging-database-url' secret..."
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "staging-database-url" --value "$DATABASE_URL"
    print_success "Secret 'staging-database-url' updated in Key Vault"
else
    print_step "Storing staging database URL..."
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "staging-database-url" --value "$DATABASE_URL"
    print_success "Secret 'staging-database-url' stored in Key Vault"
fi

# Prompt for Azure service keys
echo ""
print_warning "Azure Service Keys Configuration"
print_warning "Press Enter to skip any key and add it later via Azure Portal"
echo ""

read -p "Azure Translator Key: " AZURE_TRANSLATOR_KEY
read -p "Azure Translator Region (default: centralindia): " AZURE_TRANSLATOR_REGION
AZURE_TRANSLATOR_REGION=${AZURE_TRANSLATOR_REGION:-centralindia}
read -p "Azure Document Intelligence Key: " AZURE_DOC_INTELLIGENCE_KEY
read -p "Azure Document Intelligence Endpoint: " AZURE_DOC_INTELLIGENCE_ENDPOINT
read -p "Azure Blob Storage Connection String: " AZURE_BLOB_CONNECTION_STRING

# Store Azure service keys if provided
if [ ! -z "$AZURE_TRANSLATOR_KEY" ]; then
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-key" --value "$AZURE_TRANSLATOR_KEY" --only-show-errors
    print_success "Azure Translator Key stored"
fi

if [ ! -z "$AZURE_TRANSLATOR_REGION" ]; then
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-translator-region" --value "$AZURE_TRANSLATOR_REGION" --only-show-errors
    print_success "Azure Translator Region stored"
fi

if [ ! -z "$AZURE_DOC_INTELLIGENCE_KEY" ]; then
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-key" --value "$AZURE_DOC_INTELLIGENCE_KEY" --only-show-errors
    print_success "Azure Document Intelligence Key stored"
fi

if [ ! -z "$AZURE_DOC_INTELLIGENCE_ENDPOINT" ]; then
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-doc-intelligence-endpoint" --value "$AZURE_DOC_INTELLIGENCE_ENDPOINT" --only-show-errors
    print_success "Azure Document Intelligence Endpoint stored"
fi

if [ ! -z "$AZURE_BLOB_CONNECTION_STRING" ]; then
    az keyvault secret set --vault-name $KEY_VAULT_NAME --name "azure-blob-connection-string" --value "$AZURE_BLOB_CONNECTION_STRING" --only-show-errors
    print_success "Azure Blob Storage Connection String stored"
fi

# Step 14: Create service principal for GitHub Actions (optional)
echo ""
read -p "Do you want to create a service principal for GitHub Actions CI/CD? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_step "Creating service principal for GitHub Actions..."

    SUBSCRIPTION_ID=$(az account show --query id --output tsv)
    SP_NAME="pandiver-github-staging"

    # Check if service principal already exists
    if SP_ID=$(az ad sp list --display-name $SP_NAME --query '[0].appId' --output tsv) && [ ! -z "$SP_ID" ]; then
        print_success "Service principal already exists: $SP_NAME"
        print_warning "Note: Cannot retrieve existing credentials. Create new ones if needed."
    else
        # Create service principal with contributor role
        SP_OUTPUT=$(az ad sp create-for-rbac \
          --name $SP_NAME \
          --role contributor \
          --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
          --sdk-auth)

        CLIENT_ID=$(echo $SP_OUTPUT | jq -r '.clientId')

        print_success "Service principal created: $SP_NAME"

        # Grant Key Vault access to service principal
        print_step "Granting Key Vault access to service principal..."

        KEY_VAULT_RESOURCE_ID="/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"

        az role assignment create \
          --role "Key Vault Secrets User" \
          --assignee $CLIENT_ID \
          --scope $KEY_VAULT_RESOURCE_ID

        print_success "Key Vault access granted to service principal"

        # Store credentials for later display
        SP_CREDENTIALS="$SP_OUTPUT"
    fi
fi

# Step 15: Test PostgreSQL connection
print_step "Testing PostgreSQL connection..."
if command -v psql &> /dev/null; then
    if PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" psql -h $POSTGRES_HOST -U $POSTGRES_ADMIN_USER -d $POSTGRES_DB_NAME -c "SELECT version();" &>/dev/null; then
        print_success "PostgreSQL connection test successful!"
    else
        print_warning "Could not verify PostgreSQL connection (this is okay - may need to wait for server to be fully ready)"
    fi
else
    print_warning "psql not found - skipping connection test"
fi

# Step 16: Display configuration summary
echo ""
echo "🎉 Azure PostgreSQL Staging Environment Setup Complete!"
echo "========================================================"
echo ""
echo "📋 Configuration Summary:"
echo "========================="
echo "Resource Group:             $RESOURCE_GROUP"
echo "Location:                   $LOCATION"
echo ""
echo "PostgreSQL Server:          $POSTGRES_SERVER_NAME"
echo "PostgreSQL Host:            $POSTGRES_HOST"
echo "PostgreSQL Port:            $POSTGRES_PORT"
echo "Database Name:              $POSTGRES_DB_NAME"
echo "Admin User:                 $POSTGRES_ADMIN_USER"
echo "PostgreSQL Version:         $POSTGRES_VERSION"
echo "Tier:                       $POSTGRES_TIER ($POSTGRES_SKU)"
echo "Storage:                    ${POSTGRES_STORAGE_SIZE}GB"
echo "Backup Retention:           ${BACKUP_RETENTION_DAYS} days"
echo ""
echo "Container Registry:         $ACR_NAME"
echo "Key Vault:                  $KEY_VAULT_NAME"
echo "Container Apps Environment: $ENVIRONMENT_NAME"
echo "Log Analytics Workspace:    $LOG_WORKSPACE_NAME"
echo ""

echo "🔑 Connection String (stored in Key Vault):"
echo "==========================================="
echo "SECRET NAME: staging-database-url"
echo "VALUE: $DATABASE_URL"
echo ""

echo "📝 Next Steps:"
echo "=============="
echo "1. Test database connection from your local machine:"
echo "   psql \"$DATABASE_URL\""
echo ""
echo "2. Run database migrations:"
echo "   cd backend"
echo "   DATABASE_URL=\"$DATABASE_URL\" alembic upgrade head"
echo ""
echo "3. Or migrate data from development PostgreSQL:"
echo "   python3 scripts/migrate_sqlite_to_postgres.py --target-db \"$DATABASE_URL\""
echo ""
echo "4. Build and push Docker images to ACR:"
echo "   az acr login --name $ACR_NAME"
echo "   docker build -t $ACR_NAME.azurecr.io/pandiver-backend:staging ./backend"
echo "   docker push $ACR_NAME.azurecr.io/pandiver-backend:staging"
echo "   docker build -t $ACR_NAME.azurecr.io/pandiver-frontend:staging ./frontend"
echo "   docker push $ACR_NAME.azurecr.io/pandiver-frontend:staging"
echo ""
echo "5. Deploy Container Apps (create deployment script or use Azure Portal)"
echo ""

if [ ! -z "$SP_CREDENTIALS" ]; then
    echo "🔐 GitHub Actions Secrets:"
    echo "=========================="
    echo "Add these secrets to your GitHub repository:"
    echo ""
    echo "AZURE_CREDENTIALS_STAGING:"
    echo "$SP_CREDENTIALS"
    echo ""
    echo "KEY_VAULT_NAME_STAGING: $KEY_VAULT_NAME"
    echo "ACR_NAME_STAGING: $ACR_NAME"
    echo "RESOURCE_GROUP_STAGING: $RESOURCE_GROUP"
    echo ""
fi

echo "💡 Tips:"
echo "========"
echo "• Access Key Vault secrets: az keyvault secret show --vault-name $KEY_VAULT_NAME --name <secret-name>"
echo "• View PostgreSQL logs: az postgres flexible-server server-logs list --resource-group $RESOURCE_GROUP --name $POSTGRES_SERVER_NAME"
echo "• Monitor with Azure Portal: https://portal.azure.com"
echo "• PostgreSQL connection string is in Key Vault secret: staging-database-url"
echo ""

print_success "Setup complete! Your Azure PostgreSQL staging environment is ready."
