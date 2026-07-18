#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Sourcing environment variables from .env..."
    set -a # Automatically mark environment variables for export
    source .env # Source the file to load variables into the current shell context
    set +a # Turn off automatic marking
else
    echo ".env file not found. Running without loading secrets."
fi

# Run the main command
npm run dev
