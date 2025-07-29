#!/usr/bin/env python3
"""
Launch script for the Transaction Display Interface
Run this to start the Streamlit web interface
"""

import subprocess
import sys
import os
from pathlib import Path

def check_requirements():
    """Check if required packages are installed"""
    required_packages = [
        'streamlit',
        'plotly',
        'pandas',
        'pdfplumber'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("Install them with:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    
    return True

def main():
    """Main launcher function"""
    print("🚀 Starting Banking Statement Transaction Extractor Interface")
    print("=" * 60)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    # Set the current directory to the backend directory
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Get the interface file path
    interface_file = backend_dir / "transaction_display_interface.py"
    
    if not interface_file.exists():
        print(f"❌ Interface file not found: {interface_file}")
        sys.exit(1)
    
    print(f"📂 Backend directory: {backend_dir}")
    print(f"🖥️  Interface file: {interface_file}")
    print("=" * 60)
    print("🌐 Starting Streamlit server...")
    print("📌 The interface will open in your default web browser")
    print("🔗 Default URL: http://localhost:8501")
    print("=" * 60)
    print("💡 Tips:")
    print("   - Upload PDF bank statements using the sidebar")
    print("   - Or select from sample statements")
    print("   - Use the tabs to extract, view, adjust, and export data")
    print("   - Press Ctrl+C to stop the server")
    print("=" * 60)
    
    try:
        # Run Streamlit
        subprocess.run([
            sys.executable, "-m", "streamlit", "run", str(interface_file),
            "--server.port", "8501",
            "--server.address", "localhost",
            "--browser.gatherUsageStats", "false"
        ], check=True)
    
    except KeyboardInterrupt:
        print("\n👋 Interface stopped by user")
    
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running Streamlit: {e}")
        sys.exit(1)
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()