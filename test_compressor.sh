#!/bin/bash

# PDF Compressor Testing Script
# This script tests the PDF Compression & Optimizer feature

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       PDF Compressor & Optimizer - Testing Suite              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
API_URL="http://localhost:8000"
TEST_PDF="sample-statements/ICICI bank.pdf"

# Check if test PDF exists
if [ ! -f "$TEST_PDF" ]; then
    echo -e "${RED}Error: Test PDF not found: $TEST_PDF${NC}"
    exit 1
fi

# Get file size
ORIGINAL_SIZE=$(stat -f%z "$TEST_PDF" 2>/dev/null || stat -c%s "$TEST_PDF" 2>/dev/null)
ORIGINAL_SIZE_MB=$(echo "scale=2; $ORIGINAL_SIZE / 1024 / 1024" | bc)
echo -e "${BLUE}Test PDF: $TEST_PDF${NC}"
echo -e "${BLUE}Original Size: ${ORIGINAL_SIZE_MB} MB${NC}"
echo ""

# Prompt for JWT token
echo -e "${YELLOW}Please provide your JWT token:${NC}"
echo -e "${YELLOW}You can get it from:${NC}"
echo -e "  1. Login at http://localhost:3000/auth/login"
echo -e "  2. Open browser console (F12)"
echo -e "  3. Run: localStorage.getItem('accessToken')"
echo ""
read -p "JWT Token: " JWT_TOKEN

if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}Error: JWT token is required${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━ Test 1: Get Compression Levels ━━━${NC}"
curl -s -X GET "$API_URL/api/v1/pdf-compressor/compression-levels" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'

echo ""
echo -e "${BLUE}━━━ Test 2: Analyze PDF ━━━${NC}"
ANALYZE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/pdf-compressor/analyze" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -F "file=@$TEST_PDF")

echo "$ANALYZE_RESPONSE" | jq '.'

# Extract estimated savings
LIGHT_SAVING=$(echo "$ANALYZE_RESPONSE" | jq -r '.estimated_savings.light.percentage')
MODERATE_SAVING=$(echo "$ANALYZE_RESPONSE" | jq -r '.estimated_savings.moderate.percentage')
AGGRESSIVE_SAVING=$(echo "$ANALYZE_RESPONSE" | jq -r '.estimated_savings.aggressive.percentage')

echo ""
echo -e "${GREEN}Estimated Savings:${NC}"
echo -e "  Light:      ${LIGHT_SAVING}%"
echo -e "  Moderate:   ${MODERATE_SAVING}%"
echo -e "  Aggressive: ${AGGRESSIVE_SAVING}%"

echo ""
echo -e "${BLUE}━━━ Test 3: Compress PDF (Moderate Level) ━━━${NC}"
COMPRESS_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/pdf-compressor/compress" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -F "file=@$TEST_PDF" \
    -F "compression_level=moderate")

echo "$COMPRESS_RESPONSE" | jq '.'
JOB_ID=$(echo "$COMPRESS_RESPONSE" | jq -r '.job_id')

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
    echo -e "${RED}Error: Failed to start compression job${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Job started with ID: $JOB_ID${NC}"

echo ""
echo -e "${BLUE}━━━ Test 4: Monitor Job Status ━━━${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    STATUS_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/pdf-compressor/jobs/$JOB_ID/status" \
        -H "Authorization: Bearer $JWT_TOKEN")

    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')

    if [ "$STATUS" = "COMPLETED" ]; then
        echo -e "${GREEN}✓ Job completed successfully!${NC}"
        echo "$STATUS_RESPONSE" | jq '.'

        # Extract compression stats
        COMPRESSED_SIZE=$(echo "$STATUS_RESPONSE" | jq -r '.compressed_size')
        REDUCTION_PCT=$(echo "$STATUS_RESPONSE" | jq -r '.size_reduction_percentage')

        if [ "$COMPRESSED_SIZE" != "null" ] && [ "$COMPRESSED_SIZE" != "0" ]; then
            COMPRESSED_SIZE_MB=$(echo "scale=2; $COMPRESSED_SIZE / 1024 / 1024" | bc)
            SAVED_SIZE=$(echo "$ORIGINAL_SIZE - $COMPRESSED_SIZE" | bc)
            SAVED_SIZE_MB=$(echo "scale=2; $SAVED_SIZE / 1024 / 1024" | bc)

            echo ""
            echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║         Compression Results                ║${NC}"
            echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
            echo -e "  Original Size:    ${ORIGINAL_SIZE_MB} MB"
            echo -e "  Compressed Size:  ${COMPRESSED_SIZE_MB} MB"
            echo -e "  Space Saved:      ${SAVED_SIZE_MB} MB (${REDUCTION_PCT}%)"
            echo ""
        fi

        break
    elif [ "$STATUS" = "FAILED" ]; then
        echo -e "${RED}✗ Job failed!${NC}"
        echo "$STATUS_RESPONSE" | jq '.'
        exit 1
    else
        echo -e "${YELLOW}Status: $STATUS (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS)${NC}"
        sleep 2
    fi

    ATTEMPT=$((ATTEMPT + 1))
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}Error: Job did not complete within timeout${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━ Test 5: Download Compressed PDF ━━━${NC}"
OUTPUT_FILE="/tmp/compressed_test.pdf"
HTTP_CODE=$(curl -s -w "%{http_code}" -o "$OUTPUT_FILE" -X GET \
    "$API_URL/api/v1/pdf-compressor/download/$JOB_ID" \
    -H "Authorization: Bearer $JWT_TOKEN")

if [ "$HTTP_CODE" = "200" ]; then
    DOWNLOAD_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
    DOWNLOAD_SIZE_MB=$(echo "scale=2; $DOWNLOAD_SIZE / 1024 / 1024" | bc)
    echo -e "${GREEN}✓ Download successful!${NC}"
    echo -e "  Saved to: $OUTPUT_FILE"
    echo -e "  File size: ${DOWNLOAD_SIZE_MB} MB"

    # Verify it's a valid PDF
    if file "$OUTPUT_FILE" | grep -q "PDF"; then
        echo -e "${GREEN}✓ Downloaded file is a valid PDF${NC}"
    else
        echo -e "${RED}✗ Downloaded file is not a valid PDF${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Download failed with HTTP code: $HTTP_CODE${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━ Test 6: List Recent Jobs ━━━${NC}"
curl -s -X GET "$API_URL/api/v1/pdf-compressor/jobs?limit=5" \
    -H "Authorization: Bearer $JWT_TOKEN" | jq '.'

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  ALL TESTS PASSED! ✓                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "You can now:"
echo -e "  1. Open the compressed PDF: open $OUTPUT_FILE"
echo -e "  2. Compare with original: open '$TEST_PDF'"
echo -e "  3. Check Swagger UI: http://localhost:8000/docs"
echo ""
