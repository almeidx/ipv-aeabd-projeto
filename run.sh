#!/bin/bash

docker compose down
# docker volume prune -a -f
# docker system prune -a -f
docker volume rm ipv-aeabd-projeto_dynamodb_data
docker volume rm ipv-aeabd-projeto_mongo_data
docker volume rm ipv-aeabd-projeto_pg_data

docker compose up -d

sleep 10 # give the db's time to boot

node --run create-tables
node --run generate-data
