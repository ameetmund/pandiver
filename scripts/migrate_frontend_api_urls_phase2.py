#!/usr/bin/env python3
"""
Frontend API URL Migration Script - Phase 2

This script handles template literals and complex URL patterns.

Usage:
    python3 scripts/migrate_frontend_api_urls_phase2.py [--dry-run]
"""

import os
import re
import sys
from pathlib import Path

# Base directory
FRONTEND_SRC = Path(__file__).parent.parent / 'frontend' / 'src'

def find_files_with_hardcoded_urls():
    """Find all .tsx and .ts files with hardcoded localhost URLs."""
    files = []
    for root, dirs, filenames in os.walk(FRONTEND_SRC):
        # Skip node_modules
        if 'node_modules' in dirs:
            dirs.remove('node_modules')

        for filename in filenames:
            if filename.endswith(('.tsx', '.ts')) and filename != 'api.ts':
                filepath = Path(root) / filename
                try:
                    content = filepath.read_text()
                    if 'http://localhost:8000' in content:
                        files.append(filepath)
                except Exception as e:
                    print(f"Warning: Could not read {filepath}: {e}")

    return files

def replace_template_literals(content):
    """
    Replace template literal patterns like:
        `http://localhost:8000/endpoint/${var}`
    with:
        getApiUrl(`/endpoint/${var}`)
    """
    # Pattern for template literals with variables
    pattern = r'`http://localhost:8000(/[^`]*)`'
    replacement = r'getApiUrl(`\1`)'
    return re.sub(pattern, replacement, content)

def replace_string_literals(content):
    """
    Replace simple string literals like:
        'http://localhost:8000/endpoint'
    with:
        getApiUrl('/endpoint')
    """
    # Single quotes
    pattern1 = r"'http://localhost:8000(/[^']*)'"
    replacement1 = r"getApiUrl('\1')"
    content = re.sub(pattern1, replacement1, content)

    # Double quotes
    pattern2 = r'"http://localhost:8000(/[^"]*)"'
    replacement2 = r'getApiUrl("\1")'
    content = re.sub(pattern2, replacement2, content)

    return content

def migrate_file(filepath, dry_run=False):
    """Migrate a single file."""
    try:
        content = filepath.read_text()
        original_content = content

        # Replace template literals first
        content = replace_template_literals(content)

        # Then replace simple string literals
        content = replace_string_literals(content)

        if content != original_content:
            if dry_run:
                print(f"[DRY RUN] Would update: {filepath.relative_to(FRONTEND_SRC)}")
                return True
            else:
                filepath.write_text(content)
                print(f"✅ Updated: {filepath.relative_to(FRONTEND_SRC)}")
                return True
        else:
            print(f"ℹ️  No changes needed: {filepath.relative_to(FRONTEND_SRC)}")
            return False

    except Exception as e:
        print(f"❌ Error processing {filepath}: {e}")
        return False

def main():
    """Main function."""
    dry_run = '--dry-run' in sys.argv

    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified\n")
    else:
        print("🚀 Starting Frontend API URL Migration - Phase 2\n")

    # Find all files
    files = find_files_with_hardcoded_urls()

    if not files:
        print("✅ No files found with hardcoded localhost URLs!")
        return

    print(f"Found {len(files)} files with hardcoded URLs:\n")

    # Migrate each file
    updated_count = 0
    for filepath in files:
        if migrate_file(filepath, dry_run):
            updated_count += 1

    print(f"\n{'=' * 60}")
    if dry_run:
        print(f"[DRY RUN] Would update {updated_count}/{len(files)} files")
    else:
        print(f"✅ Migration complete: {updated_count}/{len(files)} files updated")

if __name__ == '__main__':
    main()
