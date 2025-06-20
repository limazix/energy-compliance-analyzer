// src/hooks/useAnalysisManager.ts
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { doc, onSnapshot, type FirestoreError, type Timestamp } from 'firebase/firestore';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { getPastAnalysesAction } from '@/features/analysis-listing/actions/analysisListingActions';
import {
  cancelAnalysisAction,
  deleteAnalysisAction,
} from '@/features/analysis-management/actions/analysisManagementActions';
import {
  processAnalysisFile,
  retryAnalysisAction, // Import the new retry action
} from '@/features/analysis-processing/actions/analysisProcessingActions';
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';
import { addTagToAction, removeTagAction } from '@/features/tag-management/actions/tagActions';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { formatStructuredReportToTxt } from '@/lib/reportUtils';
import type { Analysis } from '@/types/analysis';
import { usePastAnalyses } from './usePastAnalyses';

import type { User } from 'firebase/auth';

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

  useEffect(() => {
    let unsub: (() => void) | undefined;
    // This effect sets up a real-time listener for the currently selected analysis.
    // It will only subscribe if a valid user, currentAnalysis with a non-error ID,
    // and basic required fields (fileName, title, createdAt) are present.
    if (user?.uid && currentAnalysis?.id && !currentAnalysis.id.startsWith('error-')) {
      const validUserId = user.uid;
      const analysisIdToListen = currentAnalysis.id;

      // eslint-disable-next-line no-console
      console.debug(
        `[useAnalysisManager_onSnapshot] Subscribing to analysis ID: ${analysisIdToListen} for user UID: ${validUserId}. Current local status: ${currentAnalysis.status}`
      );
      const analysisDocumentRef = doc(db, 'users', validUserId, 'analyses', analysisIdToListen);

      try {
        unsub = onSnapshot(
          analysisDocumentRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              // eslint-disable-next-line no-console
              console.debug(
                `[useAnalysisManager_onSnapshot] Snapshot for ${analysisIdToListen}: Status: ${data.status}, Progress: ${data.progress}, ErrMsg: ${data.errorMessage?.substring(0, 100)}`
              );

              // Define a list of valid analysis statuses to ensure type safety and catch potential data issues
              const validStatuses: Analysis['status'][] = [
                'uploading',
                'summarizing_data',
                'identifying_regulations',
                'assessing_compliance',
                'reviewing_report',
                'completed',
                'error',
                'deleted',
                'cancelling',
                'cancelled',
                'pending_deletion',
              ];
              // Validate the status received from Firestore
              const statusIsValid =
                data.status && validStatuses.includes(data.status as Analysis['status']);

              // Construct the updated analysis object, handling potential missing or invalid data
              const updatedAnalysis: Analysis = {
                id: docSnap.id,
                userId: typeof data.userId === 'string' ? data.userId : validUserId,
                fileName:
                  typeof data.fileName === 'string'
                    ? data.fileName
                    : currentAnalysis.fileName || 'Nome de arquivo desconhecido', // Fallback to current local state
                title: typeof data.title === 'string' ? data.title : currentAnalysis.title, // Fallback
                description:
                  typeof data.description === 'string'
                    ? data.description
                    : currentAnalysis.description, // Fallback
                languageCode:
                  typeof data.languageCode === 'string'
                    ? data.languageCode
                    : currentAnalysis.languageCode, // Fallback
                // Use validated status, default to 'error' if invalid
                status: statusIsValid ? (data.status as Analysis['status']) : 'error',
                progress: typeof data.progress === 'number' ? data.progress : 0,
                uploadProgress:
                  typeof data.uploadProgress === 'number' ? data.uploadProgress : undefined,
                powerQualityDataUrl:
                  typeof data.powerQualityDataUrl === 'string'
                    ? data.powerQualityDataUrl
                    : undefined,
                powerQualityDataSummary:
                  typeof data.powerQualityDataSummary === 'string'
                    ? data.powerQualityDataSummary
                    : undefined,
                isDataChunked:
                  typeof data.isDataChunked === 'boolean' ? data.isDataChunked : undefined,
                identifiedRegulations: Array.isArray(data.identifiedRegulations)
                  ? data.identifiedRegulations.map(String)
                  : undefined,
                // Prioritize `summary` field, fallback to structured report introduction if available
                summary:
                  typeof data.summary === 'string'
                    ? data.summary
                    : (data.structuredReport as AnalyzeComplianceReportOutput)?.introduction
                        ?.overallResultsSummary,
                complianceReport:
                  typeof data.complianceReport === 'string' ? data.complianceReport : undefined,
                // Ensure structuredReport is of the correct type or undefined
                structuredReport: data.structuredReport as
                  | AnalyzeComplianceReportOutput
                  | undefined,
                mdxReportStoragePath:
                  typeof data.mdxReportStoragePath === 'string'
                    ? data.mdxReportStoragePath
                    : undefined,
                // Include errorMessage if status is valid, otherwise use a default error message or existing message
                errorMessage: statusIsValid
                  ? typeof data.errorMessage === 'string'
                    ? data.errorMessage
                    : undefined
                  : data.errorMessage || 'Status inválido recebido do Firestore.',
                // Ensure tags are an array of strings
                tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
                // Convert Timestamp to ISO string, fallback to current local state or new date
                createdAt: (data.createdAt as Timestamp)?.toDate
                  ? (data.createdAt as Timestamp).toDate().toISOString()
                  : currentAnalysis.createdAt || new Date().toISOString(),
                // Convert Timestamp to ISO string if available
                completedAt: (data.completedAt as Timestamp)?.toDate
                  ? (data.completedAt as Timestamp).toDate().toISOString()
                  : undefined,
                deletionRequestedAt: (data.deletionRequestedAt as Timestamp)?.toDate
                  ? (data.deletionRequestedAt as Timestamp).toDate().toISOString()
                  : undefined,
                reportLastModifiedAt: (data.reportLastModifiedAt as Timestamp)?.toDate
                  ? (data.reportLastModifiedAt as Timestamp).toDate().toISOString()
                  : undefined,
              };
              // Update the local currentAnalysis state with the data from Firestore
              setCurrentAnalysis(updatedAnalysis);

              // Update the past analyses list if this analysis is present,
              // filtering out any analyses marked as 'deleted'.
              // Note: The primary source for the list is now usePastAnalyses,
              // but this ensures real-time updates for the specific analysis
              // currently being viewed in the list context.
              setAnalyses((prev) =>
                prev
                  .map((pa) => (pa.id === updatedAnalysis.id ? updatedAnalysis : pa))
                  .filter((a) => a.status !== 'deleted')
              );
            } else {
              // Handle cases where the document might not exist (e.g., deleted or not yet created)
              // eslint-disable-next-line no-console
              console.warn(
                `[useAnalysisManager_onSnapshot] Document ${analysisIdToListen} not found for user ${user.uid}. Current local status: ${currentAnalysis?.status}.`
              );
              // If the document disappears unexpectedly and the local status isn't already terminal,
              // update the local state to an error status.
              if (
                analysisIdToListen &&
                !analysisIdToListen.startsWith('error-') &&
                currentAnalysis?.status !== 'deleted' &&
                currentAnalysis?.status !== 'error' &&
                currentAnalysis?.status !== 'cancelled' &&
                currentAnalysis?.status !== 'pending_deletion'
              ) {
                setCurrentAnalysis((prev) => {
                  if (
                    prev &&
                    prev.id === analysisIdToListen &&
                    prev.status !== 'error' &&
                    prev.status !== 'deleted' &&
                    prev.status !== 'cancelled' &&
                    prev.status !== 'pending_deletion'
                  ) {
                    return {
                      ...prev,
                      status: 'error',
                      errorMessage: `Documento da análise (ID: ${analysisIdToListen}) não foi encontrado ou foi removido inesperadamente.`,
                    };
                  }
                  return prev; // Return previous state if no change is needed
                });
              }
            }
          },
          (error: FirestoreError) => {
            // Handle Firestore listener errors
            // eslint-disable-next-line no-console
            console.error(
              `[useAnalysisManager_onSnapshot] Firestore onSnapshot error for ${analysisIdToListen} (User: ${user.uid}): Code: ${error.code}, Message: ${error.message}`,
              error
            );
            // Display a user-friendly toast notification
            toast({
              title: 'Erro ao Sincronizar Análise',
              description: `Não foi possível obter atualizações: ${error.message}`,
              variant: 'destructive',
            });
            // Update the local state to reflect the error, if the current analysis matches the listener
            setCurrentAnalysis((prev) => {
              if (
                prev &&
                analysisIdToListen &&
                prev.id === analysisIdToListen &&
                !prev.id.startsWith('error-') &&
                prev.status !== 'error' &&
                prev.status !== 'cancelled' &&
                prev.status !== 'pending_deletion'
              ) {
                return {
                  ...prev,
                  status: 'error',
                  errorMessage: `Erro ao sincronizar com Firestore: ${error.message}`,
                };
              }
              return prev; // Return previous state if no change is needed
            });
          }
        );
      } catch (e) {
        // Catch potential errors when setting up the listener
        // eslint-disable-next-line no-console
        console.error(
          '[useAnalysisManager_onSnapshot] Exception setting up onSnapshot for analysis ID:',
          analysisIdToListen,
          e
        );
      }
    }
    // Cleanup function to unsubscribe from the listener when the component unmounts or dependencies change
    return () => {
      if (unsub) {
        // eslint-disable-next-line no-console
        console.debug(
          `[useAnalysisManager_onSnapshot] Unsubscribing from analysis ID: ${currentAnalysis?.id}`
        );
        unsub();
      }
    };
  }, [user, currentAnalysis, toast]);

  /**
   * Initiates the AI processing for a given analysis.
   * @param analysisId - The ID of the analysis to process.
   * @param userIdFromCaller - The ID of the user initiating the action.
   */

  const startAiProcessing = useCallback(
    async (analysisId: string, userIdFromCaller: string) => {
      // eslint-disable-next-line no-console
      console.info(
        `[useAnalysisManager_startAiProcessing] Calling server action 'processAnalysisFile' for ID: ${analysisId}, UserID: ${userIdFromCaller}`
      );
      if (!userIdFromCaller || !analysisId) {
        const msg = `[useAnalysisManager_startAiProcessing] CRITICAL: userId ('${userIdFromCaller}') or analysisId ('${analysisId}') is invalid. Aborting.`;
        // eslint-disable-next-line no-console
        console.error(msg);
        toast({
          title: 'Erro Crítico',
          description: 'ID de usuário ou análise inválido.',
          variant: 'destructive',
        });
        setCurrentAnalysis((prev) =>
          prev && prev.id === analysisId ? { ...prev, status: 'error', errorMessage: msg } : prev
        );
        return;
      }

      try {
        const result = await processAnalysisFile(analysisId, userIdFromCaller);
        // eslint-disable-next-line no-console
        console.info(
          `[useAnalysisManager_startAiProcessing] Server action 'processAnalysisFile' completed for ID: ${analysisId}. Success: ${result.success}, Error: ${result.error}`
        );

        if (result.success) {
          toast({
            title: 'Processamento Iniciado',
            description:
              'A análise está sendo processada em segundo plano. O progresso será atualizado automaticamente.',
          });
        } else {
          const errorMsg = `Falha ao iniciar processamento: ${result.error || 'Erro desconhecido'}`;
          setCurrentAnalysis((prev) => {
            if (
              prev &&
              prev.id === analysisId &&
              prev.status !== 'error' &&
              prev.status !== 'cancelled'
            ) {
              return { ...prev, status: 'error', errorMessage: errorMsg };
            }
            return prev;
          });
          toast({ title: 'Erro ao Iniciar', description: errorMsg, variant: 'destructive' });
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisManager_startAiProcessing] Error calling 'processAnalysisFile' action for ${analysisId}:`,
          e
        );
        setCurrentAnalysis((prev) => {
          if (
            prev &&
            prev.id === analysisId &&
            prev.status !== 'error' &&
            prev.status !== 'cancelled'
          ) {
            return {
              ...prev,
              status: 'error',
              errorMessage: `Erro de comunicação ao iniciar: ${errorMsg}`,
            };
          }
          return prev;
        });
        toast({
          title: 'Erro de Comunicação',
          description: `Não foi possível iniciar o processamento: ${errorMsg}`,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  /**
   * Adds a tag to a specific analysis.
   * @param analysisId - The ID of the analysis.
   * @param tag - The tag string to add.
   */
  const handleAddTag = useCallback(
    async (analysisId: string, tag: string) => {
      if (!user?.uid || !tag.trim() || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível adicionar a tag: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      try {
        // Call the server action to add the tag
        await addTagToAction(user.uid, analysisId, tag.trim());
        setTagInput(''); // Clear the tag input field
        toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisManager_handleAddTag] Error adding tag to ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao adicionar tag',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  /**
   * Removes a specific tag from an analysis.
   * @param analysisId - The ID of the analysis.
   * @param tagToRemove - The tag string to remove.
   */
  const handleRemoveTag = useCallback(
    async (analysisId: string, tagToRemove: string) => {
      if (!user?.uid || !analysisId || !tagToRemove.trim()) {
        toast({
          title: 'Erro',
          description: 'Não foi possível remover a tag: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      try {
        // Call the server action to remove the tag
        await removeTagAction(user.uid, analysisId, tagToRemove);
        toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisManager_handleRemoveTag] Error removing tag from ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao remover tag',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  /**
   * Requests the deletion of an analysis.
   * @param analysisId - The ID of the analysis to delete.
   * @param onDeleted - Optional callback function to execute after the deletion request is sent.
   */
  const handleDeleteAnalysis = useCallback(
    async (analysisId: string, onDeleted?: () => void) => {
      if (!user?.uid || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível excluir a análise: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      try {
        // Call the server action to request deletion
        await deleteAnalysisAction(user.uid, analysisId);
        toast({
          title: 'Solicitação de Exclusão Enviada',
          description: 'A análise será excluída em breve. O status será atualizado.',
        });
        onDeleted?.();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisManager_handleDeleteAnalysis] Error requesting deletion for analysis ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao Solicitar Exclusão',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  /**
   * Requests the cancellation of a processing analysis.
   * @param analysisId - The ID of the analysis to cancel.
   */
  const handleCancelAnalysis = useCallback(
    async (analysisId: string) => {
      if (!user?.uid || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível solicitar o cancelamento: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.info(
        `[useAnalysisManager_handleCancel] Requesting cancellation for analysis ID: ${analysisId}`
      );
      try {
        // Call the server action to cancel the analysis
        const result = await cancelAnalysisAction(user.uid, analysisId);
        if (result.success) {
          toast({
            title: 'Cancelamento Solicitado',
            description: 'A análise será interrompida em breve.',
          });
        } else {
          toast({
            title: 'Erro ao Cancelar',
            description: result.error || 'Não foi possível solicitar o cancelamento.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisManager_handleCancel] Error cancelling analysis ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao Cancelar',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  /**
   * Requests a retry for an analysis that failed processing.
   * @param analysisId - The ID of the analysis to retry.
   */
  const handleRetryAnalysis = useCallback(
    async (analysisId: string) => {
      if (!user?.uid || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível tentar novamente: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.info(
        `[useAnalysisManager_handleRetry] Requesting retry for analysis ID: ${analysisId}`
      );
      try {
        // Call the server action to retry the analysis
        const result = await retryAnalysisAction(user.uid, analysisId);
        if (result.success) {
          toast({
            title: 'Nova Tentativa Solicitada',
            description: 'A análise será reprocessada. O status será atualizado em breve.',
          });
          // The onSnapshot listener should pick up the status change and update currentAnalysis
        } else {
          toast({
            title: 'Erro ao Tentar Novamente',
            description: result.error || 'Não foi possível solicitar uma nova tentativa.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisManager_handleRetry] Error retrying analysis ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao Tentar Novamente',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  /**
   * Downloads the structured report of an analysis as a text file.
   * @param analysisData - The analysis object containing the structured report.
   */
  const downloadReportAsTxt = useCallback(
    (analysisData: Analysis | null) => {
      if (!analysisData) {
        toast({
          title: 'Download não disponível',
          description: 'Nenhuma análise selecionada.',
          variant: 'destructive',
        });
        return;
      }
      const reportText = formatStructuredReportToTxt(
        analysisData.structuredReport,
        analysisData.fileName
      );
      if (reportText === 'Relatório estruturado não disponível.') {
        toast({
          title: 'Download não disponível',
          description: 'O relatório estruturado está vazio ou não foi gerado.',
          variant: 'destructive',
        });
        return;
      }
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${(analysisData.title || analysisData.fileName).replace(/\.[^/.]+$/, '')}_relatorio_conformidade.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({
        title: 'Download Iniciado',
        description: 'O relatório estruturado está sendo baixado.',
      });
    },
    [toast]
  );

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
    handleRetryAnalysis, // Expose the new handler
    /** Downloads the structured report as a text file. */
    downloadReportAsTxt,
    /** Steps to display in the analysis progress view. */
    displayedAnalysisSteps,
  };
}
