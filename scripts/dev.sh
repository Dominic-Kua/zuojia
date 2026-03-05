#!/bin/bash

# Netwriter Development Launcher
# Starts Vite dev server, waits for it to be ready, then launches Electron
# Cleans up all processes when Electron closes or on Ctrl+C

set -e

# Configuration
VITE_PORT=5173
MAX_WAIT=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Process tracking
VITE_PID=""
ELECTRON_PID=""

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Shutting down processes...${NC}"
    
    if [ ! -z "$ELECTRON_PID" ]; then
        echo -e "${BLUE}Stopping Electron (PID: $ELECTRON_PID)${NC}"
        kill $ELECTRON_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$VITE_PID" ]; then
        echo -e "${CYAN}Stopping Vite (PID: $VITE_PID)${NC}"
        kill $VITE_PID 2>/dev/null || true
        # Also kill any child processes
        pkill -P $VITE_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}All processes stopped${NC}"
    exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Check if port is in use
check_port() {
    local port=$1
    nc -z localhost $port 2>/dev/null
    return $?
}

# Wait for port to be ready
wait_for_port() {
    local port=$1
    local attempts=0
    
    echo -e "${CYAN}Waiting for port $port to be ready...${NC}"
    
    while ! check_port $port; do
        sleep 1
        attempts=$((attempts + 1))
        
        if [ $attempts -ge $MAX_WAIT ]; then
            echo -e "${RED}Timeout waiting for port $port${NC}"
            return 1
        fi
        
        if [ $((attempts % 5)) -eq 0 ]; then
            echo -e "${YELLOW}Still waiting... ($attempts seconds)${NC}"
        fi
    done
    
    echo -e "${GREEN}✓ Port $port is ready!${NC}"
    return 0
}

# Main execution
echo -e "${GREEN}Starting Netwriter development environment...${NC}"

# Check for required commands
if ! command -v nc &> /dev/null; then
    echo -e "${RED}Error: 'nc' (netcat) is required but not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: 'npm' is required but not installed${NC}"
    exit 1
fi

if ! command -v electron &> /dev/null; then
    echo -e "${RED}Error: 'electron' is required but not installed${NC}"
    echo -e "${YELLOW}Try running: npm install${NC}"
    exit 1
fi

# Check if Vite is already running
if check_port $VITE_PORT; then
    echo -e "${YELLOW}Warning: Port $VITE_PORT is already in use${NC}"
    echo -e "${YELLOW}Using existing Vite server...${NC}"
else
    # Start Vite dev server in background
    echo -e "${CYAN}Starting Vite dev server...${NC}"
    npm run dev:vite > /tmp/netwriter-vite.log 2>&1 &
    VITE_PID=$!
    
    echo -e "${CYAN}Vite PID: $VITE_PID${NC}"
    
    # Wait for Vite to be ready
    if ! wait_for_port $VITE_PORT; then
        echo -e "${RED}Failed to start Vite. Check logs: /tmp/netwriter-vite.log${NC}"
        tail -20 /tmp/netwriter-vite.log
        exit 1
    fi
fi

# Start Electron
echo -e "${BLUE}Starting Electron...${NC}"
NODE_ENV=development electron . &
ELECTRON_PID=$!

echo -e "${BLUE}Electron PID: $ELECTRON_PID${NC}"
echo -e "${GREEN}✓ All services started!${NC}"
echo -e "${CYAN}Close the Electron window or press Ctrl+C to exit${NC}"

# Wait for Electron to exit
wait $ELECTRON_PID

echo -e "${BLUE}Electron closed${NC}"
