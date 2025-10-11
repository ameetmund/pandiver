#!/bin/bash

# PostgreSQL Query Helper Script
# Easy access to PostgreSQL tables for Pandiver

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONTAINER_NAME="pandiver-postgres-dev"
DB_USER="pandiver"
DB_NAME="pandiver_db"

# Function to execute SQL
execute_sql() {
    docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "$1"
}

# Check if container is running
if ! docker ps --filter name=$CONTAINER_NAME --format '{{.Names}}' | grep -q $CONTAINER_NAME; then
    echo -e "${YELLOW}⚠️  PostgreSQL container is not running. Please start it first with:${NC}"
    echo "./start_pandiver_docker.sh"
    exit 1
fi

echo -e "${GREEN}🐘 PostgreSQL Query Helper${NC}"
echo "================================"
echo ""

# Show usage if no arguments
if [ $# -eq 0 ]; then
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  tables              - List all tables"
    echo "  describe <table>    - Show table structure"
    echo "  count <table>       - Count rows in table"
    echo "  query <table> [n]   - Show first n rows (default: 10)"
    echo "  sql \"<query>\"       - Execute custom SQL query"
    echo "  shell               - Open interactive psql shell"
    echo ""
    echo "Examples:"
    echo "  $0 tables"
    echo "  $0 describe users"
    echo "  $0 count api_usage"
    echo "  $0 query users 5"
    echo "  $0 sql \"SELECT * FROM users WHERE email LIKE '%gmail%'\""
    echo ""
    exit 0
fi

COMMAND=$1

case $COMMAND in
    tables)
        echo -e "${BLUE}📋 All Tables:${NC}"
        execute_sql "\dt"
        ;;

    describe)
        if [ -z "$2" ]; then
            echo "Error: Please specify a table name"
            echo "Usage: $0 describe <table>"
            exit 1
        fi
        TABLE=$2
        echo -e "${BLUE}📊 Structure of '$TABLE':${NC}"
        execute_sql "\d $TABLE"
        ;;

    count)
        if [ -z "$2" ]; then
            echo "Error: Please specify a table name"
            echo "Usage: $0 count <table>"
            exit 1
        fi
        TABLE=$2
        echo -e "${BLUE}🔢 Row count for '$TABLE':${NC}"
        execute_sql "SELECT COUNT(*) as total_rows FROM $TABLE;"
        ;;

    query)
        if [ -z "$2" ]; then
            echo "Error: Please specify a table name"
            echo "Usage: $0 query <table> [limit]"
            exit 1
        fi
        TABLE=$2
        LIMIT=${3:-10}
        echo -e "${BLUE}📄 First $LIMIT rows from '$TABLE':${NC}"
        execute_sql "SELECT * FROM $TABLE LIMIT $LIMIT;"
        ;;

    sql)
        if [ -z "$2" ]; then
            echo "Error: Please provide a SQL query"
            echo "Usage: $0 sql \"<query>\""
            exit 1
        fi
        SQL_QUERY=$2
        echo -e "${BLUE}🔍 Executing query:${NC}"
        echo "$SQL_QUERY"
        echo ""
        execute_sql "$SQL_QUERY"
        ;;

    shell)
        echo -e "${BLUE}🐚 Opening interactive PostgreSQL shell...${NC}"
        echo "Type 'exit' or press Ctrl+D to exit"
        echo ""
        docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
        ;;

    *)
        echo "Unknown command: $COMMAND"
        echo "Run '$0' without arguments to see usage"
        exit 1
        ;;
esac
