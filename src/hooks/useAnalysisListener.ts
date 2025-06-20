// src/hooks/useAnalysisListener.ts
'use client';
import { useEffect } from 'react';

import { doc, onSnapshot, type FirestoreError, type Timestamp } from 'firebase/firestore';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';

import type { User } from 'firebase/auth'; // Although User type is imported, it's not directly used in this hook's parameters

/**
 * Validates if a given status string is a valid Analysis status.
 * @param {unknown} status - The status to validate.
 * @returns {status is Analysis['status']} True if valid, false otherwise.
 */
function statusIsValid(status: unknown): status is Analysis['status'] {
  const validStatuses: Analysis['status'][] = [
    'uploading',
    'summarizing_data',
    'identifying_regulations',
    'assessing_compliance',
    'completed',
    'error',
    'deleted',
    'cancelling',
    'cancelled',
    'reviewing_report',
    'pending_deletion',
  ];
  return typeof status === 'string' && validStatuses.includes(status as Analysis['status']);
}

/**
 * Converts a Firestore Timestamp or ISO string to an ISO string, or returns undefined if invalid.
 * @param timestampFieldValue - The value to convert.
 * @returns The ISO string representation of the timestamp, or undefined.
 */
const mapTimestampToISO = (
  timestampFieldValue: Timestamp | string | undefined
): string | undefined => {
  if (timestampFieldValue instanceof Timestamp) {
    return (timestampFieldValue as Timestamp).toDate().toISOString();
  }
  if (
    // Allow ISO strings for backward compatibility or manual entry, though not standard Firestore behavior
    typeof timestampFieldValue === 'string' &&
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(timestampFieldValue)
  ) {
    return timestampFieldValue;
  }
  return undefined;
};

/**
 * Hook to set up a real-time Firestore listener for a specific analysis document.
 * It updates the current analysis state based on changes in Firestore.
 *
 * @param userId - The ID of the user to whom the analysis belongs.
 * @param analysisId - The ID of the analysis document to listen to.
 * @param initialAnalysis - The initial analysis data (optional, used for fallbacks).
 * @param setCurrentAnalysis - A state setter function to update the current analysis in the parent component.
 */
export function useAnalysisListener(
  userId: string | null,
  analysisId: string | null,
  initialAnalysis: Analysis | null,
  setCurrentAnalysis: (analysis: Analysis | null) => void
) {
  const { toast } = useToast();

  useEffect(() => {
    let unsub: (() => void) | undefined;

    // Subscribe if a valid user ID and analysis ID (not an error placeholder) are provided.
    if (userId && analysisId && !analysisId.startsWith('error-')) {
      const validUserId = userId;
      const analysisIdToListen = analysisId;

      // eslint-disable-next-line no-console
      console.debug(
        `[useAnalysisListener_onSnapshot] Subscribing to analysis ID: ${analysisIdToListen} for user UID: ${validUserId}.`
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
                `[useAnalysisListener_onSnapshot] Snapshot for ${analysisIdToListen}: Status: ${data.status}, Progress: ${data.progress}, ErrMsg: ${data.errorMessage?.substring(0, 100)}`
              );

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
              const statusIsValid =
                data.status && validStatuses.includes(data.status as Analysis['status']);

              // Construct the updated analysis object, handling potential missing or invalid data
              const updatedAnalysis: Analysis = {
                id: docSnap.id,
                userId: typeof data.userId === 'string' ? data.userId : validUserId,
                fileName:
                  typeof data.fileName === 'string'
                    ? data.fileName
                    : initialAnalysis?.fileName || 'Nome de arquivo desconhecido', // Fallback to initial or default
                title: typeof data.title === 'string' ? data.title : initialAnalysis?.title, // Fallback
                description:
                  typeof data.description === 'string'
                    ? data.description
                    : initialAnalysis?.description, // Fallback
                languageCode:
                  typeof data.languageCode === 'string'
                    ? data.languageCode
                    : initialAnalysis?.languageCode, // Fallback
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
                // Convert Timestamp to ISO string, fallback to initial or new date
                createdAt:
                  mapTimestampToISO(data.createdAt) ||
                  initialAnalysis?.createdAt ||
                  new Date().toISOString(),
                // Convert Timestamp to ISO string if available
                completedAt: mapTimestampToISO(data.completedAt),
                reportLastModifiedAt: mapTimestampToISO(data.reportLastModifiedAt),
                deletionRequestedAt: mapTimestampToISO(data.deletionRequestedAt),
              };
              // Update the local currentAnalysis state with the data from Firestore
              setCurrentAnalysis(updatedAnalysis);
            } else {
              // Handle cases where the document might not exist (e.g., deleted or not yet created)
              // eslint-disable-next-line no-console
              console.warn(
                `[useAnalysisListener_onSnapshot] Document ${analysisIdToListen} not found for user ${userId}.`
              );
              // If the document disappears unexpectedly and the local status isn't already terminal,
              // update the local state to an error status.
              if (
                analysisIdToListen &&
                !analysisIdToListen.startsWith('error-') &&
                initialAnalysis?.status !== 'deleted' &&
                initialAnalysis?.status !== 'error' &&
                initialAnalysis?.status !== 'cancelled' &&
                initialAnalysis?.status !== 'pending_deletion'
              ) {
                setCurrentAnalysis((prev) => {
                  // Only update if the listener was for the current analysis being displayed
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
              } else if (initialAnalysis?.status !== 'deleted') {
                // If the initial analysis had a non-deleted status but the doc doesn't exist,
                // explicitly set current analysis to null to clear it.
                setCurrentAnalysis(null);
              }
            }
          },
          (error: FirestoreError) => {
            // Handle Firestore listener errors
            // eslint-disable-next-line no-console
            console.error(
              `[useAnalysisListener_onSnapshot] Firestore onSnapshot error for ${analysisIdToListen} (User: ${userId}): Code: ${error.code}, Message: ${error.message}`,
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
          '[useAnalysisListener_onSnapshot] Exception setting up onSnapshot for analysis ID:',
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
          `[useAnalysisListener_onSnapshot] Unsubscribing from analysis ID: ${analysisId}`
        );
        unsub();
      }
    };
  }, [userId, analysisId, initialAnalysis, setCurrentAnalysis, toast]); // Add dependencies
}
