# Claude Code Agent System

This directory contains the specialized agent system and workflow documentation for AI-assisted software development.

## Quick Start

**New to this workflow?** Start here:

1. Read [`AGENT_WORKFLOW.md`](AGENT_WORKFLOW.md) - Complete workflow guide
2. Review [`FRONTMATTER_SCHEMA.md`](FRONTMATTER_SCHEMA.md) - Document metadata standards
3. Explore [`agents/`](agents/) - Individual agent specifications

## Files in This Directory

### Core Documentation

- **`AGENT_WORKFLOW.md`** - Complete workflow guide with diagrams, examples, and best practices
- **`FRONTMATTER_SCHEMA.md`** - Standard metadata schema for all thought documents
- **`FRONTMATTER_GENERATION.md`** - Automated frontmatter generation script usage guide
- **`TESTING_RESEARCH_AGENTS.md`** - Testing procedures for online research agents
- **`QUICK_REFERENCE.md`** - Quick reference card for common operations
- **`CHANGELOG.md`** - Version history and system evolution

### Agent Definitions

Located in `agents/` directory:

**Research Agents:**
- **`codebase-researcher.md`** (Blue) - Investigates existing code, documents patterns
- **`research-coordinator.md`** (Teal) - Coordinates online research, spawns sub-agents
- **`academic-researcher.md`** (Orange) - Sub-agent for academic literature and peer-reviewed research
- **`industry-researcher.md`** (Cyan) - Sub-agent for industry practices and expert insights

**Implementation Agents:**
- **`implementation-planner.md`** (Purple) - Designs solutions, creates phased plans
- **`plan-implementer.md`** (Red) - Executes implementation phases, writes code
- **`code-reviewer.md`** (Green) - Reviews code quality, generates mini-lessons
- **`synthesis-teacher.md`** (Yellow) - Creates comprehensive learning documentation

## Agent Overview

```
Research Phase (can run in parallel):
  Codebase Research (Blue) ──┐
  Online Research (Teal)     ├─→ Plan (Purple) → [Implement → Review → Human QA]* → Synthesis
    ├─ Academic (Orange)     │                      Red       Green      👤        Yellow
    └─ Industry (Cyan)   ────┘

* Phase loop repeats until feature is complete
```

## Thought Documents

All workflow artifacts are stored in `../thoughts/`:

```
thoughts/
├── research/          # Investigation documents (Blue agent)
├── plans/             # Implementation plans (Purple agent)
├── implementation-details/  # Progress tracking (Red agent)
├── reviews/           # Code reviews (Green agent)
└── learning/          # Learning synthesis (Yellow agent)
```

**Naming**: `YYYY-MM-DD-[ticket-id]-description.md`

## Key Principles

1. **Context Management**: Each agent keeps context <70% for clean processing
2. **Human Gates**: Humans verify features at each phase completion
3. **Learning Focus**: Extract and teach programming concepts throughout
4. **Documentation First**: Specs drive code quality ("specs are the new code")
5. **Phased Approach**: Break work into testable, reviewable phases

## Typical Workflows

### Comprehensive Research (Novel Features with External Knowledge)
```bash
"Research vector similarity algorithms and compare to our implementation"
→ Spawns codebase-researcher (Blue) + research-coordinator (Teal) in parallel
  → research-coordinator spawns academic-researcher (Orange) + industry-researcher (Cyan)
→ Review all findings (external best practices + internal code)
"Create plan to improve our recommendation system based on research"
→ Approve plan
"Implement phase 1 of the improvements"
→ Manual QA
→ Repeat for all phases
"Create learning synthesis for vector similarity feature"
```

### Online Research Only (Knowledge Building)
```bash
"Research best practices for API rate limiting"
→ Spawns research-coordinator (Teal)
  → May spawn academic-researcher and/or industry-researcher
→ Review findings with actionable recommendations
"Create plan to implement rate limiting based on research"
→ Approve plan and continue implementation...
```

### Codebase Research (Internal Focus)
```bash
"Research how authentication works in this codebase"
→ Spawns codebase-researcher (Blue)
→ Review findings
"Create implementation plan for OAuth2 authentication"
→ Approve plan
"Implement phase 1 of the OAuth2 plan"
→ Manual QA
→ Repeat for all phases
"Create learning synthesis for OAuth2 feature"
```

