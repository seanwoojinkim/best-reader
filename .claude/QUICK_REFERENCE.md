# Quick Reference Card

## Frontmatter Generation (USE THIS!)

**Always use the script - never manually construct frontmatter**

### Research Document
```bash
./hack/generate_frontmatter.sh research "Title" ENG-1234 \
  --research-question "Question?" \
  --tags "research,domain,component"
```

### Plan Document
```bash
./hack/generate_frontmatter.sh plan "Title" ENG-1234 \
  --feature "Feature Name" \
  --plan-ref thoughts/research/2025-10-15-research.md \
  --tags "plan,domain,component"
```

### Implementation Document
```bash
./hack/generate_frontmatter.sh implementation "Title" ENG-1234 \
  --plan-ref thoughts/plans/2025-10-15-plan.md \
  --phase 1 \
  --phase-name "Phase Name" \
  --tags "implementation,domain,component"
```

### Review Document
```bash
./hack/generate_frontmatter.sh review "Phase N Review: Name" ENG-1234 \
  --plan-ref thoughts/plans/2025-10-15-plan.md \
  --impl-ref thoughts/implementation-details/2025-10-15-impl.md \
  --phase 1 \
  --phase-name "Phase Name" \
  --status approved \
  --issues 2 \
  --blocking 0 \
  --tags "review,phase-1,component"
```

### Learning Document
```bash
./hack/generate_frontmatter.sh learning "Learning Synthesis: Feature" ENG-1234 \
  --feature-ref thoughts/plans/2025-10-15-plan.md \
  --learning-type comprehensive_synthesis \
  --level intermediate \
  --concepts "concept1,concept2,concept3" \
  --patterns "pattern1,pattern2" \
  --tags "learning,patterns,domain"
```

---

## Agent Invocation

### Research Codebase
```
"Research how authentication works in this codebase"
```

### Create Implementation Plan
```
"Create implementation plan for adding OAuth2 authentication"
"Create plan based on thoughts/research/2025-10-15-auth-research.md"
```

### Implement Phase
```
"Implement phase 1 of thoughts/plans/2025-10-15-oauth2-plan.md"
"Continue implementing OAuth2 from phase 2"
```

### Review Phase
```
"Review phase 1 of OAuth2 implementation"
"Review thoughts/plans/2025-10-15-oauth2-plan.md phase 2"
```

### Generate Learning
```
"Create learning synthesis for OAuth2 feature"
"Generate learning doc for thoughts/plans/2025-10-15-oauth2-plan.md"
```

---

## Workflow At A Glance

```
Research → Plan → [Implement → Review → Human QA]* → Learning → Update CHANGELOG
  Blue     Purple      Red       Green      👤        Yellow        👤
```

**Human QA after each phase!** - Don't skip manual testing

**Update CHANGELOG after feature!** - Don't forget to document

---

## Directory Structure

```
thoughts/
├── research/YYYY-MM-DD-[ticket]-description.md
├── plans/YYYY-MM-DD-[ticket]-description.md
├── implementation-details/YYYY-MM-DD-[ticket]-description.md
├── reviews/YYYY-MM-DD-[ticket]-phase-N-review.md
└── learning/YYYY-MM-DD-[ticket]-feature-synthesis.md
```

---

## Document Status Values

- `draft` - Initial creation
- `in_progress` - Actively working
- `complete` - Finished and verified
- `archived` - Historical reference

---

## Review Status Values

- `approved` - Ready for next phase
- `approved_with_notes` - Can proceed with observations
- `revisions_needed` - Must fix blocking issues

---

## Common Commands

### Update CHANGELOG (Don't Forget!)
```bash
# Interactive mode (recommended)
./hack/update_changelog.sh --interactive

# Direct command
./hack/update_changelog.sh 0.X.X added "Feature Name" "Description"
./hack/update_changelog.sh 0.X.X fixed "Bug Name" "What was fixed"
./hack/update_changelog.sh 0.X.X changed "Component Name" "What changed"
```

### Check Frontmatter Script Help
```bash
./hack/generate_frontmatter.sh
```

### Find Documents by Type
```bash
grep -l "doc_type: research" thoughts/**/*.md
grep -l "doc_type: plan" thoughts/**/*.md
grep -l "status: in_progress" thoughts/**/*.md
```

### Find Reviews with Issues
```bash
grep -l "review_status: revisions_needed" thoughts/reviews/*.md
grep "blocking_issues:" thoughts/reviews/*.md
```

### List Recent Documents
```bash
ls -lt thoughts/research/ | head
ls -lt thoughts/plans/ | head
ls -lt thoughts/reviews/ | head
```

---

## Key Principles

1. **Use the frontmatter script** - Never manually construct metadata
2. **Human QA after each phase** - Verify features actually work
3. **Keep context <70%** - Agents stay focused and effective
4. **Document everything** - All work produces traceable artifacts
5. **Learn continuously** - Review synthesis docs after features

---

## Need Help?

- **Workflow**: `.claude/AGENT_WORKFLOW.md`
- **Frontmatter**: `.claude/FRONTMATTER_GENERATION.md`
- **Schema**: `.claude/FRONTMATTER_SCHEMA.md`
- **Agent Behavior**: `.claude/agents/<agent-name>.md`

---

**Remember**: Specs are the new code. Quality specifications → Quality implementation → Quality learning
