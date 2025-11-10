# Serene Audio Continuation UX

**Ticket ID:** ENG-AUDIO-001
**Created:** 2025-11-10
**Status:** Planning
**Priority:** High

## Core Principle

Audio is not a "feature" — it's **continuation of the reading experience** when hands-free is needed. Pricing should be invisible during reading flow, handled gracefully through account balance.

## Design Philosophy Alignment

From spec-v0.1.md:
> "Calm, curious, focused — a companion that subtly understands when to help and when to stay silent"

**Audio must:**
- Never interrupt reading flow with pricing decisions
- Feel like natural continuation, not upsell
- Respect the serene, restrained aesthetic
- Maintain "graceful silence" — no promotional language

## UX Approach: Account Balance System

### Setup (One-Time, Settings Area)

**Audio Settings** (in settings drawer, not during reading):
```
┌─────────────────────────────────┐
│ Audio                           │
│                                 │
│ Listen when hands-free          │
│ Natural voice narration         │
│                                 │
│ Voice Quality:                  │
│ ○ Standard (Device voice) Free  │
│ ● Premium (Natural voice)       │
│                                 │
│ Account Balance: $10.00         │
│ [Add Funds]                     │
│                                 │
│ Estimated: ~20 chapters         │
│ (~2-3 books)                    │
└─────────────────────────────────┘
```

**Add Funds Flow** (outside reading context):
```
┌─────────────────────────────────┐
│ Add Audio Balance               │
│                                 │
│ ○ $5.00  (~10 chapters)         │
│ ● $10.00 (~20 chapters)         │
│ ○ $20.00 (~40 chapters)         │
│ ○ $50.00 (~100 chapters)        │
│                                 │
│ Balance never expires           │
│                                 │
│ [Add to Account]                │
└─────────────────────────────────┘
```

### During Reading (Zero Friction)

**Context-aware audio suggestion** (when appropriate):

```
User has been reading for 25 minutes
Typical commute time approaching (learned pattern)

┌─────────────────────────────────┐
│                                 │
│    Chapter 5: The Journey       │
│                                 │
│    [Continue Reading]           │
│                                 │
│    Or listen hands-free         │
│    [Play Audio]                 │
│                                 │
└─────────────────────────────────┘
```

**No pricing information shown** — balance is pre-loaded.

If user selects "Play Audio":
- Audio generates quietly
- Shows gentle progress: "Preparing audio..."
- Deducts from balance silently
- Begins playback when ready

### When Balance is Low

**Gentle notification** (not during reading):

When user opens app (library view):
```
┌─────────────────────────────────┐
│ ℹ Audio balance: $1.50          │
│                                 │
│ Enough for ~3 chapters          │
│                                 │
│ [Add Funds] [Dismiss]           │
└─────────────────────────────────┘
```

**During reading** (if balance insufficient):
```
User taps "Play Audio"

┌─────────────────────────────────┐
│ Audio balance: $0.40            │
│ This chapter needs ~$0.50       │
│                                 │
│ [Add $5] [Use Standard Voice]   │
└─────────────────────────────────┘
```

**Fallback to free option always available:**
- Standard = Device TTS (free, lower quality)
- Premium = OpenAI TTS (costs balance, high quality)

## Visual Design Language

### Typography & Tone

All audio-related UI follows spec principles:

**Typeface:**
- Body: Source Serif (matches reading)
- Labels: Söhne (minimal UI text)

