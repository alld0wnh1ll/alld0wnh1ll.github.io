#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║     ETHEREUM IMMERSIVE TRAINER                             ║"
echo "║     Interactive Blockchain Learning Environment            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Default values
MODE="${MODE:-instructor}"
RPC_PORT="${RPC_PORT:-8545}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo -e "Mode: ${BLUE}$MODE${NC}"
echo ""

# Graceful shutdown handler
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    
    if [ ! -z "$HARDHAT_PID" ]; then
        kill $HARDHAT_PID 2>/dev/null || true
    fi
    if [ ! -z "$INDEXER_PID" ]; then
        kill $INDEXER_PID 2>/dev/null || true
    fi
    if [ ! -z "$TERMINAL_PID" ]; then
        kill $TERMINAL_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ Services stopped${NC}"
    exit 0
}
trap cleanup SIGTERM SIGINT

# ============================================
# INSTRUCTOR MODE
# Runs blockchain node + deploys contracts + serves frontend
# ============================================
if [ "$MODE" = "instructor" ]; then
    echo -e "${GREEN}🎓 Starting INSTRUCTOR mode...${NC}"
    echo "   - Blockchain node will run on port $RPC_PORT"
    echo "   - Frontend will run on port $FRONTEND_PORT"
    echo ""
    
    # Ensure contracts directory exists
    mkdir -p /app/contracts/student
    
    # Start Hardhat node in background
    echo -e "${BLUE}⛓️  Starting Hardhat blockchain node...${NC}"
    npx hardhat node --hostname 0.0.0.0 --port $RPC_PORT &
    HARDHAT_PID=$!
    
    # Wait for node to be ready
    echo "   Waiting for blockchain node to start..."
    for i in $(seq 1 30); do
        if curl -s -X POST http://localhost:$RPC_PORT \
            -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null 2>&1; then
            echo -e "   ${GREEN}✓ Blockchain node is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "   ${RED}✗ Failed to start blockchain node!${NC}"
            exit 1
        fi
        sleep 2
    done
    
    # Brief pause to ensure node is fully ready for deployments
    sleep 2
    
    # Deploy PoS contracts (must succeed or container exits)
    echo ""
    echo -e "${BLUE}📜 Deploying PoS Simulator...${NC}"
    if ! npx hardhat run scripts/deploy.js --network localhost; then
        echo ""
        echo -e "${RED}✗ Contract deployment failed!${NC}"
        echo "  If you see 'Transaction reverted' or 'require(false)', try:"
        echo "  1. docker-compose down -v   (removes persisted data)"
        echo "  2. docker-compose up --build"
        exit 1
    fi
    
    # Deploy Chain City (game contracts)
    echo ""
    echo -e "${BLUE}🎮 Deploying Chain City (game contracts)...${NC}"
    if npx hardhat run scripts/deploy-game.js --network localhost; then
        echo -e "   ${GREEN}✓ Chain City deployed${NC}"
        if [ -f "/app/frontend/public/game-config.json" ]; then
            cp /app/frontend/public/game-config.json /app/frontend/dist/game-config.json
            echo -e "   ${GREEN}✓ game-config.json copied to frontend${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠ Chain City deployment failed (game features may not work)${NC}"
    fi
    
    # Deploy Beacon Chain Lab (optional, set DEPLOY_BEACON_LAB=1 to enable)
    if [ "${DEPLOY_BEACON_LAB}" = "1" ]; then
        echo ""
        echo -e "${BLUE}⛓ Deploying Beacon Chain Lab...${NC}"
        if npx hardhat run scripts/deploy-beacon-lab.js --network localhost; then
            echo -e "   ${GREEN}✓ Beacon Chain Lab deployed${NC}"
            if [ -f "/app/frontend/public/beacon-lab-config.json" ]; then
                cp /app/frontend/public/beacon-lab-config.json /app/frontend/dist/beacon-lab-config.json
                echo -e "   ${GREEN}✓ beacon-lab-config.json copied to frontend${NC}"
            fi
        else
            echo -e "   ${YELLOW}⚠ Beacon Chain Lab deployment failed${NC}"
        fi
    fi
    
    # Start Chain City indexer in background
    echo ""
    echo -e "${BLUE}📊 Starting Chain City indexer (port 3001)...${NC}"
    if [ -f "/app/frontend/public/game-config.json" ] || [ -f "/app/frontend/dist/game-config.json" ]; then
        RPC_URL="http://localhost:$RPC_PORT" node indexer/index.js &
        INDEXER_PID=$!
        sleep 2
        echo -e "   ${GREEN}✓ Indexer running${NC}"
    else
        echo -e "   ${YELLOW}⚠ Skipping indexer (no game-config.json)${NC}"
    fi

    # Start Lab Terminal (PTY) in background (listens on TERMINAL_PORTS or 3002)
    echo ""
    echo -e "${BLUE}🖥️  Starting Lab Terminal (ports 3002, 3003, 3004)...${NC}"
    node server/terminal-server.js &
    TERMINAL_PID=$!
    sleep 1
    echo -e "   ${GREEN}✓ Lab Terminal running${NC}"
    
    # Read and export contract address
    if [ -f "CONTRACT_ADDRESS.txt" ]; then
        CONTRACT_ADDRESS=$(head -1 CONTRACT_ADDRESS.txt | tr -d '\r\n')
        export CONTRACT_ADDRESS
        
        # Save to web-accessible location for auto-configuration
        mkdir -p /app/frontend/dist/api
        
        # Get container/host IP for external access hints
        CONTAINER_IP=$(hostname -i 2>/dev/null || echo "localhost")
        
        # Create config JSON (use /rpc-proxy for same-origin, avoids CORS in Docker)
        cat > /app/frontend/dist/api/config.json << EOF
{
  "contractAddress": "$CONTRACT_ADDRESS",
  "rpcUrl": "/rpc-proxy",
  "mode": "instructor",
  "startTime": "$(date -Iseconds)"
}
EOF
        echo "$CONTRACT_ADDRESS" > /app/frontend/dist/contract-address.txt
        
        echo -e "   ${GREEN}✓ Contract deployed!${NC}"
    else
        echo -e "   ${YELLOW}⚠ Warning: Could not find contract address file${NC}"
    fi
    
    # Start frontend server (with Lab API for session/fund-requests)
    echo ""
    echo -e "${BLUE}🌐 Starting frontend server (with Lab API)...${NC}"
    FRONTEND_PORT=$FRONTEND_PORT node /app/server/frontend-server.js &
    FRONTEND_PID=$!
    
    # Wait a moment for serve to start
    sleep 2
    
    # Print success banner
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo -e "║  ${GREEN}✓ INSTRUCTOR NODE IS RUNNING${NC}                                ║"
    echo "║                                                                ║"
    echo "╠════════════════════════════════════════════════════════════════╣"
    echo "║                                                                ║"
    echo "║  LOCAL ACCESS:                                                 ║"
    echo "║    Frontend:      http://localhost:$FRONTEND_PORT                       ║"
    echo "║    Blockchain:    http://localhost:$RPC_PORT                        ║"
    echo "║                                                                ║"
    echo "╠════════════════════════════════════════════════════════════════╣"
    echo "║                                                                ║"
    echo "║  CONTRACT ADDRESS:                                             ║"
    echo "║    $CONTRACT_ADDRESS                           ║"
    echo "║                                                                ║"
    echo "╠════════════════════════════════════════════════════════════════╣"
    echo "║                                                                ║"
    echo "║  📋 SHARE WITH STUDENTS:                                       ║"
    echo "║    1. Find your IP: hostname -I (Linux) or ipconfig (Windows)  ║"
    echo "║    2. Share:                                                   ║"
    echo "║       - Frontend: http://<YOUR-IP>:$FRONTEND_PORT                       ║"
    echo "║       - RPC URL:  http://<YOUR-IP>:$RPC_PORT                        ║"
    echo "║       - Contract: $CONTRACT_ADDRESS            ║"
    echo "║    3. Chain City: Live view -> Chain City button               ║"
    echo "║                                                                ║"
    echo "║  📄 Auto-config endpoints:                                     ║"
    echo "║    http://localhost:$FRONTEND_PORT/contract-address.txt             ║"
    echo "║    http://localhost:$FRONTEND_PORT/api/config.json                  ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    
