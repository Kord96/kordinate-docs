#!/bin/bash
# Wire a project to the docs site by copying atlas data

set -e

PROJECT_NAME="${1:-}"

if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: ./scripts/wire-project.sh <project-name>"
  echo ""
  echo "This script copies atlas data from a project to the docs site."
  echo "The project must exist in /home/claude/projects/<project-name>/"
  exit 1
fi

PROJECT_PATH="/home/claude/projects/$PROJECT_NAME"
DOCS_DATA_DIR="src/content/docs/$PROJECT_NAME"

# Verify project exists
if [ ! -d "$PROJECT_PATH" ]; then
  echo "❌ Project not found: $PROJECT_PATH"
  exit 1
fi

# Get atlas.json from augur memory
ATLAS_SOURCE="$PROJECT_PATH/.kord/agents/augur/memory/atlas.json"
if [ ! -f "$ATLAS_SOURCE" ]; then
  echo "❌ Atlas not found: $ATLAS_SOURCE"
  echo "   Make sure the project has been analyzed with augur"
  exit 1
fi

# Create docs directory
mkdir -p "$DOCS_DATA_DIR"
echo "📁 Created $DOCS_DATA_DIR"

# Copy atlas.json
cp "$ATLAS_SOURCE" "$DOCS_DATA_DIR/atlas.json"
echo "✓ Copied atlas.json"

# Copy stories directory if it exists
if [ -d "$PROJECT_PATH/.kord/agents/augur/memory/stories" ]; then
  mkdir -p "$DOCS_DATA_DIR/stories"
  cp "$PROJECT_PATH/.kord/agents/augur/memory/stories"/* "$DOCS_DATA_DIR/stories/" 2>/dev/null || true
  echo "✓ Copied stories"
fi

# Create manifest and story index if needed
if [ ! -f "$DOCS_DATA_DIR/manifest.json" ]; then
  cat > "$DOCS_DATA_DIR/manifest.json" << 'EOF'
{
  "project": "auto-generated",
  "generated": "auto-generated",
  "sources": {
    "atlas": "augur/memory/atlas.json",
    "stories": "augur/memory/stories/"
  }
}
EOF
  echo "✓ Created manifest.json"
fi

# Create journey placeholder if it doesn't exist
if [ ! -f "$DOCS_DATA_DIR/journeys/index.md" ]; then
  mkdir -p "$DOCS_DATA_DIR/journeys"
  cat > "$DOCS_DATA_DIR/journeys/index.md" << EOF
---
title: $PROJECT_NAME Journey
---

# $PROJECT_NAME

This is a placeholder journey page. Create custom journey pages in this directory.

- [Atlas](/dev/$PROJECT_NAME/atlas/)
- [Issues](/dev/$PROJECT_NAME/issues/)
EOF
  echo "✓ Created journey placeholder"
fi

echo ""
echo "✅ Project wired successfully!"
echo ""
echo "Now available at:"
echo "  - /dev/$PROJECT_NAME/ (journey - customize at $DOCS_DATA_DIR/journeys/)"
echo "  - /dev/$PROJECT_NAME/atlas/ (architecture, findings, patterns)"
echo ""
echo "The Atlas page contains:"
echo "  - Architecture graph and components"
echo "  - Technical debt violations and recommendations"
echo "  - Failure modes and recovery paths"
echo "  - Detected patterns, anti-patterns, and gaps"
