---
doc_type: research
date: 2025-11-13T16:52:03+00:00
title: "CSS Override Still Not Working Debug"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T16:52:03+00:00"
research_question: "Why isn't the CSS font override working despite using high specificity selectors (body *, body *::before, body *::after) with !important flags AND themes.override() for inline styles?"
research_type: codebase_research
researcher: Sean Kim

git_commit: dc51a88d49fa0d4a022d16ad8937c829f6fffc2a
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - css
  - epub
  - fonts
  - specificity
  - debug
status: complete

related_docs:
  - thoughts/research/2025-11-13-epub-embedded-css-font-override-issue-investigation.md
---

# Research: CSS Override Still Not Working Debug

**Date**: 2025-11-13T16:52:03+00:00
**Researcher**: Sean Kim
**Git Commit**: dc51a88d
**Branch**: main
**Repository**: reader

## Research Question

Why isn't the CSS font override working despite using high specificity selectors (body *, body *::before, body *::after) with !important flags AND themes.override() for inline styles?

## Executive Summary

This investigation reveals a **critical misunderstanding of how the current implementation should work**. The code at `hooks/useEpubReader.ts:145-174` implements BOTH Solution 1 (Override API with inline styles) AND parts of Solution 4 (Hybrid approach with descendant selectors) from the previous research document. **Theoretically, this should work perfectly.**

However, the user reports it's STILL not working. This means:

1. **Either there's a bug in how the styles are being applied** (timing issue, iframe not updated, etc.)
2. **Or the EPUB has `!important` on its class selectors** (which would beat our `body *` selector)
3. **Or the inline styles from `themes.override()` aren't being applied at all** (bug in epub.js or our usage)
4. **Or there's an issue with font-family inheritance** (child element overriding parent)

The most likely root causes are:
- **Root Cause #1**: The inline styles from `themes.override()` apply to `body`, but child elements with classes still win because **direct application beats inheritance**
- **Root Cause #2**: The `body *` selector might not have `!important` applied correctly due to how epub.js parses the CSS string
- **Root Cause #3**: Timing issue where styles are applied before EPUB content loads

## Critical Findings

### Finding 1: Current Implementation Analysis

**Location**: `hooks/useEpubReader.ts:145-174`

**What's Implemented**:
```typescript
// Part 1: Descendant selector with !important
rendition.themes.default({
  'body *, body *::before, body *::after': {
    'font-family': `${fontFamilyCSS} !important`,
  },
});

// Part 2: Inline styles via override API
rendition.themes.override('font-family', fontFamilyCSS, true);
rendition.themes.override('font-size', `${fontSize}px`, true);
rendition.themes.override('line-height', `${lineHeight}`, true);

// Part 3: Force update
rendition.themes.update();
```

**What This SHOULD Do**:

1. **Descendant Selector (`body *`)**: Injects CSS into iframe's `<head>`:
   ```css
   body *, body *::before, body *::after {
     font-family: Georgia, serif !important;
   }
   ```
   - Specificity: `0,0,0,1` (body element) + `0,0,0,0` (universal) = `0,0,0,1`
   - Has `!important` flag

2. **Override API (Inline Styles)**: Applies inline style to body element:
   ```html
   <body style="font-family: Georgia, serif !important; font-size: 18px !important; line-height: 1.5 !important;">
   ```
   - Specificity: `1,0,0,0` (inline style - highest possible)

3. **Update**: Forces epub.js to re-apply all styles to currently rendered content

**Why This SHOULD Work**:

According to CSS cascade rules:
- `!important` on any selector beats non-`!important` on any other selector, regardless of specificity
- Inline styles have the highest specificity (1,0,0,0)
- The `body *` selector with `!important` should override `.noindent5` without `!important`
- Even if that fails, the inline style on `body` should cause children to inherit the font

**Why This MIGHT NOT Work**:

The critical issue is **CSS inheritance vs direct application**:

```html
<body style="font-family: Georgia !important;">
  <p class="noindent5">Text</p>
</body>
```

```css
.noindent5 { font-family: EBGaramond; }
body * { font-family: Georgia !important; }
```

