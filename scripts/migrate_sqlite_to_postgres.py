#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script

This script migrates data from the existing SQLite database to PostgreSQL.
It preserves all user accounts, API keys, and usage data.

Usage:
    python3 scripts/migrate_sqlite_to_postgres.py [--dry-run]
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from app.models import Base, User, ApiKey, ApiUsage, PDFSplitterJob, PDFTranslationJob
from dotenv import load_dotenv

# Load environment variables
load_dotenv('environments/.env.development')

# Database URLs
SQLITE_URL = "sqlite:///./backend/pandiver.db"
POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://pandiver:pandiver_dev_password@localhost:5432/pandiver_db")

def check_databases():
    """Verify both databases are accessible."""
    print("🔍 Checking database connectivity...")

    # Check SQLite
    if not os.path.exists("backend/pandiver.db"):
        print("❌ SQLite database not found at: backend/pandiver.db")
        return False
    print("✅ SQLite database found")

    # Check PostgreSQL
    try:
        pg_engine = create_engine(POSTGRES_URL)
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ PostgreSQL connection successful")
        pg_engine.dispose()
        return True
    except Exception as e:
        print(f"❌ PostgreSQL connection failed: {e}")
        print(f"   URL: {POSTGRES_URL.replace(os.getenv('DATABASE_URL', '').split('@')[0].split('//')[1], '****')}")
        return False

def get_table_counts(engine):
    """Get row counts for all tables."""
    Session = sessionmaker(bind=engine)
    session = Session()

    counts = {}
    try:
        counts['users'] = session.query(User).count()
        counts['api_keys'] = session.query(ApiKey).count()
        counts['api_usage'] = session.query(ApiUsage).count()
        counts['pdf_splitter_jobs'] = session.query(PDFSplitterJob).count()
        counts['pdf_translation_jobs'] = session.query(PDFTranslationJob).count()
    except Exception as e:
        print(f"Warning: Could not get all counts: {e}")
    finally:
        session.close()

    return counts

