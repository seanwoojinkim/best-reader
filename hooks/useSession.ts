import { useState, useEffect, useCallback, useRef } from 'react';
import { startSession, endSession, updateSession } from '@/lib/db';

interface UseSessionProps {
  bookId: number;
  onSessionEnd?: (sessionId: number) => void;
}

export function useSession({ bookId, onSessionEnd }: UseSessionProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [pagesRead, setPagesRead] = useState(0);
  const [wordsRead, setWordsRead] = useState(0);
  const sessionIdRef = useRef<number | null>(null);
  const pagesReadRef = useRef(0);
  const wordsReadRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    pagesReadRef.current = pagesRead;
    wordsReadRef.current = wordsRead;
  }, [pagesRead, wordsRead]);

  // Start session on mount
  useEffect(() => {
    const initSession = async () => {
      const id = await startSession(bookId);
      setSessionId(id);
      sessionIdRef.current = id;
    };

    initSession();

    // End session on unmount (uses refs to get latest values)
    return () => {
      if (sessionIdRef.current !== null) {
        endSession(sessionIdRef.current, pagesReadRef.current, wordsReadRef.current);
        onSessionEnd?.(sessionIdRef.current);
      }
    };
  }, [bookId, onSessionEnd]);

  // Track page turn
  const trackPageTurn = useCallback(async () => {
    setPagesRead((prev) => prev + 1);

    // Estimate words per page (average ~250 words per typical fiction book)
    // NOTE: Known limitation - this is a rough estimate. Actual words per page varies:
    //   - Children's books: ~100 words/page
    //   - Fiction novels: 200-300 words/page
    //   - Academic textbooks: ~400 words/page
    //   - Poetry: ~50 words/page
    // TODO Phase 3: Calculate actual words from rendition.getContents().content.textContent
    const estimatedWords = 250;
    setWordsRead((prev) => prev + estimatedWords);

    // Update session in database periodically
    if (sessionIdRef.current !== null) {
      await updateSession(sessionIdRef.current, {
        pagesRead: pagesRead + 1,
        wordsRead: wordsRead + estimatedWords,
      });
    }
  }, [pagesRead, wordsRead]);

  // Manual session end (for testing or explicit close)
  const endCurrentSession = useCallback(async () => {
    if (sessionIdRef.current !== null) {
      await endSession(sessionIdRef.current, pagesReadRef.current, wordsReadRef.current);
      onSessionEnd?.(sessionIdRef.current);
      sessionIdRef.current = null;
      setSessionId(null);
    }
  }, [onSessionEnd]);

  return {
    sessionId,
    pagesRead,
    wordsRead,
    trackPageTurn,
    endCurrentSession,
  };
}
