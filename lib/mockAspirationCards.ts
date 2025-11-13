/**
 * Mock Aspirational Card Content Generator
 *
 * Provides sample card content for demonstrating aspirational reading features.
 * These cards are distinct from AI features (sky blue theme) and use purple/violet theme.
 *
 * Card Types:
 * - Context: Before reading - provides background
 * - Comprehension: After reading - checks understanding
 * - Reflection: After reading - deeper thinking
 * - Connection: After reading - personal relevance
 */

import type { AspirationCardContent } from '@/types';

/**
 * Mock cards for "Meditations" by Marcus Aurelius
 */
export const meditationsCards: AspirationCardContent[] = [
  {
    id: 'meditations-ch1-context',
    type: 'context',
    title: 'Before You Read: Context for Book 1',
    body: `**About This Section**

Marcus Aurelius wrote this as a private journal, never meant for publication. Book 1 is unique - it's a list of people who influenced him and the lessons they taught.

**What to Look For**:
- How gratitude shapes his worldview
- The Stoic values he absorbed from mentors
- His humble approach to leadership

This sets the foundation for everything that follows.`,
    timing: 'before',
  },
  {
    id: 'meditations-ch2-comprehension',
    type: 'comprehension',
    title: 'Check Your Understanding',
    body: `**Think About What You Just Read**

Marcus emphasizes starting each day with intention. Before moving on, consider:

- What "obstacles" does he say we'll encounter?
- How does he suggest we prepare mentally?
- What role does acceptance play in his philosophy?

*Take a moment to reflect on these questions*`,
    timing: 'after',
  },
  {
    id: 'meditations-ch3-reflection',
    type: 'reflection',
    title: 'Reflect Deeper',
    body: `**Personal Reflection**

Marcus writes: "You have power over your mind - not outside events. Realize this, and you will find strength."

**Consider**:
- When have you felt powerless over external circumstances?
- What would change if you focused only on your response?
- How might this principle apply to a current challenge?

*These ideas become powerful through personal application*`,
    timing: 'after',
  },
  {
    id: 'meditations-ch4-connection',
    type: 'connection',
    title: 'Make Connections',
    body: `**Connecting to Your Experience**

The Stoics believed in practicing philosophy daily, not just reading about it.

**Try This**:
- Identify one principle from this section
- Think of a situation where you could apply it today
- Notice how it changes your perspective

**Example**: If Marcus discusses accepting what you cannot change, consider a frustration you're currently experiencing. What parts are within your control?`,
    timing: 'after',
  },
];

/**
 * Mock cards for Kafka's works
 */
export const kafkaCards: AspirationCardContent[] = [
  {
    id: 'kafka-metamorphosis-context',
    type: 'context',
    title: 'Before You Read: Understanding Kafka',
    body: `**Literary Context**

Kafka wrote during a time of rapid change and uncertainty in early 20th century Prague. His work explores themes of alienation, bureaucracy, and the absurd.

**Reading Kafka**:
- Expect ambiguity - there are no clear answers
- Notice the tension between the surreal and the mundane
- Pay attention to how characters react to impossible situations

His work asks more questions than it answers.`,
    timing: 'before',
  },
  {
    id: 'kafka-metamorphosis-comprehension',
    type: 'comprehension',
    title: 'Check Your Understanding',
    body: `**Key Elements to Consider**

As you process this section:

- How do characters react to the transformation?
- What does Gregor's concern about work tell us?
- How does Kafka use absurdity to highlight real human concerns?

*Kafka's work rewards careful attention to these details*`,
    timing: 'after',
  },
  {
    id: 'kafka-metamorphosis-reflection',
    type: 'reflection',
    title: 'Reflect Deeper',
    body: `**What Makes This Powerful?**

Kafka presents an impossible situation - yet it feels uncomfortably real.

**Reflect On**:
- Why does the family's reaction feel so familiar?
- What does this reveal about identity and worth?
- How does Kafka make the absurd feel inevitable?

*The discomfort you might feel is part of the experience*`,
    timing: 'after',
  },
];

/**
 * Generic cards for nonfiction works
 */
export const nonfictionCards: AspirationCardContent[] = [
  {
    id: 'nonfiction-chapter-context',
    type: 'context',
    title: 'Before You Read',
    body: `**Setting Up for Success**

This section introduces key concepts that will be developed throughout the chapter.

**What to Watch For**:
- Main thesis or argument
- Supporting evidence and examples
- How ideas build on each other

Reading with these questions in mind will deepen your comprehension.`,
    timing: 'before',
  },
  {
    id: 'nonfiction-chapter-comprehension',
    type: 'comprehension',
    title: 'Check Your Understanding',
    body: `**Core Concepts Review**

Before continuing, make sure you grasped:

- What is the main argument?
- What evidence supports this claim?
- How does this connect to earlier chapters?

*Understanding these foundations makes later material easier*`,
    timing: 'after',
  },
  {
    id: 'nonfiction-chapter-reflection',
    type: 'reflection',
    title: 'Reflect on the Ideas',
    body: `**Going Deeper**

Strong arguments are worth engaging with:

- What assumptions does the author make?
- Where is the evidence strongest? Weakest?
- How does this challenge or confirm your thinking?

*Critical engagement strengthens understanding*`,
    timing: 'after',
  },
  {
    id: 'nonfiction-chapter-connection',
    type: 'connection',
    title: 'Apply What You Learned',
    body: `**Making It Real**

Ideas become valuable through application:

**Consider**:
- How does this relate to your experience?
- Where could you apply these insights?
- What would you do differently with this knowledge?

*The gap between knowing and doing is where learning happens*`,
    timing: 'after',
  },
];

/**
 * Get all cards for a specific book
 */
export function getCardsForBook(bookTitle: string): AspirationCardContent[] {
  const lowerTitle = bookTitle.toLowerCase();

  if (lowerTitle.includes('meditation')) {
    return meditationsCards;
  }

  if (lowerTitle.includes('kafka') || lowerTitle.includes('metamorphosis')) {
    return kafkaCards;
  }

  return nonfictionCards;
}

/**
 * Get a specific card by ID
 */
export function getCardById(cardId: string): AspirationCardContent | undefined {
  const allCards = [
    ...meditationsCards,
    ...kafkaCards,
    ...nonfictionCards,
  ];

  return allCards.find(card => card.id === cardId);
}

/**
 * Get all cards of a specific type (for demo purposes)
 */
export function getCardsByType(type: AspirationCardContent['type']): AspirationCardContent[] {
  const allCards = [
    ...meditationsCards,
    ...kafkaCards,
    ...nonfictionCards,
  ];

  return allCards.filter(card => card.type === type);
}

/**
 * Get sample cards for demo (one of each type)
 */
export function getSampleCards(): AspirationCardContent[] {
  return [
    meditationsCards[0],  // context
    meditationsCards[1],  // comprehension
    meditationsCards[2],  // reflection
    meditationsCards[3],  // connection
  ];
}