### Direct Planning (Well-Understood Features)
```bash
"Create plan for adding email notifications to user registration"
→ Approve plan
"Implement phase 1 of email notifications plan"
→ Manual QA
→ Repeat for all phases
"Create learning synthesis for email notifications"
```

## Human Touchpoints

You are essential at these points:

1. **Initiation** - Define the need, provide context
2. **Research Review** - Validate findings, answer questions
3. **Plan Approval** - Approve approach and scope
4. **Phase QA** - Manually test each phase
5. **Course Correction** - Decide on fixes vs. re-planning
6. **Learning Review** - Study synthesis documents

## Testing Philosophy

This workflow accommodates inconsistent test coverage:

- Code reviews note test status but don't block on missing tests
- Human QA is the critical verification gate
- Mini-lessons and synthesis docs teach testing value
- Gradually build testing culture through education

## Context Window Management

Each agent targets <70% context usage:

- **Why**: Maintains clean information processing
- **How**: Focused responsibilities, parallel sub-agents, proper chunking
- **Benefit**: Quality outputs, room for sub-agents, accurate understanding

## Metadata & Traceability

All documents include frontmatter with:
- Git commit hash and branch
- Creation/update timestamps
- Document type and status
- Cross-references to related docs

**Generate complete frontmatter automatically** (eliminates context waste):
```bash
./hack/generate_frontmatter.sh <doc_type> <title> [ticket_id] [options]
```

See `.claude/FRONTMATTER_GENERATION.md` for complete usage guide.

## Getting Help

1. **Workflow questions**: See `AGENT_WORKFLOW.md`
2. **Metadata questions**: See `FRONTMATTER_SCHEMA.md`
3. **Agent behavior**: Review specific agent file in `agents/`
4. **Troubleshooting**: See "Troubleshooting" section in `AGENT_WORKFLOW.md`

## Philosophy

**"Specs are the new code"**

Since AI generates code from specifications, the most important investment is in quality seed information:

- Clear research questions
- Thorough requirements
- Detailed plans
- Good verification

The workflow is designed to maximize spec quality through iterative refinement and human-in-the-loop validation.

## Version History

- **v1.1** (2025-10-15) - Context optimization update
  - Automated frontmatter generation script
  - Reduced agent context usage by 300-500 tokens per document
  - Updated all agents to use script instead of manual construction
  - Quick reference documentation added

- **v1.0** (2025-10-15) - Initial complete implementation
  - Five specialized agents
  - Unified frontmatter schema
  - Complete workflow documentation
  - Phase-by-phase review process
  - Learning synthesis capability

See `CHANGELOG.md` for detailed version history.

## Using This Workflow in Other Projects

This workflow system can be exported to any project:

### Quick Export

```bash
# From this project
./hack/export_workflow.sh /path/to/other/project

# In the other project
cd /path/to/other/project
# Restart Claude Code to register agents
```

This copies:
- `.claude/` - All agents and documentation
- `hack/` workflow scripts - Frontmatter generation, changelog updates
- `thoughts/` directory structure - Empty but ready to use

### Manual Copy

Alternatively, copy these directories manually:
1. `.claude/` → Target project
2. `hack/generate_frontmatter.sh`, `hack/update_changelog.sh`, `hack/spec_metadata.sh` → Target `hack/`
3. Create `thoughts/{research,plans,implementation-details,reviews,learning}/` in target

### After Export

1. **Restart Claude Code** in the target project (registers agents)
2. **Test**: `./hack/generate_frontmatter.sh research "Test" --research-question "Test?"`
3. **Start using**: Follow workflow in `AGENT_WORKFLOW.md`

### Template Repository (Future)

Consider creating a template repo for easier distribution:
- `github.com/yourusername/claude-code-workflow-template`
- Click "Use this template" for new projects
- Includes all agents, scripts, and documentation

## Contributing to the Workflow

Found ways to improve the workflow? Update these docs:

1. Make changes to agent files or docs
2. Update version history in this README
3. Test with a real feature implementation
4. Document lessons learned in thoughts/learning/
5. Export to test projects using `./hack/export_workflow.sh`

---

**Maintained by**: Sean Kim
**Last Updated**: 2025-10-15
**Status**: Active Development
**Portable**: Export to any project with `./hack/export_workflow.sh`
