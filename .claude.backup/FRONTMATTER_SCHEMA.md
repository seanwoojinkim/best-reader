# Thoughts Directory Frontmatter Schema

This document defines the standard YAML frontmatter schema used across all documentation in the `thoughts/` directory. Consistent metadata enables traceability, searchability, and automated tooling.

## Purpose

All markdown documents in `thoughts/` use frontmatter to capture:
- Document type and purpose
- Creation and update history
- Git lineage (commit, branch, repository)
- Attribution (who created/updated)
- Cross-references to related documents
- Organizational metadata (tags, status, tickets)

## Directory Structure

```
thoughts/
├── research/          # Codebase investigation documents
├── plans/             # Implementation planning documents
├── implementation-details/  # Implementation progress tracking
├── reviews/           # Code review documents
└── learning/          # Learning and synthesis documents
```

## File Naming Convention

All files follow: `YYYY-MM-DD-[optional-ticket-id]-kebab-case-description.md`

Examples:
- `2025-10-15-ENG-1234-authentication-flow.md`
- `2025-10-15-database-migration-strategy.md`

## Base Schema (Required for ALL Documents)

```yaml
---
# Document metadata
doc_type: research | plan | implementation | review | learning
date: 2025-10-15T14:30:00-07:00  # ISO 8601 with timezone
title: "Human-readable title"

# Git lineage
git_commit: abc123def456
branch: feature/branch-name
repository: my-project

# Attribution
created_by: Claude | <name>
last_updated: 2025-10-15
last_updated_by: Claude | <name>

# Organization
ticket_id: ENG-1234  # optional, omit if no ticket
tags: [domain, component, pattern]
status: draft | in_progress | complete | archived

# Cross-references
related_docs:
  - thoughts/research/2025-10-15-related.md
  - thoughts/plans/2025-10-14-prereq.md
---
```

## Type-Specific Extensions

### Research Documents (doc_type: research)

Location: `thoughts/research/`

Additional fields:
```yaml
doc_type: research
research_question: "What authentication patterns exist in the codebase?"
researcher: Claude  # For backwards compatibility
```

Full example:
```yaml
---
doc_type: research
date: 2025-10-15T14:30:00-07:00
title: "Authentication Flow Investigation"
research_question: "How does authentication work in the application?"
researcher: Claude

git_commit: abc123def456
branch: feature/auth-improvements
repository: my-project

created_by: Claude
last_updated: 2025-10-15
last_updated_by: Claude

ticket_id: ENG-1234
tags: [research, authentication, security]
status: complete

related_docs:
  - thoughts/plans/2025-10-16-auth-improvements.md
---
```

### Plan Documents (doc_type: plan)

Location: `thoughts/plans/`

Additional fields:
```yaml
doc_type: plan
feature: "Bay Location Tracking"
plan_reference: thoughts/research/2025-10-15-research.md  # Source research
phases:
  - name: "Phase 1: Database Schema"
    status: complete
  - name: "Phase 2: Scanner Integration"
    status: in_progress
  - name: "Phase 3: UI Updates"
    status: pending
```

Full example:
```yaml
---
doc_type: plan
date: 2025-10-15T14:30:00-07:00
title: "Bay Location Tracking Implementation Plan"
feature: "Bay Location Tracking"
plan_reference: thoughts/research/2025-10-15-bay-location-research.md

git_commit: abc123def456
branch: feature/bay-location-tracking
repository: my-project

created_by: Claude
last_updated: 2025-10-15
last_updated_by: Claude

ticket_id: ENG-1234
tags: [plan, warehouse, location-tracking]
status: in_progress

phases:
  - name: "Phase 1: Database Schema"
    status: complete
  - name: "Phase 2: Scanner Integration"
    status: in_progress
  - name: "Phase 3: UI Updates"
    status: pending

related_docs:
  - thoughts/research/2025-10-15-bay-location-research.md
---
```

### Implementation Documents (doc_type: implementation)

Location: `thoughts/implementation-details/`

Additional fields:
```yaml
doc_type: implementation
plan_reference: thoughts/plans/2025-10-15-feature.md
current_phase: 2
phase_name: "Scanner Integration"
```

Full example:
```yaml
---
doc_type: implementation
date: 2025-10-15T14:30:00-07:00
title: "Bay Location Tracking Implementation Progress"
plan_reference: thoughts/plans/2025-10-15-bay-location-tracking.md
current_phase: 2
phase_name: "Scanner Integration"

git_commit: abc123def456
branch: feature/bay-location-tracking
repository: my-project

created_by: Claude
last_updated: 2025-10-15
last_updated_by: Claude

ticket_id: ENG-1234
tags: [implementation, warehouse, location-tracking]
status: in_progress

related_docs:
  - thoughts/plans/2025-10-15-bay-location-tracking.md
  - thoughts/reviews/2025-10-15-bay-location-phase-1-review.md
---
```

