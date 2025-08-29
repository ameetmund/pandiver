#!/bin/bash

# Pandiver API v2.0 - cURL Testing Script
# 
# This script demonstrates how to test all API endpoints using cURL
# Make sure the server is running: uvicorn app.main:app --reload

set -e  # Exit on any error

# Configuration
BASE_URL="http://localhost:8000"
API_BASE="$BASE_URL/api/v1"
JWT_TOKEN=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Test server connectivity
test_server() {
    print_header "Testing Server Connectivity"
    
    if curl -s "$BASE_URL/" > /dev/null; then
        print_success "Server is running at $BASE_URL"
        return 0
    else
        print_error "Cannot connect to server at $BASE_URL"
        print_warning "Make sure the server is running with: uvicorn app.main:app --reload"
        exit 1
    fi
}

# Authenticate and get JWT token
authenticate() {
    print_header "Authentication"
    
    print_warning "This test requires valid credentials."
    print_warning "Update the EMAIL and PASSWORD variables below."
    
    # Replace with valid credentials
    EMAIL="test@example.com"
    PASSWORD="testpassword"
    
    # Register user (might fail if already exists)
    echo "Attempting to register user..."
    curl -s -X POST "$BASE_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Test User\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || true
    
    echo -e "\nAuthenticating..."
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
    
    if echo "$RESPONSE" | grep -q "access_token"; then
        JWT_TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
        print_success "Authentication successful"
        echo "JWT Token: ${JWT_TOKEN:0:20}..."
        return 0
    else
        print_error "Authentication failed"
        echo "Response: $RESPONSE"
        print_warning "Please update EMAIL and PASSWORD variables in this script"
        exit 1
    fi
}

# Create a test PDF file
create_test_pdf() {
    print_header "Creating Test PDF"
    
    TEST_PDF="test_statement.pdf"
    
    # Create a simple PDF using echo (not a real PDF, but good enough for testing upload)
    cat > "$TEST_PDF" << 'EOF'
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Bank Statement) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000174 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
268
%%EOF
EOF
    
    print_success "Created test PDF: $TEST_PDF"
}

