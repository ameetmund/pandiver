# Test Data Directory

This directory contains sample files for testing the Smart PDF Parser application.

## ⚠️ Important for Production

**DO NOT deploy this directory to production servers.** This directory should be excluded from production deployments and is only meant for development and testing purposes.

## Contents

### sample-statements/
Contains sample bank statements for testing PDF parsing functionality:
- `HDFC bank.pdf` - Sample HDFC bank statement
- `ICICI bank.pdf` - Sample ICICI bank statement  
- `IDFC bank.pdf` - Sample IDFC bank statement

## Usage

1. Upload these PDFs through the Smart PDF Parser interface
2. Test drag-and-drop functionality with the extracted text blocks
3. Verify export functionality with the structured data

## Security Note

These are sample/demo files and do not contain real personal or financial information. However, in a production environment, ensure that:

1. No real customer data is stored in the repository
2. Test files are removed before deployment
3. Proper data handling procedures are followed

## Gitignore

This directory is excluded from version control in production deployments via `.gitignore` entries.