# Hack Scripts

Utility scripts for the MRP system and Claude Code workflow.

## Workflow Scripts

### `update_changelog.sh`

**Purpose**: Helper script to update CHANGELOG.md in Keep a Changelog format.

**Usage**:
```bash
# Interactive mode (recommended - prompts for all fields)
./hack/update_changelog.sh --interactive

# Direct command
./hack/update_changelog.sh <version> <type> <title> <description>
```

**Examples**:

```bash
# Add new feature
./hack/update_changelog.sh 0.2.2 added "OAuth2 Authentication" \
  "Added OAuth2 login flow with Google provider"

# Document change
./hack/update_changelog.sh 0.2.2 changed "User Dashboard" \
  "Improved dashboard layout and responsiveness"

# Document bug fix
./hack/update_changelog.sh 0.2.2 fixed "Login Redirect" \
  "Fixed authentication redirect issue on logout"
```

**Change Types**:
- `added` - New features
- `changed` - Changes in existing functionality
- `fixed` - Bug fixes
- `removed` - Removed features
- `deprecated` - Soon-to-be removed features
- `security` - Security improvements

**Features**:
- Interactive mode for easy use
- Automatic section creation/management
- Creates backup before modifying
- Follows Keep a Changelog format
- Handles version sections automatically

### `generate_frontmatter.sh`

**Purpose**: Generate complete YAML frontmatter for thought documents, eliminating context waste in AI agents.

**Usage**:
```bash
./hack/generate_frontmatter.sh <doc_type> <title> [ticket_id] [options]
```

**Doc Types**: `research`, `plan`, `implementation`, `review`, `learning`

**Examples**:

```bash
# Research document
./hack/generate_frontmatter.sh research "Authentication Flow" ENG-1234 \
  --research-question "How does auth work?" \
  --tags "research,auth,security"

# Plan document
./hack/generate_frontmatter.sh plan "OAuth2 Implementation" ENG-1234 \
  --feature "OAuth2 Authentication" \
  --tags "plan,oauth2,auth"

# Review document
./hack/generate_frontmatter.sh review "Phase 1 Review: Database" ENG-1234 \
  --phase 1 \
  --phase-name "Database Schema" \
  --status approved \
  --issues 2 \
  --blocking 0
```

**See**: `.claude/FRONTMATTER_GENERATION.md` for complete documentation

### `spec_metadata.sh`

**Purpose**: Display git metadata for documentation (legacy - use `generate_frontmatter.sh` instead).

**Usage**:
```bash
./hack/spec_metadata.sh           # Display human-readable output
./hack/spec_metadata.sh --json    # Output JSON format
```

**Outputs**:
- Current date/time with timezone
- Git commit hash
- Branch name
- Repository name
- Author name and email

## System Scripts

### `spec_metadata.sh` Options

Generate filename suggestions:
```bash
./hack/spec_metadata.sh --generate-filename ENG-1234 "feature description"
# Output: 2025-10-15-ENG-1234-feature-description.md

./hack/spec_metadata.sh --generate-filename "" "no ticket feature"
# Output: 2025-10-15-no-ticket-feature.md
```

## For AI Agents

**IMPORTANT**: AI agents should ALWAYS use `generate_frontmatter.sh` instead of manually constructing frontmatter.

Benefits:
- Zero context waste reading format specifications
- Perfect consistency across all documents
- No placeholder values - real metadata from git
- Automatic filename suggestions
- Input validation and helpful errors

Example agent usage:
```bash
# Agent builds command based on document type
./hack/generate_frontmatter.sh research "My Research Title" ENG-9999 \
  --research-question "What does this code do?" \
  --tags "research,component,pattern"

# Agent captures output (YAML to stdout)
# Agent pastes complete frontmatter into document
# No manual construction needed!
```

## Script Maintenance

When adding new scripts:
1. Add executable permission: `chmod +x hack/new_script.sh`
2. Document in this README
3. Add usage examples
4. Update `.claude/` documentation if workflow-related

---

**For more information**: See `.claude/` directory for complete workflow documentation.
