#!/usr/bin/env python3
"""
Test script for Smart PDF Parser upload-pdf endpoint
"""

import requests
import io

# Configuration  
BASE_URL = "http://localhost:8000"
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"

def get_auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get('access_token')
    return None

def test_upload_pdf():
    """Test the upload-pdf endpoint"""
    print("🔐 Getting authentication token...")
    token = get_auth_token()
    
    if not token:
        print("❌ Failed to get auth token")
        return
    
    print("✅ Got auth token")
    
    # Create a simple PDF content
    dummy_pdf = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \n0000000179 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n238\n%%EOF"
    
    files = {'file': ('test.pdf', dummy_pdf, 'application/pdf')}
    headers = {'Authorization': f'Bearer {token}'}
    
    print("📤 Testing upload-pdf endpoint...")
    
    try:
        response = requests.post(f"{BASE_URL}/upload-pdf/", files=files, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Got {len(data)} text blocks")
            if data:
                print(f"Sample block: {data[0]}")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_upload_pdf()