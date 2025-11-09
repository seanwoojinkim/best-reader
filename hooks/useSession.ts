import { useState, useEffect, useCallback, useRef } from 'react';
import { startSession, endSession, updateSession, trackAnalyticsEvent } from '@/lib/db';
import { isSlowdown, isSpeedUp } from '@/lib/analytics';

interface UseSessionProps {
  bookId: number;
  currentCfi?: string;
  onSessionEnd?: (sessionId: number) => void;
}

export function useSession({ bookId, currentCfi, onSessionEnd }: UseSessionProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [pagesRead, setPagesRead] = useState(0);
  const [wordsRead, setWordsRead] = useState(0);
  const sessionIdRef = useRef<number | null>(null);
  const pagesReadRef = useRef(0);
  const wordsReadRef = useRef(0);

  // Analytics tracking (Phase 3)
  const lastTurnTimeRef = useRef<number | null>(null);
  const recentTurnTimesRef = useRef<number[]>([]);
  const [sessionStartTime] = useState(() => new Date());

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

  // Track page turn with analytics (Phase 3)
  const trackPageTurn = useCallback(async () => {
    const now = Date.now();
    const turnTime = lastTurnTimeRef.current !== null ? now - lastTurnTimeRef.current : null;

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

    // Analytics tracking (Phase 3)
    if (sessionIdRef.current !== null && turnTime !== null) {
      // Track page turn event
      await trackAnalyticsEvent({
        sessionId: sessionIdRef.current,
        bookId,
        event: 'page_turn',
        timeSinceLastTurn: turnTime,
        cfi: currentCfi,
      });

      // Detect slowdowns/speedups
      const recentTimes = recentTurnTimesRef.current;

      if (isSlowdown(turnTime, recentTimes)) {
        await trackAnalyticsEvent({
          sessionId: sessionIdRef.current,
          bookId,
          event: 'slowdown',
          timeSinceLastTurn: turnTime,
          cfi: currentCfi,
          metadata: { avgTurnTime: recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length },
        });
      } else if (isSpeedUp(turnTime, recentTimes)) {
        await trackAnalyticsEvent({
          sessionId: sessionIdRef.current,
          bookId,
          event: 'speed_up',
          timeSinceLastTurn: turnTime,
          cfi: currentCfi,
        });
      }

      // Update rolling window (keep last 10 turn times)
      recentTurnTimesRef.current = [...recentTimes, turnTime].slice(-10);
    }

    lastTurnTimeRef.current = now;

    // Update session in database periodically
    if (sessionIdRef.current !== null) {
      await updateSession(sessionIdRef.current, {
        pagesRead: pagesRead + 1,
        wordsRead: wordsRead + estimatedWords,
      });
    }
  }, [bookId, currentCfi, pagesRead, wordsRead]);

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
    sessionStartTime,
    trackPageTurn,
    endCurrentSession,
  };
}