# ============================================
# STUDENT MODE  
# Only serves frontend, connects to instructor's blockchain
# ============================================
elif [ "$MODE" = "student" ]; then
    echo -e "${GREEN}📚 Starting STUDENT mode...${NC}"
    
    # Check for required instructor connection info
    if [ -z "$INSTRUCTOR_RPC_URL" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  INSTRUCTOR_RPC_URL not set!${NC}"
        echo "   Students need to connect to instructor's blockchain."
        echo ""
        echo "   Set environment variable:"
        echo "   INSTRUCTOR_RPC_URL=http://<instructor-ip>:8545"
        echo ""
        INSTRUCTOR_RPC_URL="http://localhost:8545"
    fi
    
    echo "   - Connecting to: $INSTRUCTOR_RPC_URL"
    echo "   - Frontend will run on port $FRONTEND_PORT"
    echo ""
    
    # Start Lab Terminal (PTY) so remote students can use the terminal from their browser
    echo -e "${BLUE}🖥️  Starting Lab Terminal (ports 3002, 3003, 3004)...${NC}"
    TERMINAL_PORTS="${TERMINAL_PORTS:-3002,3003,3004}" TERMINAL_CWD=/app node server/terminal-server.js &
    TERMINAL_PID=$!
    sleep 1
    echo -e "   ${GREEN}✓ Lab Terminal running (students can use terminal from browser)${NC}"
    echo ""
    
    # Create config for student to connect to instructor
    mkdir -p /app/frontend/dist/api
    cat > /app/frontend/dist/api/config.json << EOF
{
  "rpcUrl": "$INSTRUCTOR_RPC_URL",
  "contractAddress": "$CONTRACT_ADDRESS",
  "mode": "student",
  "startTime": "$(date -Iseconds)"
}
EOF
    
    # Start frontend server
    echo -e "${BLUE}🌐 Starting frontend server...${NC}"
    serve -s /app/frontend/dist -l $FRONTEND_PORT &
    FRONTEND_PID=$!
    
    sleep 2
    
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo -e "║  ${GREEN}✓ STUDENT CLIENT IS RUNNING${NC}                               ║"
    echo "║                                                            ║"
    echo "╠════════════════════════════════════════════════════════════╣"
    echo "║                                                            ║"
    echo "║  Frontend:        http://localhost:$FRONTEND_PORT                  ║"
    echo "║  Lab Terminal:    ports 3002, 3003, 3004 (browser shell)   ║"
    echo "║  Instructor RPC:  $INSTRUCTOR_RPC_URL"
    echo "║                                                            ║"
    echo "║  Open browser to: http://localhost:$FRONTEND_PORT                  ║"
    echo "║  Lab Terminal: use --network instructor for Hardhat console ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
else
    echo -e "${RED}❌ Unknown mode: $MODE${NC}"
    echo "   Valid modes: instructor, student"
    exit 1
fi

# Keep container running and wait for child processes
wait
