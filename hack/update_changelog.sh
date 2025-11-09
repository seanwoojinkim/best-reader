#!/bin/bash

# update_changelog.sh - Helper for updating CHANGELOG.md
# Makes it easy to add new entries in the standard format
#
# Usage:
#   ./hack/update_changelog.sh <version> <type> <title> <description>
#
# Examples:
#   ./hack/update_changelog.sh 0.2.2 added "OAuth2 Authentication" "Added OAuth2 login flow"
#   ./hack/update_changelog.sh 0.2.2 changed "User Profile" "Improved profile page layout"
#   ./hack/update_changelog.sh 0.2.2 fixed "Login Bug" "Fixed authentication redirect issue"

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
print_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
print_usage() { echo -e "${BLUE}[USAGE]${NC} $1" >&2; }

usage() {
    cat >&2 << EOF
${BLUE}Update CHANGELOG.md${NC}

Usage:
  $0 <version> <type> <title> <description>

Arguments:
  version      - Version number (e.g., 0.2.2)
  type         - Change type: added, changed, fixed, removed, deprecated, security
  title        - Short title of the change
  description  - Detailed description

Examples:
  # Add new feature
  $0 0.2.2 added "OAuth2 Authentication" "Added OAuth2 login flow with Google provider"

  # Document change
  $0 0.2.2 changed "User Dashboard" "Improved dashboard layout and responsiveness"

  # Document fix
  $0 0.2.2 fixed "Login Redirect" "Fixed authentication redirect issue on logout"

  # Interactive mode (prompts for all fields)
  $0 --interactive

Change Types:
  added      - New features
  changed    - Changes in existing functionality
  deprecated - Soon-to-be removed features
  removed    - Removed features
  fixed      - Bug fixes
  security   - Security improvements

Format:
  Follows Keep a Changelog format: https://keepachangelog.com/

EOF
    exit 1
}

# Interactive mode
interactive_mode() {
    print_info "Interactive CHANGELOG update mode"
    echo ""

    read -p "Version (e.g., 0.2.2): " VERSION
    echo ""
    echo "Change type:"
    echo "  1) added      - New features"
    echo "  2) changed    - Changes in existing functionality"
    echo "  3) fixed      - Bug fixes"
    echo "  4) removed    - Removed features"
    echo "  5) deprecated - Soon-to-be removed features"
    echo "  6) security   - Security improvements"
    read -p "Select type (1-6): " TYPE_NUM

    case $TYPE_NUM in
        1) TYPE="added" ;;
        2) TYPE="changed" ;;
        3) TYPE="fixed" ;;
        4) TYPE="removed" ;;
        5) TYPE="deprecated" ;;
        6) TYPE="security" ;;
        *) print_error "Invalid type"; exit 1 ;;
    esac

    echo ""
    read -p "Short title: " TITLE
    read -p "Description: " DESCRIPTION

    echo ""
    print_info "Summary:"
    echo "  Version: $VERSION"
    echo "  Type: $TYPE"
    echo "  Title: $TITLE"
    echo "  Description: $DESCRIPTION"
    echo ""
    read -p "Add this entry? (y/n): " CONFIRM

    if [[ "$CONFIRM" != "y" ]]; then
        print_info "Cancelled"
        exit 0
    fi
}

# Check for interactive mode
if [[ "${1:-}" == "--interactive" ]] || [[ "${1:-}" == "-i" ]]; then
    interactive_mode
elif [ $# -lt 4 ]; then
    usage
else
    VERSION=$1
    TYPE=$2
    TITLE=$3
    DESCRIPTION=$4
fi

# Validate type
case $TYPE in
    added|changed|deprecated|removed|fixed|security)
        ;;
    *)
        print_error "Invalid type: $TYPE"
        print_usage "Must be one of: added, changed, deprecated, removed, fixed, security"
        exit 1
        ;;
esac

# Check if CHANGELOG.md exists
CHANGELOG="CHANGELOG.md"
if [ ! -f "$CHANGELOG" ]; then
    print_error "CHANGELOG.md not found in current directory"
    exit 1
