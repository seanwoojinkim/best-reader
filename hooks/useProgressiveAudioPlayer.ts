import { useRef, useState, useCallback, useEffect } from 'react';
import type { Chapter, AudioChunk } from '@/types';
import { getAudioChunks, getAudioFile, getAudioChunksInRange } from '@/lib/db';

// Memory management constants
const CHUNK_MEMORY_WINDOW = 5; // Keep max 5 chunks in memory
const CHUNK_PRELOAD_AHEAD = 2; // Preload 2 chunks ahead of playback

interface UseProgressiveAudioPlayerProps {
  chapter: Chapter | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onChunkLoad?: (chunkIndex: number, totalChunks: number) => void;
}

interface UseProgressiveAudioPlayerResult {
  playing: boolean;
  currentTime: number;
  duration: number;
  loading: boolean;
  error: string | null;
  chunksLoaded: number;
  totalChunks: number;
  isGenerating: boolean;
  playbackSpeed: number;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  loadChapter: (chapter: Chapter) => Promise<void>;
}

interface ScheduledChunk {
  chunkIndex: number;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode;
  startTime: number; // Absolute time in AudioContext timeline
  duration: number;
  started: boolean; // Track if source.start() has been called
}

export function useProgressiveAudioPlayer({
  chapter,
  onTimeUpdate,
  onEnded,
  onChunkLoad,
}: UseProgressiveAudioPlayerProps): UseProgressiveAudioPlayerResult {
  // Audio context (persistent across chunks)
  const audioContextRef = useRef<AudioContext | null>(null);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Chunk tracking
  const [chunksLoaded, setChunksLoaded] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Scheduled chunks for playback
  const scheduledChunksRef = useRef<ScheduledChunk[]>([]);
  const nextStartTimeRef = useRef(0); // Tracks next chunk's start time in seconds
  const playbackStartTimeRef = useRef(0); // AudioContext time when playback began
  const currentTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memory management
  const [currentPlayingChunk, setCurrentPlayingChunk] = useState(0);
  const chunkBufferMapRef = useRef<Map<number, AudioBuffer>>(new Map());
  const audioFileIdRef = useRef<number | null>(null);

  // Dynamic chunk loading during generation
  const chunkPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scheduling lock to prevent race conditions (Issue #2)
  const schedulingInProgressRef = useRef(false);

  // Initialize AudioContext once
  useEffect(() => {
    console.log('[useProgressiveAudioPlayer] Initializing AudioContext');
    audioContextRef.current = new AudioContext();

    return () => {
      console.log('[useProgressiveAudioPlayer] Cleaning up AudioContext');
      if (currentTimeIntervalRef.current) {
        clearInterval(currentTimeIntervalRef.current);
      }
      if (chunkPollingIntervalRef.current) {
        clearInterval(chunkPollingIntervalRef.current);
      }
      scheduledChunksRef.current.forEach(s => {
        try {
          s.source.stop();
        } catch (e) {
          // Already stopped
        }
      });
      audioContextRef.current?.close();
    };
  }, []);

  /**
   * Load chunk into memory (with sliding window eviction)
   */
  const loadChunkIntoMemory = useCallback(async (
    chunk: AudioChunk
  ): Promise<AudioBuffer> => {
    // Check if already in memory
    if (chunkBufferMapRef.current.has(chunk.chunkIndex)) {
      return chunkBufferMapRef.current.get(chunk.chunkIndex)!;
    }

    // Evict old chunks if window full
    if (chunkBufferMapRef.current.size >= CHUNK_MEMORY_WINDOW) {
      // Remove chunks far behind current playback position
      const chunksToEvict: number[] = [];
      chunkBufferMapRef.current.forEach((_, index) => {
        if (index < currentPlayingChunk - 1) {
          chunksToEvict.push(index);
        }
      });

      chunksToEvict.forEach(index => {
        console.log(`[useProgressiveAudioPlayer] Evicting chunk ${index} from memory`);
        chunkBufferMapRef.current.delete(index);
      });
    }

    // Decode and store
    const arrayBuffer = await chunk.blob.arrayBuffer();
    const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
    chunkBufferMapRef.current.set(chunk.chunkIndex, audioBuffer);

    return audioBuffer;
  }, [currentPlayingChunk]);

  /**
   * Preload upcoming chunks in background
   */
  const preloadUpcomingChunks = useCallback(async () => {
    if (!audioFileIdRef.current) return;

    const startIndex = currentPlayingChunk + 1;
    const endIndex = currentPlayingChunk + CHUNK_PRELOAD_AHEAD;

    try {
      const chunks = await getAudioChunksInRange(audioFileIdRef.current, startIndex, endIndex);

      for (const chunk of chunks) {
        if (!chunkBufferMapRef.current.has(chunk.chunkIndex)) {
          await loadChunkIntoMemory(chunk);
        }
      }
    } catch (err) {
      console.error('[useProgressiveAudioPlayer] Failed to preload chunks:', err);
    }
  }, [currentPlayingChunk, loadChunkIntoMemory]);

  /**
   * Schedule a single chunk for gapless playback
   * FIX Issue #2: Add scheduling lock to prevent concurrent scheduling
   */
  const scheduleChunk = useCallback(async (chunk: AudioChunk) => {
    if (!audioContextRef.current) return;

    // Prevent concurrent scheduling (Issue #2)
    if (schedulingInProgressRef.current) {
      console.warn(`[useProgressiveAudioPlayer] Scheduling in progress, skipping chunk ${chunk.chunkIndex}`);
      return;
    }

    schedulingInProgressRef.current = true;

    try {
      // Check if chunk already scheduled
      if (scheduledChunksRef.current.some(s => s.chunkIndex === chunk.chunkIndex)) {
        console.log(`[useProgressiveAudioPlayer] Chunk ${chunk.chunkIndex} already scheduled, skipping`);
        return;
      }

      console.log(`[useProgressiveAudioPlayer] Scheduling chunk ${chunk.chunkIndex}`);

      // Load chunk with memory management
      const audioBuffer = await loadChunkIntoMemory(chunk);

      // Create source node
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      // FIX Issue #1: Calculate start time correctly for gapless playback
      // startTime is relative time offset, not AudioContext time
      const startTime = nextStartTimeRef.current;
      nextStartTimeRef.current += audioBuffer.duration;

      // Track scheduled chunk
      const scheduledChunk: ScheduledChunk = {
        chunkIndex: chunk.chunkIndex,
        buffer: audioBuffer,
        source,
        startTime,
        duration: audioBuffer.duration,
        started: false, // FIX Issue #5: Track if source has been started
      };
      scheduledChunksRef.current.push(scheduledChunk);

      // Update total duration
      setDuration(nextStartTimeRef.current);

      // FIX Issue #3: Handle chunk end with proper cleanup
      source.onended = () => {
        console.log(`[useProgressiveAudioPlayer] Chunk ${chunk.chunkIndex} ended`);

        // Remove this source from the scheduled list (Issue #3 - memory leak fix)
        const index = scheduledChunksRef.current.findIndex(s => s.chunkIndex === chunk.chunkIndex);
        if (index !== -1) {
          scheduledChunksRef.current.splice(index, 1);
        }

        // Update current playing chunk for memory management
        setCurrentPlayingChunk(chunk.chunkIndex + 1);

        // FIX Issue #4: Check if this was the last chunk (compare against totalChunks, not array length)
        const isLastChunk = chunk.chunkIndex === totalChunks - 1;
        if (isLastChunk && !isGenerating) {
          console.log('[useProgressiveAudioPlayer] Playback complete');
          setPlaying(false);
          if (currentTimeIntervalRef.current) {
            clearInterval(currentTimeIntervalRef.current);
            currentTimeIntervalRef.current = null;
          }
          onEnded?.();
        }
      };

      // FIX Issue #6: If playback is already active, start this chunk immediately
      if (playing && audioContextRef.current) {
        const now = audioContextRef.current.currentTime;
        const absoluteStartTime = playbackStartTimeRef.current + startTime;

        if (absoluteStartTime <= now) {
          // Chunk should have already started - skip to current position
          const offset = now - absoluteStartTime;
          console.log(`[useProgressiveAudioPlayer] Starting late chunk ${chunk.chunkIndex} with offset ${offset}s`);
          source.start(now, offset);
        } else {
          // Future chunk - start at designated time
          console.log(`[useProgressiveAudioPlayer] Starting chunk ${chunk.chunkIndex} at ${absoluteStartTime}s`);
          source.start(absoluteStartTime);
        }
        scheduledChunk.started = true;
      }

      console.log(`[useProgressiveAudioPlayer] Chunk ${chunk.chunkIndex} scheduled at ${startTime}s (duration: ${audioBuffer.duration}s)`);
      onChunkLoad?.(chunk.chunkIndex + 1, totalChunks);
    } catch (err) {
      console.error(`[useProgressiveAudioPlayer] Failed to schedule chunk ${chunk.chunkIndex}:`, err);
      // Don't throw - continue with other chunks
    } finally {
      schedulingInProgressRef.current = false;
    }
  }, [loadChunkIntoMemory, totalChunks, isGenerating, playing, onChunkLoad, onEnded]);

  /**
   * Poll for new chunks during generation and schedule them automatically
   */
  const pollForNewChunks = useCallback(async () => {
    if (!audioFileIdRef.current) return;

    try {
      // Check if generation is complete
      const audioFile = await getAudioFile(chapter?.id!);
      if (!audioFile) return;

      // Update generation status
      if (audioFile.isComplete && isGenerating) {
        console.log('[useProgressiveAudioPlayer] Generation complete, stopping polling');
        setIsGenerating(false);
        if (chunkPollingIntervalRef.current) {
          clearInterval(chunkPollingIntervalRef.current);
          chunkPollingIntervalRef.current = null;
        }
      }

      // Get all chunks and check for new ones
      const allChunks = await getAudioChunks(audioFileIdRef.current);
      const newChunkCount = allChunks.length;

      if (newChunkCount > chunksLoaded) {
        console.log(`[useProgressiveAudioPlayer] Found ${newChunkCount - chunksLoaded} new chunks`);

        // Schedule only the new chunks (race condition protected by scheduling lock)
        const newChunks = allChunks.slice(chunksLoaded);
        for (const chunk of newChunks) {
          await scheduleChunk(chunk);
        }

        setChunksLoaded(newChunkCount);
      }
    } catch (err) {
      console.error('[useProgressiveAudioPlayer] Failed to poll for new chunks:', err);
    }
  }, [chapter?.id, chunksLoaded, isGenerating, scheduleChunk]);

  /**
   * Load chapter and schedule all available chunks
   */
  const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
    if (!chapterToLoad.id || !audioContextRef.current) {
      console.log('[useProgressiveAudioPlayer] Invalid chapter or audio context');
      return;
    }

    console.log('[useProgressiveAudioPlayer] Loading chapter:', chapterToLoad.title);
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCurrentPlayingChunk(0);

    // Stop any currently playing chunks
    scheduledChunksRef.current.forEach(s => {
      try {
        s.source.stop();
      } catch (e) {
        // Already stopped
      }
    });
    scheduledChunksRef.current = [];
    nextStartTimeRef.current = 0;
    chunkBufferMapRef.current.clear();

    try {
      // Get audio file metadata
      const audioFile = await getAudioFile(chapterToLoad.id);

      if (!audioFile) {
        throw new Error('Audio not generated for this chapter');
      }

      // Check if progressive or single-blob
      if (!audioFile.isProgressive) {
        throw new Error('This chapter uses single-blob storage. Use standard audio player.');
      }

      audioFileIdRef.current = audioFile.id!;
      setTotalChunks(audioFile.totalChunks || 0);
      setIsGenerating(!audioFile.isComplete);

      // Get all available chunks
      const chunks = await getAudioChunks(audioFile.id!);
      console.log(`[useProgressiveAudioPlayer] Found ${chunks.length} chunks`);

      if (chunks.length === 0) {
        throw new Error('No audio chunks found');
      }

      setChunksLoaded(chunks.length);

      // Schedule all available chunks
      for (const chunk of chunks) {
        await scheduleChunk(chunk);
      }

      setLoading(false);
    } catch (err) {
      console.error('[useProgressiveAudioPlayer] Error loading chapter:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setLoading(false);
    }
  }, [scheduleChunk]);

  /**
   * Start playback of all scheduled chunks
   * FIX Issue #5: Support pause/resume by tracking source start state
   */
  const play = useCallback(async () => {
    if (!audioContextRef.current) {
      setError('Audio context not initialized');
      return;
    }

    if (scheduledChunksRef.current.length === 0) {
      setError('No audio chunks loaded');
      return;
    }

    console.log('[useProgressiveAudioPlayer] Starting playback');

    // Resume AudioContext if suspended (browser autoplay policy OR after pause)
    if (audioContextRef.current.state === 'suspended') {
      console.log('[useProgressiveAudioPlayer] Resuming suspended AudioContext');
      await audioContextRef.current.resume();
      setPlaying(true);

      // Restart time tracking if we're resuming from pause
      if (!currentTimeIntervalRef.current) {
        startCurrentTimeTracking();
      }
      return;
    }

    // First-time play: start all unstarted sources at their designated times
    const now = audioContextRef.current.currentTime;
    playbackStartTimeRef.current = now;

    // FIX Issue #1: Start sources at absolute AudioContext times
    scheduledChunksRef.current.forEach(scheduled => {
      if (!scheduled.started) {
        try {
          // Calculate absolute start time in AudioContext timeline
          const absoluteStartTime = playbackStartTimeRef.current + scheduled.startTime;
          console.log(`[useProgressiveAudioPlayer] Starting chunk ${scheduled.chunkIndex} at ${absoluteStartTime}s (relative: ${scheduled.startTime}s)`);
          scheduled.source.start(absoluteStartTime);
          scheduled.started = true;
        } catch (err) {
          console.warn(`[useProgressiveAudioPlayer] Could not start chunk ${scheduled.chunkIndex}:`, err);
        }
      }
    });

    setPlaying(true);
    setError(null);

    // Start tracking current time
    startCurrentTimeTracking();
  }, []);

  /**
   * Start current time tracking interval
   */
  const startCurrentTimeTracking = useCallback(() => {
    if (currentTimeIntervalRef.current) {
      clearInterval(currentTimeIntervalRef.current);
    }

    currentTimeIntervalRef.current = setInterval(() => {
      if (!audioContextRef.current || !playing) return;

      const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
      setCurrentTime(elapsed);
      onTimeUpdate?.(elapsed, duration);
    }, 100);
  }, [playing, duration, onTimeUpdate]);

  /**
   * Pause playback
   * FIX Issue #5: Use AudioContext.suspend() for proper pause/resume
   */
  const pause = useCallback(() => {
    if (!audioContextRef.current) return;

    console.log('[useProgressiveAudioPlayer] Pausing playback');
    audioContextRef.current.suspend();
    setPlaying(false);

    if (currentTimeIntervalRef.current) {
      clearInterval(currentTimeIntervalRef.current);
      currentTimeIntervalRef.current = null;
    }
  }, []);

  /**
   * Seek to a specific time
   * Note: Seeking requires re-creating source nodes (not implemented in MVP)
   */
  const seek = useCallback((time: number) => {
    console.warn('[useProgressiveAudioPlayer] Seeking not yet implemented for progressive playback');

    if (isGenerating) {
      setError('Cannot seek while audio is generating. Please wait for completion.');
    } else {
      setError('Seeking is not yet supported for progressive playback. This feature is coming soon.');
    }
  }, [isGenerating]);

  /**
   * Change playback speed
   * FIX Issue #8: Warn that speed changes during playback may cause timing issues
   * TODO: Implement proper speed change with re-scheduling for Phase 4
   */
  const setSpeed = useCallback((speed: number) => {
    const validSpeed = Math.max(0.25, Math.min(4.0, speed));

    if (playing) {
      console.warn('[useProgressiveAudioPlayer] Speed changes during playback may cause gaps. Consider pausing first.');
      // For now, warn but allow it - Phase 4 can improve this
    }

    console.log(`[useProgressiveAudioPlayer] Setting playback speed to ${validSpeed}x`);

    setPlaybackSpeed(validSpeed);

    scheduledChunksRef.current.forEach(scheduled => {
      scheduled.source.playbackRate.value = validSpeed;
    });
  }, [playing]);

  // Auto-load chapter when it changes
  useEffect(() => {
    if (chapter) {
      loadChapter(chapter);
    }
  }, [chapter, loadChapter]);

  // Preload upcoming chunks when current chunk changes
  useEffect(() => {
    if (currentPlayingChunk > 0 && isGenerating) {
      preloadUpcomingChunks();
    }
  }, [currentPlayingChunk, isGenerating, preloadUpcomingChunks]);

  // Poll for new chunks during generation
  useEffect(() => {
    if (isGenerating && audioFileIdRef.current) {
      console.log('[useProgressiveAudioPlayer] Starting chunk polling (every 2s)');

      // Poll immediately
      pollForNewChunks();

      // Then poll every 2 seconds
      chunkPollingIntervalRef.current = setInterval(() => {
        pollForNewChunks();
      }, 2000);

      return () => {
        if (chunkPollingIntervalRef.current) {
          console.log('[useProgressiveAudioPlayer] Stopping chunk polling');
          clearInterval(chunkPollingIntervalRef.current);
          chunkPollingIntervalRef.current = null;
        }
      };
    }
  }, [isGenerating, pollForNewChunks]);

  return {
    playing,
    currentTime,
    duration,
    loading,
    error,
    chunksLoaded,
    totalChunks,
    isGenerating,
    playbackSpeed,
    play,
    pause,
    seek,
    setSpeed,
    loadChapter,
  };
}
