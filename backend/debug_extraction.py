#!/usr/bin/env python3
"""
Debug script to test the bank statement extraction functionality
"""

import requests
import json
import os

# Configuration
BASE_URL = "http://localhost:8000"
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"

def test_authentication():
    """Test if authentication is working"""
    print("🔐 Testing Authentication...")
    
    # Test login
    login_response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if login_response.status_code == 200:
        print("✅ Authentication successful")
        token = login_response.json().get('access_token')
        return token
    else:
        print(f"❌ Authentication failed: {login_response.status_code} - {login_response.text}")
        return None

def test_extraction_endpoint():
    """Test the extraction endpoint without file"""
    print("\n📄 Testing Extraction Endpoint...")
    
    # Test without file
    response = requests.post(f"{BASE_URL}/intelligent-bank-extract")
    print(f"Without file: {response.status_code} - {response.json()}")
    
def test_file_extraction():
    """Test with a dummy file"""
    print("\n📄 Testing File Extraction...")
    
    # Create a dummy PDF-like file
    dummy_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n196\n%%EOF"
    
    files = {'file': ('test.pdf', dummy_content, 'application/pdf')}
    
    try:
        response = requests.post(f"{BASE_URL}/intelligent-bank-extract", files=files)
        print(f"With dummy PDF: {response.status_code}")
        if response.status_code != 200:
            print(f"Error: {response.text}")
        else:
            print(f"Success: {response.json()}")
    except Exception as e:
        print(f"Exception: {e}")

def test_server_status():
    """Test if server is running"""
    print("🚀 Testing Server Status...")
    
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("✅ Server is running")
            return True
        else:
            print(f"⚠️ Server responded with: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server")
        return False

def main():
    print("🔧 Debugging Bank Statement Extraction")
    print("=" * 50)
    
    if not test_server_status():
        return
    
    test_authentication()
    test_extraction_endpoint()
    test_file_extraction()

if __name__ == "__main__":
    main()