fi

# Get today's date
TODAY=$(date +%Y-%m-%d)

# Check if version section exists
if grep -q "## \[$VERSION\]" "$CHANGELOG"; then
    print_info "Version $VERSION already exists, will add to existing section"
    VERSION_EXISTS=true
else
    print_info "Creating new version section: $VERSION"
    VERSION_EXISTS=false
fi

# Capitalize first letter of type for section header
TYPE_HEADER="$(tr '[:lower:]' '[:upper:]' <<< ${TYPE:0:1})${TYPE:1}"

# Create temporary file
TEMP_FILE=$(mktemp)

# Build the changelog entry
if [ "$VERSION_EXISTS" = false ]; then
    # Create new version section
    cat > "$TEMP_FILE" << EOF
## [$VERSION] - $TODAY

### $TYPE_HEADER

#### $TITLE
- $DESCRIPTION

EOF
else
    # Just create the new entry
    cat > "$TEMP_FILE" << EOF

#### $TITLE
- $DESCRIPTION
EOF
fi

# Find insertion point and update CHANGELOG
if [ "$VERSION_EXISTS" = false ]; then
    # Insert new version section after header (line 7 typically)
    # Find the first "## [" line and insert before it
    LINE_NUM=$(grep -n "^## \[" "$CHANGELOG" | head -1 | cut -d: -f1)
    if [ -z "$LINE_NUM" ]; then
        # No versions yet, append after header
        cat "$CHANGELOG" > "${CHANGELOG}.bak"
        head -7 "$CHANGELOG" > "${CHANGELOG}.new"
        cat "$TEMP_FILE" >> "${CHANGELOG}.new"
        tail -n +8 "$CHANGELOG" >> "${CHANGELOG}.new"
    else
        cat "$CHANGELOG" > "${CHANGELOG}.bak"
        head -$((LINE_NUM - 1)) "$CHANGELOG" > "${CHANGELOG}.new"
        cat "$TEMP_FILE" >> "${CHANGELOG}.new"
        tail -n +${LINE_NUM} "$CHANGELOG" >> "${CHANGELOG}.new"
    fi
    mv "${CHANGELOG}.new" "$CHANGELOG"
else
    # Find the ### $TYPE_HEADER section within the version
    cat "$CHANGELOG" > "${CHANGELOG}.bak"

    # Use awk to insert into existing section
    awk -v version="$VERSION" -v type_header="$TYPE_HEADER" -v entry_file="$TEMP_FILE" '
    BEGIN { in_version=0; in_section=0; inserted=0; }

    # Found our version
    /^## \[/ {
        if ($0 ~ version) {
            in_version=1
        } else if (in_version) {
            in_version=0
        }
    }

    # Found our type section within the version
    /^### / {
        if (in_version && $0 ~ type_header && !inserted) {
            in_section=1
            print $0
            # Print existing content until next section
            getline
            while (getline line < entry_file) {
                print line
            }
            close(entry_file)
            inserted=1
            print ""
            next
        } else if (in_version && in_section) {
            in_section=0
        }
    }

    # If we reach the next version without finding our section, create it
    /^## \[/ {
        if (in_version && !inserted) {
            print "\n### " type_header
            while (getline line < entry_file) {
                print line
            }
            close(entry_file)
            inserted=1
            print ""
        }
    }

    { print }

    END {
        # If we never found the section, something went wrong
        if (!inserted) {
            print "Warning: Could not find section to insert entry" > "/dev/stderr"
        }
    }
    ' "$CHANGELOG" > "${CHANGELOG}.new"

    mv "${CHANGELOG}.new" "$CHANGELOG"
fi

# Clean up
rm -f "$TEMP_FILE"

print_info "✓ CHANGELOG.md updated successfully"
print_info "  Version: $VERSION"
print_info "  Type: $TYPE"
print_info "  Entry: $TITLE"
echo ""
print_info "Backup saved to: ${CHANGELOG}.bak"
print_info "Review changes with: git diff CHANGELOG.md"
