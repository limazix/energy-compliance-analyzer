/**
 * @fileOverview Manages the overall analysis state, coordinates with other hooks for fetching, listening, and actions.
 * Feature: Analysis Management (Orchestration)
 * Component: useAnalysisManager Hook
 */

'use client';
import { useState, useMemo } from 'react';

import type { Analysis } from '@/types/analysis';
import type { User } from 'firebase/auth';

import { useToast } from '@/hooks/use-toast';
import { usePastAnalyses } from './usePastAnalyses';
import { useAnalysisListener } from './useAnalysisListener';
import { useAnalysisActions } from './useAnalysisActions';
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';

/**
 * Manages the current active analysis, handles analysis-related actions (start, cancel, delete, retry, tag management, download),
 * and coordinates with the `usePastAnalyses` hook for fetching and listing past analyses.
 * It also sets up a real-time Firestore listener for the `currentAnalysis`.
 *
 * @param user - The authenticated Firebase user object, or null if not authenticated.
 * @returns An object containing state variables, setters, and handler functions for managing analyses.
 */
export function useAnalysisManager(user: User | null) {
  const { toast } = useToast();

  /** The currently selected or active analysis, or null if none is selected. */
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);

  /** The input value for adding tags. */
  const [tagInput, setTagInput] = useState('');

  // Utilize the usePastAnalyses hook for fetching and managing the list of past analyses
  const {
    analyses, // This is the list of past analyses from usePastAnalyses
    isLoadingPastAnalyses,
    isLoadingMoreAnalyses,
    hasMoreAnalyses,
    fetchPastAnalyses, // This is the paginated fetch function from usePastAnalyses
  } = usePastAnalyses(user?.uid);

  // Utilize the useAnalysisListener hook for real-time updates to the current analysis
  // Pass currentAnalysis and setCurrentAnalysis to the listener so it can update the state directly
  useAnalysisListener(user?.uid, currentAnalysis?.id || null, currentAnalysis, setCurrentAnalysis);

  // Utilize the useAnalysisActions hook for all analysis-related action handlers
  // Pass necessary dependencies like user ID, state setter, toast, and fetchPastAnalyses
  const {
    startAiProcessing,
    handleAddTag,
    handleRemoveTag,
    handleDeleteAnalysis,
    handleCancelAnalysis,
    handleRetryAnalysis,
    downloadReportAsTxt,
  } = useAnalysisActions(user?.uid, setCurrentAnalysis, toast, fetchPastAnalyses);

  /**
   * Calculates the displayed analysis steps based on the current analysis status and progress.
   * This is memoized to avoid unnecessary recalculations.
   */
  const displayedAnalysisSteps = useMemo(() => {
    return calculateDisplayedAnalysisSteps(currentAnalysis);
  }, [currentAnalysis]);

  /**
   * The object returned by the useAnalysisManager hook.
   */
  return {
    /** The currently active or selected analysis. */
    currentAnalysis,
    /** Setter function for `currentAnalysis`. */
    setCurrentAnalysis,
    /** Array of past analyses fetched from usePastAnalyses. */
    analyses,
    /** Boolean indicating if past analyses are currently being loaded (initial load). */
    isLoadingPastAnalyses,
    /** Boolean indicating if more past analyses are currently being loaded (pagination). */
    isLoadingMoreAnalyses,
    /** Boolean indicating if there are more past analyses available to load. */
    hasMoreAnalyses,
    /** The current value of the tag input field. */
    tagInput,
    /** Setter function for `tagInput`. */
    setTagInput,
    /** Function to fetch more past analyses (from usePastAnalyses). */
    fetchPastAnalyses,
    /** Initiates AI processing for an analysis. */
    startAiProcessing,
    /** Adds a tag to the current analysis. */
    handleAddTag,
    /** Removes a tag from the current analysis. */
    handleRemoveTag,
    /** Requests deletion of the current analysis. */
    handleDeleteAnalysis,
    /** Requests cancellation of the current analysis. */
    handleCancelAnalysis,
    /** Requests a retry for the current analysis. */
    handleRetryAnalysis,
    /** Downloads the structured report as a text file. */
    downloadReportAsTxt,
    /** Steps to display in the analysis progress view. */
    displayedAnalysisSteps,
  };
}
