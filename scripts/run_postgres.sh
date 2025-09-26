#!/bin/bash

# Configurable variables
CONTAINER_NAME="postgres"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="grepmind_db"
HOST_PORT=5432
CONTAINER_PORT=5432
VOLUME_NAME="postgres_data"
INIT_SQL_DIR="./init-scripts"

# Create Docker volume if it doesn't exist
if [ -z "$(docker volume ls -q -f name=$VOLUME_NAME)" ]; then
  echo "Creating volume $VOLUME_NAME..."
  docker volume create $VOLUME_NAME
fi

# Cleanup old container if exists
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "Container $CONTAINER_NAME already exists. Stopping and removing..."
    docker stop $CONTAINER_NAME >/dev/null 2>&1
    docker rm $CONTAINER_NAME >/dev/null 2>&1
fi

# Ensure init-scripts dir exists
mkdir -p $INIT_SQL_DIR

# Create init SQL file if not exists
INIT_SQL_FILE="$INIT_SQL_DIR/init.sql"
if [ ! -f "$INIT_SQL_FILE" ]; then
cat <<EOF > $INIT_SQL_FILE
-- Auto-init SQL for PostgreSQL

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
EOF
fi

echo "Starting PostgreSQL container with persistent storage and init script..."
docker run -d \
  --name $CONTAINER_NAME \
  -e POSTGRES_USER=$POSTGRES_USER \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB \
  -p $HOST_PORT:$CONTAINER_PORT \
  -v $VOLUME_NAME:/var/lib/postgresql/data \
  -v $(pwd)/$INIT_SQL_DIR:/docker-entrypoint-initdb.d \
  postgres:15

echo "PostgreSQL is running on localhost:$HOST_PORT"
echo "User: $POSTGRES_USER | Password: $POSTGRES_PASSWORD | Database: $POSTGRES_DB"
echo "Persistent data stored in Docker volume: $VOLUME_NAME"
echo "Init script: $INIT_SQL_FILE"
echo "You can connect using: psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB -p $HOST_PORT"
