// src/hooks/usePastAnalyses.ts
'use client';
import { useState, useCallback, useEffect } from 'react';

import { getPastAnalysesAction } from '@/features/analysis-listing/actions/analysisListingActions';
import { useToast } from '@/hooks/use-toast';
import type { Analysis } from '@/types/analysis';

export function usePastAnalyses(userId: string | null) {
  /**
   * Custom hook for fetching and managing a paginated list of past analyses for a given user.
   * Handles initial loading, loading more, and tracking the end of available data.
   *
   * @param userId The ID of the user whose analyses should be fetched. Can be null if the user is not logged in.
   * @returns An object containing the list of analyses, loading states, pagination information,
   *          and a function to fetch more analyses.
   */
  const { toast } = useToast();

  /**
   * The array of fetched analyses. This list grows as more pages are loaded.
   * @type {Analysis[]}
   */
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  /**
   * Indicates if the initial page of analyses is currently being loaded.
   * @type {boolean}
   */
  const [isLoadingPastAnalyses, setIsLoadingPastAnalyses] = useState(false);
  /**
   * Indicates if subsequent pages of analyses are currently being loaded (e.g., via "Load More" button).
   * @type {boolean}
   */
  const [isLoadingMoreAnalyses, setIsLoadingMoreAnalyses] = useState(false);
  /**
   * Indicates if there are potentially more pages of analyses to load.
   * @type {boolean}
   */
  const [hasMoreAnalyses, setHasMoreAnalyses] = useState(true);
  /**
   * The ID of the last document from the previous fetch, used as a starting point for fetching the next page.
   */
  const [lastVisibleDocId, setLastVisibleDocId] = useState<string | undefined>(undefined);

  const fetchPastAnalyses = useCallback(
    async (loadMore: boolean = false) => {
      if (!userId) {
        // eslint-disable-next-line no-console
        console.warn('[usePastAnalyses_fetch] No user ID provided, skipping fetch.');
        if (!loadMore) {
          setAnalyses([]);
          setLastVisibleDocId(undefined);
          setHasMoreAnalyses(true); // Reset for next user
        }
        setIsLoadingPastAnalyses(false);
        setIsLoadingMoreAnalyses(false);
        return;
      }

      if (!hasMoreAnalyses && loadMore) {
        // eslint-disable-next-line no-console
        console.info('[usePastAnalyses_fetch] No more analyses to load.');
        return;
      }

      if (loadMore) {
        setIsLoadingMoreAnalyses(true);
      } else {
        setIsLoadingPastAnalyses(true);
        // Reset state for a fresh initial fetch
        setAnalyses([]);
        setLastVisibleDocId(undefined);
        setHasMoreAnalyses(true);
      }

      const limit = 10; // Define your pagination limit here
      const startAfter = loadMore ? lastVisibleDocId : undefined;

      // eslint-disable-next-line no-console
      console.info(
        `[usePastAnalyses_fetch] Fetching for user: ${userId}, limit: ${limit}, startAfter: ${startAfter || 'none'}, loadMore: ${loadMore}`
      );

      try {
        const result = await getPastAnalysesAction(userId, limit, startAfter);

        if (loadMore) {
          setAnalyses((prev) => [...prev, ...result.analyses]);
        } else {
          setAnalyses(result.analyses);
        }

        setLastVisibleDocId(result.lastDocId);
        // If the number of analyses returned is less than the limit, there are no more pages
        setHasMoreAnalyses(result.analyses.length === limit);

        // eslint-disable-next-line no-console
        console.info(
          `[usePastAnalyses_fetch] Fetched ${result.analyses.length} analyses. New lastDocId: ${result.lastDocId || 'none'}, HasMore: ${result.analyses.length === limit}`
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[usePastAnalyses_fetch] Error fetching analyses:', error);
        toast({
          title: 'Erro ao buscar análises',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
        setHasMoreAnalyses(false); // Assume no more data on error
      } finally {
        if (loadMore) {
          setIsLoadingMoreAnalyses(false);
        } else {
          setIsLoadingPastAnalyses(false);
        }
      }
    },
    [userId, hasMoreAnalyses, lastVisibleDocId, toast]
  ); // Added dependencies

  /**
   * Effect hook to trigger the initial fetch of analyses when the userId changes
   * and is available. Also clears analyses if the user logs out.
   */
  // Note: Added fetchPastAnalyses to the dependency array. While typically
  // useCallback with a stable set of dependencies prevents frequent
  // recreation, including it explicitly here ensures the effect re-runs
  // if the callback identity *were* to change unexpectedly (though unlikely).
  // Effect to fetch initial data when userId changes
  useEffect(() => {
    if (userId) {
      fetchPastAnalyses(); // Initial fetch
    } else {
      // Clear analyses if user logs out
      setAnalyses([]);
      setLastVisibleDocId(undefined);
      setHasMoreAnalyses(true);
    }
  }, [userId, fetchPastAnalyses]); // Added fetchPastAnalyses to deps

  /**
   * The state and functions exposed by the usePastAnalyses hook.
   * @property {Analysis[]} analyses - The list of fetched analyses.
   * @property {boolean} isLoadingPastAnalyses - Indicates if the initial page is loading.
   * @property {boolean} isLoadingMoreAnalyses - Indicates if subsequent pages are loading.
   * @property {boolean} hasMoreAnalyses - Indicates if there are more analyses to load.
   * @property {(loadMore?: boolean) => Promise<void>} fetchPastAnalyses - Function to fetch analyses, optionally loading more.
   * @property {(analyses: Analysis[]) => void} setAnalyses - Function to directly set the analyses state (useful for updates from other sources like onSnapshot).
   */
  return {
    analyses,
    isLoadingPastAnalyses,
    isLoadingMoreAnalyses,
    hasMoreAnalyses,
    fetchPastAnalyses, // Expose fetch function for "Load More"
    setAnalyses, // Also expose setAnalyses if needed by parent for currentAnalysis updates
  };
}
