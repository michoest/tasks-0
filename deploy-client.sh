#!/bin/bash

# Build the client
cd packages/client
npm run build

# Deploy to GitHub Pages
npx gh-pages -d dist

echo "✅ Client deployed to GitHub Pages!"
echo "📱 Access at: https://tasks.michoest.com"