**Colors:**
- Audio indicator: Subtle blue-grey (#64748B) — quiet presence
- Balance text: Inherit from theme (no special color)
- Low balance warning: Amber (#F59E0B) — not red (too alarming)

**Language:**
- Never: "Buy credits!" "Unlock premium!" "Upgrade now!"
- Always: "Add funds" "Continue listening" "Balance low"

### Animations

**Audio generation:**
```
Subtle pulse animation on audio icon
Duration: 2-4s
Easing: ease-in-out
No spinner — just soft breathing motion
```

**Balance update:**
```
Number fades out → new number fades in
Duration: 200ms
No celebratory animations
```

### Icon Language

**Audio availability indicator:**
```
Next to chapter in list:
♪ = Audio ready
⟳ = Generating (rare, only if pre-generated)
[empty] = Not generated yet
```

**Minimal, monochrome, consistent with typography**

## Pricing Structure (Backend)

### Cost Calculation

```typescript
interface AudioCost {
  characterCount: number;
  openaiCost: number;      // $15 per 1M chars
  markup: number;          // 2.22x (122% margin)
  userPrice: number;       // $0.50 per chapter avg
}

// Example: 15k character chapter
characterCount: 15000
openaiCost: $0.225
markup: 2.22x
userPrice: $0.50
profit: $0.275
```

### Balance Packages

```
$5.00 = 10 chapters (~1-1.5 books)
$10.00 = 20 chapters (~2-3 books)
$20.00 = 40 chapters (~5-6 books)
$50.00 = 100 chapters (~12-15 books)

No discounts for larger packages
Keep it simple and transparent
```

### Fallback Economics

**If user has $0 balance:**
- Standard voice (device TTS) is always free
- No paywall, no hard sell
- Just a quiet option: "Add balance for natural voice"

**Philosophy:**
Reading is free. Premium audio is optional enhancement.

## Information Architecture

### Settings Location

```
Settings Drawer
├─ Reading
│  ├─ Font
│  ├─ Theme
│  └─ Layout
├─ Audio ← New section
│  ├─ Voice Quality (Standard/Premium)
│  ├─ Account Balance ($10.00)
│  └─ Add Funds
└─ Privacy
   └─ Data Storage
```

### Chapter List Enhancement

```
Library → Book → Chapters

Chapter 3: The Journey
  ├─ 15 min read
  ├─ ♪ Audio available
  └─ [Read] [Listen]
```

**No pricing shown here** — balance is assumed.

## Notification Strategy

### When to Show Balance

**Show balance:**
- Settings > Audio (always visible)
- After adding funds (confirmation)
- When balance <$2 (library view, gentle reminder)

**Never show balance:**
- During reading (breaks immersion)
- On chapter list (feels transactional)
- In recap modals (wrong context)

### Language Examples

**Good:**
- "Audio balance: $8.50"
- "Add funds for hands-free listening"
- "Continue with standard voice (free)"

**Bad:**
- "Buy more credits!"
- "Unlock premium audio!"
- "You're running out of audio!"
- "Upgrade to listen!"

## Mobile Considerations (Capacitor)

### Pre-fetching Strategy

**User-initiated only:**
```
Chapter list → Long press chapter
┌─────────────────────────────────┐
│ Chapter 5: The Journey          │
│                                 │
│ [Read Now]                      │
│ [Prepare Audio]                 │
│                                 │
│ Uses ~$0.50 from balance        │
└─────────────────────────────────┘
```

**Background:**
- Audio only generates when app is active (foreground)
- Native audio player handles background playback
- No surprise generation while backgrounded

### Lock Screen (Native Media Controls)

```
Lock Screen Display:
─────────────────────────────────
The Way of Kings
Brandon Sanderson

Chapter 5: The Journey
─────────────────────────────────
[⏮] [⏸] [⏭]

Minimal metadata
Matches book typography aesthetic
No branding, no clutter
```

## First-Time User Flow

### Onboarding (One Screen)

```
After uploading first book:

┌─────────────────────────────────┐
│ Listen hands-free               │
│                                 │
│ Switch between reading and      │
│ listening seamlessly            │
│                                 │
│ • Standard voice (free)         │
│ • Premium voice (paid)          │
│                                 │
│ [Try Premium - Add $5]          │
│ [Use Standard Only]             │
└─────────────────────────────────┘
```

**Key points:**
- Introduced after first book (context is clear)
- Free option always available
- Simple choice, no pressure
- Can skip entirely

## Success Metrics

### User Experience
- Audio transition takes <3 seconds
- Zero pricing interruptions during reading
- Balance reminder feels helpful, not annoying
- 80%+ of audio users have positive balance

### Business
- Average balance: $10-20 (indicates trust)
- 40%+ of users try audio within first week
- 60%+ of audio users add balance 2+ times
- <5% churn due to pricing confusion

## Technical Implementation Notes

### Database Schema

```typescript
interface UserAudioBalance {
  userId: string;
  balance: number;          // In dollars
  totalSpent: number;
  totalGenerated: number;   // Chapters
  createdAt: Date;
  updatedAt: Date;
}

interface AudioTransaction {
  id: string;
  userId: string;
  type: 'add_funds' | 'generate_chapter';
  amount: number;           // Positive for add, negative for spend
  chapterId?: string;
  timestamp: Date;
}
```

### Cost Tracking

```typescript
async function generateChapterAudio(
  chapterId: string,
  voiceQuality: 'standard' | 'premium'
): Promise<AudioResult> {

  if (voiceQuality === 'standard') {
    // Device TTS - free
    return generateDeviceTTS(chapterId);
  }

  // Check balance
  const balance = await getUserBalance();
  const estimatedCost = await estimateChapterCost(chapterId);

  if (balance < estimatedCost) {
    throw new InsufficientBalanceError({
      balance,
      required: estimatedCost
    });
  }

  // Generate with OpenAI
  const result = await generateOpenAITTS(chapterId);

  // Deduct actual cost (not estimate)
  await deductBalance(result.actualCost);

  return result;
}
```

## Alternative: Subscription Model

**If pre-paid balance feels too complex:**

```
Settings > Audio
┌─────────────────────────────────┐
│ Audio                           │
│                                 │
│ ○ Standard (Device voice) Free  │
│ ○ Premium  $9.99/month          │
│                                 │
│ Premium includes:               │
│ • Natural voice narration       │
│ • Up to 30 chapters/month       │
│ • Seamless background playback  │
│                                 │
│ [Try Premium - 7 Days Free]     │
└─────────────────────────────────┘
```

**Simpler, but:**
- Monthly commitment feels heavier
- Still need usage caps (30 chapters/month)
- Recurring charges can surprise users

**Recommendation: Start with balance model**
- More flexible
- Pay as you go
- No commitment
- Aligns better with "graceful silence" philosophy

## Summary

**Audio in the serene reader:**
- Pre-loaded balance (handled in settings)
- Zero pricing friction during reading
- Always a free fallback (device TTS)
- Quiet notifications when balance low
- Matches minimal, refined aesthetic
- Never feels like upsell or interruption

**The feeling:**
> "I can listen when I need to" — not "I need to buy credits"

This maintains the calm, focused, curious experience while building a sustainable business.