def migrate_data(dry_run=False):
    """Migrate data from SQLite to PostgreSQL."""
    print("\n🚀 Starting data migration...")
    print(f"   Source: SQLite (backend/pandiver.db)")
    print(f"   Target: PostgreSQL ({POSTGRES_URL.split('@')[1] if '@' in POSTGRES_URL else 'localhost'})")
    print()

    if dry_run:
        print("🔍 DRY RUN MODE - No data will be written\n")

    # Create engines
    sqlite_engine = create_engine(SQLITE_URL)
    postgres_engine = create_engine(POSTGRES_URL)

    # Create sessions
    SqliteSession = sessionmaker(bind=sqlite_engine)
    PostgresSession = sessionmaker(bind=postgres_engine)

    sqlite_session = SqliteSession()
    postgres_session = PostgresSession()

    try:
        # Get source counts
        print("📊 Source database (SQLite):")
        source_counts = get_table_counts(sqlite_engine)
        for table, count in source_counts.items():
            print(f"   {table}: {count} rows")

        total_rows = sum(source_counts.values())
        if total_rows == 0:
            print("\n⚠️  No data to migrate (empty database)")
            return True

        print()

        # Create tables in PostgreSQL
        print("📋 Creating tables in PostgreSQL...")
        Base.metadata.create_all(postgres_engine)
        print("✅ Tables created")

        if dry_run:
            print("\n[DRY RUN] Would migrate:")
            for table, count in source_counts.items():
                print(f"   {table}: {count} rows")
            return True

        # Migrate Users
        if source_counts.get('users', 0) > 0:
            print(f"\n👥 Migrating {source_counts['users']} users...")
            users = sqlite_session.query(User).all()
            for user in users:
                # Check if user already exists
                existing = postgres_session.query(User).filter_by(email=user.email).first()
                if existing:
                    print(f"   ⚠️  User already exists: {user.email} (skipping)")
                    continue

                # Create new user object (don't reuse SQLite object)
                new_user = User(
                    id=user.id,
                    name=user.name,
                    email=user.email,
                    hashed_password=user.hashed_password,
                    created_at=user.created_at
                )
                postgres_session.add(new_user)
                print(f"   ✅ Migrated user: {user.email}")
            postgres_session.commit()

        # Migrate API Keys
        if source_counts.get('api_keys', 0) > 0:
            print(f"\n🔑 Migrating {source_counts['api_keys']} API keys...")
            api_keys = sqlite_session.query(ApiKey).all()
            for key in api_keys:
                existing = postgres_session.query(ApiKey).filter_by(api_key=key.api_key).first()
                if existing:
                    print(f"   ⚠️  API key already exists: {key.key_name} (skipping)")
                    continue

                new_key = ApiKey(
                    id=key.id,
                    user_id=key.user_id,
                    key_name=key.key_name,
                    api_key=key.api_key,
                    created_at=key.created_at,
                    last_used_at=key.last_used_at,
                    is_active=key.is_active
                )
                postgres_session.add(new_key)
                print(f"   ✅ Migrated API key: {key.key_name}")
            postgres_session.commit()

        # Migrate API Usage
        if source_counts.get('api_usage', 0) > 0:
            print(f"\n📈 Migrating {source_counts['api_usage']} API usage records...")
            usage_records = sqlite_session.query(ApiUsage).all()
            for usage in usage_records:
                new_usage = ApiUsage(
                    id=usage.id,
                    api_key_id=usage.api_key_id,
                    endpoint=usage.endpoint,
                    job_id=usage.job_id,
                    status=usage.status,
                    file_count=usage.file_count,
                    processing_time=usage.processing_time,
                    created_at=usage.created_at,
                    completed_at=usage.completed_at
                )
                postgres_session.add(new_usage)
            postgres_session.commit()
            print(f"   ✅ Migrated {source_counts['api_usage']} usage records")

        # Migrate PDF Splitter Jobs
        if source_counts.get('pdf_splitter_jobs', 0) > 0:
            print(f"\n📄 Migrating {source_counts['pdf_splitter_jobs']} PDF splitter jobs...")
            jobs = sqlite_session.query(PDFSplitterJob).all()
            for job in jobs:
                new_job = PDFSplitterJob(
                    id=job.id,
                    job_id=job.job_id,
                    user_id=job.user_id,
                    api_key_id=job.api_key_id,
                    original_filename=job.original_filename,
                    selected_pages=job.selected_pages,
                    output_filename=job.output_filename,
                    total_pages=job.total_pages,
                    status=job.status,
                    error_message=job.error_message,
                    file_size_bytes=job.file_size_bytes,
                    created_at=job.created_at,
                    completed_at=job.completed_at
                )
                postgres_session.add(new_job)
            postgres_session.commit()
            print(f"   ✅ Migrated {source_counts['pdf_splitter_jobs']} splitter jobs")

        # Migrate PDF Translation Jobs
        if source_counts.get('pdf_translation_jobs', 0) > 0:
            print(f"\n🌐 Migrating {source_counts['pdf_translation_jobs']} PDF translation jobs...")
            jobs = sqlite_session.query(PDFTranslationJob).all()
            for job in jobs:
                new_job = PDFTranslationJob(
                    id=job.id,
                    job_id=job.job_id,
                    user_id=job.user_id,
                    api_key_id=job.api_key_id,
                    original_filename=job.original_filename,
                    translated_filename=job.translated_filename,
                    source_language=job.source_language,
                    target_language=job.target_language,
                    detected_language=job.detected_language,
                    translation_method=job.translation_method,
                    total_pages=job.total_pages,
                    status=job.status,
                    error_message=job.error_message,
                    characters_translated=job.characters_translated,
                    file_size_bytes=job.file_size_bytes,
                    created_at=job.created_at,
                    completed_at=job.completed_at
                )
                postgres_session.add(new_job)
            postgres_session.commit()
            print(f"   ✅ Migrated {source_counts['pdf_translation_jobs']} translation jobs")

        # Verify migration
        print("\n✅ Verifying migration...")
        target_counts = get_table_counts(postgres_engine)
        print("\n📊 Target database (PostgreSQL):")
        for table, count in target_counts.items():
            print(f"   {table}: {count} rows")

        # Compare counts
        print("\n📋 Migration Summary:")
        all_match = True
        for table in source_counts:
            source = source_counts.get(table, 0)
            target = target_counts.get(table, 0)
            status = "✅" if source == target else "⚠️ "
            print(f"   {status} {table}: {source} → {target}")
            if source != target:
                all_match = False

        # Fix PostgreSQL sequences
        print("\n🔧 Fixing PostgreSQL sequences...")
        with postgres_engine.connect() as conn:
            conn.execute(text("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));"))
            conn.execute(text("SELECT setval('api_keys_id_seq', (SELECT MAX(id) FROM api_keys));"))
            conn.execute(text("SELECT setval('api_usage_id_seq', (SELECT MAX(id) FROM api_usage));"))
            conn.execute(text("SELECT setval('pdf_splitter_jobs_id_seq', (SELECT MAX(id) FROM pdf_splitter_jobs));"))
            conn.execute(text("SELECT setval('pdf_translation_jobs_id_seq', (SELECT MAX(id) FROM pdf_translation_jobs));"))
            conn.commit()
        print("✅ Sequences updated successfully")

        if all_match:
            print("\n🎉 Migration completed successfully!")
            return True
        else:
            print("\n⚠️  Migration completed with warnings (some records may have been skipped)")
            return True

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        postgres_session.rollback()
        import traceback
        traceback.print_exc()
        return False
    finally:
        sqlite_session.close()
        postgres_session.close()
        sqlite_engine.dispose()
        postgres_engine.dispose()

def main():
    """Main entry point."""
    dry_run = '--dry-run' in sys.argv

    print("=" * 60)
    print("SQLite to PostgreSQL Migration")
    print("=" * 60)
    print()

    # Check databases
    if not check_databases():
        print("\n❌ Database connectivity check failed")
        print("\n💡 Make sure PostgreSQL is running:")
        print("   docker-compose -f docker-compose.dev.yml up postgres -d")
        sys.exit(1)

    # Run migration
    success = migrate_data(dry_run=dry_run)

    if success:
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("❌ Migration failed")
        print("=" * 60)
        sys.exit(1)

if __name__ == '__main__':
    main()