# Test single file processing
test_single_file_processing() {
    print_header "Testing Single File Processing"
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "No JWT token available. Run authenticate first."
        return 1
    fi
    
    echo "Processing single file..."
    RESPONSE=$(curl -s -X POST "$API_BASE/process" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -F "file=@$TEST_PDF" \
        -F "extraction_method=smart" \
        -F 'metadata={"test_type":"curl_test"}')
    
    if echo "$RESPONSE" | grep -q "job_id"; then
        JOB_ID=$(echo "$RESPONSE" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)
        print_success "Single file processing started. Job ID: $JOB_ID"
        
        # Test job status
        echo "Checking job status..."
        STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_BASE/jobs/$JOB_ID/status")
        
        if echo "$STATUS_RESPONSE" | grep -q "status"; then
            STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
            print_success "Job status retrieved: $STATUS"
        else
            print_error "Failed to get job status"
            echo "Response: $STATUS_RESPONSE"
        fi
        
        return 0
    else
        print_error "Single file processing failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test webhook management
test_webhook_management() {
    print_header "Testing Webhook Management"
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "No JWT token available. Run authenticate first."
        return 1
    fi
    
    echo "Creating webhook endpoint..."
    RESPONSE=$(curl -s -X POST "$API_BASE/webhooks/endpoints" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "url": "https://webhook.site/unique-test-id",
            "events": ["processing.completed", "processing.failed"],
            "description": "Test webhook from curl script"
        }')
    
    if echo "$RESPONSE" | grep -q "webhook_id"; then
        WEBHOOK_ID=$(echo "$RESPONSE" | grep -o '"webhook_id":"[^"]*"' | cut -d'"' -f4)
        print_success "Webhook created. ID: $WEBHOOK_ID"
        
        # List webhooks
        echo "Listing webhooks..."
        LIST_RESPONSE=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_BASE/webhooks/endpoints")
        
        if echo "$LIST_RESPONSE" | grep -q "webhooks"; then
            print_success "Webhooks listed successfully"
        else
            print_error "Failed to list webhooks"
        fi
        
        # Test webhook
        echo "Testing webhook..."
        TEST_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer $JWT_TOKEN" \
            "$API_BASE/webhooks/endpoints/$WEBHOOK_ID/test")
        
        if echo "$TEST_RESPONSE" | grep -q "success"; then
            print_success "Webhook test sent"
        else
            print_error "Webhook test failed"
            echo "Response: $TEST_RESPONSE"
        fi
        
        return 0
    else
        print_error "Webhook creation failed"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test bulk file processing
test_bulk_processing() {
    print_header "Testing Bulk File Processing"
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "No JWT token available. Run authenticate first."
        return 1
    fi
    
    # Create additional test files
    cp "$TEST_PDF" "test_bulk_1.pdf"
    cp "$TEST_PDF" "test_bulk_2.pdf"
    
    echo "Processing multiple files..."
    RESPONSE=$(curl -s -X POST "$API_BASE/process-bulk" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -F "files=@test_bulk_1.pdf" \
        -F "files=@test_bulk_2.pdf" \
        -F "extraction_method=smart" \
        -F "max_concurrent_jobs=2")
    
    if echo "$RESPONSE" | grep -q "bulk_job_id"; then
        BULK_JOB_ID=$(echo "$RESPONSE" | grep -o '"bulk_job_id":"[^"]*"' | cut -d'"' -f4)
        print_success "Bulk processing started. Bulk Job ID: $BULK_JOB_ID"
    else
        print_error "Bulk processing failed"
        echo "Response: $RESPONSE"
    fi
    
    # Clean up
    rm -f test_bulk_1.pdf test_bulk_2.pdf
}

# Test watch folder endpoints
test_watch_folder() {
    print_header "Testing Watch Folder Endpoints"
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "No JWT token available. Run authenticate first."
        return 1
    fi
    
    print_warning "Watch folder test requires valid AWS S3 credentials"
    print_warning "This test will attempt to create a watch folder but may fail"
    
    echo "Attempting to create S3 watch folder..."
    RESPONSE=$(curl -s -X POST "$API_BASE/watch-folders" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "folder_type": "s3",
            "folder_path": "test-folder/",
            "credentials": {
                "aws_access_key_id": "DUMMY_KEY",
                "aws_secret_access_key": "DUMMY_SECRET",
                "bucket_name": "test-bucket",
                "region": "us-east-1"
            },
            "poll_interval_hours": 24,
            "extraction_method": "smart",
            "auto_delete_processed": false,
            "file_patterns": ["*.pdf"]
        }')
    
    if echo "$RESPONSE" | grep -q "folder_id"; then
        FOLDER_ID=$(echo "$RESPONSE" | grep -o '"folder_id":"[^"]*"' | cut -d'"' -f4)
        print_success "Watch folder created (with dummy credentials). ID: $FOLDER_ID"
    elif echo "$RESPONSE" | grep -q "Failed to connect"; then
        print_warning "Watch folder creation failed (expected with dummy credentials)"
        print_success "API endpoint is working correctly"
    else
        print_error "Watch folder creation failed unexpectedly"
        echo "Response: $RESPONSE"
    fi
    
    # Test listing watch folders
    echo "Listing watch folders..."
    LIST_RESPONSE=$(curl -s -H "Authorization: Bearer $JWT_TOKEN" \
        "$API_BASE/watch-folders")
    
    if echo "$LIST_RESPONSE" | grep -q "watch_folders"; then
        print_success "Watch folders listed successfully"
    else
        print_error "Failed to list watch folders"
    fi
}

# Test API documentation endpoints
test_api_docs() {
    print_header "Testing API Documentation"
    
    echo "Testing Swagger UI..."
    if curl -s "$BASE_URL/docs" | grep -q "swagger"; then
        print_success "Swagger UI is available at $BASE_URL/docs"
    else
        print_warning "Swagger UI might not be available"
    fi
    
    echo "Testing ReDoc..."
    if curl -s "$BASE_URL/redoc" | grep -q "redoc"; then
        print_success "ReDoc is available at $BASE_URL/redoc"
    else
        print_warning "ReDoc might not be available"
    fi
}

# Test error handling
test_error_handling() {
    print_header "Testing Error Handling"
    
    if [ -z "$JWT_TOKEN" ]; then
        print_error "No JWT token available. Run authenticate first."
        return 1
    fi
    
    # Test invalid job ID
    echo "Testing invalid job ID..."
    RESPONSE=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $JWT_TOKEN" \
        "$API_BASE/jobs/invalid-job-id/status")
    
    if echo "$RESPONSE" | grep -q "500\|404"; then
        print_success "Invalid job ID correctly returns error"
    else
        print_warning "Unexpected response for invalid job ID"
    fi
    
    # Test unauthorized request
    echo "Testing unauthorized request..."
    RESPONSE=$(curl -s -w "%{http_code}" "$API_BASE/jobs/some-id/status")
    
    if echo "$RESPONSE" | grep -q "401\|403"; then
        print_success "Unauthorized request correctly returns error"
    else
        print_warning "Unexpected response for unauthorized request"
    fi
}

# Clean up function
cleanup() {
    print_header "Cleaning Up"
    
    rm -f "$TEST_PDF" test_bulk_*.pdf result.csv
    print_success "Temporary files cleaned up"
}

# Main function
main() {
    echo "Pandiver API v2.0 - cURL Testing Script"
    echo "======================================"
    
    # Test server connectivity
    test_server
    
    # Authenticate
    authenticate
    
    # Create test files
    create_test_pdf
    
    # Run tests
    test_single_file_processing
    test_webhook_management
    test_bulk_processing
    test_watch_folder
    test_api_docs
    test_error_handling
    
    # Clean up
    cleanup
    
    print_header "Testing Complete"
    print_success "All cURL tests completed!"
    print_warning "Remember to update credentials for full testing"
    
    echo -e "\n${BLUE}Next steps:${NC}"
    echo "1. Visit the API documentation at: $BASE_URL/docs"
    echo "2. Try the interactive Swagger UI"
    echo "3. Set up real webhook URLs for testing"
    echo "4. Configure S3 credentials for watch folder testing"
    echo "5. Test with real PDF bank statements"
}

# Run main function
main "$@"