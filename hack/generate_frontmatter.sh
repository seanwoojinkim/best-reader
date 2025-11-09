#!/bin/bash

# generate_frontmatter.sh - Generate complete frontmatter for thought documents
# This script eliminates context waste by providing ready-to-paste YAML frontmatter
#
# Usage:
#   ./hack/generate_frontmatter.sh <doc_type> <title> [ticket_id] [options]
#
# Doc Types:
#   research, plan, implementation, review, learning
#
# Examples:
#   ./hack/generate_frontmatter.sh research "Authentication Flow Investigation" ENG-1234
#   ./hack/generate_frontmatter.sh plan "OAuth2 Implementation Plan" ENG-1234 --feature "OAuth2 Authentication"
#   ./hack/generate_frontmatter.sh review "Phase 1 Review" ENG-1234 --phase 1 --phase-name "Database Schema"
#   ./hack/generate_frontmatter.sh learning "OAuth2 Learning Synthesis" ENG-1234 --feature-ref thoughts/plans/2025-10-15-oauth2.md

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() { echo -e "${GREEN}[INFO]${NC} $1" >&2; }
print_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1" >&2; }
print_usage() { echo -e "${BLUE}[USAGE]${NC} $1" >&2; }

# Show usage
usage() {
    cat >&2 << EOF
${BLUE}Generate Frontmatter for Thought Documents${NC}

Usage:
  $0 <doc_type> <title> [ticket_id] [options]

Doc Types:
  research        - Codebase research documents
  plan            - Implementation plan documents
  implementation  - Implementation progress documents
  review          - Code review documents
  learning        - Learning synthesis documents

Required Arguments:
  doc_type        - One of: research, plan, implementation, review, learning
  title           - Document title (quoted if contains spaces)

Optional Arguments:
  ticket_id       - Ticket ID (e.g., ENG-1234), omit if no ticket

Options (type-specific):
  Research:
    --research-question "..."  - The research question
    --research-type TYPE       - Type of research: online_research, codebase_research, or hybrid
    --research-strategy "..."  - Strategy used (e.g., "academic,industry")
    --sources-reviewed N       - Number of sources reviewed
    --quality-score SCORE      - Overall quality: high, medium, or low
    --confidence LEVEL         - Confidence level: high, medium, or low

  Plan:
    --feature "..."           - Feature name
    --plan-ref PATH           - Reference to research document

  Implementation:
    --plan-ref PATH           - Reference to plan document
    --phase N                 - Current phase number
    --phase-name "..."        - Phase name

  Review:
    --plan-ref PATH           - Reference to plan document
    --impl-ref PATH           - Reference to implementation document
    --phase N                 - Reviewed phase number
    --phase-name "..."        - Phase name
    --status STATUS           - Review status: approved, approved_with_notes, revisions_needed
    --issues N                - Number of issues found
    --blocking N              - Number of blocking issues

  Learning:
    --feature-ref PATH        - Reference to feature plan
    --learning-type TYPE      - phase_summary or comprehensive_synthesis
    --level LEVEL             - beginner, intermediate, or advanced
    --concepts "c1,c2,c3"     - Comma-separated list of concepts
    --patterns "p1,p2,p3"     - Comma-separated list of patterns

  Common:
    --tags "tag1,tag2,tag3"   - Comma-separated list of tags
    --status STATUS           - Document status: draft, in_progress, complete, archived
    --related "path1,path2"   - Comma-separated list of related document paths

Examples:
  # Research document
  $0 research "Authentication Flow Investigation" ENG-1234 \\
    --research-question "How does authentication work in the application?" \\
    --research-type "online_research" \\
    --research-strategy "academic,industry" \\
    --sources-reviewed 15 \\
    --quality-score "high" \\
    --confidence "high" \\
    --tags "research,authentication,security"

  # Plan document
  $0 plan "OAuth2 Implementation Plan" ENG-1234 \\
    --feature "OAuth2 Authentication" \\
    --plan-ref thoughts/research/2025-10-15-auth-research.md \\
    --tags "plan,authentication,oauth2"

  # Implementation document
  $0 implementation "OAuth2 Implementation Progress" ENG-1234 \\
    --plan-ref thoughts/plans/2025-10-15-oauth2-plan.md \\
    --phase 1 \\
    --phase-name "Database Schema" \\
    --tags "implementation,oauth2,database"

  # Review document
  $0 review "Phase 1 Review: Database Schema" ENG-1234 \\
    --plan-ref thoughts/plans/2025-10-15-oauth2-plan.md \\
    --impl-ref thoughts/implementation-details/2025-10-15-oauth2.md \\
    --phase 1 \\
    --phase-name "Database Schema" \\
    --status approved \\
    --issues 2 \\
    --blocking 0

  # Learning document
  $0 learning "OAuth2 Learning Synthesis" ENG-1234 \\
    --feature-ref thoughts/plans/2025-10-15-oauth2-plan.md \\
    --learning-type comprehensive_synthesis \\
    --level intermediate \\
    --concepts "jwt-tokens,oauth2-flow,session-management" \\
    --patterns "service-objects,repository-pattern"

EOF
    exit 1
}

