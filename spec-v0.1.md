📘 Product Spec: Adaptive Reader (v0.1)

⸻

1. Project Overview

Goal:
Create a serene, intelligent e-reading experience that adapts to how a person reads — supporting immersion, comprehension, and continuity without distraction.

The app should help users maintain reading flow across sessions and reading modes (pleasure, instrumental, aspirational). It should feel calm, curious, and focused — a companion that subtly understands when to help and when to stay silent.

⸻

2. Design Philosophy

Core Emotional Targets
	•	Calm: Interface should immediately reduce tension; typography and layout should invite stillness.
	•	Focused: No clutter or unnecessary affordances; clear hierarchy, no persistent toolbars.
	•	Curious: Gentle invitations to explore meaning or context when appropriate.

Experience Principles
	1.	Form follows feedback. Build lean; beautify after adaptive systems show value.
	2.	Adaptive, not reactive. The system observes patterns and adjusts gently — never nagging.
	3.	Graceful silence. No gamification, streaks, or dopamine mechanics.
	4.	Local trust. Reading data and context live on-device; cloud sync is opt-in.
	5.	Refined restraint. Every visual, animation, and AI response should feel intentional.

⸻

3. Core Use Cases

Mode	Goal	Reader Behavior	AI Role
Pleasure Reading	Immerse fully in story	Full-screen minimal mode; optional recap after time away	Context recap only
Instrumental Reading	Extract useful information quickly	Highlight, skim, summarize	“Summarize key points” on request
Aspirational Reading	Comprehend complex material	Contextual explanations on dense sections	“Explain this” or “Restate simply”

Each mode is implicit, not selected — inferred from behavior.

⸻

4. UX Flow Summary

4.1 Entry
	•	Splash → “Library” (clean grid/list, large covers, minimal chrome)
	•	Tap book → “Resume” screen:
	•	If <15 min: open directly
	•	If 15 min–48h: show optional recap card (“Previously…”)
	•	If >48h: short summary card + continue button

4.2 Reading View
	•	Typography-centered interface (custom fonts, adjustable margins/line height)
	•	Swipe or tap navigation (pagination and scrolling both supported)
	•	Minimal overlay gestures:
	•	Tap center: show top bar (book title, settings, AI access)
	•	Long press: select text → “Highlight / Ask / Summarize”
	•	Two-finger swipe down: “Recap / Context” overlay

4.3 Adaptive Behaviors (v0.1 rules)
	•	Track reading time, page-turn cadence, highlights.
	•	Calculate average reading speed → detect significant slowdowns.
	•	If slowdown persists on same paragraph, mark potential friction zone (no visible action yet — data only).
	•	After inactivity threshold, prompt recap on reopen.

4.4 Recap Modal
	•	Small card overlay when resuming:
	•	“It’s been 2 days since your last session.”
	•	“Previously: Justine debated visiting her mother’s bank.”
	•	“Continue reading” button.

4.5 Highlight & AI Drawer
	•	Bottom sheet drawer opens when selecting text or pressing “AI” button.
	•	Tabs:
	•	Summarize (key points or passage restatement)
	•	Explain (for dense text, optional tone: “scholarly” / “plain”)
	•	Notes (user-written annotations)
	•	Drawer auto-dismisses when user returns to page.

⸻

5. Visual & Interaction Design

