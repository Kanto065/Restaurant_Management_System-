#!/bin/bash

# FoodMonk Backend - Quick Test Script

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║           FoodMonk Backend - Quick Test Script            ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js ${NODE_VERSION}"
else
    echo -e "${RED}✗${NC} Node.js not found!"
    exit 1
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm ${NPM_VERSION}"
else
    echo -e "${RED}✗${NC} npm not found!"
    exit 1
fi

# Check MongoDB
echo -n "Checking MongoDB... "
if command -v mongod &> /dev/null; then
    MONGO_VERSION=$(mongod --version | head -n 1 | cut -d ' ' -f 3)
    echo -e "${GREEN}✓${NC} MongoDB ${MONGO_VERSION}"
else
    echo -e "${YELLOW}⚠${NC} MongoDB not found or not in PATH"
fi

# Check if .env exists
echo -n "Checking .env file... "
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
else
    echo -e "${YELLOW}⚠${NC} .env file not found, copying from .env.example"
    cp .env.example .env
fi

# Check node_modules
echo -n "Checking dependencies... "
if [ -d node_modules ]; then
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${YELLOW}⚠${NC} Dependencies not installed, run: npm install"
fi

# Check uploads directory
echo -n "Checking uploads directory... "
if [ -d uploads ]; then
    echo -e "${GREEN}✓${NC} Uploads directory exists"
else
    echo -e "${YELLOW}⚠${NC} Creating uploads directory..."
    mkdir -p uploads
    echo -e "${GREEN}✓${NC} Uploads directory created"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Setup Complete! ✓                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Make sure MongoDB is running"
echo "2. Run: npm run seed (to populate sample data)"
echo "3. Run: npm run dev (to start the server)"
echo "4. Open: http://localhost:7878/api-docs"
echo ""
