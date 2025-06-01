
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { processAnalysisFile, getPastAnalysesAction, addTagToAction, removeTagAction, deleteAnalysisAction } from '@/app/actions';

const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
  { name: 'Upload do Arquivo e Preparação' },
  { name: 'Identificando Resoluções ANEEL' },
  { name: 'Analisando Conformidade' },
  { name: 'Gerando Resultados' },
];

export function useAnalysisManager(user: User | null) {
  const { toast } = useToast();
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [pastAnalyses, setPastAnalyses] = useState<Analysis[]>([]);
  const [isLoadingPastAnalyses, setIsLoadingPastAnalyses] = useState(false);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (user && user.uid && typeof user.uid === 'string' && user.uid.trim() !== '' && currentAnalysis?.id && !currentAnalysis.id.startsWith('error-')) {
      console.log(`[useAnalysisManager_onSnapshot] Subscribing to analysis ID: ${currentAnalysis.id} for user UID: ${user.uid}. Current local status: ${currentAnalysis?.status}`);
      const analysisDocumentRef = doc(db, 'users', user.uid, 'analyses', currentAnalysis.id);
      
      try {
        unsub = onSnapshot(analysisDocumentRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              console.log(`[useAnalysisManager_onSnapshot] Snapshot for ${currentAnalysis.id}: Status: ${data.status}, Progress: ${data.progress}, ErrMsg: ${data.errorMessage}`);
              
              const validStatuses: Analysis['status'][] = ['uploading', 'identifying_regulations', 'assessing_compliance', 'completed', 'error', 'deleted'];
              const statusIsValid = data.status && validStatuses.includes(data.status as Analysis['status']);

              const updatedAnalysis: Analysis = {
                id: docSnap.id,
                userId: typeof data.userId === 'string' ? data.userId : user.uid,
                fileName: typeof data.fileName === 'string' ? data.fileName : currentAnalysis?.fileName || 'Nome de arquivo desconhecido',
                status: statusIsValid ? (data.status as Analysis['status']) : 'error',
                progress: typeof data.progress === 'number' ? data.progress : 0,
                uploadProgress: typeof data.uploadProgress === 'number' ? data.uploadProgress : undefined,
                powerQualityDataUrl: typeof data.powerQualityDataUrl === 'string' ? data.powerQualityDataUrl : undefined,
                identifiedRegulations: Array.isArray(data.identifiedRegulations) ? data.identifiedRegulations.map(String) : undefined,
                summary: typeof data.summary === 'string' ? data.summary : undefined,
                complianceReport: typeof data.complianceReport === 'string' ? data.complianceReport : undefined,
                errorMessage: statusIsValid ? (typeof data.errorMessage === 'string' ? data.errorMessage : undefined) : (data.errorMessage || 'Status inválido recebido do Firestore.'),
                tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
                createdAt: (data.createdAt instanceof Timestamp) ? data.createdAt.toDate().toISOString() : (currentAnalysis?.createdAt || new Date().toISOString()),
                completedAt: (data.completedAt instanceof Timestamp) ? data.completedAt.toDate().toISOString() : undefined,
              };
              setCurrentAnalysis(updatedAnalysis);
            } else {
              console.warn(`[useAnalysisManager_onSnapshot] Document ${currentAnalysis?.id} not found. Current local status: ${currentAnalysis?.status}.`);
              if (currentAnalysis && currentAnalysis.id && !currentAnalysis.id.startsWith('error-') && currentAnalysis.status !== 'deleted' && currentAnalysis.status !== 'error') {
                setCurrentAnalysis(prev => {
                  if (prev && prev.id === currentAnalysis.id && prev.status !== 'error' && prev.status !== 'deleted') {
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
              if (prev && currentAnalysis?.id && prev.id === currentAnalysis.id && !prev.id.startsWith('error-') && prev.status !== 'error') {
                return { ...prev, status: 'error', errorMessage: `Erro ao sincronizar com Firestore: ${error.message}` };
              }
              return prev;
            });
          }
        );
      } catch (e) {
        console.error("[useAnalysisManager_onSnapshot] Exception setting up onSnapshot:", e);
      }
    } else {
      // console.log(`[useAnalysisManager_onSnapshot] Conditions not met for subscription. User: ${!!user}, User UID: ${user?.uid}, CurrentAnalysis ID: ${currentAnalysis?.id}, IsErrorID: ${!!currentAnalysis?.id?.startsWith('error-')}`);
    }
    return () => {
      if (unsub) {
        console.log(`[useAnalysisManager_onSnapshot] Unsubscribing from analysis ID: ${currentAnalysis?.id}`);
        unsub();
      }
    };
  }, [user, currentAnalysis?.id, toast]); 


  const startAiProcessing = useCallback(async (analysisId: string, userIdFromCaller: string) => {
    console.log(`[useAnalysisManager_startAiProcessing] Calling server action processAnalysisFile for ID: ${analysisId}, UserID: ${userIdFromCaller}`);
    if (!userIdFromCaller || typeof userIdFromCaller !== 'string' || userIdFromCaller.trim() === '') {
        const msg = `[useAnalysisManager_startAiProcessing] CRITICAL: userIdFromCaller is invalid ('${userIdFromCaller}') for analysisId: ${analysisId}. Aborting.`;
        console.error(msg);
        toast({ title: 'Erro Crítico', description: 'ID de usuário inválido para processamento.', variant: 'destructive'});
        setCurrentAnalysis(prev => prev && prev.id === analysisId ? { ...prev, status: 'error', errorMessage: msg} : prev);
        return;
    }
    if (!analysisId || typeof analysisId !== 'string' || analysisId.trim() === '') {
      const msg = `[useAnalysisManager_startAiProcessing] CRITICAL: analysisId is invalid ('${analysisId}') for userId: ${userIdFromCaller}. Aborting.`;
      console.error(msg);
      toast({ title: 'Erro Crítico', description: 'ID da análise inválido para processamento.', variant: 'destructive'});
      setCurrentAnalysis(prev => prev && prev.id === analysisId ? { ...prev, status: 'error', errorMessage: msg} : prev);
      return;
    }
    try {
      await processAnalysisFile(analysisId, userIdFromCaller);
      console.log(`[useAnalysisManager_startAiProcessing] Server action processAnalysisFile finished or threw for ID: ${analysisId}`);
    } catch (processError) {
        const errorMsg = processError instanceof Error ? processError.message : String(processError);
        console.error(`[useAnalysisManager_startAiProcessing] Error calling processAnalysisFile for ${analysisId}:`, processError);
        setCurrentAnalysis(prev => {
            if (prev && prev.id === analysisId && prev.status !== 'error') {
                return { ...prev, status: 'error', errorMessage: `Falha ao iniciar processamento AI: ${errorMsg}`};
            }
            return prev;
        });
        toast({ title: 'Erro no Processamento', description: `Falha ao processar análise: ${errorMsg}`, variant: 'destructive'});
    }
  }, [toast]);


  const fetchPastAnalyses = useCallback(async () => {
    if (!user || !user.uid || typeof user.uid !== 'string' || user.uid.trim() === '') {
      console.warn('[useAnalysisManager_fetchPastAnalyses] No user or invalid user.uid, skipping fetch. User:', JSON.stringify(user));
      setPastAnalyses([]);
      setIsLoadingPastAnalyses(false); // Ensure loader is turned off
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
    if (!user || !user.uid || typeof user.uid !== 'string' || user.uid.trim() === '' || !tag.trim() || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === '') {
        console.warn('[useAnalysisManager_handleAddTag] Invalid parameters. User UID:', user?.uid, 'Tag:', tag, 'AnalysisId:', analysisId);
        toast({title: "Erro", description: "Não foi possível adicionar a tag devido a parâmetros inválidos.", variant: "destructive"});
        return;
    }
    const currentUserId = user.uid;
    try {
      await addTagToAction(currentUserId, analysisId, tag.trim());
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: [...new Set([...(a.tags || []), tag.trim()])]} : a));
      setTagInput('');
      toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleAddTag] Error adding tag to ${analysisId}:`, error);
      toast({ title: 'Erro ao adicionar tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast]);

  const handleRemoveTag = useCallback(async (analysisId: string, tagToRemove: string) => {
     if (!user || !user.uid || typeof user.uid !== 'string' || user.uid.trim() === '' || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === '' || !tagToRemove.trim()) {
        console.warn('[useAnalysisManager_handleRemoveTag] Invalid parameters. User UID:', user?.uid, 'TagToRemove:', tagToRemove, 'AnalysisId:', analysisId);
        toast({title: "Erro", description: "Não foi possível remover a tag devido a parâmetros inválidos.", variant: "destructive"});
        return;
    }
    const currentUserId = user.uid;
    try {
      await removeTagAction(currentUserId, analysisId, tagToRemove);
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: (a.tags || []).filter(t => t !== tagToRemove) } : a));
      toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleRemoveTag] Error removing tag from ${analysisId}:`, error);
      toast({ title: 'Erro ao remover tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast]);


  const handleDeleteAnalysis = useCallback(async (analysisId: string, onDeleted?: () => void) => {
    if (!user || !user.uid || typeof user.uid !== 'string' || user.uid.trim() === '' || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === '') {
        console.warn('[useAnalysisManager_handleDeleteAnalysis] Invalid parameters. User UID:', user?.uid, 'AnalysisId:', analysisId);
        toast({title: "Erro", description: "Não foi possível excluir a análise devido a parâmetros inválidos.", variant: "destructive"});
        return;
    }
    const currentUserId = user.uid;
    try {
      await deleteAnalysisAction(currentUserId, analysisId);
      setPastAnalyses(prev => prev.filter(a => a.id !== analysisId));
      if (currentAnalysis?.id === analysisId) {
        setCurrentAnalysis(null);
      }
      toast({ title: 'Análise excluída', description: 'A análise foi marcada como excluída.' });
      onDeleted?.();
    } catch (error) {
      console.error(`[useAnalysisManager_handleDeleteAnalysis] Error deleting analysis ${analysisId}:`, error);
      toast({ title: 'Erro ao excluir', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis?.id]);

  const downloadReportAsTxt = (reportText: string | undefined, fileName: string = "relatorio") => {
    if (!reportText) {
      toast({ title: "Download não disponível", description: "O relatório está vazio ou não foi gerado.", variant: "destructive" });
      return;
    }
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName.replace(/\.[^/.]+$/, "")}_relatorio_conformidade.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({title: "Download Iniciado", description: "O relatório está sendo baixado."});
  };

 const displayedAnalysisSteps = useMemo(() => {
    let steps: AnalysisStep[] = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0 }));

    if (!currentAnalysis || currentAnalysis.id.startsWith('error-')) {
        if (currentAnalysis && currentAnalysis.errorMessage) {
             steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: currentAnalysis.errorMessage, progress: currentAnalysis.uploadProgress ?? 0};
        } else {
             steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'pending', details: 'Aguardando início da análise ou configuração inicial.', progress: 0};
        }
        for (let i = 1; i < steps.length; i++) {
            steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
        }
        return steps;
    }

    const { status, progress, errorMessage, powerQualityDataUrl, identifiedRegulations, summary, uploadProgress } = currentAnalysis;
    
    const sanitizedOverallProgress = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0;

    if (powerQualityDataUrl || status === 'identifying_regulations' || status === 'assessing_compliance' || status === 'completed') {
      steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
    } else if (status === 'uploading') {
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: uploadProgress ?? 0 };
    } else if (status === 'error' && (!powerQualityDataUrl && !identifiedRegulations && !summary)) {
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: errorMessage, progress: uploadProgress ?? 0 };
    }

    if (status === 'identifying_regulations') {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: sanitizedOverallProgress };
    } else if (status === 'assessing_compliance' || status === 'completed') {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'completed', progress: 100 };
    } else if (status === 'error' && powerQualityDataUrl && (!identifiedRegulations && !summary)) {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'error', details: errorMessage, progress: sanitizedOverallProgress };
    }
    
    if (status === 'assessing_compliance') {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: sanitizedOverallProgress };
    } else if (status === 'completed') {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'completed', progress: 100 };
    } else if (status === 'error' && powerQualityDataUrl && identifiedRegulations && !summary) {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'error', details: errorMessage, progress: sanitizedOverallProgress };
    }

    if (status === 'completed') {
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 };
    } else if (status === 'error' && summary) {
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'error', details: errorMessage, progress: sanitizedOverallProgress };
    } else if (steps[0].status === 'completed' && steps[1].status === 'completed' && steps[2].status === 'completed' && status !== 'error') {
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'in_progress', progress: sanitizedOverallProgress };
    }
    
    if (status === 'error' && !steps.find(s => s.status === 'error')) {
        let errorAssigned = false;
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].status === 'in_progress' || steps[i].status === 'pending') {
                steps[i] = { ...steps[i], status: 'error', details: errorMessage, progress: steps[i].progress === 100 ? sanitizedOverallProgress : steps[i].progress };
                errorAssigned = true;
                break;
            }
        }
        if (!errorAssigned) {
            steps[steps.length -1] = { ...steps[steps.length-1], status: 'error', details: errorMessage, progress: sanitizedOverallProgress};
        }
    }
    return steps;
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
    downloadReportAsTxt,
    displayedAnalysisSteps,
  };
}