Layout
	•	Background: Paper off-white (#FAF9F7) or pure black for night mode.
	•	Typography: High-quality serif (e.g., Literata, Source Serif, or custom variable font).
	•	Font size: 12–18pt adjustable; maintain 66–75 characters per line.
	•	Margins: Generous, symmetrical.
	•	Animations: Sub-300ms micro-motion; fade/slide with low easing.

Tone
	•	No gamified icons, badges, or progress bars.
	•	Emotional tone: quietly confident, literary, warm.

Micro-Delight
	•	Subtle animation when resuming (page fade-in, paragraph glows briefly).
	•	Soft chime or vibration (optional) when “recap available.”
	•	Highlight color adaptive to ambient theme (sepia → amber, night → blue-grey).

⸻

6. Adaptive System (Foundation Spec)

Signal	Derived Metric	Use
Page turns / time	Words per minute	Detect focus level
Session frequency	Reading habit	Trigger recap threshold
Highlight density	Engagement	Inform summaries
Reread detection (page revisit)	Potential difficulty	Mark candidate for explanation
Time of day	Circadian preference	(Future) reading reminders

Storage:
Local (IndexedDB, SQLite via WASM, or similar web storage). Schema example:

Book {
  id, title, author, filePath, coverPath
}

Session {
  id, bookId, startTime, endTime, pagesRead, wordsRead, avgSpeed
}

Highlight {
  id, bookId, location, text, createdAt, tags
}

⸻

7. AI Layer Spec (v0.1)

Gateway: API handler (OpenAI or Anthropic).
Models: GPT-4o or Claude 3.5 Sonnet for summarization/explanation.

Prompt structure examples:

Recap (fiction):

You are a literary narrator. Summarize the last two chapters in 2 sentences, 
matching the author’s tone and style. Do not add new interpretation.

Explain (nonfiction / aspirational):

Explain this passage in plain terms. 
If it’s philosophical, restate the key argument in everyday language.

Summarize (instrumental):

Summarize this section into bullet points of key actionable ideas.

Behavioral rules:
	•	AI never initiates conversation.
	•	Output always <120 words unless user requests more.
	•	Formatting consistent with reading tone.

⸻

8. Data & Privacy
	•	Default: All logs stored locally.
	•	Optional Cloud Sync: encrypted user consent via Supabase or Firebase.
	•	AI Requests: anonymized excerpts only (no personal info).
	•	Settings: “Clear learning” and “Condense memory” options.

⸻

9. MVP Deliverables (Web/Containerized Mobile)

Core Components
	•	EPUB parser (epub.js or similar JS library)
	•	State manager (Redux, Zustand, or Context API)
	•	Local DB (IndexedDB via Dexie.js/PouchDB)
	•	Theming system (light/dark, font selector, CSS variables)
	•	Responsive reading view with pagination + touch gestures
	•	Session logger
	•	Recap modal (time-based)
	•	Highlight + AI drawer (API integration)

Stretch Goals
	•	Adaptive triggers (speed variance detection)
	•	Multi-device sync
	•	On-device summarization cache

Deployment/Distribution
	•	Web-first with responsive design (React or Next.js)
	•	Progressive Web App (PWA) for installability and offline support
	•	Containerize with Capacitor or Tauri for iOS & Android distribution

⸻

10. Roadmap (Prototype → Adaptive System)

Phase	Focus	Deliverable
Phase 1	Core Reader	EPUB display, typography, state persistence (React components)
Phase 2	Recap System	Time-based recap cards (modal components, state)
Phase 3	AI Drawer	Summarize / Explain interactions (API handler, UI)
Phase 4	Adaptive Loop	Detect friction zones, adjust recap behavior
Phase 5	Reflective Layer	Optional insights: reading habits, comprehension logs

⸻

11. Open Design Questions (for exploration)
	1.	How should adaptation feedback be surfaced without breaking immersion?
	2.	Can “recap” and “explanation” responses visually mirror the book’s typographic tone?
	3.	How does the app signal “presence” — a sense of quiet companionship — without overt personality?
	4.	What’s the minimal motion language to make the UI feel alive, not distracting?
	5.	How do we avoid false triggers for rereads (distinguish inattention vs. difficulty)?

⸻

12. Design References
	•	Aesthetic inspiration: Oura, Reeder 5, Apple Books, Arc Browser, Craft Docs.
	•	Tone inspiration: Studio Neat, Craig Mod’s “Kissa by Kissa,” modern literary calm.
	•	Typography: Literata, Charter, Source Serif, Söhne (for UI labels).

⸻

13. Success Criteria
	•	You (or a small internal group) can read 3–5 sessions in the prototype without frustration.
	•	Recap feels “like memory,” not “like notification.”
	•	Visual environment induces focus within 30 seconds of opening.
	•	No user ever feels “watched” — adaptation feels like attunement, not tracking.

⸻

Deliverables for UI/UX Designer
	•	Interactive flow mockups (Library → Reader → Recap → AI Drawer).
	•	Minimalist typography system & motion style guide.
	•	Initial color palette and iconography set.
	•	Adaptive state diagrams for recap logic.
	•	Mock content for 1 fiction + 1 nonfiction example.

⸻

Would you like me to follow this with a React or Next.js implementation plan, specifying recommended libraries, folder structure, architecture patterns (such as Redux or Context for state management, Dexie.js for local DB, PWA/containerization strategy), and integration with AI and sync services?