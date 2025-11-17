
# Online Research: epub.js Pagination Bugs on E-ink Android WebView

**Date**: 2025-11-16
**Researcher**: Claude (research-coordinator)
**Research Depth**: Deep
**Status**: In Progress

## Research Question

Research epub.js pagination calculation bugs specifically on E-ink displays and Android WebView, with focus on Boox Palma 2 skipping last page of chapters.

**Critical Context:**
- Boox Palma 2 (E-ink Android WebView) skips the last page of chapters when paging through
- Bug occurs with BOTH system fonts and custom fonts (NOT a font loading issue)
- Does NOT occur in browser, iPhone, or Android emulator
- Font loading fixes eliminated FOUC but didn't fix pagination
- Using epub.js with `flow: 'paginated'`, `snap: true`, `width: '100%'`, `height: '100%'`

## Research Strategy

**Approach**: Deep investigation into intersection of E-ink display rendering, Android WebView layout engine, and epub.js pagination algorithms.

**Sub-agents to deploy**:
- academic-researcher: E-ink display technology, WebView layout engines, viewport dimension calculation, CSS box model differences (Deep)
- industry-researcher: epub.js GitHub issues, Boox-specific bugs, production E-ink reader implementations, community workarounds (Deep)

**Depth rationale**: Complex device-specific bug at intersection of multiple technologies (E-ink hardware, Android WebView, epub.js library). Requires both theoretical understanding of rendering differences and practical solutions from production implementations.

---

## Academic Research Findings

[This section will be populated by academic-researcher as research progresses]

---

## Industry Research Findings

[This section will be populated by industry-researcher as research progresses]

---

## Executive Summary

[Will be completed during final synthesis]

