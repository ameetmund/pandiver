#!/bin/bash

# Add missing AZURE_DOC_TRANSLATOR_* secrets to Key Vault
# Only adds: azure-doc-translator-key, azure-doc-translator-region, azure-doc-translator-endpoint

set -e

KEY_VAULT_NAME="kv-pandiver-staging-8766"
ENV_FILE="backend/.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Adding Missing AZURE_DOC_TRANSLATOR_* Secrets to Key Vault ===${NC}"
echo ""

echo "Reading secrets from $ENV_FILE..."

DOC_TRANSLATOR_KEY=$(grep "^AZURE_DOC_TRANSLATOR_KEY=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DOC_TRANSLATOR_REGION=$(grep "^AZURE_DOC_TRANSLATOR_REGION=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
DOC_TRANSLATOR_ENDPOINT=$(grep "^AZURE_DOC_TRANSLATOR_ENDPOINT=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")

if [ -z "$DOC_TRANSLATOR_KEY" ] || [ -z "$DOC_TRANSLATOR_REGION" ] || [ -z "$DOC_TRANSLATOR_ENDPOINT" ]; then
  echo "Error: One or more AZURE_DOC_TRANSLATOR_* variables not found in $ENV_FILE"
  exit 1
fi

echo -e "${GREEN}✓${NC} Found all three AZURE_DOC_TRANSLATOR_* variables"
echo ""

echo "Adding to Key Vault: $KEY_VAULT_NAME..."

az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-doc-translator-key \
  --value "$DOC_TRANSLATOR_KEY" \
  --output none
echo -e "  ${GREEN}✓${NC} azure-doc-translator-key"

az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-doc-translator-region \
  --value "$DOC_TRANSLATOR_REGION" \
  --output none
echo -e "  ${GREEN}✓${NC} azure-doc-translator-region"

az keyvault secret set \
  --vault-name "$KEY_VAULT_NAME" \
  --name azure-doc-translator-endpoint \
  --value "$DOC_TRANSLATOR_ENDPOINT" \
  --output none
echo -e "  ${GREEN}✓${NC} azure-doc-translator-endpoint"

echo ""
echo -e "${GREEN}=== Success! ===${NC}"
echo "Added 3 missing secrets to Key Vault: $KEY_VAULT_NAME"
echo ""
echo "These will be used by the PDF translator service (azure_doc_translation_service.py)"
