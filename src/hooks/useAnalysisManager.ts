
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';
import { processAnalysisFile } from '@/features/analysis-processing/actions/analysisProcessingActions';
import { getPastAnalysesAction } from '@/features/analysis-listing/actions/analysisListingActions';
import { addTagToAction, removeTagAction } from '@/features/tag-management/actions/tagActions';
import { deleteAnalysisAction, cancelAnalysisAction } from '@/features/analysis-management/actions/analysisManagementActions';
import type { AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report';
import { formatStructuredReportToTxt } from '@/lib/reportUtils';
import { calculateDisplayedAnalysisSteps } from '@/features/analysis-processing/utils/analysisStepsUtils';


export function useAnalysisManager(user: User | null) {
  const { toast } = useToast();
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [pastAnalyses, setPastAnalyses] = useState<Analysis[]>([]);
  const [isLoadingPastAnalyses, setIsLoadingPastAnalyses] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (user?.uid && currentAnalysis?.id && !currentAnalysis.id.startsWith('error-')) {
      const validUserId = user.uid; // Ensure it's a string before using
      console.log(`[useAnalysisManager_onSnapshot] Subscribing to analysis ID: ${currentAnalysis.id} for user UID: ${validUserId}. Current local status: ${currentAnalysis?.status}`);
      const analysisDocumentRef = doc(db, 'users', validUserId, 'analyses', currentAnalysis.id);
      
      try {
        unsub = onSnapshot(analysisDocumentRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              console.log(`[useAnalysisManager_onSnapshot] Snapshot for ${currentAnalysis.id}: Status: ${data.status}, Progress: ${data.progress}, ErrMsg: ${data.errorMessage?.substring(0,100)}`);
              
              const validStatuses: Analysis['status'][] = ['uploading', 'summarizing_data', 'identifying_regulations', 'assessing_compliance', 'completed', 'error', 'deleted', 'cancelling', 'cancelled'];
              const statusIsValid = data.status && validStatuses.includes(data.status as Analysis['status']);

              const updatedAnalysis: Analysis = {
                id: docSnap.id,
                userId: typeof data.userId === 'string' ? data.userId : validUserId,
                fileName: typeof data.fileName === 'string' ? data.fileName : currentAnalysis?.fileName || 'Nome de arquivo desconhecido',
                title: typeof data.title === 'string' ? data.title : currentAnalysis?.title,
                description: typeof data.description === 'string' ? data.description : currentAnalysis?.description,
                languageCode: typeof data.languageCode === 'string' ? data.languageCode : currentAnalysis?.languageCode,
                status: statusIsValid ? (data.status as Analysis['status']) : 'error',
                progress: typeof data.progress === 'number' ? data.progress : 0,
                uploadProgress: typeof data.uploadProgress === 'number' ? data.uploadProgress : undefined,
                powerQualityDataUrl: typeof data.powerQualityDataUrl === 'string' ? data.powerQualityDataUrl : undefined,
                powerQualityDataSummary: typeof data.powerQualityDataSummary === 'string' ? data.powerQualityDataSummary : undefined,
                isDataChunked: typeof data.isDataChunked === 'boolean' ? data.isDataChunked : undefined,
                identifiedRegulations: Array.isArray(data.identifiedRegulations) ? data.identifiedRegulations.map(String) : undefined,
                summary: typeof data.summary === 'string' ? data.summary : (data.structuredReport as AnalyzeComplianceReportOutput)?.introduction?.overallResultsSummary,
                complianceReport: typeof data.complianceReport === 'string' ? data.complianceReport : undefined, 
                structuredReport: data.structuredReport as AnalyzeComplianceReportOutput | undefined,
                mdxReportStoragePath: typeof data.mdxReportStoragePath === 'string' ? data.mdxReportStoragePath : undefined,
                errorMessage: statusIsValid ? (typeof data.errorMessage === 'string' ? data.errorMessage : undefined) : (data.errorMessage || 'Status inválido recebido do Firestore.'),
                tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
                createdAt: (data.createdAt instanceof Timestamp) ? data.createdAt.toDate().toISOString() : (currentAnalysis?.createdAt || new Date().toISOString()),
                completedAt: (data.completedAt instanceof Timestamp) ? data.completedAt.toDate().toISOString() : undefined,
              };
              setCurrentAnalysis(updatedAnalysis);

              // Update pastAnalyses list if the current one changed significantly (e.g. status)
              setPastAnalyses(prev => prev.map(pa => pa.id === updatedAnalysis.id ? updatedAnalysis : pa).filter(a => a.status !== 'deleted'));

            } else {
              console.warn(`[useAnalysisManager_onSnapshot] Document ${currentAnalysis?.id} not found. Current local status: ${currentAnalysis?.status}.`);
              if (currentAnalysis && currentAnalysis.id && !currentAnalysis.id.startsWith('error-') && currentAnalysis.status !== 'deleted' && currentAnalysis.status !== 'error' && currentAnalysis.status !== 'cancelled') {
                setCurrentAnalysis(prev => {
                  if (prev && prev.id === currentAnalysis.id && prev.status !== 'error' && prev.status !== 'deleted' && prev.status !== 'cancelled') {
                      return { ...prev, status: 'error', errorMessage: `Documento da análise (ID: ${currentAnalysis.id}) não foi encontrado ou foi removido inesperadamente.` };
                  }
                  return prev;
                });
              }
            }
          },
          (error: FirestoreError) => {
            console.error(`[useAnalysisManager_onSnapshot] Firestore onSnapshot error for ${currentAnalysis?.id}: Code: ${error.code}, Message: ${error.message}`, error);
            toast({ title: 'Erro ao Sincronizar Análise', description: `Não foi possível obter atualizações: ${error.message}`, variant: 'destructive' });
            setCurrentAnalysis(prev => {
              if (prev && currentAnalysis?.id && prev.id === currentAnalysis.id && !prev.id.startsWith('error-') && prev.status !== 'error' && prev.status !== 'cancelled') {
                return { ...prev, status: 'error', errorMessage: `Erro ao sincronizar com Firestore: ${error.message}` };
              }
              return prev;
            });
          }
        );
      } catch (e) {
        console.error("[useAnalysisManager_onSnapshot] Exception setting up onSnapshot:", e);
      }
    }
    return () => {
      if (unsub) {
        console.log(`[useAnalysisManager_onSnapshot] Unsubscribing from analysis ID: ${currentAnalysis?.id}`);
        unsub();
      }
    };
  }, [user, currentAnalysis?.id, toast]); 


  const startAiProcessing = useCallback(async (analysisId: string, userIdFromCaller: string) => {
    console.log(`[useAnalysisManager_startAiProcessing] Calling server action 'processAnalysisFile' for ID: ${analysisId}, UserID: ${userIdFromCaller}`);
    if (!userIdFromCaller || !analysisId) {
        const msg = `[useAnalysisManager_startAiProcessing] CRITICAL: userId ('${userIdFromCaller}') or analysisId ('${analysisId}') is invalid. Aborting.`;
        console.error(msg);
        toast({ title: 'Erro Crítico', description: 'ID de usuário ou análise inválido.', variant: 'destructive'});
        setCurrentAnalysis(prev => prev && prev.id === analysisId ? { ...prev, status: 'error', errorMessage: msg} : prev);
        return;
    }
    
    try {
      // This action now just queues the analysis for background processing by the Firebase Function
      const result = await processAnalysisFile(analysisId, userIdFromCaller);
      console.log(`[useAnalysisManager_startAiProcessing] Server action 'processAnalysisFile' completed for ID: ${analysisId}. Success: ${result.success}, Error: ${result.error}`);
      
      if (result.success) {
        toast({ title: 'Processamento Iniciado', description: 'A análise está sendo processada em segundo plano. O progresso será atualizado automaticamente.' });
        // The onSnapshot listener will handle UI updates based on Firestore changes made by the Firebase Function.
      } else {
        const errorMsg = `Falha ao iniciar processamento: ${result.error || 'Erro desconhecido'}`;
        setCurrentAnalysis(prev => {
            if (prev && prev.id === analysisId && prev.status !== 'error' && prev.status !== 'cancelled') {
                return { ...prev, status: 'error', errorMessage: errorMsg };
            }
            return prev;
        });
        toast({ title: 'Erro ao Iniciar', description: errorMsg, variant: 'destructive' });
      }
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`[useAnalysisManager_startAiProcessing] Error calling 'processAnalysisFile' action for ${analysisId}:`, e);
        setCurrentAnalysis(prev => {
            if (prev && prev.id === analysisId && prev.status !== 'error' && prev.status !== 'cancelled') {
                return { ...prev, status: 'error', errorMessage: `Erro de comunicação ao iniciar: ${errorMsg}`};
            }
            return prev;
        });
        toast({ title: 'Erro de Comunicação', description: `Não foi possível iniciar o processamento: ${errorMsg}`, variant: 'destructive'});
    }
  }, [toast]);


  const fetchPastAnalyses = useCallback(async () => {
    if (!user?.uid) {
      console.warn('[useAnalysisManager_fetchPastAnalyses] No user or invalid user.uid, skipping fetch.');
      setPastAnalyses([]);
      setIsLoadingPastAnalyses(false); 
      return;
    }
    setIsLoadingPastAnalyses(true);
    const currentUserId = user.uid;
    console.log(`[useAnalysisManager_fetchPastAnalyses] Fetching for user: ${currentUserId}`);
    try {
      const analyses = await getPastAnalysesAction(currentUserId);
      setPastAnalyses(analyses.filter(a => a.status !== 'deleted'));
    } catch (error) {
      console.error('[useAnalysisManager_fetchPastAnalyses] Error fetching:', error);
      toast({ title: 'Erro ao buscar análises', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    } finally {
      setIsLoadingPastAnalyses(false);
    }
  }, [user, toast]);

  const handleAddTag = useCallback(async (analysisId: string, tag: string) => {
    if (!user?.uid || !tag.trim() || !analysisId ) {
        toast({title: "Erro", description: "Não foi possível adicionar a tag: dados inválidos.", variant: "destructive"});
        return;
    }
    try {
      await addTagToAction(user.uid, analysisId, tag.trim());
      // Optimistic update handled by onSnapshot or fetchPastAnalyses re-fetch
      setTagInput('');
      toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleAddTag] Error adding tag to ${analysisId}:`, error);
      toast({ title: 'Erro ao adicionar tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast]);

  const handleRemoveTag = useCallback(async (analysisId: string, tagToRemove: string) => {
     if (!user?.uid || !analysisId || !tagToRemove.trim()) {
        toast({title: "Erro", description: "Não foi possível remover a tag: dados inválidos.", variant: "destructive"});
        return;
    }
    try {
      await removeTagAction(user.uid, analysisId, tagToRemove);
      // Optimistic update handled by onSnapshot or fetchPastAnalyses re-fetch
      toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleRemoveTag] Error removing tag from ${analysisId}:`, error);
      toast({ title: 'Erro ao remover tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast]);


  const handleDeleteAnalysis = useCallback(async (analysisId: string, onDeleted?: () => void) => {
    if (!user?.uid || !analysisId) {
        toast({title: "Erro", description: "Não foi possível excluir a análise: dados inválidos.", variant: "destructive"});
        return;
    }
    try {
      await deleteAnalysisAction(user.uid, analysisId);
      // UI update will be handled by onSnapshot seeing the 'deleted' status and fetchPastAnalyses filtering it out
      toast({ title: 'Análise excluída', description: 'A análise foi marcada como excluída.' });
      onDeleted?.(); // Callback for UI actions like closing accordion
      if (currentAnalysis?.id === analysisId) {
        setCurrentAnalysis(null); // Clear current if it was the one deleted
      }
      // Refetch past analyses to update the list immediately
      fetchPastAnalyses();
    } catch (error) {
      console.error(`[useAnalysisManager_handleDeleteAnalysis] Error deleting analysis ${analysisId}:`, error);
      toast({ title: 'Erro ao excluir', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis?.id, fetchPastAnalyses]);

  const handleCancelAnalysis = useCallback(async (analysisId: string) => {
    if (!user?.uid || !analysisId) {
      toast({ title: 'Erro', description: 'Não foi possível solicitar o cancelamento: dados inválidos.', variant: 'destructive' });
      return;
    }
    console.log(`[useAnalysisManager_handleCancel] Requesting cancellation for analysis ID: ${analysisId}`);
    try {
      const result = await cancelAnalysisAction(user.uid, analysisId);
      if (result.success) {
        toast({ title: 'Cancelamento Solicitado', description: 'A análise será interrompida em breve.' });
        // onSnapshot will update the UI when status changes to 'cancelling' and then 'cancelled'
      } else {
        toast({ title: 'Erro ao Cancelar', description: result.error || 'Não foi possível solicitar o cancelamento.', variant: 'destructive' });
      }
    } catch (error) {
      console.error(`[useAnalysisManager_handleCancel] Error cancelling analysis ${analysisId}:`, error);
      toast({ title: 'Erro ao Cancelar', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast]);

  const downloadReportAsTxt = useCallback((analysisData: Analysis | null) => {
    if (!analysisData) {
        toast({ title: "Download não disponível", description: "Nenhuma análise selecionada.", variant: "destructive" });
        return;
    }
    const reportText = formatStructuredReportToTxt(analysisData.structuredReport, analysisData.fileName);
    if (reportText === "Relatório estruturado não disponível.") {
      toast({ title: "Download não disponível", description: "O relatório estruturado está vazio ou não foi gerado.", variant: "destructive" });
      return;
    }
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(analysisData.title || analysisData.fileName).replace(/\.[^/.]+$/, "")}_relatorio_conformidade.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({title: "Download Iniciado", description: "O relatório estruturado está sendo baixado."});
  }, [toast]);

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
    startAiProcessing, // This now just queues for Firebase Function
    handleAddTag,
    handleRemoveTag,
    handleDeleteAnalysis,
    handleCancelAnalysis,
    downloadReportAsTxt,
    displayedAnalysisSteps,
  };
}
