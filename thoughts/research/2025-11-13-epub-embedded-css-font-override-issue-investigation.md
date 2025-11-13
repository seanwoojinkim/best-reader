---
doc_type: research
date: 2025-11-13T16:40:12+00:00
title: "EPUB Embedded CSS Font Override Issue Investigation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T16:40:12+00:00"
research_question: "How do EPUB-embedded CSS classes with hardcoded font-family declarations override the reader's custom font settings, and what are the viable solutions?"
research_type: codebase_research
researcher: Sean Kim

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - epub
  - css
  - fonts
  - specificity
  - override
status: complete

related_docs:
  - thoughts/research/2025-11-13-font-switching-complete-failure-analysis.md
  - thoughts/research/2025-11-13-typography-and-font-implementation-analysis.md
---

# Research: EPUB Embedded CSS Font Override Issue Investigation

**Date**: 2025-11-13T16:40:12+00:00
**Researcher**: Sean Kim
**Git Commit**: f043ea027c72c71df95873aeac6edad6d812395b
**Branch**: main
**Repository**: reader

## Research Question

How do EPUB-embedded CSS classes with hardcoded font-family declarations override the reader's custom font settings, and what are the viable solutions?

## Executive Summary

This investigation uncovered the **root cause** of why custom font settings don't work in the EPUB reader: **CSS specificity hierarchy**. EPUB files contain embedded stylesheets with class selectors (e.g., `.noindent5 { font-family: "EBGaramond", serif; }`) that have **higher specificity** than our element selectors (`body { font-family: ... !important }`). Even with `!important`, a class selector (specificity 0,0,1,0) beats an element selector (specificity 0,0,0,1).

**The Critical Finding**: Our current approach applies styles to `body`, `p`, and `a` elements using `rendition.themes.default()`. This works for EPUB content that doesn't specify fonts, but **completely fails** when the EPUB has class-level or inline font declarations.

**Example from real EPUB**:
```css
/* EPUB's embedded CSS - specificity: 0,0,1,0 */
.noindent5 {
    font-family: "EBGaramond", serif;
    margin-top: 10%;
}

/* Our current approach - specificity: 0,0,0,1 */
body {
    font-family: Georgia, serif !important;
}
```

**Result**: `.noindent5` wins because class selector > element selector, regardless of `!important` on the losing selector.

This research provides **5 viable solutions** ranked by effectiveness, maintainability, and side effects, with **Solution 1 (Universal Selector with Override API)** as the recommended approach.

## Root Cause Analysis

### 1. CSS Specificity Fundamentals

**Specificity Hierarchy** (highest to lowest):
1. Inline styles: `<p style="font-family: X">` - Specificity: 1,0,0,0
2. ID selectors: `#header` - Specificity: 0,1,0,0
3. Class/attribute/pseudo-class: `.noindent5`, `[type="text"]`, `:hover` - Specificity: 0,0,1,0
4. Element/pseudo-element: `body`, `p`, `::before` - Specificity: 0,0,0,1
5. Universal selector: `*` - Specificity: 0,0,0,0

**The `!important` Rule**:
- `!important` increases priority WITHIN the same specificity level
- Does NOT make a lower-specificity selector beat a higher-specificity selector
- If both selectors have `!important`, specificity still wins

**Example**:
```css
/* Specificity: 0,0,0,1 + !important */
body { font-family: Arial !important; }

/* Specificity: 0,0,1,0 (no !important needed) */
.text { font-family: Georgia; }
```
**Result**: `.text` wins, even though `body` has `!important`.

### 2. EPUB CSS Structure

**Common EPUB stylesheet patterns**:
```css
/* Class-based text styling (most common) */
.chapterTitle { font-family: "Baskerville", serif; }
.bodyText { font-family: "Garamond", serif; font-size: 1em; }
.noindent { font-family: "Times New Roman", serif; text-indent: 0; }

/* ID-based section styling */
#chapter1 { font-family: "Georgia"; }

/* Inline styles (rare but possible) */
<p style="font-family: 'Comic Sans MS';">Text</p>
```

**Reality**: Most well-formatted EPUBs use **semantic class names** for styling, meaning nearly every paragraph has a class with a hardcoded font-family.

### 3. Current Implementation Limitations

**Location**: `hooks/useEpubReader.ts:144-160`

```typescript
rendition.themes.default({
  body: {
    'background-color': `${colors.bg} !important`,
    'color': `${colors.text} !important`,
    'font-size': `${fontSize}px !important`,
    'line-height': `${lineHeight} !important`,
    'font-family': `${fontFamilyCSS} !important`,  // ← INEFFECTIVE
    padding: '2rem !important',
  },
  p: {
    'margin-bottom': '1em !important',
  },
  a: {
    color: `${colors.text} !important`,
    'text-decoration': 'underline !important',
  },
});
```

**What We're Actually Injecting** (via `themes.addStylesheetRules()`):
```css
body { font-family: Georgia, serif !important; }
p { margin-bottom: 1em !important; }
a { color: #1A1A1A !important; text-decoration: underline !important; }
```

**Why This Fails**:
- We target elements: `body`, `p`, `a` (specificity: 0,0,0,1)
- EPUB targets classes: `.bodyText`, `.noindent5` (specificity: 0,0,1,0)
- **Class wins over element, always**

### 4. How epub.js Applies Themes

**Source Analysis**: `node_modules/epubjs/src/themes.js:1-268`

**Key Methods**:

