# Claude Code Agent Workflow

**Version**: 1.0
**Last Updated**: 2025-10-15
**Philosophy**: "Specs are the new code" - Seed information quality determines output quality

## Overview

This document describes the complete AI-assisted development workflow using specialized Claude Code agents. The workflow is designed for developers (amateur to mid-level) who want to build features beyond their current skill level while learning programming principles along the way.

## Core Principles

1. **Context Management**: Keep agent context usage <70% to maintain clean information flow
2. **Human-in-the-Loop**: Humans provide direction at key decision points and verify features
3. **Phased Implementation**: Break work into independently testable phases with acceptance gates
4. **Learning Integration**: Extract and teach programming concepts throughout the process
5. **Documentation First**: All artifacts are documented with consistent metadata for traceability

## Agent Overview

The workflow uses eight specialized agents:

| Agent | Purpose | Input | Output | Color |
|-------|---------|-------|--------|-------|
| **codebase-researcher** | Investigate existing code, document current state | Research question, files | Research document | Blue |
| **research-coordinator** | Coordinate online research, spawn academic/industry sub-agents | Research question | Online research document | Teal |
| **academic-researcher** | Search academic literature, evaluate methodology | Research focus (from coordinator) | Academic findings | Orange |
| **industry-researcher** | Search industry practices, expert insights | Research focus (from coordinator) | Industry findings | Cyan |
| **implementation-planner** | Design solutions, create phased implementation plans | Requirements, research | Plan document | Purple |
| **plan-implementer** | Execute plan phases, write code, track progress | Plan document | Code + Implementation doc | Red |
| **code-reviewer** | Review code quality, verify requirements, teach concepts | Phase completion, plan | Review document + mini-lessons | Green |
| **synthesis-teacher** | Synthesize learning from full feature, explain patterns | Completed feature docs | Comprehensive learning doc | Yellow |

**Note**: academic-researcher and industry-researcher are sub-agents typically spawned by research-coordinator, not invoked directly by users.

## Directory Structure

All workflow artifacts are stored in `thoughts/` with consistent naming:

```
thoughts/
├── research/          # Codebase investigation documents
│   └── YYYY-MM-DD-[ticket-id]-description.md
├── plans/             # Implementation planning documents
│   └── YYYY-MM-DD-[ticket-id]-description.md
├── implementation-details/  # Implementation progress tracking
│   └── YYYY-MM-DD-[ticket-id]-description.md
├── reviews/           # Code review documents
│   └── YYYY-MM-DD-[ticket-id]-phase-N-review.md
└── learning/          # Learning and synthesis documents
    └── YYYY-MM-DD-[ticket-id]-feature-synthesis.md
```

**Naming Convention**: `YYYY-MM-DD-[optional-ticket-id]-kebab-case-description.md`

All documents use standard frontmatter metadata (see `.claude/FRONTMATTER_SCHEMA.md`).