# Validate doc type
validate_doc_type() {
    local type=$1
    case $type in
        research|plan|implementation|review|learning)
            return 0
            ;;
        *)
            print_error "Invalid doc_type: $type"
            print_usage "Must be one of: research, plan, implementation, review, learning"
            exit 1
            ;;
    esac
}

# Check if in git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository"
    exit 1
fi

# Parse required arguments
if [ $# -lt 2 ]; then
    usage
fi

DOC_TYPE=$1
TITLE=$2
shift 2

TICKET_ID=""
if [ $# -gt 0 ] && [[ ! "$1" =~ ^-- ]]; then
    TICKET_ID=$1
    shift
fi

validate_doc_type "$DOC_TYPE"

# Gather git metadata
ISO_DATETIME=$(date -u +"%Y-%m-%dT%H:%M:%S%z" | sed 's/\([0-9][0-9]\)$/:\1/')
SIMPLE_DATE=$(date +"%Y-%m-%d")
GIT_COMMIT=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_REPO=$(basename "$(git rev-parse --show-toplevel)")
AUTHOR_NAME=$(git config user.name || echo "Claude")

# Default values
STATUS="draft"
TAGS=""
RELATED_DOCS=""

# Type-specific defaults and variables
RESEARCH_QUESTION=""
RESEARCH_TYPE=""
RESEARCH_STRATEGY=""
SOURCES_REVIEWED=""
QUALITY_SCORE=""
CONFIDENCE=""
FEATURE=""
PLAN_REF=""
IMPL_REF=""
FEATURE_REF=""
PHASE=""
PHASE_NAME=""
REVIEW_STATUS=""
ISSUES_FOUND=""
BLOCKING_ISSUES=""
LEARNING_TYPE=""
LEARNING_LEVEL=""
CONCEPTS=""
PATTERNS=""

# Parse options
while [ $# -gt 0 ]; do
    case $1 in
        --research-question)
            RESEARCH_QUESTION="$2"
            shift 2
            ;;
        --research-type)
            RESEARCH_TYPE="$2"
            shift 2
            ;;
        --research-strategy)
            RESEARCH_STRATEGY="$2"
            shift 2
            ;;
        --sources-reviewed)
            SOURCES_REVIEWED="$2"
            shift 2
            ;;
        --quality-score)
            QUALITY_SCORE="$2"
            shift 2
            ;;
        --confidence)
            CONFIDENCE="$2"
            shift 2
            ;;
        --feature)
            FEATURE="$2"
            shift 2
            ;;
        --plan-ref)
            PLAN_REF="$2"
            shift 2
            ;;
        --impl-ref)
            IMPL_REF="$2"
            shift 2
            ;;
        --feature-ref)
            FEATURE_REF="$2"
            shift 2
            ;;
        --phase)
            PHASE="$2"
            shift 2
            ;;
        --phase-name)
            PHASE_NAME="$2"
            shift 2
            ;;
        --status)
            STATUS="$2"
            shift 2
            ;;
        --review-status)
            REVIEW_STATUS="$2"
            shift 2
            ;;
        --issues)
            ISSUES_FOUND="$2"
            shift 2
            ;;
        --blocking)
            BLOCKING_ISSUES="$2"
            shift 2
            ;;
        --learning-type)
            LEARNING_TYPE="$2"
            shift 2
            ;;
        --level)
            LEARNING_LEVEL="$2"
            shift 2
            ;;
        --concepts)
            CONCEPTS="$2"
            shift 2
            ;;
        --patterns)
            PATTERNS="$2"
            shift 2
            ;;
        --tags)
            TAGS="$2"
            shift 2
            ;;
        --related)
            RELATED_DOCS="$2"
            shift 2
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Helper function to convert CSV to YAML array
csv_to_yaml_array() {
    local csv=$1
    local indent=${2:-}
    if [ -z "$csv" ]; then
        echo "${indent}[]"
        return
    fi

    echo "$csv" | tr ',' '\n' | while read -r item; do
        item=$(echo "$item" | xargs)  # trim whitespace
        echo "${indent}- $item"
    done
}

