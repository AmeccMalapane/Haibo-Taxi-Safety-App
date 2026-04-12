#!/bin/bash

# Haibo App: Daily Facebook Sync Script
# This script runs the scraper and the database ingestion logic.

PROJECT_DIR="/home/ubuntu/Haibo-Taxi-Safety-App/Haibo_info/Haibo-Taxi-Safety-App"
SCRIPTS_DIR="$PROJECT_DIR/scripts/fb-sync"

echo "[$(date)] Starting daily Facebook sync..."

# 1. Navigate to project directory
cd "$PROJECT_DIR"

# 2. Run the scraper
echo "[$(date)] Running scraper..."
python3 "$SCRIPTS_DIR/fb_scraper.py"

# 3. Run the ingestion script
echo "[$(date)] Running database ingestion..."
npx tsx "$SCRIPTS_DIR/ingest.ts"

echo "[$(date)] Sync completed successfully."
