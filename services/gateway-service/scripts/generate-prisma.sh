#!/bin/bash
# Generate Prisma Client
# This script should be run after installing dependencies

cd "$(dirname "$0")/../.."
npx prisma generate --schema=./prisma/schema.prisma
