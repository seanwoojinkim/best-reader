#!/bin/bash

# spec_metadata.sh - Gather metadata for research documents
# This script collects all necessary metadata before creating research documentation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Gather current date/time with timezone
CURRENT_DATETIME=$(date '+%Y-%m-%d %H:%M:%S %Z')
DATE_PREFIX=$(date '+%Y-%m-%d')

# Gather git information
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository"
    exit 1
fi

GIT_COMMIT=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_REPO=$(basename "$(git rev-parse --show-toplevel)")

# Get researcher name from git config
RESEARCHER_NAME=$(git config user.name || echo "Unknown")
RESEARCHER_EMAIL=$(git config user.email || echo "unknown@example.com")

# Check if we're in a clean state (optional warning)
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    print_warning "Working directory has uncommitted changes"
fi

# Print metadata
echo "==================================="
echo "Research Document Metadata"
echo "==================================="
echo ""
echo "Date/Time:     $CURRENT_DATETIME"
echo "Git Commit:    $GIT_COMMIT"
echo "Branch:        $GIT_BRANCH"
echo "Repository:    $GIT_REPO"
echo "Researcher:    $RESEARCHER_NAME <$RESEARCHER_EMAIL>"
echo ""
echo "==================================="
echo "Filename Formats"
echo "==================================="
echo ""
echo "With ticket:    ${DATE_PREFIX}-ENG-XXXX-description.md"
echo "Without ticket: ${DATE_PREFIX}-description.md"
echo ""
echo "Example: ${DATE_PREFIX}-ENG-1234-implement-user-auth.md"
echo "Example: ${DATE_PREFIX}-database-optimization-research.md"
echo ""

# Output in JSON format for programmatic use (optional)
if [[ "${1:-}" == "--json" ]]; then
    cat << EOF
{
  "datetime": "$CURRENT_DATETIME",
  "date_prefix": "$DATE_PREFIX",
  "git_commit": "$GIT_COMMIT",
  "git_branch": "$GIT_BRANCH",
  "git_repo": "$GIT_REPO",
  "researcher_name": "$RESEARCHER_NAME",
  "researcher_email": "$RESEARCHER_EMAIL",
  "filename_with_ticket": "${DATE_PREFIX}-ENG-XXXX-description.md",
  "filename_without_ticket": "${DATE_PREFIX}-description.md"
}
EOF
else
    print_info "All metadata collected successfully"
    print_info "Use --json flag for JSON output"
fi

# Helper function to generate filename
if [[ "${1:-}" == "--generate-filename" ]]; then
    TICKET="${2:-}"
    DESCRIPTION="${3:-}"

    if [[ -z "$DESCRIPTION" ]]; then
        print_error "Usage: $0 --generate-filename [TICKET] DESCRIPTION"
        exit 1
    fi

    # Convert description to kebab-case
    KEBAB_DESC=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g')

    if [[ -n "$TICKET" ]]; then
        echo "${DATE_PREFIX}-${TICKET}-${KEBAB_DESC}.md"
    else
        echo "${DATE_PREFIX}-${KEBAB_DESC}.md"
    fi
fi