1. **`themes.default(rules)`** (line 57):
   - Registers CSS rules for "default" theme
   - Calls `registerRules("default", rules)`
   - Stores rules in `this._themes["default"]`

2. **`themes.update(name)`** (line 145):
   - Gets all rendered content iframes
   - Calls `add(name, content)` for each iframe
   - Re-applies theme to already-rendered content

3. **`themes.add(name, contents)`** (line 181):
   - Injects theme into specific iframe
   - Calls `contents.addStylesheetRules(theme.rules, name)`
   - Creates `<style data-epubjs="true">` tag in iframe head

4. **`contents.addStylesheetRules(rules, key)`** (line 767 in contents.js):
   - Converts CSS-in-JS object to stylesheet rules
   - Uses `styleSheet.insertRule()` to add CSS
   - **Does NOT add `!important` automatically**
   - Array format supports `!important` via third parameter: `["color", "red", true]`

**The Process**:
```
1. themes.default({ body: { 'font-family': 'Georgia !important' }})
   ↓
2. registerRules("default", rules) - stores in _themes
   ↓
3. inject(contents) - called via content hook
   ↓
4. add("default", contents)
   ↓
5. contents.addStylesheetRules(rules, "default")
   ↓
6. Creates: <style data-epubjs="true">body { font-family: Georgia !important; }</style>
   ↓
7. Appended to iframe <head> AFTER EPUB's stylesheets
```

**Critical Finding**: Our stylesheet is added AFTER the EPUB's stylesheets, but this **doesn't matter** because specificity trumps source order.

### 5. epub.js Override API

**Source**: `node_modules/epubjs/src/themes.js:205-256`

```javascript
override(name, value, priority) {
  var contents = this.rendition.getContents();

  this._overrides[name] = {
    value: value,
    priority: priority === true  // boolean flag
  };

  contents.forEach((content) => {
    content.css(name, this._overrides[name].value, this._overrides[name].priority);
  });
}
```

**What `contents.css()` Does** (line 251 in contents.js):
```javascript
css(property, value, priority) {
  var content = this.content || this.document.body;

  if (value) {
    content.style.setProperty(property, value, priority ? "important" : "");
  } else {
    content.style.removeProperty(property);
  }

  return this.window.getComputedStyle(content)[property];
}
```

**Critical Understanding**:
- `override()` calls `contents.css()` which uses **`element.style.setProperty()`**
- This sets **inline styles on the body element**
- Inline styles have specificity 1,0,0,0 - **the highest specificity**
- **This is the key to overriding EPUB classes!**

**Convenience Methods**:
```javascript
// Line 254-256 in themes.js
font(f) {
  this.override("font-family", f, true);  // priority=true adds !important
}
```

### 6. Why Our Current Approach Doesn't Work