## Complete Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    FEATURE INITIATION                        │
│                      (Human Start)                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ codebase-researcher│ ← Research existing implementation
         │      (Blue)        │   Understand current patterns
         └────────┬───────────┘   Document what exists
                  │
                  │ produces thoughts/research/*.md
                  ▼
         ┌────────────────────┐
         │implementation-     │ ← Create detailed plan
         │    planner         │   Design architecture
         │    (Purple)        │   Define phases with success criteria
         └────────┬───────────┘
                  │
                  │ produces thoughts/plans/*.md
                  ▼
    ┌─────────────────────────────────────┐
    │         PHASE IMPLEMENTATION         │
    │              (Loop)                  │
    └─────────────────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │                    │
        │  PHASE N START     │
        │                    │
        └─────────┬──────────┘
                  │
                  ▼
         ┌────────────────────┐
         │  plan-implementer  │ ← Implement phase N
         │       (Red)        │   Write code
         └────────┬───────────┘   Update progress doc
                  │
                  │ produces code + thoughts/implementation-details/*.md
                  ▼
         ┌────────────────────┐
         │   code-reviewer    │ ← Review implementation
         │      (Green)       │   Verify requirements
         └────────┬───────────┘   Generate mini-lessons
                  │
                  │ produces thoughts/reviews/*-phase-N-review.md
                  ▼
        ┌─────────────────────┐
        │  Review Decision    │
        └─────────┬───────────┘
                  │
          ┌───────┼───────┐
          │       │       │
    ❌    │  ⚠️   │  ✅   │
Revisions │ With  │ Approved
 Needed   │ Notes │
          │       │       │
          │       ▼       │
          │   ┌───────┐  │
          │   │Human  │  │
          │   │  QA   │  │
          │   └───┬───┘  │
          │       │      │
          └───────┼──────┘
                  │
          ┌───────┴────────┐
          │                │
   Feature incomplete  Feature complete
          │                │
    [Next Phase]           ▼
          │       ┌────────────────────┐
          │       │ synthesis-teacher  │ ← Synthesize learning
          │       │     (Yellow)       │   Explain patterns
          │       └────────────────────┘   Create learning path
          │                │
          └────────────────┘ produces thoughts/learning/*-synthesis.md
```

## Detailed Phase Breakdown

### Phase 0: Feature Initiation (Human)

**When**: Starting a new feature or investigating an unfamiliar area

**Human Actions**:
- Identify feature need or research question
- Gather any existing context (tickets, requirements, user stories)
- Decide whether to start with research or planning

**Decision Point**:
- Need to understand existing code? → Start with **codebase-researcher**
- Already understand context? → Start with **implementation-planner**

---

### Phase 1A: Codebase Research (Blue Agent)

**Agent**: `codebase-researcher`

**Purpose**: Understand current codebase, document existing patterns, map out relevant code

**Inputs**:
- Research question or area of interest
- File paths or components to investigate
- Optional: ticket or requirements document

**Process**:
1. Read any mentioned files completely
2. Decompose research question into focused areas
3. Spawn parallel sub-agents for deep investigation
4. Gather metadata (`hack/spec_metadata.sh`)
5. Synthesize findings into research document
6. Present summary with file references

**Outputs**:
- `thoughts/research/YYYY-MM-DD-[ticket]-description.md`
- Summary of findings with code references
- Open questions requiring clarification

**Human Actions**:
- Review research findings
- Answer open questions
- Approve moving to planning OR request additional research

**Context Target**: <70%

---

### Phase 1B: Online Research (Teal Agent + Sub-agents)

**Agent**: `research-coordinator` (spawns `academic-researcher` and `industry-researcher`)

**Purpose**: Research external knowledge, best practices, academic theory, industry patterns

**Inputs**:
- Research question about external knowledge
- Desired depth (quick, medium, deep)
- Optional: specific focus areas or constraints

**Process**:
1. Analyze query and determine research strategy
2. Evaluate required depth based on complexity criteria
3. Perform initial scoping with WebSearch
4. Spawn specialized sub-agents in parallel:
   - `academic-researcher`: For academic papers, studies, theory
   - `industry-researcher`: For best practices, case studies, expert insights
5. Cross-validate findings from multiple sources
6. Apply critical thinking to identify bias and contradictions
7. Synthesize unified insights with confidence levels
8. Generate research document

**Outputs**:
- `thoughts/research/YYYY-MM-DD-[ticket]-online-research.md`
- Academic findings (if applicable)
- Industry best practices and case studies
- Source quality assessment
- Synthesized recommendations with confidence levels

**Human Actions**:
- Review research findings
- Evaluate recommendations
- Decide how to integrate with codebase findings
- Approve moving to planning

**Context Target**: <70% (coordinator), sub-agents manage their own context

**Research Patterns**:

1. **Parallel Research** (most comprehensive):
   ```
   User: "Investigate vector matching for affinity recommendations"
   → Spawn codebase-researcher: "Research our current matching implementation"
   → Spawn research-coordinator: "Research vector matching algorithms and best practices"
     → research-coordinator spawns:
       - academic-researcher: "Research vector similarity algorithms"
       - industry-researcher: "Research recommendation system implementations"
   → Synthesize: external knowledge + our current implementation → recommendations
   ```

2. **Online-Only Research**:
   ```
   User: "Research best practices for mobile-first UI design"
   → Spawn research-coordinator only
     → Spawns industry-researcher: "Expert insights on mobile-first design"
   → Generate insights for future planning
   ```

3. **Deep Academic Research**:
   ```
   User: "Research cognitive load theory in UI design"
   → Spawn research-coordinator
     → Spawns academic-researcher: "Cognitive load research"
     → Spawns industry-researcher: "Practical UI applications"
   → Synthesize theory + practice
   ```

---

### Phase 2: Implementation Planning (Purple Agent)

**Agent**: `implementation-planner`

**Purpose**: Design solution, create detailed phased implementation plan

**Inputs**:
- Feature requirements or problem description
- Research document (if available)
- Constraints and considerations

**Process**:
1. Analyze requirements and codebase
2. Present understanding and ask clarifying questions
3. Propose architecture design options with trade-offs
4. Get user buy-in on approach
5. Propose phase structure
6. Gather metadata (`hack/spec_metadata.sh`)
7. Create detailed plan with success criteria per phase
8. Present plan for review

**Outputs**:
- `thoughts/plans/YYYY-MM-DD-[ticket]-feature.md`
- Phased implementation roadmap
- Success criteria for each phase
- File changes required
- Testing strategy
- Risk assessment

**Human Actions**:
- Review and approve plan
- Clarify ambiguities
- Adjust scope or phases if needed
- Approve to begin implementation

**Context Target**: <70%

---

### Phase 3: Phase Implementation Loop

This phase repeats for each implementation phase until feature is complete.

#### Phase 3A: Implementation (Red Agent)

**Agent**: `plan-implementer`

**Purpose**: Execute one phase of the plan, write code, update progress

**Inputs**:
- Plan document
- Current phase number
- Implementation progress document (if continuing)

**Process**:
1. Read plan and phase requirements completely
2. Gather metadata for progress tracking
3. Create/update implementation progress document
4. Implement phase changes systematically
5. Run tests (if they exist)
6. Update progress document and plan frontmatter
7. Mark phase complete

**Outputs**:
- Code changes (new files, modified files)
- `thoughts/implementation-details/YYYY-MM-DD-[ticket]-feature.md` (updated)
- Updated plan document frontmatter (phase status)

**Deviation Handling**:
- If plan can't be followed: STOP, document issue, wait for human approval
- If errors occur: Document in progress doc, may need re-planning

**Context Target**: <70%

---

#### Phase 3B: Code Review (Green Agent)

**Agent**: `code-reviewer`

**Purpose**: Review implementation against requirements, verify quality, teach concepts

**Inputs**:
- Plan document
- Implementation progress document
- Phase number to review
- Code files changed in phase

**Process**:
1. Read plan phase requirements and success criteria
2. Read implementation progress document
3. Examine all code files modified in phase
4. Run tests (if they exist - note status but don't block)
5. Gather metadata (`hack/spec_metadata.sh`)
6. Categorize findings: blocking vs. non-blocking
7. Generate 2-5 mini-lessons on concepts applied
8. Create review document
9. Present summary with decision

**Outputs**:
- `thoughts/reviews/YYYY-MM-DD-[ticket]-phase-N-review.md`
- Review status: ✅ Approved | ⚠️ Approved with Notes | ❌ Revisions Needed
- Issues categorized by severity
- Mini-lessons on patterns/concepts used
- Next steps

**Review Criteria**:
- Requirements met?
- Code quality acceptable?
- Integration clean?
- Security concerns?
- Performance issues?

**Testing Philosophy**:
- Note test coverage honestly
- Suggest what should be tested
- DO NOT block on missing tests alone
- Encourage test culture through suggestions

**Context Target**: <70%

---

#### Phase 3C: Human QA (Human)

**When**: After code-reviewer approves (or approves with notes)

**Human Actions**:
- Manually test the feature in development environment
- Verify phase success criteria are actually met
- Check that user-facing functionality works as expected
- Identify any issues not caught by automated review

**Decision Point**:
- **Feature works**: Approve phase, proceed
- **Issues found**: Document problems, return to implementer
- **Unclear**: Ask questions, may need re-planning

**Why This Matters**:
- Builds may pass but features may not work correctly
- Human judgment catches UX and integration issues
- Provides learning feedback loop

---

#### Phase 3D: Loop Decision

**Options**:

1. **More phases remaining**: Return to Phase 3A with next phase number
2. **All phases complete**: Proceed to Phase 4 (Synthesis)
3. **Blocking issues**: Return to implementer or re-plan

---

### Phase 4: Learning Synthesis (Yellow Agent)

**Agent**: `synthesis-teacher`

**Purpose**: Create comprehensive educational documentation from complete feature

**Inputs**:
- Plan document
- All implementation documents
- All review documents
- All code from feature

**Process**:
1. Collect all artifacts from feature development
2. Analyze all code files created/modified
3. Extract concepts, patterns, architectural decisions
4. Organize by complexity: beginner → intermediate → advanced
5. Document key decisions and trade-offs
6. Gather metadata using frontmatter generation script
7. Create comprehensive learning document
8. Present summary with learning path

**Outputs**:
- `thoughts/learning/YYYY-MM-DD-[ticket]-feature-synthesis.md`
- Organized concept explanations (beginner/intermediate/advanced)
- Code examples from actual implementation
- Decision rationale documentation
- Quick reference guide
- Learning path forward
- Further reading resources

**Educational Focus**:
- Why patterns were chosen
- Trade-offs made
- Alternative approaches
- Best practices applied
- Common pitfalls avoided
- Next learning steps

**When to Invoke**:
- After all phases complete and reviewed
- Manual invocation by human
- Optional: can be run periodically to review progress

**Context Target**: <70%

---

### Phase 5: Feature Wrap-up (Human)

**CRITICAL**: Don't forget to update the project CHANGELOG.md!

After synthesis (or after final review if skipping synthesis):

**Update CHANGELOG.md**:
```bash
# Interactive mode (easiest)
./hack/update_changelog.sh --interactive

# Or direct command
./hack/update_changelog.sh 0.X.X added "Feature Name" "Brief description"
```

**Change types**:
- `added` - New features
- `changed` - Changes to existing functionality
- `fixed` - Bug fixes
- `removed` - Removed features
- `deprecated` - Soon-to-be removed features
- `security` - Security improvements

**Why this matters**:
- Documents feature for other developers
- Tracks project evolution
- Helps with release notes
- Easy to forget without reminder!

---

## Human Touchpoints

Throughout the workflow, humans are essential at these points:

| Stage | Human Role | Purpose |
|-------|-----------|---------|
| **Initiation** | Define need, kick off research or planning | Direction setting |
| **Research Review** | Validate findings, answer questions | Context verification |
| **Plan Approval** | Approve approach, clarify requirements | Scope validation |
| **Phase QA** | Manually test feature, verify it works | Reality check |
| **Issue Response** | Decide on fixes vs. re-planning | Course correction |
| **Learning Review** | Read synthesis, identify knowledge gaps | Growth tracking |

**Dream Scenario**: Largely hands-off between phase QA checkpoints, with agents handling research → plan → implement → review autonomously.

## Workflow Variations

### Variation 1: Comprehensive Research (Complex/Novel Features)

```
Human Question → [Parallel]:
  - codebase-researcher (internal understanding)
  - research-coordinator (external knowledge)
    → academic-researcher + industry-researcher
→ Synthesize both → implementation-planner → Phase Loop → synthesis-teacher
```

Use when:
- Novel feature requiring external knowledge
- Need to understand both internal code AND best practices
- Want to compare current implementation to industry standards

### Variation 2: Codebase-Only Research (Internal Focus)

```
Human Question → codebase-researcher → implementation-planner → Phase Loop → synthesis-teacher
```

Use when:
- Unfamiliar codebase area but standard patterns
- Complex existing integration
- Need to understand current patterns first
- External best practices not needed

### Variation 3: Online-Only Research (Knowledge Building)

```
Human Question → research-coordinator → academic-researcher + industry-researcher → (Optional) implementation-planner
```

Use when:
- Building domain knowledge before implementation
- Researching new technologies or approaches
- Investigating best practices for future projects
- No immediate implementation planned

### Variation 4: Direct Planning (Well-Understood Features)

```
Human Requirements → implementation-planner → Phase Loop → synthesis-teacher
```

Use when:
- Clear requirements
- Familiar domain AND codebase
- Similar to previous work
- No research needed

### Variation 5: Quick Implementation (Tiny Changes)

```
Human → direct coding (no agents)
```

Use when:
- Trivial changes (typo fixes, small tweaks)
- Single-file edits
- No learning value

## Context Management

Each agent targets <70% context usage to maintain:
- Clean information processing
- Accurate understanding
- Quality outputs
- Ability to spawn sub-agents

**Strategies**:
- Focus each agent on specific responsibility
- Use parallel sub-agents for deep dives
- Clear input/output boundaries
- Proper document chunking

## Testing Reality

This codebase has inconsistent test coverage. The workflow accommodates this:

**code-reviewer Approach**:
- Document test status honestly
- Suggest what should be tested
- Note failures but investigate, don't block
- DO NOT block on missing tests alone
- Encourage testing through education

**Over Time**:
- Mini-lessons teach testing value
- Review suggestions build test culture
- Learning docs explain testing patterns
- Gradual improvement through education

## Error Handling & Recovery

### If plan-implementer Gets Stuck
1. Documents specific issue in implementation doc
2. Stops and waits for human input
3. Human decides: fix it, adjust plan, or re-plan

### If code-reviewer Finds Blocking Issues
1. Status: ❌ Revisions Needed
2. Documents specific issues with file:line references
3. Returns to plan-implementer with clear requirements
4. Implementer addresses issues
5. Re-review after fixes

### If Human QA Fails
1. Document what doesn't work
2. Determine scope: code fix or re-plan?
3. Return to appropriate agent
4. May need additional phase or plan revision

### If Context Limit Reached
1. Agent should finish current task
2. Create document with current state
3. Spawn fresh agent to continue
4. Previous doc becomes input to new agent

## Document Metadata

All documents use consistent frontmatter (see `.claude/FRONTMATTER_SCHEMA.md`).

**CRITICAL: Agents must use the automated frontmatter generation script**:

```bash
./hack/generate_frontmatter.sh <doc_type> <title> [ticket_id] [options]
```

This script:
- Generates complete, ready-to-paste YAML frontmatter
- Eliminates context waste (agents don't read format specs)
- Ensures perfect consistency and no placeholders
- Includes all git metadata automatically
- Suggests proper filename

See `.claude/FRONTMATTER_GENERATION.md` for complete usage examples.

**No Manual Frontmatter**: Agents must NEVER manually construct frontmatter - always use the script

## File References

Throughout documentation, use these patterns:

**In Documents**:
- `` `path/to/file.rb:123` `` - Single line reference
- `` `path/to/file.js:45-67` `` - Range reference

**In Code**:
- Relative paths from repository root
- ✅ `thoughts/research/2025-10-15-feature.md`
- ❌ `/Users/user/project/thoughts/research/2025-10-15-feature.md`
- ❌ `./research/2025-10-15-feature.md`

## Agent Communication

Agents should:
- Use specific file:line references
- Link to related documents
- Provide concrete next steps
- Ask clarifying questions when uncertain
- Document assumptions clearly
- Escalate to human when appropriate

## Success Metrics

**Research Quality**:
- Complete coverage of relevant code
- Clear file:line references
- Connections between components documented
- Open questions identified

**Plan Quality**:
- Clear phase breakdown
- Measurable success criteria
- Risk assessment included
- File changes specified
- Testing strategy defined

**Implementation Quality**:
- Requirements met
- Tests pass (if they exist)
- No regressions
- Progress tracked
- Deviations documented

**Review Quality**:
- All requirements checked
- Issues categorized by severity
- Specific file:line references
- 2-5 educational mini-lessons
- Clear next steps

**Learning Quality**:
- Concepts organized by complexity
- Code examples from actual implementation
- Decision rationale explained
- Learning path provided
- Further resources linked

## Tools & Scripts

**Metadata Generation**:
```bash
hack/spec_metadata.sh
```

**Finding Documents**:
```bash
# Find all research on authentication
grep -r "authentication" thoughts/research/

# Find plans in progress
grep -l "status: in_progress" thoughts/plans/*.md

# Find reviews with blocking issues
grep -l "review_status: revisions_needed" thoughts/reviews/*.md
```

**Document Validation**:
```bash
# Check frontmatter exists
head -20 thoughts/research/2025-10-15-feature.md | grep "^---"

# Verify doc_type is set
grep "^doc_type:" thoughts/plans/*.md
```

## Best Practices

### For Humans

1. **Be clear with initial direction**: Specific questions get better research
2. **Review thoroughly at checkpoints**: Agents trust your verification
3. **Document what you find in QA**: Detailed feedback helps learning
4. **Ask "why" questions**: Deepens understanding of decisions
5. **Use synthesis docs**: Review learning materials after features
6. **Iterate on plans**: It's okay to adjust as you learn

### For Agents

1. **Read files completely**: No limit/offset parameters
2. **Gather metadata first**: Use `hack/spec_metadata.sh` before creating docs
3. **Use parallel sub-agents**: Maximize efficiency, manage context
4. **Document assumptions**: Make decision-making transparent
5. **Provide specific references**: Always include file:line numbers
6. **Escalate uncertainty**: Ask humans when unclear
7. **Update related docs**: Keep cross-references current

## Troubleshooting

### "Agent ran out of context"
- Agent tried to do too much in one session
- Solution: Break work into smaller phases, use more sub-agents

### "Review keeps blocking on tests"
- Review philosophy not followed
- Solution: Re-read code-reviewer testing section, tests shouldn't block

### "Human QA failed but review passed"
- Review criteria may be too narrow
- Solution: Update review criteria based on what was missed

### "Can't find related documents"
- Cross-references not maintained
- Solution: Update frontmatter `related_docs` arrays

### "Metadata has placeholders"
- Agent didn't run metadata script
- Solution: Always run `hack/spec_metadata.sh` before creating docs

## Future Enhancements

Potential workflow improvements:

1. **Automated Phase Transitions**: Trigger next agent based on document status
2. **Test Generation Agent**: Specialized agent for creating test coverage
3. **Documentation Agent**: Generate user-facing docs from implementation
4. **Refactoring Agent**: Specialized agent for code improvements
5. **Migration Script**: Update old documents to new frontmatter schema
6. **Validation Tools**: Scripts to verify document metadata completeness
7. **Learning Metrics**: Track concepts learned over time

## Getting Started

### First Time Setup

1. Read this document completely
2. Review `.claude/FRONTMATTER_SCHEMA.md`
3. Check that `hack/spec_metadata.sh` works:
   ```bash
   bash hack/spec_metadata.sh
   ```
4. Review existing agents in `.claude/agents/`

### Starting Your First Feature

1. Identify your feature or research need
2. Decide: research first or plan first?
3. Invoke appropriate agent with clear prompt
4. Follow agent guidance through workflow
5. Participate at human checkpoints
6. Review learning synthesis at end

### Example Flows

**Example 1: Comprehensive Research Flow**

```bash
# Parallel research (internal + external knowledge)
"Investigate rate limiting. Compare our implementation to industry best practices"
→ Spawns codebase-researcher + research-coordinator in parallel

# Review both research outputs, then plan
"Create implementation plan to improve our rate limiting based on research findings"

# Implement phases
"Implement phase 1 of the rate limiting improvements"

# Review each phase
"Review phase 1 of rate limiting implementation"

# After review approval, QA
[Test feature manually]

# Repeat for remaining phases...

# After all phases complete
"Create learning synthesis for rate limiting feature"
```

**Example 2: Codebase-Only Research Flow**

```bash
# Internal research only
"Research how authentication works in this codebase"

# Review research output, then plan
"Create implementation plan for adding OAuth2 authentication"

# Implement and review phases...
"Implement phase 1 of the OAuth2 plan"
"Review phase 1 of OAuth2 implementation"

# Continue through phases...

# Final synthesis
"Create learning synthesis for OAuth2 feature"
```

**Example 3: Online Research First Flow**

```bash
# Build knowledge before implementation
"Research vector similarity algorithms and recommendation system best practices"
→ Spawns research-coordinator → academic-researcher + industry-researcher

# After understanding external knowledge
"Research our current recommendation implementation"
→ Spawns codebase-researcher

# Compare and plan
"Create plan to implement vector-based recommendations based on research"

# Continue with implementation phases...
```

## Philosophy: Specs Are The New Code

The quality of your specifications directly determines the quality of generated code. Invest in:

- **Clear requirements**: Ambiguity creates bugs
- **Thorough research**: Understanding context prevents rework
- **Detailed plans**: Precise specs enable accurate implementation
- **Good questions**: Asking "why" improves understanding
- **Complete metadata**: Traceability enables learning

The time spent on research and planning pays dividends in implementation quality and learning outcomes.

---

**Maintained by**: Sean Kim
**Agent versions**: See individual agent files for updates
**Schema version**: See `.claude/FRONTMATTER_SCHEMA.md`
**Questions**: Review this doc first, then ask specific questions