**Expected Cascade**:
1. `<p>` inherits `font-family: Georgia` from `<body>` inline style
2. `.noindent5` applies `font-family: EBGaramond` directly to `<p>` (specificity: 0,0,1,0)
3. `body *` applies `font-family: Georgia !important` to `<p>` (specificity: 0,0,0,1 + !important)
4. **`body *` should win** because `!important` beats non-`!important`

**BUT**: If the EPUB's stylesheet ALSO uses `!important`:
```css
.noindent5 { font-family: EBGaramond !important; }
```

Then:
- `.noindent5 !important` has specificity `0,0,1,0` + !important
- `body * !important` has specificity `0,0,0,1` + !important
- **`.noindent5` wins** because both have `!important`, so specificity decides (class > element)

### Finding 2: epub.js CSS Parsing

**Location**: `node_modules/epubjs/src/contents.js:792-811`

**How epub.js Parses Object-Based CSS Rules**:
```javascript
const selectors = Object.keys(rules);
selectors.forEach((selector) => {
  const definition = rules[selector];
  const _rules = Object.keys(definition);
  const result = _rules.map((rule) => {
    return `${rule}:${definition[rule]}`;  // ← CRITICAL LINE
  }).join(';');
  styleSheet.insertRule(`${selector}{${result}}`, styleSheet.cssRules.length);
});
```

**Key Observation**:
Line 807 does `${rule}:${definition[rule]}`, which means it **directly concatenates** the CSS property and value.

When we pass:
```typescript
{
  'body *, body *::before, body *::after': {
    'font-family': 'Georgia, serif !important'
  }
}
```

It generates:
```css
body *, body *::before, body *::after { font-family: Georgia, serif !important; }
```

**This is correct!** The `!important` is included in the value string and gets inserted properly.

**Verification**:
```javascript
// Test script output from earlier
Selector: body *
Result: font-family:Georgia, serif !important
Final CSS: body *{font-family:Georgia, serif !important}
```

✅ The CSS is being generated correctly.

### Finding 3: Override API Implementation

**Location**: `node_modules/epubjs/src/themes.js:205-216`

**How `themes.override()` Works**:
```javascript
override (name, value, priority) {
  var contents = this.rendition.getContents();

  this._overrides[name] = {
    value: value,
    priority: priority === true
  };

  contents.forEach( (content) => {
    content.css(name, this._overrides[name].value, this._overrides[name].priority);
  });
}
```

**Location**: `node_modules/epubjs/src/contents.js:251-261`

**How `contents.css()` Works**:
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

**What This Does**:
- Gets the content element (defaults to `document.body`)
- Uses `setProperty(property, value, "important")` to set inline style
- Sets style on the BODY element

**Result**:
```html
<body style="font-family: Georgia, serif !important;">
```

✅ This should apply inline styles correctly.

### Finding 4: CSS Specificity Deep Dive

**Specificity Calculation Rules**:

1. Inline styles: `1,0,0,0`
2. ID selectors: `0,1,0,0`
3. Class/attribute/pseudo-class: `0,0,1,0`
4. Element/pseudo-element: `0,0,0,1`
5. Universal selector: `0,0,0,0`

**Examples**:

| Selector | Calculation | Specificity |
|----------|-------------|-------------|
| `*` | universal | 0,0,0,0 |
| `body` | element | 0,0,0,1 |
| `body *` | element + universal | 0,0,0,1 |
| `body p` | element + element | 0,0,0,2 |
| `.noindent5` | class | 0,0,1,0 |
| `#header` | ID | 0,1,0,0 |
| `style="..."` | inline | 1,0,0,0 |

**Our Selectors**:

| Selector | Specificity | Has !important? |
|----------|-------------|-----------------|
| `body * { ... !important }` | 0,0,0,1 | ✅ Yes |
| `.noindent5 { ... }` | 0,0,1,0 | ❌ No (assumed) |
| `<body style="... !important">` | 1,0,0,0 | ✅ Yes |

**Cascade Resolution**:

