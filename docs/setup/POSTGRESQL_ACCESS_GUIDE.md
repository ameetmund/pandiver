# PostgreSQL Database Access Guide

Complete guide for accessing and querying PostgreSQL tables in Pandiver.

## Quick Start

### Using the Helper Script (Easiest)

```bash
# Make sure Docker containers are running
./start_pandiver_docker.sh

# Use the helper script
./scripts/postgres_query_helper.sh
```

## Available Commands

### 1. List All Tables
```bash
./scripts/postgres_query_helper.sh tables
```

### 2. Describe Table Structure
```bash
./scripts/postgres_query_helper.sh describe users
./scripts/postgres_query_helper.sh describe api_keys
./scripts/postgres_query_helper.sh describe api_usage
./scripts/postgres_query_helper.sh describe pdf_splitter_jobs
./scripts/postgres_query_helper.sh describe pdf_translation_jobs
./scripts/postgres_query_helper.sh describe user_tables
```

### 3. Count Rows in a Table
```bash
./scripts/postgres_query_helper.sh count users
./scripts/postgres_query_helper.sh count api_usage
```

### 4. Query Table Data
```bash
# Get first 10 rows (default)
./scripts/postgres_query_helper.sh query users

# Get specific number of rows
./scripts/postgres_query_helper.sh query api_keys 5
./scripts/postgres_query_helper.sh query api_usage 20
```

### 5. Execute Custom SQL Queries
```bash
# Simple query
./scripts/postgres_query_helper.sh sql "SELECT COUNT(*) FROM users WHERE email LIKE '%gmail%'"

# Query with joins
./scripts/postgres_query_helper.sh sql "
SELECT u.name, u.email, COUNT(ak.id) as api_key_count
FROM users u
LEFT JOIN api_keys ak ON u.id = ak.user_id
GROUP BY u.id, u.name, u.email
ORDER BY api_key_count DESC
"

# Query with date filters
./scripts/postgres_query_helper.sh sql "
SELECT * FROM api_usage
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10
"
```

### 6. Interactive PostgreSQL Shell
```bash
./scripts/postgres_query_helper.sh shell
```

In the shell, you can use:
- `\dt` - List all tables
- `\d table_name` - Describe table structure
- `\q` or `exit` - Exit the shell

## Direct Docker Commands

If you prefer using Docker directly:

### List Tables
```bash
docker exec pandiver-postgres-dev psql -U pandiver -d pandiver_db -c "\dt"
```

### Describe Table
```bash
docker exec pandiver-postgres-dev psql -U pandiver -d pandiver_db -c "\d users"
```

### Query Data
```bash
docker exec pandiver-postgres-dev psql -U pandiver -d pandiver_db -c "SELECT * FROM users LIMIT 5;"
```

### Interactive Shell
```bash
docker exec -it pandiver-postgres-dev psql -U pandiver -d pandiver_db
```

## Database Schema

### Tables Overview

| Table Name | Description | Key Columns |
|------------|-------------|-------------|
| **users** | User accounts | id, name, email, hashed_password, created_at |
| **api_keys** | API keys for authentication | id, user_id, key_name, api_key, is_active, created_at |
| **api_usage** | API usage tracking | id, user_id, api_key_id, endpoint, created_at |
| **pdf_splitter_jobs** | PDF splitting jobs | id, user_id, job_id, original_filename, status, created_at |
| **pdf_translation_jobs** | PDF translation jobs | id, user_id, job_id, status, source_language, target_language |
| **user_tables** | Custom user tables | id, user_id, table_name, file_path, created_at |

## Useful Queries

### User Statistics
```sql
SELECT
    COUNT(*) as total_users,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_7d,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d
FROM users;
```

### API Usage by User
```sql
SELECT
    u.name,
    u.email,
    COUNT(au.id) as total_requests,
    COUNT(DISTINCT au.endpoint) as unique_endpoints
FROM users u
LEFT JOIN api_usage au ON u.id = au.user_id
GROUP BY u.id, u.name, u.email
ORDER BY total_requests DESC
LIMIT 10;
```

### Active API Keys
```sql
SELECT
    u.name,
    u.email,
    ak.key_name,
    ak.api_key,
    ak.created_at,
    ak.last_used_at
FROM api_keys ak
JOIN users u ON ak.user_id = u.id
WHERE ak.is_active = true
ORDER BY ak.created_at DESC;
```

### Recent Jobs Status
```sql
SELECT
    'splitter' as job_type,
    status,
    COUNT(*) as count
FROM pdf_splitter_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status

UNION ALL

SELECT
    'translation' as job_type,
    status,
    COUNT(*) as count
FROM pdf_translation_jobs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

## Connection Details

- **Host**: localhost (when using Docker)
- **Port**: 5432
- **Database**: pandiver_db
- **User**: pandiver
- **Password**: pandiver_dev_password (development only)
- **Container Name**: pandiver-postgres-dev

## Backup and Restore

### Create Backup
```bash
docker exec pandiver-postgres-dev pg_dump -U pandiver pandiver_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore from Backup
```bash
cat backup_file.sql | docker exec -i pandiver-postgres-dev psql -U pandiver -d pandiver_db
```

### Export Specific Table to CSV
```bash
docker exec pandiver-postgres-dev psql -U pandiver -d pandiver_db -c "COPY users TO STDOUT WITH CSV HEADER" > users.csv
```

## Troubleshooting

### Container Not Running
```bash
# Check if containers are running
docker ps --filter name=pandiver

# Start containers
./start_pandiver_docker.sh
```

### Permission Denied
Make sure the helper script is executable:
```bash
chmod +x scripts/postgres_query_helper.sh
```

### Connection Issues
Verify PostgreSQL is healthy:
```bash
docker exec pandiver-postgres-dev pg_isready -U pandiver -d pandiver_db
```

## Production Access

For accessing Azure PostgreSQL (staging/production), see:
- [Azure PostgreSQL Setup Guide](../deployment/azure_postgres_setup.md) (coming soon)
- Use Azure Portal Query Editor
- Connect via pgAdmin with SSL enabled
