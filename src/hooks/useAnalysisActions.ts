// src/hooks/useAnalysisActions.ts
'use client';
import { useCallback } from 'react';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import {
  cancelAnalysisAction,
  deleteAnalysisAction,
} from '@/features/analysis-management/actions/analysisManagementActions';
import {
  processAnalysisFile,
  retryAnalysisAction,
} from '@/features/analysis-processing/actions/analysisProcessingActions';
import { addTagToAction, removeTagAction } from '@/features/tag-management/actions/tagActions';
// useToast is imported but the toast function is passed as a prop
// import { useToast } from '@/hooks/use-toast';
import { formatStructuredReportToTxt } from '@/lib/reportUtils';
import type { Analysis } from '@/types/analysis';

/**
 * A hook that provides callback functions for performing various actions related to user analyses.
 * These actions typically involve calling server actions or utility functions.
 *
 * @param userId - The ID of the authenticated user.
 * @param setCurrentAnalysis - A function to set the currently active analysis in the parent component.
 * @param toast - A function from the useToast hook to display notifications.
 * @param fetchPastAnalyses - A function to refetch the list of past analyses (e.g., after deletion).
 */
export function useAnalysisActions(
  userId: string | null,
  setCurrentAnalysis: (analysis: Analysis | null) => void,
  toast: any, // Use the actual type for toast if available, otherwise 'any' is a fallback
  fetchPastAnalyses: () => Promise<void>
) {
  /**
   * Initiates the AI processing for a given analysis.
   * @param analysisId - The ID of the analysis to process.
   */
  const startAiProcessing = useCallback(
    async (analysisId: string) => {
      // eslint-disable-next-line no-console
      console.info(
        `[useAnalysisActions_startAiProcessing] Calling server action 'processAnalysisFile' for ID: ${analysisId}, UserID: ${userId}`
      );
      if (!userId || !analysisId) {
        const msg = `[useAnalysisActions_startAiProcessing] CRITICAL: userId ('${userId}') or analysisId ('${analysisId}') is invalid. Aborting.`;
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
        const result = await processAnalysisFile(analysisId, userId);
        // eslint-disable-next-line no-console
        console.info(
          `[useAnalysisActions_startAiProcessing] Server action 'processAnalysisFile' completed for ID: ${analysisId}. Success: ${result.success}, Error: ${result.error}`
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
          `[useAnalysisActions_startAiProcessing] Error calling 'processAnalysisFile' action for ${analysisId}:`,
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
    [userId, toast, setCurrentAnalysis] // Depend on userId, toast, and setCurrentAnalysis
  );

  /**
   * Adds a tag to a specific analysis.
   * @param analysisId - The ID of the analysis.
   * @param tag - The tag string to add.
   */
  const handleAddTag = useCallback(
    async (analysisId: string, tag: string) => {
      if (!userId || !tag.trim() || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível adicionar a tag: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      try {
        // Call the server action to add the tag
        await addTagToAction(userId, analysisId, tag.trim());
        // setTagInput(''); // setTagInput is in useAnalysisManager, pass it as prop if needed here
        toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisActions_handleAddTag] Error adding tag to ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao adicionar tag',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [userId, toast] // Depend on userId and toast
  );

  /**
   * Removes a specific tag from an analysis.
   * @param analysisId - The ID of the analysis.
   * @param tagToRemove - The tag string to remove.
   */
  const handleRemoveTag = useCallback(
    async (analysisId: string, tagToRemove: string) => {
      if (!userId || !analysisId || !tagToRemove.trim()) {
        toast({
          title: 'Erro',
          description: 'Não foi possível remover a tag: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      try {
        // Call the server action to remove the tag
        await removeTagAction(userId, analysisId, tagToRemove);
        toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisActions_handleRemoveTag] Error removing tag from ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao remover tag',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [userId, toast] // Depend on userId and toast
  );

  /**
   * Requests the deletion of an analysis.
   * @param analysisId - The ID of the analysis to delete.
   * @param onDeleted - Optional callback function to execute after the deletion request is sent.
   */
  const handleDeleteAnalysis = useCallback(
    async (analysisId: string, onDeleted?: () => void) => {
      if (!userId || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível excluir a análise: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      try {
        // Call the server action to request deletion
        await deleteAnalysisAction(userId, analysisId);
        toast({
          title: 'Solicitação de Exclusão Enviada',
          description: 'A análise será excluída em breve. O status será atualizado.',
        });
        // Call the provided onDeleted callback, which should ideally refetch the list
        onDeleted?.();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisActions_handleDeleteAnalysis] Error requesting deletion for analysis ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao Solicitar Exclusão',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
      }
    },
    [userId, toast] // Depend on userId and toast. onDeleted is a stable prop.
  );

  /**
   * Requests the cancellation of a processing analysis.
   * @param analysisId - The ID of the analysis to cancel.
   */
  const handleCancelAnalysis = useCallback(
    async (analysisId: string) => {
      if (!userId || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível solicitar o cancelamento: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.info(
        `[useAnalysisActions_handleCancel] Requesting cancellation for analysis ID: ${analysisId}`
      );
      try {
        // Call the server action to cancel the analysis
        const result = await cancelAnalysisAction(userId, analysisId);
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
        return result; // Return result to potentially handle in UI
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisActions_handleCancel] Error cancelling analysis ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao Cancelar',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
        // Rethrow or return an error object if needed by the caller
        throw new Error(`Failed to cancel analysis: ${String(error)}`);
      }
    },
    [userId, toast] // Depend on userId and toast
  );

  /**
   * Requests a retry for an analysis that failed processing.
   * @param analysisId - The ID of the analysis to retry.
   */
  const handleRetryAnalysis = useCallback(
    async (analysisId: string) => {
      if (!userId || !analysisId) {
        toast({
          title: 'Erro',
          description: 'Não foi possível tentar novamente: dados inválidos.',
          variant: 'destructive',
        });
        return;
      }
      // eslint-disable-next-line no-console
      console.info(
        `[useAnalysisActions_handleRetry] Requesting retry for analysis ID: ${analysisId}`
      );
      try {
        // Call the server action to retry the analysis
        const result = await retryAnalysisAction(userId, analysisId);
        if (result.success) {
          toast({
            title: 'Nova Tentativa Solicitada',
            description: 'A análise será reprocessada. O status será atualizado em breve.',
          });
          // The onSnapshot listener (managed by useAnalysisListener) should pick up the status change and update currentAnalysis
        } else {
          toast({
            title: 'Erro ao Tentar Novamente',
            description: result.error || 'Não foi possível solicitar uma nova tentativa.',
            variant: 'destructive',
          });
        }
        return result; // Return result to potentially handle in UI
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[useAnalysisActions_handleRetry] Error retrying analysis ${analysisId}:`,
          error
        );
        toast({
          title: 'Erro ao Tentar Novamente',
          description: String(error instanceof Error ? error.message : error),
          variant: 'destructive',
        });
        // Rethrow or return an error object if needed by the caller
        throw new Error(`Failed to retry analysis: ${String(error)}`);
      }
    },
    [userId, toast] // Depend on userId and toast
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
    [toast] // Depend on toast
  );

  return {
    startAiProcessing,
    handleAddTag,
    handleRemoveTag,
    handleDeleteAnalysis,
    handleCancelAnalysis,
    handleRetryAnalysis,
    downloadReportAsTxt,
  };
}
