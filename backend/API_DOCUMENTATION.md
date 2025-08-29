# Pandiver API v2.0 - Complete Documentation

## Overview

The Pandiver API provides advanced PDF processing capabilities with support for:

- **Single & Bulk File Processing**: Process one or multiple PDF files concurrently
- **Multiple Extraction Methods**: Smart, intelligent, Textract, and manual extraction
- **Webhook Notifications**: Real-time notifications for job completion
- **Watch Folders**: Automatic processing of files from cloud storage (S3, Google Drive, Dropbox)
- **Multiple Export Formats**: JSON, CSV, XLSX
- **Job Management**: Track progress, cancel jobs, get results

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

All API endpoints require JWT authentication. Include the token in the Authorization header:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

To get a JWT token, first register/login via the existing auth endpoints:

```bash
# Register
curl -X POST "http://localhost:8000/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "your@email.com", 
    "password": "yourpassword"
  }'

# Login
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "yourpassword"
  }'
```

## API Endpoints

### 1. Single File Processing

Process a single PDF file for transaction extraction.

**Endpoint:** `POST /api/v1/process`

**Parameters:**
- `file` (required): PDF file to upload
- `extraction_method`: Method to use (`smart`, `intelligent`, `textract`, `manual`) - Default: `smart`
- `webhook_url`: Optional URL for webhook notifications
- `webhook_events`: JSON array of events to webhook
- `metadata`: JSON object with additional metadata

**Example:**

```bash
curl -X POST "http://localhost:8000/api/v1/process" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@bank_statement.pdf" \
  -F "extraction_method=smart" \
  -F "webhook_url=https://yourdomain.com/webhooks/pandiver" \
  -F 'webhook_events=["processing.completed", "processing.failed"]' \
  -F 'metadata={"customer_id": "123", "batch": "morning"}'
```

**Response:**
```json
{
  "job_id": "abc123-def456",
  "status": "pending", 
  "message": "File uploaded successfully. Processing started.",
  "created_at": "2025-08-20T10:30:00Z",
  "webhook_url": "https://yourdomain.com/webhooks/pandiver",
  "metadata": {"customer_id": "123", "batch": "morning"}
}
```

### 2. Bulk File Processing

Process multiple PDF files concurrently.

**Endpoint:** `POST /api/v1/process-bulk`

**Parameters:**
- `files` (required): Multiple PDF files
- `extraction_method`: Method to use for all files
- `max_concurrent_jobs`: Maximum concurrent processing (1-10, default: 3)
- `webhook_url`: Optional webhook URL
- `webhook_events`: Events to webhook
- `metadata`: Additional metadata

**Example:**

```bash
curl -X POST "http://localhost:8000/api/v1/process-bulk" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "files=@statement1.pdf" \
  -F "files=@statement2.pdf" \
  -F "files=@statement3.pdf" \
  -F "extraction_method=smart" \
  -F "max_concurrent_jobs=2" \
  -F "webhook_url=https://yourdomain.com/webhooks/pandiver"
```

### 3. Job Status & Results

**Get Job Status:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/v1/jobs/abc123/status"
```

**Get Job Results:**
```bash
# JSON format (default)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/v1/jobs/abc123/result"

# CSV format
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/v1/jobs/abc123/result?format=csv"

# Excel format
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/v1/jobs/abc123/result?format=xlsx"
```

**Cancel Job:**
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/v1/jobs/abc123"
```

### 4. Webhooks

Create webhook endpoints to receive notifications when jobs complete.

**Create Webhook Endpoint:**
```bash
curl -X POST "http://localhost:8000/api/v1/webhooks/endpoints" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourdomain.com/webhooks/pandiver",
    "events": ["processing.completed", "processing.failed"],
    "description": "Production webhook for processing results"
  }'
```

**Response:**
```json
{
  "webhook_id": "wh_abc123",
  "url": "https://yourdomain.com/webhooks/pandiver", 
  "events": ["processing.completed", "processing.failed"],
  "secret": "whsec_1a2b3c4d5e6f...",
  "active": true,
  "created_at": "2025-08-20T10:30:00Z",
  "signature_info": {
    "header_name": "X-Pandiver-Signature",
    "algorithm": "HMAC-SHA256",
    "example": "sha256=1a2b3c4d5e6f..."
  }
}
```

**Webhook Payload Format:**
```json
{
  "event_type": "processing.completed",
  "job_id": "abc123-def456", 
  "timestamp": "2025-08-20T10:35:00Z",
  "data": {
    "status": "completed",
    "total_transactions": 45,
    "processing_time_seconds": 12.5,
    "file_name": "bank_statement.pdf"
  }
}
```

**Verify Webhook Signatures:**
Your webhook endpoint should verify the signature to ensure authenticity:

```python
import hmac
import hashlib

def verify_webhook_signature(payload, signature, secret):
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'), 
        hashlib.sha256
    ).hexdigest()
    expected_signature = f"sha256={expected_signature}"
    return hmac.compare_digest(signature, expected_signature)
```

### 5. Watch Folders

Automatically process files from cloud storage locations.

**Create S3 Watch Folder:**
```bash
curl -X POST "http://localhost:8000/api/v1/watch-folders" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "folder_type": "s3",
    "folder_path": "bank-statements/incoming/",
    "credentials": {
      "aws_access_key_id": "AKIA...",
      "aws_secret_access_key": "...",
      "bucket_name": "my-documents",
      "region": "us-east-1"
    },
    "poll_interval_hours": 6,
    "extraction_method": "smart",
    "webhook_url": "https://yourdomain.com/webhooks/pandiver",
    "auto_delete_processed": false,
    "file_patterns": ["*.pdf"]
  }'
```

