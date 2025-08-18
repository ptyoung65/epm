#!/bin/bash

# AIRIS-MON Setup Script
# This script sets up the development environment for AIRIS-MON

set -e

echo "🚀 Setting up AIRIS-MON development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! dpkg --compare-versions "$NODE_VERSION" "ge" "$REQUIRED_VERSION"; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js $REQUIRED_VERSION or later."
    exit 1
fi

print_success "Node.js version $NODE_VERSION detected"

# Check if Docker is available
if command -v docker &> /dev/null; then
    print_success "Docker detected"
else
    print_warning "Docker not found. You'll need to install Docker to use containerized services."
fi

# Create necessary directories
print_status "Creating project directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p backups
mkdir -p certificates

# Set up environment file
if [ ! -f .env ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_warning "Please update the .env file with your actual configuration values."
else
    print_success ".env file already exists"
fi

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Build the project
print_status "Building the project..."
npm run build

# Run tests to ensure everything is working
print_status "Running tests..."
npm test

print_success "AIRIS-MON setup completed successfully!"
print_status "Next steps:"
echo "  1. Update .env file with your configuration"
echo "  2. Start development server: npm run dev"
echo "  3. Or start with Docker: npm run docker:dev"
echo ""
print_status "Available commands:"
echo "  npm run dev        - Start development server"
echo "  npm run build      - Build for production"
echo "  npm run test       - Run tests"
echo "  npm run lint       - Run linting"
echo "  npm run docker:dev - Start with Docker Compose"
echo ""
print_success "Happy coding! 🎉"