```
Step 1: Separate !important declarations
  - body * (0,0,0,1) with !important
  - <body style> (1,0,0,0) with !important

Step 2: Separate non-!important declarations
  - .noindent5 (0,0,1,0) without !important

Step 3: Compare !important declarations by specificity
  - <body style> (1,0,0,0) wins over body * (0,0,0,1)
  - Both apply, but inline style has higher priority

Step 4: !important declarations beat non-!important
  - Both body * and <body style> beat .noindent5
```

**Expected Result**: Our styles should win!

### Finding 5: The Inheritance Problem

**Critical Insight**: CSS inheritance is NOT the same as direct application.

**Scenario 1: Inheritance (Current Implementation)**:
```html
<body style="font-family: Georgia !important;">
  <p class="noindent5">Text</p>
</body>
```

```css
.noindent5 { font-family: EBGaramond; }
```

**What Happens**:
1. `<body>` has inline style: `font-family: Georgia !important`
2. `<p>` inherits `font-family: Georgia` from body (inherited value)
3. `<p>` has class `.noindent5` which applies `font-family: EBGaramond` (direct value)
4. **Direct application beats inherited value**, even if the inherited value has `!important` on the parent

**Result**: `<p>` shows EBGaramond ❌

**Why?**: In CSS, `!important` on a parent's inline style does NOT make the inherited value `!important` on the child. The child sees:
- Inherited value: `font-family: Georgia` (no !important, it's just inherited)
- Direct value: `font-family: EBGaramond` (from class)
- **Direct beats inherited**

---

**Scenario 2: Direct Application with !important (What We Think We Have)**:
```css
body * { font-family: Georgia !important; }
.noindent5 { font-family: EBGaramond; }
```

```html
<body>
  <p class="noindent5">Text</p>
</body>
```

**What Happens**:
1. `<p>` matches `body *` → `font-family: Georgia !important` (specificity: 0,0,0,1 + !important)
2. `<p>` matches `.noindent5` → `font-family: EBGaramond` (specificity: 0,0,1,0, no !important)
3. Compare: `!important` beats non-`!important`, regardless of specificity
4. **`body *` wins**

**Result**: `<p>` shows Georgia ✅

**Conclusion**: The `body *` selector with `!important` SHOULD work, if it's being applied correctly.

### Finding 6: Possible Bugs

**Potential Issue #1: Timing**

The styles might be applied BEFORE the EPUB content loads, so when the content loads, it overrides our styles.

**Flow**:
```
1. rendition.themes.default({ 'body *': { ... } })  ← Registers theme
2. rendition.themes.override('font-family', ...)    ← Registers override
3. rendition.themes.update()                        ← Applies to current content
4. EPUB chapter loads                               ← Loads new iframe
5. ??? Are our styles re-applied to the new iframe? ???
```

**Check**: Do content hooks re-run when navigating between chapters?

**Location**: `hooks/useEpubReader.ts:82-113`

```typescript
newRendition.hooks.content.register((contents: any) => {
  // This runs for EVERY chapter as it loads
});
```

**Answer**: YES, content hooks run for every chapter. And `themes.inject()` is registered as a content hook:

**Location**: `node_modules/epubjs/src/themes.js:21-22`

```javascript
this.rendition.hooks.content.register(this.inject.bind(this));
this.rendition.hooks.content.register(this.overrides.bind(this));
```

So both theme rules AND overrides are re-applied to each chapter as it loads. ✅ Timing should be fine.

---

**Potential Issue #2: EPUB Has !important**

If the EPUB's CSS uses `!important`, our styles would lose:

```css
.noindent5 { font-family: EBGaramond !important; }  /* Specificity: 0,0,1,0 + !important */
body * { font-family: Georgia !important; }         /* Specificity: 0,0,0,1 + !important */
```

**Result**: `.noindent5` wins (higher specificity, both have !important) ❌

**How to Check**: User needs to inspect the EPUB's CSS in DevTools to see if it has `!important` on font-family.

---

**Potential Issue #3: Selector Not Being Applied**

Perhaps the selector `'body *, body *::before, body *::after'` is being parsed incorrectly or not inserted into the stylesheet.

**How to Check**: User needs to:
1. Open DevTools
2. Switch to iframe context
3. Inspect `<head>` → find `<style id="epubjs-inserted-css-default">`
4. Check if the rule `body * { font-family: ... !important; }` exists

---

**Potential Issue #4: Value String Parsing**

When we pass `'font-family': '${fontFamilyCSS} !important'`, perhaps the variable contains quotes or special characters that break the CSS.

**Example**:
```typescript
fontFamilyCSS = "'Georgia', serif"
// Results in:
'font-family': "'Georgia', serif !important"
// Generates CSS:
body * { font-family: 'Georgia', serif !important; }
```

This should be valid CSS. But if `fontFamilyCSS` has a trailing quote or escape character, it could break.

**How to Check**: Add console.log to see exact value:
```typescript
console.log('[useEpubReader] fontFamilyCSS:', fontFamilyCSS);
```

---

**Potential Issue #5: Multiple iframes**

If there are multiple iframes (for different chapters or spread view), perhaps only some of them get the styles applied.

**How to Check**: User needs to verify that ALL iframes have the styles in their `<head>`.

## Root Cause Hypothesis

Based on the investigation, the most likely root causes are:

### Hypothesis 1: EPUB Uses !important (Most Likely)

**Probability**: 70%

**Issue**: If the EPUB's stylesheet has:
```css
.noindent5 { font-family: EBGaramond !important; }
```

Then our `body *` selector loses because both have `!important`, so specificity decides (class > element).

**Solution**: Use a MORE SPECIFIC selector:
```typescript
rendition.themes.default({
  'body *': {
    'font-family': `${fontFamilyCSS} !important`,
  },
  'body * *': {  // Even more specific
    'font-family': `${fontFamilyCSS} !important`,
  },
  // Or target common EPUB elements explicitly
  'body p, body div, body span, body h1, body h2, body h3, body h4, body h5, body h6': {
    'font-family': `${fontFamilyCSS} !important`,
  },
});
```

OR: Use a content hook to REMOVE `!important` from EPUB styles:
```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  // Find all stylesheets
  const stylesheets = doc.querySelectorAll('style, link[rel="stylesheet"]');

  // Remove !important from font-family declarations
  // (This is complex and may break other things)
});
```

---

### Hypothesis 2: Font-Family Value Contains Special Characters

**Probability**: 15%

**Issue**: The `fontFamilyCSS` variable might contain quotes, commas, or other characters that break when concatenated with `!important`.

**Example**:
```typescript
fontFamilyCSS = "'Custom Font', 'Another Font', serif"
// Results in:
body * { font-family: 'Custom Font', 'Another Font', serif !important; }
```

This should be valid, but browsers can be picky.

**Solution**: Ensure proper escaping or use a different format:
```typescript
const fontFamilyCSS = fontFamily === 'serif'
  ? 'Georgia, serif'
  : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
```

---

### Hypothesis 3: The Selector Space is Wrong

**Probability**: 10%

**Issue**: The space in `'body *, body *::before, body *::after'` might be parsed incorrectly.

**What It Means**:
- `body *::before` (with space) = "the ::before pseudo-element of all descendants of body"
- `body*::before` (no space) = "the ::before pseudo-element of body element itself" (invalid)

The current syntax is CORRECT, but epub.js might not parse it properly.

**Solution**: Try without pseudo-elements first:
```typescript
rendition.themes.default({
  'body *': {
    'font-family': `${fontFamilyCSS} !important`,
  },
});
```

If that works, then add pseudo-elements back separately:
```typescript
rendition.themes.default({
  'body *': {
    'font-family': `${fontFamilyCSS} !important`,
  },
  'body *::before, body *::after': {
    'font-family': `${fontFamilyCSS} !important`,
  },
});
```

---

### Hypothesis 4: Inheritance vs Direct Application

**Probability**: 5%

**Issue**: As explained in Finding 5, if the inline style on `<body>` just sets inheritance, child elements with classes can override it.

BUT: We already have `body *` selector which should apply DIRECTLY to all children, not via inheritance.

**Solution**: Ensure the `body *` selector is actually being applied (check DevTools).

## Debugging Steps for User

To identify the actual root cause, the user should:

### Step 1: Inspect the EPUB's CSS

1. Open reader with EPUB
2. Open DevTools (F12)
3. Click the "iframe" dropdown in DevTools (top left)
4. Select the epub.js iframe
5. Go to "Elements" tab
6. Expand `<head>` section
7. Find the EPUB's stylesheet (usually `<link rel="stylesheet" href="...">` or `<style>`)
8. Check if `.noindent5` (or other class) has `!important`:
   ```css
   .noindent5 {
     font-family: "EBGaramond", serif !important;  /* ← LOOK FOR THIS */
   }
   ```

**Result**:
- ✅ If EPUB has `!important`: **Hypothesis 1 is correct**
- ❌ If EPUB has no `!important`: Continue to Step 2

---

### Step 2: Inspect Our Injected CSS

1. In the same iframe context in DevTools
2. Look for `<style id="epubjs-inserted-css-default">`
3. Check if it contains:
   ```css
   body *, body *::before, body *::after {
     font-family: Georgia, serif !important;
   }
   ```

**Result**:
- ✅ If the rule exists: Our CSS is being injected correctly
- ❌ If the rule is missing: There's a bug in how we're calling `themes.default()`
- ⚠️ If the rule exists but `!important` is missing: epub.js is stripping it

---

### Step 3: Inspect the Body Element

1. In the same iframe context
2. Inspect the `<body>` element
3. Check the inline styles:
   ```html
   <body style="font-family: Georgia, serif !important; font-size: 18px !important; ...">
   ```

**Result**:
- ✅ If inline styles exist: `themes.override()` is working
- ❌ If inline styles are missing: There's a bug in `themes.override()` or how we're calling it

---

### Step 4: Inspect a Paragraph Element

1. In the same iframe context
2. Find a `<p>` element with the class `.noindent5`
3. Right-click → Inspect
4. In the "Styles" tab, check which rule is winning:
   - Look for `font-family` property
   - See which CSS rule is NOT crossed out (the winning rule)

**Result**:
- If `.noindent5` is winning: Check its specificity and `!important`
- If `body *` is winning but font still looks wrong: The font might not be loaded or the font name is wrong
- If inline style on `<body>` is winning: Child might be inheriting (check "Computed" tab)

---

### Step 5: Check the Computed Style

1. Still inspecting the `<p>` element
2. Switch to "Computed" tab
3. Find `font-family`
4. Click the arrow to expand it
5. See which CSS rule is the "winning" rule

**Result**: This will show EXACTLY which rule is being applied.

---

### Step 6: Check Console Logs

1. Go to "Console" tab in DevTools
2. Look for our log:
   ```
   [useEpubReader] Styling effect ran { fontFamily: 'serif', fontType: 'system', customFont: undefined }
   ```

**Result**: Verify that the effect is running and the values are correct.

---

### Step 7: Test with Simple CSS

To isolate the issue, try using a MORE specific selector:

**Temporary Test Change** in `hooks/useEpubReader.ts:145-164`:

```typescript
rendition.themes.default({
  body: {
    'background-color': `${colors.bg} !important`,
    color: `${colors.text} !important`,
    padding: '2rem !important',
  },
  // Test: Use ONLY body * without pseudo-elements
  'body *': {
    'font-family': `Georgia, serif !important`,  // Hardcode to test
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

If this works, then the issue is with the pseudo-element syntax or the variable `fontFamilyCSS`.

## Recommended Solutions

### Solution A: Use More Specific Selector (If EPUB has !important)

If the EPUB's classes use `!important`, we need HIGHER specificity.

**Implementation**:

```typescript
rendition.themes.default({
  body: {
    'background-color': `${colors.bg} !important`,
    color: `${colors.text} !important`,
    padding: '2rem !important',
  },
  // More specific selector: targets common EPUB elements
  'body p, body div, body span, body h1, body h2, body h3, body h4, body h5, body h6, body li, body td, body th, body blockquote, body pre': {
    'font-family': `${fontFamilyCSS} !important`,
  },
  // Also target all descendants (fallback)
  'body *': {
    'font-family': `${fontFamilyCSS} !important`,
  },
  p: {
    'margin-bottom': '1em !important`,
  },
  a: {
    color: `${colors.text} !important`,
    'text-decoration': 'underline !important',
  },
});
```

**Pros**:
- Higher specificity for common elements
- Fallback to universal selector
- Still uses official epub.js API

**Cons**:
- More verbose
- Might miss uncommon elements

---

### Solution B: Strip EPUB's !important (Content Hook)

If the EPUB uses `!important`, we can strip it using a content hook.

**Implementation**:

```typescript
// Add this effect BEFORE the styling effect
useEffect(() => {
  if (!rendition) return;

  const stripImportantHook = (contents: any) => {
    const doc = contents.document;

    // Find all style elements
    const styleElements = doc.querySelectorAll('style');

    styleElements.forEach((styleEl: HTMLStyleElement) => {
      // Skip our own styles
      if (styleEl.id && styleEl.id.includes('epubjs-inserted-css')) {
        return;
      }

      // Remove !important from font-family declarations
      if (styleEl.textContent) {
        styleEl.textContent = styleEl.textContent.replace(
          /font-family:\s*([^;]+)\s*!important/gi,
          'font-family: $1'
        );
      }
    });
  };

  rendition.hooks.content.register(stripImportantHook);

  return () => {
    rendition.hooks.content.deregister(stripImportantHook);
  };
}, [rendition]);
```

**Pros**:
- Removes the competing `!important` flags
- Our styles will definitely win

**Cons**:
- Modifies EPUB content (might break publisher intent)
- Complex and fragile
- Performance impact (runs on every chapter)

---

### Solution C: Use ID-Based Selector (Highest Specificity)

Give the body element an ID and use that for highest specificity.

**Implementation**:

```typescript
useEffect(() => {
  if (!rendition) return;

  const addIdHook = (contents: any) => {
    const doc = contents.document;
    const body = doc.body;

    // Add ID to body
    body.id = 'epub-reader-body';
  };

  rendition.hooks.content.register(addIdHook);

  return () => {
    rendition.hooks.content.deregister(addIdHook);
  };
}, [rendition]);

// Then in styling effect:
rendition.themes.default({
  '#epub-reader-body *': {  // Specificity: 0,1,0,0 + 0,0,0,0 = 0,1,0,0
    'font-family': `${fontFamilyCSS} !important`,
  },
});
```

**Pros**:
- ID selector (0,1,0,0) beats class selector (0,0,1,0)
- Even if EPUB has `!important` on class, our ID selector with `!important` wins

**Cons**:
- Requires modifying the DOM (adding ID to body)
- Slightly more complex

---

### Solution D: Use Universal Selector with Multiple Descendants

Chain multiple descendant selectors to increase specificity.

**Implementation**:

```typescript
rendition.themes.default({
  'body * *': {  // Specificity: 0,0,0,2 (body + universal + universal)
    'font-family': `${fontFamilyCSS} !important`,
  },
  'body * * *': {  // Specificity: 0,0,0,3
    'font-family': `${fontFamilyCSS} !important`,
  },
});
```

**Pros**:
- Simple to implement
- Increases specificity without changing DOM

**Cons**:
- Still loses to class selectors (0,0,1,0 > 0,0,0,3)
- Not effective if EPUB uses classes

---

### Solution E: Inline Styles on Every Element (Nuclear Option)

Use a content hook to apply inline styles to EVERY element.

**Implementation**:

```typescript
useEffect(() => {
  if (!rendition || fontType !== 'system') return;

  const fontFamilyCSS = fontFamily === 'serif'
    ? 'Georgia, serif'
    : '-apple-system, sans-serif';

  const inlineStyleHook = (contents: any) => {
    const doc = contents.document;

    // Get all elements
    const allElements = doc.body.querySelectorAll('*');

    allElements.forEach((el: HTMLElement) => {
      // Apply inline style
      el.style.setProperty('font-family', fontFamilyCSS, 'important');
    });
  };

  rendition.hooks.content.register(inlineStyleHook);

  return () => {
    rendition.hooks.content.deregister(inlineStyleHook);
  };
}, [rendition, fontFamily, fontType]);
```

**Pros**:
- Inline styles on each element = highest specificity
- Guaranteed to work

**Cons**:
- Performance impact (iterates over all elements)
- Might break special elements (icons, decorative fonts)
- Doesn't work for dynamically added content
- Overkill

## Recommended Implementation Order

1. **Debug First** (Steps 1-6 above) - understand the actual issue
2. **Try Solution A** (More specific selector) - simple and effective
3. **If that fails, try Solution C** (ID-based selector) - higher specificity
4. **If that fails, try Solution B** (Strip EPUB !important) - aggressive but effective
5. **Last resort: Solution E** (Inline styles on everything) - nuclear option

## Code Changes

### Change 1: Add Debugging Logs

**File**: `hooks/useEpubReader.ts:145-177`

Add logging before and after style application:

```typescript
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

  // Apply theme colors and styles
  const colors = THEME_COLORS[theme];

  console.log('[useEpubReader] Applying font override:', {
    fontFamilyCSS,
    fontSize: `${fontSize}px`,
    lineHeight: `${lineHeight}`,
    theme,
  });

  // ... rest of effect ...

  rendition.themes.update();

  console.log('[useEpubReader] Font override applied, waiting for re-render');
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

### Change 2: Try Solution A (More Specific Selector)

**File**: `hooks/useEpubReader.ts:154-156`

Replace:
```typescript
'body *, body *::before, body *::after': {
  'font-family': `${fontFamilyCSS} !important`,
},
```

With:
```typescript
// More specific selectors for common EPUB elements
'body p, body div, body span, body h1, body h2, body h3, body h4, body h5, body h6, body li, body td, body th': {
  'font-family': `${fontFamilyCSS} !important`,
},
// Universal selector as fallback
'body *': {
  'font-family': `${fontFamilyCSS} !important`,
},
// Pseudo-elements
'body *::before, body *::after': {
  'font-family': `${fontFamilyCSS} !important`,
},
```

### Change 3: If Solution A Fails, Try Solution C (ID Selector)

**File**: `hooks/useEpubReader.ts` (add new effect before styling effect)

```typescript
// Add ID to body element for higher specificity
useEffect(() => {
  if (!rendition) return;

  const addBodyIdHook = (contents: any) => {
    const doc = contents.document;
    if (doc.body && !doc.body.id) {
      doc.body.id = 'epub-reader-body';
      console.log('[useEpubReader] Added ID to body element');
    }
  };

  rendition.hooks.content.register(addBodyIdHook);

  return () => {
    rendition.hooks.content.deregister(addBodyIdHook);
  };
}, [rendition]);
```

**Then update the styling effect**:

```typescript
rendition.themes.default({
  body: {
    'background-color': `${colors.bg} !important`,
    color: `${colors.text} !important`,
    padding: '2rem !important',
  },
  // Use ID selector for highest specificity (0,1,0,0)
  '#epub-reader-body *': {
    'font-family': `${fontFamilyCSS} !important`,
  },
  '#epub-reader-body *::before, #epub-reader-body *::after': {
    'font-family': `${fontFamilyCSS} !important`,
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

## Summary

The current implementation SHOULD work theoretically, but something is preventing it. The most likely issues are:

1. **EPUB uses `!important` on its class selectors** (check DevTools)
2. **The selector or value is malformed** (check generated CSS)
3. **Inline styles aren't being applied** (check body element)

User should follow the debugging steps to identify the root cause, then apply the appropriate solution. The recommended approach is:

1. **Debug first** (don't guess)
2. **Try Solution A** (more specific selectors)
3. **Try Solution C** if needed (ID-based selector)
4. **Report findings** for further assistance

The key insight is that **`!important` on inheritance is NOT the same as `!important` on direct application**. We need the `body *` selector to apply styles DIRECTLY to children, not via inheritance from the body element.
