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

import type { User } from 'firebase/auth';

export function useAnalysisManager(user: User | null) {
  const { toast } = useToast();
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [pastAnalyses, setPastAnalyses] = useState<Analysis[]>([]);
  const [isLoadingPastAnalyses, setIsLoadingPastAnalyses] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (
      user?.uid &&
      currentAnalysis?.id &&
      !currentAnalysis.id.startsWith('error-') &&
      currentAnalysis.fileName &&
      currentAnalysis.title &&
      currentAnalysis.createdAt
    ) {
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

              const updatedAnalysis: Analysis = {
                id: docSnap.id,
                userId: typeof data.userId === 'string' ? data.userId : validUserId,
                fileName:
                  typeof data.fileName === 'string'
                    ? data.fileName
                    : currentAnalysis.fileName || 'Nome de arquivo desconhecido',
                title: typeof data.title === 'string' ? data.title : currentAnalysis.title,
                description:
                  typeof data.description === 'string'
                    ? data.description
                    : currentAnalysis.description,
                languageCode:
                  typeof data.languageCode === 'string'
                    ? data.languageCode
                    : currentAnalysis.languageCode,
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
                summary:
                  typeof data.summary === 'string'
                    ? data.summary
                    : (data.structuredReport as AnalyzeComplianceReportOutput)?.introduction
                        ?.overallResultsSummary,
                complianceReport:
                  typeof data.complianceReport === 'string' ? data.complianceReport : undefined,
                structuredReport: data.structuredReport as
                  | AnalyzeComplianceReportOutput
                  | undefined,
                mdxReportStoragePath:
                  typeof data.mdxReportStoragePath === 'string'
                    ? data.mdxReportStoragePath
                    : undefined,
                errorMessage: statusIsValid
                  ? typeof data.errorMessage === 'string'
                    ? data.errorMessage
                    : undefined
                  : data.errorMessage || 'Status inválido recebido do Firestore.',
                tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
                createdAt: (data.createdAt as Timestamp)?.toDate
                  ? (data.createdAt as Timestamp).toDate().toISOString()
                  : currentAnalysis.createdAt || new Date().toISOString(),
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
              setCurrentAnalysis(updatedAnalysis);

              setPastAnalyses((prev) =>
                prev
                  .map((pa) => (pa.id === updatedAnalysis.id ? updatedAnalysis : pa))
                  .filter((a) => a.status !== 'deleted')
              );
            } else {
              // eslint-disable-next-line no-console
              console.warn(
                `[useAnalysisManager_onSnapshot] Document ${analysisIdToListen} not found. Current local status: ${currentAnalysis?.status}.`
              );
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
                  return prev;
                });
              }
            }
          },
          (error: FirestoreError) => {
            // eslint-disable-next-line no-console
            console.error(
              `[useAnalysisManager_onSnapshot] Firestore onSnapshot error for ${analysisIdToListen}: Code: ${error.code}, Message: ${error.message}`,
              error
            );
            toast({
              title: 'Erro ao Sincronizar Análise',
              description: `Não foi possível obter atualizações: ${error.message}`,
              variant: 'destructive',
            });
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
              return prev;
            });
          }
        );
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[useAnalysisManager_onSnapshot] Exception setting up onSnapshot:', e);
      }
    }
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

  const fetchPastAnalyses = useCallback(async () => {
    if (!user?.uid) {
      // eslint-disable-next-line no-console
      console.warn(
        '[useAnalysisManager_fetchPastAnalyses] No user or invalid user.uid, skipping fetch.'
      );
      setPastAnalyses([]);
      setIsLoadingPastAnalyses(false);
      return;
    }
    setIsLoadingPastAnalyses(true);
    const currentUserId = user.uid;
    // eslint-disable-next-line no-console
    console.info(`[useAnalysisManager_fetchPastAnalyses] Fetching for user: ${currentUserId}`);
    try {
      const analyses = await getPastAnalysesAction(currentUserId);
      setPastAnalyses(analyses.filter((a) => a.status !== 'deleted'));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[useAnalysisManager_fetchPastAnalyses] Error fetching:', error);
      toast({
        title: 'Erro ao buscar análises',
        description: String(error instanceof Error ? error.message : error),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPastAnalyses(false);
    }
  }, [user, toast]);

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
        await addTagToAction(user.uid, analysisId, tag.trim());
        setTagInput('');
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

  const displayedAnalysisSteps = useMemo(() => {
    return calculateDisplayedAnalysisSteps(currentAnalysis);
  }, [currentAnalysis]);

  return {
    currentAnalysis,
    setCurrentAnalysis,
    pastAnalyses,
    isLoadingPastAnalyses,
    tagInput,
    setTagInput,
    fetchPastAnalyses,
    startAiProcessing,
    handleAddTag,
    handleRemoveTag,
    handleDeleteAnalysis,
    handleCancelAnalysis,
    handleRetryAnalysis, // Expose the new handler
    downloadReportAsTxt,
    displayedAnalysisSteps,
  };
}
