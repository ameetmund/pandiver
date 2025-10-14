#!/bin/bash

# Sync all required secrets from local .env to Azure Key Vault
# This script consolidates SAS tokens, translator secrets, and document intelligence secrets

set -e

# Configuration
KEY_VAULT_NAME="kv-pandiver-staging-8766"
ENV_FILE="environments/.env.staging"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Sync Secrets to Azure Key Vault for CI/CD Pipeline     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: $ENV_FILE not found!${NC}"
    exit 1
fi

echo -e "${YELLOW}Reading secrets from $ENV_FILE...${NC}"
echo ""

# ========== 1. SAS Tokens ==========
echo -e "${BLUE}━━━ 1. Azure Blob Storage SAS Tokens ━━━${NC}"

SRC_SAS_TOKEN=$(grep "^AZURE_BLOB_SRC_SAS_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
OUT_SAS_TOKEN=$(grep "^AZURE_BLOB_OUT_SAS_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
CONFIG_SAS_TOKEN=$(grep "^AZURE_BLOB_CONFIG_SAS_TOKEN=" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$SRC_SAS_TOKEN" ] || [ -z "$OUT_SAS_TOKEN" ] || [ -z "$CONFIG_SAS_TOKEN" ]; then
    echo -e "${RED}✗ Error: One or more SAS tokens not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Found all SAS tokens"

echo -n "  • azure-blob-src-sas-token... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-blob-src-sas-token --value "$SRC_SAS_TOKEN" --output none
echo -e "${GREEN}✓${NC}"

echo -n "  • azure-blob-out-sas-token... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-blob-out-sas-token --value "$OUT_SAS_TOKEN" --output none
echo -e "${GREEN}✓${NC}"

echo -n "  • azure-blob-config-sas-token... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-blob-config-sas-token --value "$CONFIG_SAS_TOKEN" --output none
echo -e "${GREEN}✓${NC}"
echo ""

# ========== 2. Document Translator ==========
echo -e "${BLUE}━━━ 2. Azure Document Translator ━━━${NC}"

DOC_TRANSLATOR_KEY=$(grep "^AZURE_DOC_TRANSLATOR_KEY=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DOC_TRANSLATOR_REGION=$(grep "^AZURE_DOC_TRANSLATOR_REGION=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DOC_TRANSLATOR_ENDPOINT=$(grep "^AZURE_DOC_TRANSLATOR_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DOC_TRANSLATOR_KEY" ] || [ -z "$DOC_TRANSLATOR_REGION" ] || [ -z "$DOC_TRANSLATOR_ENDPOINT" ]; then
    echo -e "${RED}✗ Error: One or more DOC_TRANSLATOR variables not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Found all DOC_TRANSLATOR variables"

echo -n "  • azure-doc-translator-key... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-doc-translator-key --value "$DOC_TRANSLATOR_KEY" --output none
echo -e "${GREEN}✓${NC}"

echo -n "  • azure-doc-translator-region... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-doc-translator-region --value "$DOC_TRANSLATOR_REGION" --output none
echo -e "${GREEN}✓${NC}"

echo -n "  • azure-doc-translator-endpoint... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-doc-translator-endpoint --value "$DOC_TRANSLATOR_ENDPOINT" --output none
echo -e "${GREEN}✓${NC}"
echo ""

# ========== 3. Document Intelligence ==========
echo -e "${BLUE}━━━ 3. Azure Document Intelligence ━━━${NC}"

DOC_INTELLIGENCE_KEY=$(grep "^AZURE_DOCUMENT_INTELLIGENCE_KEY=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DOC_INTELLIGENCE_ENDPOINT=$(grep "^AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DOC_INTELLIGENCE_KEY" ] || [ -z "$DOC_INTELLIGENCE_ENDPOINT" ]; then
    echo -e "${RED}✗ Error: DOCUMENT_INTELLIGENCE variables not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Found all DOCUMENT_INTELLIGENCE variables"

echo -n "  • azure-document-intelligence-key... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-document-intelligence-key --value "$DOC_INTELLIGENCE_KEY" --output none
echo -e "${GREEN}✓${NC}"

echo -n "  • azure-document-intelligence-endpoint... "
az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name azure-document-intelligence-endpoint --value "$DOC_INTELLIGENCE_ENDPOINT" --output none
echo -e "${GREEN}✓${NC}"
echo ""

# ========== Summary ==========
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                          SUCCESS!                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ All 8 secrets synced to Key Vault: $KEY_VAULT_NAME${NC}"
echo ""
echo "Secrets added:"
echo "  • 3 SAS tokens (blob storage)"
echo "  • 3 Document Translator credentials"
echo "  • 2 Document Intelligence credentials"
echo ""
echo "These secrets will be automatically used by GitHub Actions CI/CD workflows."
echo ""
echo "To verify:"
echo -e "  ${YELLOW}az keyvault secret list --vault-name $KEY_VAULT_NAME --query \"[].name\" -o table${NC}"
