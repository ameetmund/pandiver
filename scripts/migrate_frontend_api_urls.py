#!/usr/bin/env python3
"""
Frontend API URL Migration Script

This script updates all frontend files that use hardcoded http://localhost:8000 URLs
to use the centralized API utility from @/lib/api.

Usage:
    python3 scripts/migrate_frontend_api_urls.py [--dry-run]
"""

import os
import re
import sys
from pathlib import Path

# Base directory
FRONTEND_SRC = Path(__file__).parent.parent / 'frontend' / 'src'

# API URL patterns to replace
HARDCODED_URL_PATTERN = r'http://localhost:8000'

# Files to skip (already migrated)
SKIP_FILES = {
    'lib/api.ts',  # The API utility itself
    'app/auth/login/page.tsx',  # Already migrated
    'app/auth/signup/page.tsx',  # Already migrated
}

def find_files_with_hardcoded_urls():
    """Find all .tsx and .ts files with hardcoded localhost URLs."""
    files = []
    for root, dirs, filenames in os.walk(FRONTEND_SRC):
        # Skip node_modules
        if 'node_modules' in dirs:
            dirs.remove('node_modules')

        for filename in filenames:
            if filename.endswith(('.tsx', '.ts')):
                filepath = Path(root) / filename
                rel_path = filepath.relative_to(FRONTEND_SRC)

                # Skip excluded files
                if str(rel_path) in SKIP_FILES:
                    continue

                # Check if file contains hardcoded URL
                try:
                    content = filepath.read_text()
                    if HARDCODED_URL_PATTERN in content:
                        files.append(filepath)
                except Exception as e:
                    print(f"Warning: Could not read {filepath}: {e}")

    return files

def needs_api_import(content):
    """Check if file needs to import the API utility."""
    return 'from @/lib/api' not in content and "from '@/lib/api'" not in content

def add_api_import(content):
    """Add API utility import to the file."""
    # Find the last import statement
    import_pattern = r"^import .+;$"
    imports = list(re.finditer(import_pattern, content, re.MULTILINE))

    if not imports:
        # No imports found, add at the top after 'use client' if present
        if "'use client'" in content or '"use client"' in content:
            lines = content.split('\n')
            insert_idx = next((i for i, line in enumerate(lines) if 'use client' in line), 0) + 1
            lines.insert(insert_idx + 1, "import { apiClient, getApiUrl } from '@/lib/api';")
            return '\n'.join(lines)
        else:
            return "import { apiClient, getApiUrl } from '@/lib/api';\n" + content

    # Add after last import
    last_import = imports[-1]
    insert_pos = last_import.end() + 1
    new_import = "\nimport { apiClient, getApiUrl } from '@/lib/api';"
    return content[:insert_pos] + new_import + content[insert_pos:]

def replace_simple_fetch_calls(content):
    """
    Replace simple fetch calls like:
        fetch('http://localhost:8000/endpoint', ...)
    with:
        fetch(getApiUrl('/endpoint'), ...)
    """
    # Pattern for fetch calls
    pattern = r"fetch\(['\"]http://localhost:8000(/[^'\"]*)['\"]"
    replacement = r"fetch(getApiUrl('\1')"

    return re.sub(pattern, replacement, content)

def migrate_file(filepath, dry_run=False):
    """Migrate a single file."""
    try:
        content = filepath.read_text()
        original_content = content

        # Add import if needed
        if needs_api_import(content):
            content = add_api_import(content)

        # Replace fetch calls
        content = replace_simple_fetch_calls(content)

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
        print("🚀 Starting Frontend API URL Migration\n")

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
        print("\nRun without --dry-run to apply changes:")
        print("  python3 scripts/migrate_frontend_api_urls.py")
    else:
        print(f"✅ Migration complete: {updated_count}/{len(files)} files updated")
        print("\n⚠️  IMPORTANT: Review the changes and test your application!")
        print("   Some files may need manual adjustments for complex API calls.")

if __name__ == '__main__':
    main()
