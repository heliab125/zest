#!/bin/bash
# Build script for Zest

set -e

echo "=========================================="
echo "  Zest Build Script"
echo "=========================================="

# Check prerequisites
echo ""
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm $(npm --version)"

if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found. Install from https://rustup.rs/"
    exit 1
fi
echo "✅ Rust $(rustc --version | cut -d' ' -f2)"

if ! command -v cargo &> /dev/null; then
    echo "❌ Cargo not found"
    exit 1
fi
echo "✅ Cargo $(cargo --version | cut -d' ' -f2)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build
echo ""
echo "Building Zest..."
npm run tauri build

echo ""
echo "=========================================="
echo "  Build Complete!"
echo "=========================================="
echo ""
echo "Output locations:"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macOS app: src-tauri/target/release/bundle/macos/"
    echo "DMG:       src-tauri/target/release/bundle/dmg/"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "Windows:   src-tauri/target/release/bundle/msi/"
    echo "           src-tauri/target/release/bundle/nsis/"
else
    echo "Linux:     src-tauri/target/release/bundle/deb/"
    echo "           src-tauri/target/release/bundle/appimage/"
fi

echo ""