# Generate base frontmatter
cat << EOF
---
doc_type: $DOC_TYPE
date: $ISO_DATETIME
title: "$TITLE"
_generated: true
_script_version: "1.0"
_generated_at: "$ISO_DATETIME"
EOF

# Add type-specific fields
case $DOC_TYPE in
    research)
        if [ -n "$RESEARCH_QUESTION" ]; then
            echo "research_question: \"$RESEARCH_QUESTION\""
        fi
        if [ -n "$RESEARCH_TYPE" ]; then
            echo "research_type: $RESEARCH_TYPE"
        fi
        if [ -n "$RESEARCH_STRATEGY" ]; then
            echo "research_strategy: \"$RESEARCH_STRATEGY\""
        fi
        if [ -n "$SOURCES_REVIEWED" ]; then
            echo "sources_reviewed: $SOURCES_REVIEWED"
        fi
        if [ -n "$QUALITY_SCORE" ]; then
            echo "quality_score: $QUALITY_SCORE"
        fi
        if [ -n "$CONFIDENCE" ]; then
            echo "confidence: $CONFIDENCE"
        fi
        echo "researcher: $AUTHOR_NAME"
        echo ""
        ;;

    plan)
        if [ -n "$FEATURE" ]; then
            echo "feature: \"$FEATURE\""
        fi
        if [ -n "$PLAN_REF" ]; then
            echo "plan_reference: $PLAN_REF"
        fi
        echo ""
        echo "# Update phase status as implementation progresses"
        echo "phases:"
        echo "  - name: \"Phase 1: Description\""
        echo "    status: pending"
        echo "  - name: \"Phase 2: Description\""
        echo "    status: pending"
        echo ""
        ;;

    implementation)
        if [ -n "$PLAN_REF" ]; then
            echo "plan_reference: $PLAN_REF"
        fi
        if [ -n "$PHASE" ]; then
            echo "current_phase: $PHASE"
        fi
        if [ -n "$PHASE_NAME" ]; then
            echo "phase_name: \"$PHASE_NAME\""
        fi
        echo ""
        ;;

    review)
        if [ -n "$PHASE" ]; then
            echo "reviewed_phase: $PHASE"
        fi
        if [ -n "$PHASE_NAME" ]; then
            echo "phase_name: \"$PHASE_NAME\""
        fi
        if [ -n "$PLAN_REF" ]; then
            echo "plan_reference: $PLAN_REF"
        fi
        if [ -n "$IMPL_REF" ]; then
            echo "implementation_reference: $IMPL_REF"
        fi
        if [ -n "$REVIEW_STATUS" ]; then
            echo "review_status: $REVIEW_STATUS"
        else
            echo "review_status: approved  # approved | approved_with_notes | revisions_needed"
        fi
        echo "reviewer: $AUTHOR_NAME"
        if [ -n "$ISSUES_FOUND" ]; then
            echo "issues_found: $ISSUES_FOUND"
        fi
        if [ -n "$BLOCKING_ISSUES" ]; then
            echo "blocking_issues: $BLOCKING_ISSUES"
        fi
        echo ""
        ;;

    learning)
        if [ -n "$FEATURE_REF" ]; then
            echo "feature_reference: $FEATURE_REF"
        fi
        if [ -n "$LEARNING_TYPE" ]; then
            echo "learning_type: $LEARNING_TYPE"
        else
            echo "learning_type: comprehensive_synthesis  # phase_summary | comprehensive_synthesis"
        fi
        if [ -n "$LEARNING_LEVEL" ]; then
            echo "learning_level: $LEARNING_LEVEL"
        else
            echo "learning_level: intermediate  # beginner | intermediate | advanced"
        fi
        if [ -n "$CONCEPTS" ]; then
            echo "concepts_covered:"
            csv_to_yaml_array "$CONCEPTS" "  "
        else
            echo "concepts_covered: []"
        fi
        if [ -n "$PATTERNS" ]; then
            echo "patterns_used:"
            csv_to_yaml_array "$PATTERNS" "  "
        else
            echo "patterns_used: []"
        fi
        echo ""
        ;;
