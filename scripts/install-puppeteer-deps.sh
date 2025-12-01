#!/bin/bash

set -e

echo "Installing Puppeteer/Chromium dependencies for Linux..."

sudo apt-get update

echo "Installing required system libraries..."

sudo apt-get install -y \
  libatk-1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libexpat1 \
  libgbm1 \
  libgconf-2-4 \
  libglib2.0-0 \
  libglib2.0-data \
  libgtk-3-0 \
  libgtk-3-common \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangoft2-1.0-0 \
  libpci3 \
  libpulse0 \
  libx11-6 \
  libx11-xcb1 \
  libxau6 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxdmcp6 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxinerama1 \
  libxkbcommon0 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  ca-certificates \
  fonts-liberation \
  libappindicator1 \
  libc6 \
  libcairo2 \
  libexpat1 \
  libfontconfig1 \
  libfreetype6 \
  libpng16-16 \
  libx11-6 \
  libxcb-render0 \
  libxrender1

echo "✓ All Puppeteer dependencies installed successfully!"
echo ""
echo "Your PDF generation should now work. Restart your Node.js server:"
echo "  sudo systemctl restart couche-co"
echo ""
echo "Or if running manually:"
echo "  npm start"
