#!/bin/bash

# Load environment variables from .env file if it exists.
# Sourced WITHOUT `set -a` so secrets stay shell-local instead of being
# exported to every child process (vite/electron read .env themselves).
if [ -f .env ]; then
    echo "Sourcing environment variables from .env..."
    source .env
else
    echo ".env file not found. Running without loading secrets."
fi

# Run the main command
npm run dev