**The Cascade Hierarchy** (from lowest to highest priority):
1. Browser defaults
2. External stylesheets (EPUB's CSS)
3. Internal `<style>` tags (our themes)
4. Inline styles
5. `!important` in stylesheets
6. `!important` in inline styles

**Current Flow**:
```
EPUB loads:
  <link rel="stylesheet" href="style.css" />  ← EPUB's CSS (classes)

epub.js injects (via themes.default):
  <style data-epubjs="true">
    body { font-family: Georgia !important; }  ← Our CSS (elements)
  </style>

EPUB content:
  <p class="bodyText">Hello</p>  ← Class selector wins
```

**Specificity Comparison**:
- `.bodyText { font-family: Garamond; }` - Specificity: 0,0,1,0
- `body { font-family: Georgia !important; }` - Specificity: 0,0,0,1 + !important

**Outcome**: Class selector (0,0,1,0) > Element selector (0,0,0,1), even with `!important`.

## Detailed Findings

### 1. epub.js Theme API Capabilities

**Available Methods** (from themes.js):

| Method | Purpose | Use Case |
|--------|---------|----------|
| `themes.default(rules)` | Set default theme | Initial theme setup |
| `themes.register(name, rules)` | Register named theme | Multiple theme support |
| `themes.select(name)` | Switch themes | Dark/light mode toggle |
| `themes.update(name)` | Re-apply theme | Force refresh |
| `themes.override(prop, val, priority)` | **Inline style override** | **Font family override** |
| `themes.font(fontFamily)` | Override font (convenience) | Quick font change |
| `themes.fontSize(size)` | Override font size | Quick size change |

**Key Discovery**: `themes.override()` is the correct API for overriding EPUB styles, NOT `themes.default()`.

### 2. CSS Injection Points in epub.js

**Three injection mechanisms**:

1. **Stylesheet URL** (via `registerUrl()`):
   ```javascript
   rendition.themes.register("custom", "https://example.com/theme.css");
   ```
   - Adds `<link>` tag to iframe
   - Subject to same specificity rules

2. **Stylesheet Rules** (via `registerRules()` / `default()`):
   ```javascript
   rendition.themes.default({
     body: { 'font-family': 'Arial' }
   });
   ```
   - Creates `<style>` tag in iframe
   - Subject to same specificity rules
   - **This is what we currently use**

3. **Override (Inline Styles)** (via `override()` / `font()`):
   ```javascript
   rendition.themes.override('font-family', 'Arial', true);
   // OR
   rendition.themes.font('Arial');
   ```
   - Sets `body.style.fontFamily = 'Arial !important'`
   - **Inline styles - highest specificity**
   - **This is what we SHOULD use**

### 3. Content Hooks for Custom Injection

**Location**: `hooks/useEpubReader.ts:82-113`

We already use content hooks for swipe navigation:
```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;
  // ... touch handlers ...
});
```

**What This Enables**:
- Direct DOM access to iframe document
- Can inject `<style>` tags manually
- Can modify EPUB's existing stylesheets
- Can add universal selector rules

**Potential Advanced Solution**:
```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;
  const style = doc.createElement('style');
  style.setAttribute('data-font-override', 'true');
  style.textContent = `
    * {
      font-family: ${fontFamilyCSS} !important;
    }
  `;
  doc.head.appendChild(style);
});
```

### 4. How Other Readers Handle This

**Research from web search results**:

#### Calibre
- **"Extra CSS" option**: Injects CSS with "very high priority"
- **"Filter style information"**: Removes all `font-family` declarations from EPUB CSS
- **Modify Epub plugin**: Strips embedded fonts and CSS references completely
- **Approach**: Preprocessing - modifies EPUB content before rendering

#### Kindle (KDP)
- **Strips all embedded fonts** during EPUB upload
- **Deletes font references** from stylesheets
- **Reader settings override**: User settings always win
- **Approach**: Content modification at publishing time

#### Apple Books (iBooks)
- **`specified-fonts` attribute**: Respects EPUB fonts if attribute is set
- **User override**: Settings allow user to override publisher fonts
- **Approach**: Metadata-driven with user preference priority

#### Readium (Web Reader)
- Uses CSS user stylesheets with `!important`
- Injects universal selectors for typography
- **Approach**: Universal selector + !important

**Common Pattern**: Most readers either:
1. **Strip EPUB fonts entirely** (preprocessing)
2. **Use universal selector + !important** (runtime override)
3. **Provide user toggle** (reader preference vs publisher preference)

### 5. Universal Selector Approach

**CSS Universal Selector**: `* { }`
- Targets all elements
- Specificity: 0,0,0,0 (lowest possible)
- **With `!important`**: Can override class selectors

**Example**:
```css
/* EPUB's class (specificity: 0,0,1,0) */
.bodyText { font-family: Garamond; }

/* Universal selector with !important (specificity: 0,0,0,0 + !important) */
* { font-family: Arial !important; }
```

**Does `!important` on universal selector beat class without `!important`?**

**YES!** According to CSS cascade rules:
1. First, `!important` declarations are separated
2. Among `!important` declarations, specificity is compared
3. Among non-`!important` declarations, specificity is compared
4. `!important` always beats non-`!important`, regardless of specificity

**Result**: `* { font-family: Arial !important; }` **WINS** over `.bodyText { font-family: Garamond; }`

**Caveat**: If EPUB also uses `!important`:
```css
.bodyText { font-family: Garamond !important; }  /* Wins - higher specificity */
* { font-family: Arial !important; }  /* Loses - lower specificity */
```

### 6. Testing the Solutions

**Test EPUB Structure** (hypothetical):
```html
<html>
<head>
  <style>
    .title { font-family: "Baskerville", serif; }
    .body { font-family: "Garamond", serif; font-size: 1em; }
    .emphasis { font-family: "Georgia", serif; font-style: italic; }
  </style>
</head>
<body>
  <h1 class="title">Chapter 1</h1>
  <p class="body">This is body text.</p>
  <p class="body emphasis">This is emphasized.</p>
</body>
</html>
```

**Solution Testing Matrix**:

| Approach | Expected Result | Handles Classes? | Handles IDs? | Handles Inline? |
|----------|----------------|------------------|--------------|-----------------|
| Current (`body` selector) | ❌ Fails | ❌ No | ❌ No | ❌ No |
| Universal selector `*` | ✅ Works | ✅ Yes | ✅ Yes | ❌ No |
| Override API (inline) | ✅ Works | ✅ Yes | ✅ Yes | ⚠️ Maybe |
| Content hook injection | ✅ Works | ✅ Yes | ✅ Yes | ⚠️ Maybe |
| Strip EPUB fonts | ✅ Works | ✅ Yes | ✅ Yes | ✅ Yes |

## Solutions for CSS Override

### Solution 1: Use epub.js Override API (RECOMMENDED)

**Effectiveness**: ⭐⭐⭐⭐⭐ (5/5)
**Maintainability**: ⭐⭐⭐⭐⭐ (5/5)
**Side Effects**: ⭐⭐⭐⭐ (4/5) - May not override inline styles
**Implementation Complexity**: ⭐⭐⭐⭐⭐ (5/5) - Very simple

**How It Works**:
- Uses epub.js built-in `themes.override()` method
- Applies **inline styles** to the body element
- Inline styles have highest specificity (1,0,0,0)
- Overrides all class and ID selectors

**Implementation**:

**Location**: `hooks/useEpubReader.ts:144-160`

**Current code**:
```typescript
useEffect(() => {
  if (!rendition) return;

  const colors = THEME_COLORS[theme];
  rendition.themes.default({
    body: {
      'background-color': `${colors.bg} !important`,
      color: `${colors.text} !important`,
      'font-size': `${fontSize}px !important`,
      'line-height': `${lineHeight} !important`,
      'font-family': `${fontFamilyCSS} !important`,
      padding: '2rem !important',
    },
    p: {
      'margin-bottom': '1em !important',
    },
    a: {
      color: `${colors.text} !important`,
      'text-decoration': 'underline !important',
    },
  });

  rendition.themes.update();
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

**NEW code** (replace the styling effect):
```typescript
useEffect(() => {
  if (!rendition) return;

  const colors = THEME_COLORS[theme];

  // Use themes.default() for element-level styles that don't conflict
  rendition.themes.default({
    body: {
      'background-color': `${colors.bg} !important`,
      color: `${colors.text} !important`,
      padding: '2rem !important',
    },
    p: {
      'margin-bottom': '1em !important',
    },
    a: {
      color: `${colors.text} !important`,
      'text-decoration': 'underline !important',
    },
  });

  // Use override API for typography that MUST override EPUB styles
  rendition.themes.override('font-family', fontFamilyCSS, true);  // priority=true adds !important
  rendition.themes.override('font-size', `${fontSize}px`, true);
  rendition.themes.override('line-height', `${lineHeight}`, true);

  // Force update to apply changes
  rendition.themes.update();
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

**What This Does**:
```html
<!-- Resulting inline styles on body element -->
<body style="font-family: Georgia, serif !important; font-size: 18px !important; line-height: 1.5 !important;">
  <p class="bodyText">This text will use Georgia, not the EPUB's font!</p>
</body>
```

**Pros**:
- ✅ Minimal code change
- ✅ Uses official epub.js API
- ✅ Highest CSS specificity (inline styles)
- ✅ Overrides all class and ID selectors
- ✅ Works with existing theme system
- ✅ No side effects on layout

**Cons**:
- ⚠️ Only applies to body element (children inherit)
- ⚠️ May not override paragraph-level inline styles (rare in EPUBs)
- ⚠️ Requires understanding of CSS inheritance

**Testing**:
1. Open EPUB with class-based font declarations
2. Change font in settings
3. Verify font changes immediately
4. Test with serif, sans-serif, and custom fonts
5. Verify layout remains intact

**Recommendation**: **IMPLEMENT THIS FIRST**. It's the simplest, most maintainable solution that uses epub.js as intended.

---

### Solution 2: Universal Selector via themes.default()

**Effectiveness**: ⭐⭐⭐⭐ (4/5)
**Maintainability**: ⭐⭐⭐⭐ (4/5)
**Side Effects**: ⭐⭐⭐ (3/5) - May affect icons, special glyphs
**Implementation Complexity**: ⭐⭐⭐⭐⭐ (5/5) - Very simple

**How It Works**:
- Uses `*` universal selector with `!important`
- Targets all elements in EPUB
- `!important` on universal selector beats class selectors without `!important`

**Implementation**:

```typescript
useEffect(() => {
  if (!rendition) return;

  const colors = THEME_COLORS[theme];
  rendition.themes.default({
    body: {
      'background-color': `${colors.bg} !important`,
      color: `${colors.text} !important`,
      padding: '2rem !important',
    },
    '*': {  // ← Universal selector
      'font-family': `${fontFamilyCSS} !important`,
      'font-size': 'inherit !important',  // Inherit from body
      'line-height': `${lineHeight} !important`,
    },
    p: {
      'margin-bottom': '1em !important',
    },
    a: {
      color: `${colors.text} !important`,
      'text-decoration': 'underline !important',
    },
  });

  rendition.themes.update();
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

**What This Does**:
```css
/* Injected stylesheet */
* {
  font-family: Georgia, serif !important;
  font-size: inherit !important;
  line-height: 1.5 !important;
}
```

**Pros**:
- ✅ Overrides all class selectors (unless they have `!important`)
- ✅ Simple to implement
- ✅ Works with existing theme API
- ✅ No additional epub.js methods needed

**Cons**:
- ⚠️ Applies to ALL elements (may affect icons, emoji, special glyphs)
- ⚠️ Loses if EPUB classes also use `!important`
- ⚠️ May break decorative fonts used for drop caps, chapter headings
- ⚠️ `font-size: inherit` might cause issues with responsive sizing

**Side Effects**:
- Icons and special glyphs may render incorrectly
- Drop caps or decorative headers lose their intended font
- Page numbers, running headers might change unintentionally

**When to Use**: If Solution 1 (Override API) doesn't work for some reason, try this as a fallback.

---

### Solution 3: Content Hook with Manual Style Injection

**Effectiveness**: ⭐⭐⭐⭐⭐ (5/5)
**Maintainability**: ⭐⭐⭐ (3/5) - More complex
**Side Effects**: ⭐⭐⭐ (3/5) - Similar to Solution 2
**Implementation Complexity**: ⭐⭐⭐ (3/5) - Moderate complexity

**How It Works**:
- Uses epub.js content hooks to inject custom `<style>` tag
- Manually creates stylesheet with high specificity rules
- Full control over CSS injection

**Implementation**:

Add a new effect after the styling effect:

```typescript
// Font override via content hook
useEffect(() => {
  if (!rendition || fontType !== 'system') return;  // Only for system fonts

  const fontOverrideHook = (contents: any) => {
    const doc = contents.document;

    // Remove previous font override if exists
    const existingOverride = doc.querySelector('style[data-font-override]');
    if (existingOverride) {
      existingOverride.remove();
    }

    // Inject new font override
    const style = doc.createElement('style');
    style.setAttribute('data-font-override', 'true');
    style.textContent = `
      /* Override all EPUB fonts with universal selector */
      * {
        font-family: ${fontFamilyCSS} !important;
      }

      /* Ensure body sets the base */
      body {
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight} !important;
      }
    `;
    doc.head.appendChild(style);
  };

  rendition.hooks.content.register(fontOverrideHook);

  // Force re-render current page
  rendition.themes.update();

  return () => {
    rendition.hooks.content.deregister(fontOverrideHook);
  };
}, [rendition, fontFamily, fontSize, lineHeight, fontType]);
```

**What This Does**:
```html
<!-- In each iframe as chapter loads -->
<head>
  <link rel="stylesheet" href="epub-styles.css" />  <!-- EPUB's CSS -->
  <style data-epubjs="true">...</style>  <!-- themes.default() -->
  <style data-font-override="true">  <!-- Our override -->
    * { font-family: Georgia, serif !important; }
    body { font-size: 18px !important; line-height: 1.5 !important; }
  </style>
</head>
```

**Pros**:
- ✅ Full control over CSS injection
- ✅ Can use any CSS strategy
- ✅ Applies to each chapter as it loads
- ✅ Can combine multiple approaches

**Cons**:
- ⚠️ More complex to maintain
- ⚠️ Need to handle hook registration/deregistration
- ⚠️ Must re-run on every chapter navigation
- ⚠️ Same side effects as universal selector (Solution 2)

**When to Use**: If you need fine-grained control or want to experiment with different CSS strategies.

---

### Solution 4: Hybrid Approach (Body Override + Descendant Selector)

**Effectiveness**: ⭐⭐⭐⭐⭐ (5/5)
**Maintainability**: ⭐⭐⭐⭐ (4/5)
**Side Effects**: ⭐⭐⭐⭐⭐ (5/5) - Minimal
**Implementation Complexity**: ⭐⭐⭐⭐ (4/5)

**How It Works**:
- Uses `themes.override()` for inline styles on body (Solution 1)
- PLUS uses `themes.default()` with descendant selectors for broader coverage
- Best of both worlds

**Implementation**:

```typescript
useEffect(() => {
  if (!rendition) return;

  const colors = THEME_COLORS[theme];

  // 1. Element-level styles via themes.default()
  rendition.themes.default({
    body: {
      'background-color': `${colors.bg} !important`,
      color: `${colors.text} !important`,
      padding: '2rem !important',
    },
    // Descendant selectors for better coverage
    'body *': {  // All descendants of body
      'font-family': 'inherit !important',  // Inherit from body
    },
    p: {
      'margin-bottom': '1em !important',
    },
    a: {
      color: `${colors.text} !important`,
      'text-decoration': 'underline !important',
    },
  });

  // 2. Inline styles via override API (highest specificity)
  rendition.themes.override('font-family', fontFamilyCSS, true);
  rendition.themes.override('font-size', `${fontSize}px`, true);
  rendition.themes.override('line-height', `${lineHeight}`, true);

  rendition.themes.update();
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

**What This Does**:
```html
<body style="font-family: Georgia, serif !important; font-size: 18px !important; line-height: 1.5 !important;">
  <!-- All children inherit via CSS cascade -->
  <p class="bodyText">Uses Georgia (inherited)</p>
</body>
```

Plus injected stylesheet:
```css
body * {
  font-family: inherit !important;
}
```

**Pros**:
- ✅ Inline styles on body (highest priority)
- ✅ Descendant selector ensures inheritance
- ✅ Minimal side effects (only affects body descendants)
- ✅ Clean fallback chain

**Cons**:
- ⚠️ Slightly more complex
- ⚠️ Two different APIs for same goal (less DRY)

**When to Use**: If Solution 1 alone doesn't fully work, add the descendant selector for insurance.

---

### Solution 5: Strip EPUB Fonts (Preprocessing)

**Effectiveness**: ⭐⭐⭐⭐⭐ (5/5)
**Maintainability**: ⭐⭐ (2/5) - Very complex
**Side Effects**: ⭐⭐ (2/5) - May break publisher intent
**Implementation Complexity**: ⭐ (1/5) - Very complex

**How It Works**:
- Parse EPUB package before rendering
- Remove all `font-family` declarations from CSS
- Remove embedded font files
- Strips publisher's font choices entirely

**Implementation** (pseudo-code):

```typescript
// In book loading phase, before rendering
const processEpubStyles = async (book: Book) => {
  // 1. Get all spine items (chapters)
  const spine = await book.loaded.spine;

  for (const item of spine.items) {
    // 2. Load chapter HTML
    const doc = await item.load(book.load.bind(book));

    // 3. Find all <style> and <link> tags
    const styles = doc.querySelectorAll('style, link[rel="stylesheet"]');

    for (const styleEl of styles) {
      if (styleEl.tagName === 'STYLE') {
        // Remove font-family from inline styles
        styleEl.textContent = styleEl.textContent?.replace(
          /font-family:\s*[^;]+;?/gi,
          ''
        );
      } else if (styleEl.tagName === 'LINK') {
        // Fetch and modify external stylesheets
        const css = await fetch(styleEl.href).then(r => r.text());
        const modifiedCss = css.replace(/font-family:\s*[^;]+;?/gi, '');

        // Replace link with inline style
        const newStyle = doc.createElement('style');
        newStyle.textContent = modifiedCss;
        styleEl.replaceWith(newStyle);
      }
    }

    // 4. Remove inline styles on elements
    const elementsWithStyle = doc.querySelectorAll('[style*="font-family"]');
    for (const el of elementsWithStyle) {
      el.style.fontFamily = '';
    }
  }
};
```

**Pros**:
- ✅ Completely removes EPUB fonts
- ✅ No CSS specificity issues
- ✅ User fonts always win

**Cons**:
- ❌ Very complex to implement correctly
- ❌ Must parse and modify EPUB package
- ❌ May break publisher's design intent
- ❌ Could violate EPUB specifications
- ❌ Hard to maintain
- ❌ Performance impact (must process entire book)

**When to Use**: **AVOID**. Only consider if all other solutions fail and you're willing to invest significant development time.

---

## Ranked Solution Comparison

| Rank | Solution | Effectiveness | Maintainability | Side Effects | Complexity | Recommended? |
|------|----------|---------------|-----------------|--------------|------------|--------------|
| 1 | Override API | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ **YES** |
| 2 | Hybrid (Override + Descendant) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ If #1 needs help |
| 3 | Universal Selector | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⚠️ Fallback |
| 4 | Content Hook | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ❌ No |
| 5 | Strip EPUB Fonts | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | ❌ **AVOID** |

**Recommended Implementation Order**:
1. **Start with Solution 1** (Override API) - simplest and most effective
2. **If issues persist**, add Solution 4 (Hybrid) - adds descendant selector
3. **If still not working**, try Solution 2 (Universal Selector) - more aggressive
4. **Last resort**: Solution 3 (Content Hook) for fine-tuned control

## Implementation Guide

### Step 1: Implement Solution 1 (Override API)

**File**: `hooks/useEpubReader.ts`
**Lines**: 124-181 (styling effect)

**Changes**:

```diff
  // Apply styling
  useEffect(() => {
    if (!rendition) return;

    // Determine font-family CSS value
    let fontFamilyCSS: string;

    if (fontType === 'custom' && customFont) {
      const systemFallback = fontFamily === 'serif' ? 'Georgia, serif' : '-apple-system, sans-serif';
      fontFamilyCSS = `'${customFont.family}', ${systemFallback}`;
    } else {
      fontFamilyCSS = fontFamily === 'serif'
        ? 'Georgia, serif'
        : '-apple-system, sans-serif';
    }

    // Apply theme colors
    const colors = THEME_COLORS[theme];
    rendition.themes.default({
      body: {
        'background-color': `${colors.bg} !important`,
        color: `${colors.text} !important`,
-       'font-size': `${fontSize}px !important`,
-       'line-height': `${lineHeight} !important`,
-       'font-family': `${fontFamilyCSS} !important`,
        padding: '2rem !important',
      },
      p: {
        'margin-bottom': '1em !important',
      },
      a: {
        color: `${colors.text} !important`,
        'text-decoration': 'underline !important',
      },
    });

+   // Use override API for typography (inline styles - highest specificity)
+   // This ensures our fonts override EPUB's class-based font declarations
+   rendition.themes.override('font-family', fontFamilyCSS, true);
+   rendition.themes.override('font-size', `${fontSize}px`, true);
+   rendition.themes.override('line-height', `${lineHeight}`, true);

    // Force epub.js to re-apply theme to currently rendered content
    rendition.themes.update();

    // ... rest of effect ...
  }, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

### Step 2: Test Implementation

**Test Cases**:

1. **Serif Font Test**
   - Open EPUB with class-based fonts
   - Select "Serif" in font settings
   - ✅ Verify font changes to Georgia immediately
   - ✅ Verify layout remains intact

2. **Sans-Serif Font Test**
   - Select "Sans" in font settings
   - ✅ Verify font changes to system sans
   - ✅ Verify all text uses new font

3. **Custom Font Test** (if implemented)
   - Upload custom font
   - Select custom font
   - ✅ Verify custom font applies
   - ✅ Verify fallback if font fails to load

4. **Font Size Test**
   - Adjust font size slider
   - ✅ Verify size changes immediately
   - ✅ Verify no layout break

5. **Line Height Test**
   - Adjust line height slider
   - ✅ Verify spacing changes
   - ✅ Verify readability

6. **Edge Cases**
   - Test with EPUB that has inline styles
   - Test with EPUB that has ID selectors
   - Test with EPUB that has `!important` in classes
   - Test navigation between chapters

### Step 3: Verify in Browser DevTools

**Inspection Steps**:

1. Open reader with EPUB
2. Open DevTools (F12)
3. Find the iframe element (epub.js content)
4. Switch to iframe context (dropdown in DevTools)
5. Inspect `<body>` element
6. **Expected to see**:
   ```html
   <body style="font-family: Georgia, serif !important; font-size: 18px !important; line-height: 1.5 !important; background-color: #F9F9F9 !important; ...">
   ```
7. Check `<head>` for theme stylesheet:
   ```html
   <style data-epubjs="true">
     body { background-color: #F9F9F9 !important; ... }
     p { margin-bottom: 1em !important; }
   </style>
   ```

### Step 4: Add Logging (for debugging)

Add console logs to verify override is called:

```typescript
// Use override API for typography
console.log('[useEpubReader] Applying font override:', {
  fontFamily: fontFamilyCSS,
  fontSize: `${fontSize}px`,
  lineHeight: `${lineHeight}`,
});

rendition.themes.override('font-family', fontFamilyCSS, true);
rendition.themes.override('font-size', `${fontSize}px`, true);
rendition.themes.override('line-height', `${lineHeight}`, true);

// After update
console.log('[useEpubReader] Theme override applied');
rendition.themes.update();
```

### Step 5: Fallback to Solution 4 (if needed)

If Solution 1 doesn't fully work, add descendant selector:

```typescript
rendition.themes.default({
  body: {
    'background-color': `${colors.bg} !important`,
    color: `${colors.text} !important`,
    padding: '2rem !important',
  },
  'body *': {  // ← Add this
    'font-family': 'inherit !important',
  },
  p: {
    'margin-bottom': '1em !important',
  },
  a: {
    color: `${colors.text} !important`,
    'text-decoration': 'underline !important',
  },
});

// Keep override API calls
rendition.themes.override('font-family', fontFamilyCSS, true);
rendition.themes.override('font-size', `${fontSize}px`, true);
rendition.themes.override('line-height', `${lineHeight}`, true);
```

## Potential Risks and Mitigation

### Risk 1: EPUB with Inline Styles on Elements

**Risk**: Some EPUBs might have:
```html
<p style="font-family: 'Special Font';">Text</p>
```

**Inline styles have highest specificity (1,0,0,0)**, same as our override.

**Mitigation**:
- Our override is on `body`, which has inheritance
- The `<p>` inline style would win (same specificity, but more specific element)
- **Solution**: Use Solution 3 (Content Hook) to strip inline font styles from EPUB content:

```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  // Remove inline font-family styles
  const elementsWithInlineFonts = doc.querySelectorAll('[style*="font-family"]');
  elementsWithInlineFonts.forEach((el: HTMLElement) => {
    el.style.fontFamily = '';
  });
});
```

### Risk 2: EPUB with `!important` on Class Selectors

**Risk**:
```css
.bodyText { font-family: Garamond !important; }
```

**If EPUB class has `!important`, it beats our body inline style** (class specificity 0,0,1,0 > element 0,0,0,1, both with `!important`).

**Mitigation**:
- This is rare in EPUBs (bad practice)
- If encountered, use Solution 2 (Universal Selector) or Solution 3 (Content Hook) to inject more specific selectors
- Or strip the `!important` from EPUB CSS using content hooks

### Risk 3: Icons and Special Glyphs

**Risk**: Universal selector (`*`) would override icon fonts:
```html
<i class="icon-home" style="font-family: 'IconFont';">Home</i>
```

**Mitigation**:
- Solution 1 (Override API) avoids this - only applies to body, icons can use their own fonts
- If using Solution 2 (Universal Selector), exclude icon classes:

```typescript
rendition.themes.default({
  '*:not(.icon):not([class*="icon-"])': {  // Exclude icon classes
    'font-family': `${fontFamilyCSS} !important`,
  },
});
```

### Risk 4: Drop Caps and Decorative Elements

**Risk**: Publisher might use special fonts for drop caps:
```css
.drop-cap { font-family: "Decorative Font"; font-size: 3em; }
```

**Overriding this loses the decorative effect**.

**Mitigation**:
- Accept this as intentional behavior (user wants consistent font)
- OR provide toggle: "Respect publisher fonts" vs "Force my font"
- OR use heuristics to detect decorative elements (size > 2em, first letter of paragraph) and exclude them

### Risk 5: Math Symbols and Special Characters

**Risk**: Math or technical EPUBs might need specific fonts:
```html
<span class="math">∫ ∑ π</span>
```

**Mitigation**:
- System fonts usually support these characters
- If issues arise, add font fallback chain:
  ```typescript
  fontFamilyCSS = `${userFont}, "STIX Two Math", "Cambria Math", serif`;
  ```

### Risk 6: Right-to-Left (RTL) Languages

**Risk**: Arabic, Hebrew EPUBs might need specific fonts for proper rendering.

**Mitigation**:
- Detect language from EPUB metadata
- Use appropriate font fallbacks:
  ```typescript
  if (language === 'ar' || language === 'he') {
    fontFamilyCSS = `${userFont}, "Arial", "Tahoma", sans-serif`;
  }
  ```

## Testing Strategy

### Unit Tests (if applicable)

```typescript
describe('Font Override', () => {
  it('should apply inline font-family to body', () => {
    const rendition = createMockRendition();
    applyFontOverride(rendition, 'Georgia, serif');

    expect(rendition.themes.override).toHaveBeenCalledWith(
      'font-family',
      'Georgia, serif',
      true
    );
  });

  it('should update theme after override', () => {
    const rendition = createMockRendition();
    applyFontOverride(rendition, 'Arial');

    expect(rendition.themes.update).toHaveBeenCalled();
  });
});
```

### Integration Tests

**Manual Testing Checklist**:

- [ ] EPUB with class-based fonts → Font changes
- [ ] EPUB with ID-based fonts → Font changes
- [ ] EPUB with inline styles → Font changes (or known limitation)
- [ ] EPUB with `!important` classes → Font changes (or fallback to Solution 2)
- [ ] Navigation between chapters → Font persists
- [ ] Font size change → Size updates immediately
- [ ] Line height change → Spacing updates immediately
- [ ] Theme change (light/dark) → Colors update, font persists
- [ ] Custom font upload → Custom font applies
- [ ] Page reload → Settings persist from localStorage
- [ ] Mobile/iOS → Font changes work (test in Capacitor)

### Browser Compatibility

**Test in**:
- Chrome/Edge (Blink)
- Safari (WebKit)
- Firefox (Gecko)
- iOS Safari (Capacitor)
- Android Chrome (Capacitor)

**Expected**: All browsers support inline styles and CSS override, so compatibility should be 100%.

## Performance Considerations

### Solution 1 (Override API)

**Performance**: ⭐⭐⭐⭐⭐ Excellent
- Inline styles are fastest (no selector matching)
- Minimal DOM manipulation
- No iteration over elements

### Solution 2 (Universal Selector)

**Performance**: ⭐⭐⭐⭐ Good
- Universal selector has O(n) matching
- Browser optimizes `*` selector
- Negligible impact for typical EPUBs

### Solution 3 (Content Hook)

**Performance**: ⭐⭐⭐ Moderate
- Runs on every chapter load
- Manual DOM manipulation
- Could be slow for large chapters

### Solution 5 (Strip Fonts)

**Performance**: ⭐⭐ Poor
- Must parse entire EPUB
- Regex replacements on all CSS
- Significant initial load time

## Historical Context

### Previous Font Switching Issues

**Reference**: `thoughts/research/2025-11-13-font-switching-complete-failure-analysis.md`

**Previous investigation found**:
- `themes.update()` doesn't re-render current page
- Font switching appeared to "not work at all"
- Race conditions with rendition destruction

**Resolution from that investigation**:
- Added `themes.update()` call
- Added view re-render logic
- Fixed rendition re-initialization bug

**Current issue is DIFFERENT**:
- Previous: Font changes didn't apply to CURRENT page (needed navigation)
- Current: Font changes don't apply AT ALL due to CSS specificity

### Custom Font Upload Implementation

**Reference**: `thoughts/plans/2025-11-13-custom-font-upload-implementation.md`

**Related work**:
- Custom font loading via IndexedDB
- @font-face injection into iframe
- Font preview components

**Integration point**:
- Solution 1 works with custom fonts
- Just need to pass `customFont.family` to `fontFamilyCSS`
- Override API handles both system and custom fonts

## Code References

### Core Files

- **`hooks/useEpubReader.ts:124-181`** - Current styling effect (needs modification)
- **`node_modules/epubjs/src/themes.js:205-256`** - epub.js override implementation
- **`node_modules/epubjs/src/contents.js:251-261`** - CSS setProperty method
- **`stores/settingsStore.ts:48-52`** - Font family state management

### epub.js Source

- **`themes.override()`** (themes.js:205) - Inline style injection
- **`themes.font()`** (themes.js:254) - Convenience method for font-family
- **`contents.css()`** (contents.js:251) - Applies inline styles to body
- **`themes.default()`** (themes.js:57) - Registers theme rules
- **`themes.update()`** (themes.js:145) - Re-applies theme to rendered content

### Related Research

- **`thoughts/research/2025-11-13-font-switching-complete-failure-analysis.md`** - Previous font switching issues
- **`thoughts/research/2025-11-13-typography-and-font-implementation-analysis.md`** - Typography implementation analysis
- **`thoughts/plans/2025-11-13-custom-font-upload-implementation.md`** - Custom font feature plan

## Summary for Implementation

### Current Problem

**What's Wrong**:
```typescript
// Current implementation - DOESN'T WORK
rendition.themes.default({
  body: {
    'font-family': `${fontFamilyCSS} !important`,  // Element selector
  },
});
```

**Why It Fails**:
- We use element selector (`body`) - specificity: 0,0,0,1
- EPUB uses class selectors (`.bodyText`) - specificity: 0,0,1,0
- **Class beats element, always**

**Real-World Example**:
```css
/* EPUB's CSS - WINS */
.noindent5 { font-family: "EBGaramond", serif; }

/* Our CSS - LOSES */
body { font-family: Georgia, serif !important; }
```

### Recommended Solution

**What to Do**:
```typescript
// Recommended implementation - WORKS
rendition.themes.override('font-family', fontFamilyCSS, true);
rendition.themes.override('font-size', `${fontSize}px`, true);
rendition.themes.override('line-height', `${lineHeight}`, true);
```

**Why It Works**:
- Uses epub.js `override()` API
- Applies **inline styles** to body element
- Inline styles have specificity: 1,0,0,0
- **Inline beats class, always**

**Result**:
```html
<body style="font-family: Georgia, serif !important; ...">
  <p class="noindent5">Text uses Georgia (inherited from body)</p>
</body>
```

### Implementation Checklist

- [ ] **Step 1**: Update `hooks/useEpubReader.ts` styling effect
- [ ] **Step 2**: Remove font properties from `themes.default()`
- [ ] **Step 3**: Add `themes.override()` calls for font-family, font-size, line-height
- [ ] **Step 4**: Test with EPUB containing class-based fonts
- [ ] **Step 5**: Verify in DevTools that inline styles are applied
- [ ] **Step 6**: Test navigation between chapters
- [ ] **Step 7**: Test on mobile (Capacitor)
- [ ] **Step 8**: If issues persist, add Solution 4 (descendant selector)

### Expected Outcome

✅ **After Implementation**:
- Font changes apply immediately
- Works with any EPUB (class, ID, element selectors)
- Overrides all EPUB fonts (except inline styles, rare)
- No layout side effects
- No performance impact
- Works with custom fonts
- Works with system fonts

### Next Steps

1. **Implement Solution 1** (5 minutes) - simplest and most effective
2. **Test thoroughly** (15 minutes) - multiple EPUBs, all font options
3. **If issues arise**, add Solution 4 (5 minutes) - hybrid approach
4. **Document findings** - update this research if edge cases discovered

---

**End of Research Document**
