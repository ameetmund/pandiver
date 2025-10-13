#!/bin/bash

# Script to add SAS tokens from local .env to Azure Key Vault
# This is required for GitHub Actions CI/CD pipeline

set -e

# Configuration
KEY_VAULT_NAME="kv-pandiver-staging-8766"
ENV_FILE="backend/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Adding SAS Tokens to Azure Key Vault ===${NC}\n"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: $ENV_FILE not found!${NC}"
    exit 1
fi

# Extract SAS tokens from .env file
echo "Reading SAS tokens from $ENV_FILE..."
SRC_SAS_TOKEN=$(grep "^AZURE_BLOB_SRC_SAS_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
OUT_SAS_TOKEN=$(grep "^AZURE_BLOB_OUT_SAS_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
CONFIG_SAS_TOKEN=$(grep "^AZURE_BLOB_CONFIG_SAS_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

# Validate tokens exist
if [ -z "$SRC_SAS_TOKEN" ] || [ -z "$OUT_SAS_TOKEN" ] || [ -z "$CONFIG_SAS_TOKEN" ]; then
    echo -e "${RED}Error: One or more SAS tokens not found in $ENV_FILE${NC}"
    echo "Required variables:"
    echo "  - AZURE_BLOB_SRC_SAS_TOKEN"
    echo "  - AZURE_BLOB_OUT_SAS_TOKEN"
    echo "  - AZURE_BLOB_CONFIG_SAS_TOKEN"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found all three SAS tokens\n"

# Add tokens to Key Vault (using lowercase with hyphens as per staging-deploy.yml)
echo "Adding SAS tokens to Key Vault: $KEY_VAULT_NAME..."

echo -n "  • azure-blob-src-sas-token... "
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-blob-src-sas-token \
  --value "$SRC_SAS_TOKEN" \
  --output none
echo -e "${GREEN}✓${NC}"

echo -n "  • azure-blob-out-sas-token... "
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-blob-out-sas-token \
  --value "$OUT_SAS_TOKEN" \
  --output none
echo -e "${GREEN}✓${NC}"

echo -n "  • azure-blob-config-sas-token... "
az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-blob-config-sas-token \
  --value "$CONFIG_SAS_TOKEN" \
  --output none
echo -e "${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}=== Success! ===${NC}"
echo "All SAS tokens have been added to Key Vault: $KEY_VAULT_NAME"
echo ""
echo "These secrets will be used by GitHub Actions workflows:"
echo "  • azure-blob-src-sas-token   → AZURE_BLOB_SRC_SAS_TOKEN"
echo "  • azure-blob-out-sas-token   → AZURE_BLOB_OUT_SAS_TOKEN"
echo "  • azure-blob-config-sas-token → AZURE_BLOB_CONFIG_SAS_TOKEN"
echo ""
echo "To verify:"
echo "  az keyvault secret list --vault-name $KEY_VAULT_NAME --query \"[?contains(name, 'sas')].name\" -o table"
