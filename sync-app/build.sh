#!/bin/bash
set -e

echo "Installing root dependencies..."
pnpm install

echo "Installing web dependencies..."
cd web
pnpm install

echo "Building web application..."
pnpm run build

echo "Build completed successfully!"
