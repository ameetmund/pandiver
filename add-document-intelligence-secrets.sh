#!/bin/bash

# Add AZURE_DOCUMENT_INTELLIGENCE_* secrets to Key Vault (with "UMENT")

set -e

KEY_VAULT_NAME="kv-pandiver-staging-8766"
ENV_FILE="backend/.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Adding AZURE_DOCUMENT_INTELLIGENCE_* Secrets to Key Vault ===${NC}"
echo ""

echo "Reading secrets from $ENV_FILE..."

DOC_INTELLIGENCE_KEY=$(grep "^AZURE_DOCUMENT_INTELLIGENCE_KEY=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DOC_INTELLIGENCE_ENDPOINT=$(grep "^AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DOC_INTELLIGENCE_KEY" ] || [ -z "$DOC_INTELLIGENCE_ENDPOINT" ]; then
  echo "Error: AZURE_DOCUMENT_INTELLIGENCE_* variables not found in $ENV_FILE"
  exit 1
fi

echo -e "${GREEN}✓${NC} Found AZURE_DOCUMENT_INTELLIGENCE_* variables"
echo ""

echo "Adding to Key Vault: $KEY_VAULT_NAME..."

az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-document-intelligence-key \
  --value "$DOC_INTELLIGENCE_KEY" \
  --output none
echo -e "  ${GREEN}✓${NC} azure-document-intelligence-key"

az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-document-intelligence-endpoint \
  --value "$DOC_INTELLIGENCE_ENDPOINT" \
  --output none
echo -e "  ${GREEN}✓${NC} azure-document-intelligence-endpoint"

echo ""
echo -e "${GREEN}=== Success! ===${NC}"
echo "Added AZURE_DOCUMENT_INTELLIGENCE_* secrets to Key Vault"
echo ""
echo "These will be used by azure_document_intelligence.py for intelligent data parsing"