esac

# Add git lineage
cat << EOF
git_commit: $GIT_COMMIT
branch: $GIT_BRANCH
repository: $GIT_REPO

EOF

# Add attribution
cat << EOF
created_by: $AUTHOR_NAME
last_updated: $SIMPLE_DATE
last_updated_by: $AUTHOR_NAME

EOF

# Add organization fields
if [ -n "$TICKET_ID" ]; then
    echo "ticket_id: $TICKET_ID"
fi

if [ -n "$TAGS" ]; then
    echo "tags:"
    csv_to_yaml_array "$TAGS" "  "
else
    echo "tags: [$DOC_TYPE]"
fi

echo "status: $STATUS"
echo ""

# Add related docs
if [ -n "$RELATED_DOCS" ]; then
    echo "related_docs:"
    csv_to_yaml_array "$RELATED_DOCS" "  "
else
    echo "related_docs: []"
fi

echo "---"

# Print info to stderr
print_info "Frontmatter generated for $DOC_TYPE document" >&2
print_info "Title: $TITLE" >&2
if [ -n "$TICKET_ID" ]; then
    print_info "Ticket: $TICKET_ID" >&2
fi
print_info "Branch: $GIT_BRANCH" >&2
print_info "Commit: ${GIT_COMMIT:0:8}" >&2
echo "" >&2

# Suggest filename
KEBAB_TITLE=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g')
if [ -n "$TICKET_ID" ]; then
    SUGGESTED_FILENAME="${SIMPLE_DATE}-${TICKET_ID}-${KEBAB_TITLE}.md"
else
    SUGGESTED_FILENAME="${SIMPLE_DATE}-${KEBAB_TITLE}.md"
fi

case $DOC_TYPE in
    research)
        SUGGESTED_PATH="thoughts/research/${SUGGESTED_FILENAME}"
        ;;
    plan)
        SUGGESTED_PATH="thoughts/plans/${SUGGESTED_FILENAME}"
        ;;
    implementation)
        SUGGESTED_PATH="thoughts/implementation-details/${SUGGESTED_FILENAME}"
        ;;
    review)
        SUGGESTED_PATH="thoughts/reviews/${SUGGESTED_FILENAME}"
        ;;
    learning)
        SUGGESTED_PATH="thoughts/learning/${SUGGESTED_FILENAME}"
        ;;
esac

print_info "Suggested filename: $SUGGESTED_PATH" >&2
print_info "Copy the frontmatter above and paste into your document" >&2
