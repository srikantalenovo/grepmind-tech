#!/bin/bash

# Configurable variables
CONTAINER_NAME="postgres"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="grepmind_db"
HOST_PORT=5432
CONTAINER_PORT=5432
VOLUME_NAME="postgres_data"

# Create a Docker volume if it doesn't exist
if [ -z "$(docker volume ls -q -f name=$VOLUME_NAME)" ]; then
  echo "Creating volume $VOLUME_NAME..."
  docker volume create $VOLUME_NAME
fi

# Check if container already exists
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "Container $CONTAINER_NAME already exists. Stopping and removing..."
    docker stop $CONTAINER_NAME >/dev/null 2>&1
    docker rm $CONTAINER_NAME >/dev/null 2>&1
fi

echo "Starting PostgreSQL container with persistent storage..."
docker run -d \
  --name $CONTAINER_NAME \
  -e POSTGRES_USER=$POSTGRES_USER \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB \
  -p $HOST_PORT:$CONTAINER_PORT \
  -v $VOLUME_NAME:/var/lib/postgresql/data \
  postgres:15

echo "PostgreSQL is running on localhost:$HOST_PORT"
echo "User: $POSTGRES_USER | Password: $POSTGRES_PASSWORD | Database: $POSTGRES_DB"
echo "Persistent data stored in Docker volume: $VOLUME_NAME"