**Manual Scan:**
```bash
curl -X POST -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "http://localhost:8000/api/v1/watch-folders/folder123/scan"
```

## Extraction Methods

### 1. Smart (Default)
- Uses existing bank parser manager
- Automatically detects bank format
- Best for standard bank statements

### 2. Intelligent  
- Advanced AI-based extraction
- Works with complex/non-standard formats
- Higher accuracy but slower processing

### 3. Textract
- AWS Textract integration
- OCR for scanned documents
- Requires AWS credentials

### 4. Manual
- Basic text extraction
- No automated parsing
- For custom processing workflows

## Error Handling

All endpoints return standardized error responses:

```json
{
  "detail": "Error message describing what went wrong",
  "status_code": 400
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (invalid/missing JWT token)
- `404`: Resource not found
- `500`: Internal server error

## Rate Limits

- **File Processing**: 100 jobs per hour per user
- **Bulk Processing**: 10 bulk jobs (max 50 files each) per hour
- **API Calls**: 1000 requests per hour per user

## Supported File Types

- **Input**: PDF files only
- **Output**: JSON, CSV, XLSX formats

## Example Integration Workflows

### Workflow 1: Simple Single File Processing

```python
import requests
import time

# 1. Process file
response = requests.post(
    "http://localhost:8000/api/v1/process",
    headers={"Authorization": f"Bearer {token}"},
    files={"file": open("statement.pdf", "rb")},
    data={"extraction_method": "smart"}
)

job_id = response.json()["job_id"]

# 2. Poll for completion
while True:
    status_response = requests.get(
        f"http://localhost:8000/api/v1/jobs/{job_id}/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    status_data = status_response.json()
    
    if status_data["status"] == "completed":
        # 3. Get results
        result_response = requests.get(
            f"http://localhost:8000/api/v1/jobs/{job_id}/result",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        transactions = result_response.json()["transactions"]
        print(f"Found {len(transactions)} transactions")
        break
    elif status_data["status"] == "failed":
        print(f"Processing failed: {status_data['error_message']}")
        break
    
    time.sleep(5)  # Wait 5 seconds before checking again
```

### Workflow 2: Bulk Processing with Webhooks

```python
import requests

# 1. Create webhook endpoint
webhook_response = requests.post(
    "http://localhost:8000/api/v1/webhooks/endpoints",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "url": "https://yourdomain.com/webhooks/pandiver",
        "events": ["bulk.processing.completed", "bulk.processing.failed"]
    }
)

webhook_url = webhook_response.json()["url"]

# 2. Process multiple files
files = [
    ("files", open("statement1.pdf", "rb")),
    ("files", open("statement2.pdf", "rb")),
    ("files", open("statement3.pdf", "rb"))
]

response = requests.post(
    "http://localhost:8000/api/v1/process-bulk",
    headers={"Authorization": f"Bearer {token}"},
    files=files,
    data={
        "extraction_method": "smart",
        "webhook_url": webhook_url,
        "max_concurrent_jobs": 2
    }
)

bulk_job_id = response.json()["bulk_job_id"]
print(f"Bulk job started: {bulk_job_id}")

# Results will be delivered to your webhook endpoint
```

### Workflow 3: S3 Watch Folder

```python
import requests

# Create S3 watch folder
response = requests.post(
    "http://localhost:8000/api/v1/watch-folders", 
    headers={"Authorization": f"Bearer {token}"},
    json={
        "folder_type": "s3",
        "folder_path": "incoming-statements/",
        "credentials": {
            "aws_access_key_id": "YOUR_ACCESS_KEY",
            "aws_secret_access_key": "YOUR_SECRET_KEY",
            "bucket_name": "your-bucket",
            "region": "us-east-1"
        },
        "poll_interval_hours": 1,  # Check every hour
        "extraction_method": "smart",
        "webhook_url": "https://yourdomain.com/webhooks/pandiver",
        "auto_delete_processed": True,  # Delete files after processing
        "file_patterns": ["*.pdf"]
    }
)

folder_id = response.json()["folder_id"]
print(f"Watch folder created: {folder_id}")

# Files will be automatically processed when uploaded to S3
```

## Testing Your Integration

### 1. Interactive API Documentation

Visit the automatically generated API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 2. Test Webhook Endpoint

Use tools like ngrok to create a public URL for testing webhooks locally:

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL as your webhook_url
```

### 3. Sample Test Files

Create test PDF files or use existing bank statements to test the extraction accuracy.

## Support & Troubleshooting

### Common Issues

1. **"Invalid JWT token"**: Ensure you're using a valid token from `/auth/login`
2. **"File must be a PDF"**: Only PDF files are supported for processing
3. **"Watch folder connection failed"**: Verify your cloud storage credentials
4. **Webhook not receiving events**: Check your URL is publicly accessible

### Monitoring

- Check job status regularly for long-running processes
- Set up webhook endpoints for real-time notifications
- Use the `/api/v1/jobs` endpoint to list recent jobs

### Performance Tips

- Use bulk processing for multiple files instead of individual requests
- Set appropriate `max_concurrent_jobs` based on your server capacity
- Use webhooks instead of polling for job status
- Configure watch folders for automated processing

## Changelog

### v2.0.0 (2025-08-20)
- Added REST API endpoints for single and bulk processing
- Implemented webhook notification system
- Added watch folder functionality for S3, Google Drive, Dropbox
- Enhanced job management and status tracking
- Multiple export formats (JSON, CSV, XLSX)
- Comprehensive error handling and validation