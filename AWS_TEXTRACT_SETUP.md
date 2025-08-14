# AWS Textract Setup Guide

This guide will help you set up AWS Textract integration for the Bank Statement Parser feature.

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI installed (optional but recommended)
3. Python environment with boto3 installed

## Step 1: AWS Account Setup

### Create IAM User with Required Permissions

1. Go to AWS IAM Console
2. Create a new user for Textract operations
3. Attach the following policies:
   - `AmazonTextractFullAccess`
   - `AmazonS3FullAccess` (for document storage)

### Get AWS Credentials

After creating the IAM user:
1. Go to Security Credentials tab
2. Create Access Key
3. Download and securely store:
   - Access Key ID
   - Secret Access Key

## Step 2: S3 Bucket Setup

### Create S3 Bucket (Optional - will be auto-created)

1. Go to S3 Console
2. Create a new bucket with a unique name (e.g., `pandiver-textract-documents-[random]`)
3. Choose the same region as your Textract service (ap-south-1 for Mumbai)
4. Keep default settings for now

## Step 3: Environment Configuration

### Create .env file

Copy the `.env.example` file to `.env` in the root directory:

```bash
cp .env.example .env
```

### Fill in your AWS credentials:

```env
# AWS Configuration for Textract
AWS_ACCESS_KEY_ID=your_actual_access_key_id
AWS_SECRET_ACCESS_KEY=your_actual_secret_access_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET=pandiver-textract-documents-unique-name

# Other configurations...
```

## Step 4: Install Dependencies

### Backend Dependencies

Install the required Python packages:

```bash
cd backend
pip install boto3==1.34.*
# or install all requirements
pip install -r requirements.txt
```

## Step 5: Test the Setup

### Test AWS Connectivity

You can test your AWS setup by running a simple script:

```python
import boto3
import os
from dotenv import load_dotenv

load_dotenv()

# Test Textract client
try:
    client = boto3.client(
        'textract',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'ap-south-1')
    )
    print("✅ Textract client initialized successfully")
except Exception as e:
    print(f"❌ Error initializing Textract client: {e}")

# Test S3 client
try:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'ap-south-1')
    )
    print("✅ S3 client initialized successfully")
except Exception as e:
    print(f"❌ Error initializing S3 client: {e}")
```

## Step 6: Start the Application

### Start Backend Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Start Frontend Server

```bash
cd frontend
npm run dev
```

## Usage

1. Navigate to Dashboard → AWS Textract Parser
2. Upload a PDF file
3. Preview the document
4. Click "Extract Data with AWS Textract"
5. Wait for processing (30-60 seconds typically)
6. Review extracted tables
7. Download in your preferred format

## Troubleshooting

### Common Issues

1. **Invalid AWS Credentials**
   - Double-check your Access Key ID and Secret Access Key
   - Ensure the IAM user has required permissions

2. **Region Mismatch**
   - Ensure all services (S3, Textract) are in the same region
   - ap-south-1 (Mumbai) is recommended for Indian users

3. **S3 Bucket Issues**
   - Bucket names must be globally unique
   - If auto-creation fails, create the bucket manually

4. **Textract Service Limits**
   - Check AWS service limits for your account
   - Textract has rate limits and concurrent job limits

### Error Messages

- `Failed to initialize AWS Textract client`: Check credentials and region
- `Bucket does not exist`: Check S3 bucket name and permissions
- `Access Denied`: Verify IAM permissions
- `JobLimitExceeded`: Wait for other jobs to complete

## Security Notes

1. **Never commit .env files** to version control
2. **Use environment variables** in production
3. **Rotate access keys** regularly
4. **Use least privilege** IAM policies
5. **Enable CloudTrail** for audit logging

## Pricing

AWS Textract charges per page processed:
- First 1 million pages per month: $1.50 per 1,000 pages
- Over 1 million pages per month: $0.60 per 1,000 pages

S3 storage costs are minimal for temporary document storage.

## Support

For issues with this setup:
1. Check the troubleshooting section above
2. Verify your AWS account has sufficient permissions
3. Check the backend logs for detailed error messages
4. Ensure all environment variables are correctly set

For AWS-specific issues, refer to the [AWS Textract documentation](https://docs.aws.amazon.com/textract/).