### Review Documents (doc_type: review)

Location: `thoughts/reviews/`

Additional fields:
```yaml
doc_type: review
reviewed_phase: 2
phase_name: "Scanner Integration"
plan_reference: thoughts/plans/2025-10-15-feature.md
implementation_reference: thoughts/implementation-details/2025-10-15-feature.md
review_status: approved | approved_with_notes | revisions_needed
reviewer: Claude
issues_found: 3
blocking_issues: 0
```

Full example:
```yaml
---
doc_type: review
date: 2025-10-15T16:45:00-07:00
title: "Phase 2 Review: Scanner Integration"
reviewed_phase: 2
phase_name: "Scanner Integration"
plan_reference: thoughts/plans/2025-10-15-bay-location-tracking.md
implementation_reference: thoughts/implementation-details/2025-10-15-bay-location-tracking.md
review_status: approved_with_notes
reviewer: Claude
issues_found: 3
blocking_issues: 0

git_commit: def789abc123
branch: feature/bay-location-tracking
repository: my-project

created_by: Claude
last_updated: 2025-10-15
last_updated_by: Claude

ticket_id: ENG-1234
tags: [review, phase-2, scanner-integration]
status: complete

related_docs:
  - thoughts/plans/2025-10-15-bay-location-tracking.md
  - thoughts/implementation-details/2025-10-15-bay-location-tracking.md
---
```

### Learning Documents (doc_type: learning)

Location: `thoughts/learning/`

Additional fields:
```yaml
doc_type: learning
feature_reference: thoughts/plans/2025-10-15-feature.md
learning_type: phase_summary | comprehensive_synthesis
learning_level: beginner | intermediate | advanced
concepts_covered: [active-record-patterns, rails-migrations, stimulus-controllers]
patterns_used: [repository-pattern, service-objects, form-objects]
```

Full example:
```yaml
---
doc_type: learning
date: 2025-10-15T18:00:00-07:00
title: "Learning Summary: Bay Location Tracking Feature"
feature_reference: thoughts/plans/2025-10-15-bay-location-tracking.md
learning_type: comprehensive_synthesis
learning_level: intermediate
concepts_covered: [database-associations, barcode-scanning, rails-concerns]
patterns_used: [service-objects, callbacks, delegators]

git_commit: ghi456jkl789
branch: feature/bay-location-tracking
repository: my-project

created_by: Claude
last_updated: 2025-10-15
last_updated_by: Claude

ticket_id: ENG-1234
tags: [learning, patterns, rails, warehouse]
status: complete

related_docs:
  - thoughts/plans/2025-10-15-bay-location-tracking.md
  - thoughts/reviews/2025-10-15-bay-location-phase-1-review.md
  - thoughts/reviews/2025-10-15-bay-location-phase-2-review.md
  - thoughts/reviews/2025-10-15-bay-location-phase-3-review.md
---
```

## Metadata Generation

All agents should use the `hack/spec_metadata.sh` script to generate consistent metadata:

```bash
# Generate metadata for frontmatter
bash hack/spec_metadata.sh
```

This returns:
- Current date/time with timezone
- Git commit hash
- Current branch name
- Repository name
- Researcher/author name (from git config or default)

## Status Values

Standard status progression:
- `draft` - Initial creation, not yet complete
- `in_progress` - Actively being worked on
- `complete` - Finished and verified
- `archived` - Historical reference, no longer active

## Review Status Values

For review documents specifically:
- `approved` - No issues, ready for next phase
- `approved_with_notes` - Can proceed but with observations/suggestions
- `revisions_needed` - Blocking issues that must be addressed

## Cross-References

Use relative paths from repository root:
- ✅ `thoughts/research/2025-10-15-feature.md`
- ❌ `/Users/user/project/thoughts/research/2025-10-15-feature.md`
- ❌ `./research/2025-10-15-feature.md`

## Tags Guidelines

Use lowercase, kebab-case tags organized by:
- **Domain**: `warehouse`, `authentication`, `reporting`
- **Component**: `scanner`, `database`, `ui`, `api`
- **Pattern**: `service-objects`, `active-record`, `stimulus`
- **Type**: `research`, `review`, `learning`

Examples:
```yaml
tags: [warehouse, scanner, barcode-integration, research]
tags: [authentication, jwt, security, implementation]
tags: [learning, rails-patterns, service-objects]
```

## Validation

Documents should be valid if:
1. All required base fields are present
2. Type-specific fields match the doc_type
3. Dates are in ISO 8601 format
4. Cross-references use relative paths
5. Status values match allowed list
6. File name matches YYYY-MM-DD pattern

## Agent Responsibilities

Each agent must:
1. Run `hack/spec_metadata.sh` to gather metadata
2. Use complete metadata (no placeholders)
3. Include appropriate type-specific fields
4. Update `last_updated` and `last_updated_by` on modifications
5. Maintain cross-references between related documents
