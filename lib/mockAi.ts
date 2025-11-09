/**
 * Mock AI Response Generator
 *
 * Provides canned AI responses for:
 * - Session recap (summary of what was read)
 * - Text explanation (simplification of selected passage)
 * - Chapter summary (key points and themes)
 *
 * These are placeholder responses to demonstrate UX without real AI API calls.
 * In production, these would be replaced with GPT-4 or Claude API calls.
 */

export interface SessionData {
  pagesRead: number;
  timeReadMinutes: number;
  bookGenre?: 'fiction' | 'nonfiction' | 'technical';
}

export interface ChapterData {
  title: string;
  number?: number;
  wordCount?: number;
}

/**
 * Generate a mock session recap
 * Shows what the reader covered in their last session
 */
export function generateRecap(sessionData: SessionData): string {
  const { pagesRead, timeReadMinutes, bookGenre = 'fiction' } = sessionData;

  // Base summary
  const sessionSummary = `You read ${pagesRead} page${pagesRead === 1 ? '' : 's'} in ${timeReadMinutes} minute${timeReadMinutes === 1 ? '' : 's'}.`;

  // Genre-specific content recaps
  const contentRecaps = {
    fiction: [
      "In this section, the protagonist faced a critical decision that would change the course of their journey. The tension built as relationships were tested and motivations revealed.",
      "The narrative explored themes of identity and belonging. Characters wrestled with internal conflicts while external pressures mounted, leading to an unexpected turning point.",
      "This passage delved into the backstory, revealing crucial information about past events. The author skillfully wove exposition with present action, deepening our understanding of the central conflict.",
    ],
    nonfiction: [
      "This section presented the main argument with supporting evidence from recent research. Key concepts were introduced and explained through real-world examples and case studies.",
      "The author explored different perspectives on the topic, analyzing the strengths and weaknesses of each approach. Practical implications were discussed with actionable insights.",
      "This passage provided historical context and traced the evolution of these ideas. Important frameworks were introduced that will be built upon in later chapters.",
    ],
    technical: [
      "This section covered fundamental concepts and their practical applications. Code examples demonstrated key principles, with explanations of best practices and common pitfalls.",
      "The material explored advanced techniques and optimization strategies. Real-world scenarios illustrated when and how to apply these approaches effectively.",
      "This passage introduced important patterns and architectural decisions. Trade-offs were discussed with guidance on choosing the right approach for different situations.",
    ],
  };

  // Pick a random content recap for the genre
  const recapOptions = contentRecaps[bookGenre];
  const contentRecap = recapOptions[Math.floor(Math.random() * recapOptions.length)];

  // Key points (vary by genre)
  const keyPoints = {
    fiction: [
      "**Character Development**: A major character revealed hidden depths",
      "**Plot Progression**: Events set in motion that will impact the story's climax",
      "**Theme**: Exploration of trust, loyalty, or moral complexity",
    ],
    nonfiction: [
      "**Main Argument**: The core thesis was clearly established",
      "**Evidence**: Supporting data and examples strengthened the case",
      "**Implications**: Practical applications were discussed",
    ],
    technical: [
      "**Core Concept**: Fundamental principles were explained",
      "**Implementation**: Practical examples demonstrated usage",
      "**Best Practices**: Guidelines for real-world application",
    ],
  };

  const points = keyPoints[bookGenre].join('\n');

  return `**Session Summary**\n${sessionSummary}\n\n**What You Read**\n${contentRecap}\n\n**Key Points**\n${points}`;
}

/**
 * Generate a mock explanation for selected text
 * Provides simplified interpretation of complex passages
 */
export function generateExplanation(selectedText: string): string {
  const textLength = selectedText.length;

  // For very short selections (single word or phrase)
  if (textLength < 30) {
    const simplifications = [
      `"${selectedText}" refers to a concept that's commonly used to describe a specific situation or idea. In simpler terms, it means something that plays an important role in the broader context.`,
      `This term "${selectedText}" is significant because it represents a key idea in the passage. Think of it as a way to describe a particular phenomenon or perspective.`,
      `"${selectedText}" is used here to convey a specific meaning. The author chose this word deliberately to emphasize a particular aspect of the discussion.`,
    ];
    return simplifications[Math.floor(Math.random() * simplifications.length)];
  }

  // For medium selections (sentence or two)
  if (textLength < 150) {
    return `This passage is discussing an important idea. In simpler terms, the author is saying that there's a relationship between different factors that affects the outcome. The key concept here is understanding how these elements interact with each other.

**In Other Words**: Think of it like this - when certain conditions are present, they create a situation that leads to a particular result. The author is highlighting why this matters and what it means for the broader topic.`;
  }

  // For longer selections (paragraph)
  return `This passage presents a complex argument with several layers. Let me break it down:

**Main Idea**: The author is exploring how different factors come together to create a specific outcome or situation.

**Key Points**:
- First, there's an introduction of the core concept
- Then, supporting details that show why this matters
- Finally, implications or conclusions drawn from this understanding

**Simplified Explanation**: Imagine you're trying to understand a process that has multiple steps. Each step builds on the previous one, and the author is walking you through how they connect. The complexity comes from the interplay between these different elements, but the underlying logic is about cause and effect, or about relationships between ideas.

**Why It Matters**: This passage is important because it establishes a foundation for understanding what comes next. The concepts introduced here will likely be referenced or built upon later.`;
}

/**
 * Generate a mock chapter summary
 * Provides overview of chapter content with key themes
 */
export function generateChapterSummary(chapterData: ChapterData): string {
  const { title, number, wordCount } = chapterData;

  const chapterRef = number ? `Chapter ${number}` : title;
  const lengthNote = wordCount ? ` (approximately ${Math.round(wordCount / 250)} pages)` : '';

  const summaries = [
    {
      overview: `This chapter covers the central themes and develops important ideas introduced earlier. The author begins by establishing context, then moves through several key arguments with supporting evidence and examples.`,
      themes: [
        '**Theme 1**: The relationship between individual agency and systemic forces',
        '**Theme 2**: How perspective shapes interpretation of events',
        '**Theme 3**: The role of context in understanding meaning',
      ],
      conclusion: 'The chapter concludes by connecting these ideas to the broader arc, setting up important concepts that will be explored in depth later.',
    },
    {
      overview: `This chapter introduces critical concepts that serve as building blocks for the rest of the work. Through careful exposition and well-chosen examples, the author guides readers toward a deeper understanding.`,
      themes: [
        '**Core Concept**: The fundamental principle at the heart of this discussion',
        '**Applications**: Real-world scenarios that illustrate the concept in action',
        '**Implications**: What this means for related ideas and future topics',
      ],
      conclusion: 'The chapter ends with a transition that bridges to the next section, maintaining narrative momentum while ensuring comprehension.',
    },
    {
      overview: `This chapter delves into nuanced territory, exploring complexity and contradiction. The author doesn't shy away from difficult questions, instead using them to deepen the analysis and challenge assumptions.`,
      themes: [
        '**Tension**: The competing forces or ideas that create dramatic interest',
        '**Resolution**: How the author navigates or addresses this complexity',
        '**Growth**: What characters learn or how ideas evolve through this process',
      ],
      conclusion: 'The chapter leaves readers with new questions to ponder, expanding the scope of the work and inviting deeper engagement.',
    },
  ];

  const summary = summaries[Math.floor(Math.random() * summaries.length)];

  return `**${chapterRef}**${lengthNote}

${summary.overview}

**Key Themes**
${summary.themes.join('\n')}

${summary.conclusion}`;
}

/**
 * Generate a mock "difficulty detected" message
 * Triggered when reader slows down significantly
 */
export function generateDifficultySupport(context: 'slowdown' | 'reread'): string {
  if (context === 'slowdown') {
    return `**Having Trouble with This Section?**

This passage contains complex ideas that many readers find challenging. Here are some strategies that might help:

- **Slow Down**: It's okay to read at whatever pace feels right
- **Reread**: Going over it again often reveals new meaning
- **Context**: Sometimes skipping ahead and coming back helps
- **Notes**: Jotting down your thoughts can clarify understanding

Would you like a simplified explanation of this section?`;
  }

  return `**I Notice You're Rereading This Section**

That's a great strategy for deep comprehension. Rereading can help you:

- Catch details you missed the first time
- Connect ideas that seemed separate initially
- Build a more complete mental model
- Appreciate the author's craft and precision

Keep going - you're engaging thoughtfully with the material!`;
}
