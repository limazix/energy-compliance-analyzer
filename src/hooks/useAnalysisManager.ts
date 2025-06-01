
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { processAnalysisFile, getPastAnalysesAction, addTagToAction, removeTagAction, deleteAnalysisAction } from '@/app/actions';

const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
  { name: 'Upload do Arquivo e Preparação' }, // Ajustado para refletir que o upload é gerenciado externamente
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

  // Efeito para ouvir mudanças no documento da análise ATUAL via onSnapshot
  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (user && user.uid && currentAnalysis?.id && !currentAnalysis.id.startsWith('error-')) {
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
              // Apenas atualiza para erro se não for um erro já e se o documento deveria existir
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
      console.log(`[useAnalysisManager_onSnapshot] Conditions not met for subscription. User: ${!!user}, User UID: ${user?.uid}, CurrentAnalysis ID: ${currentAnalysis?.id}, IsErrorID: ${!!currentAnalysis?.id?.startsWith('error-')}`);
    }
    return () => {
      if (unsub) {
        console.log(`[useAnalysisManager_onSnapshot] Unsubscribing from analysis ID: ${currentAnalysis?.id}`);
        unsub();
      }
    };
  }, [user, currentAnalysis?.id]); // Depende apenas de user e currentAnalysis.id


  // Função para iniciar o processamento AI (chamada após o upload ser bem-sucedido)
  const startAiProcessing = useCallback(async (analysisId: string, userId: string) => {
    console.log(`[useAnalysisManager_startAiProcessing] Calling server action processAnalysisFile for ID: ${analysisId}, UserID: ${userId}`);
    if (!analysisId || !userId) {
      console.error('[useAnalysisManager_startAiProcessing] Analysis ID or User ID is missing.');
      setCurrentAnalysis(prev => prev && prev.id === analysisId ? { ...prev, status: 'error', errorMessage: 'ID da análise ou usuário ausente para iniciar processamento.'} : prev);
      return;
    }
    try {
      // A action processAnalysisFile atualizará o status no Firestore, e o onSnapshot pegará.
      await processAnalysisFile(analysisId, userId);
      console.log(`[useAnalysisManager_startAiProcessing] Server action processAnalysisFile finished or threw for ID: ${analysisId}`);
    } catch (processError) {
        const errorMsg = processError instanceof Error ? processError.message : String(processError);
        console.error(`[useAnalysisManager_startAiProcessing] Error calling processAnalysisFile for ${analysisId}:`, processError);
        // O erro idealmente já foi tratado e logado pela action, e o status 'error' definido no Firestore.
        // O onSnapshot deve pegar essa mudança. Se não, podemos forçar uma atualização aqui, mas é arriscado (pode sobrescrever um erro mais específico da action).
        // Apenas para garantir que a UI reflita um erro se a action falhar silenciosamente ou não atualizar o Firestore:
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
    if (!user || !user.uid) {
      console.log('[useAnalysisManager_fetchPastAnalyses] No user or user.uid, skipping fetch.');
      setPastAnalyses([]); // Limpa análises se o usuário deslogar
      return;
    }
    setIsLoadingPastAnalyses(true);
    console.log(`[useAnalysisManager_fetchPastAnalyses] Fetching for user: ${user.uid}`);
    try {
      const analyses = await getPastAnalysesAction(user.uid);
      setPastAnalyses(analyses.filter(a => a.status !== 'deleted'));
    } catch (error) {
      console.error('[useAnalysisManager_fetchPastAnalyses] Error fetching:', error);
      toast({ title: 'Erro ao buscar análises', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    } finally {
      setIsLoadingPastAnalyses(false);
    }
  }, [user, toast]);

  const handleAddTag = useCallback(async (analysisId: string, tag: string) => {
    if (!user || !user.uid || !tag.trim() || !analysisId) return;
    const currentUserId = user.uid;
    try {
      await addTagToAction(currentUserId, analysisId, tag.trim());
      // Atualizações de estado serão tratadas pelo onSnapshot se for currentAnalysis,
      // ou manualmente para pastAnalyses.
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: [...new Set([...(a.tags || []), tag.trim()])]} : a));
      if (currentAnalysis && currentAnalysis.id === analysisId) {
        // Deixar onSnapshot atualizar ou forçar aqui? Por ora, onSnapshot.
      }
      setTagInput('');
      toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleAddTag] Error adding tag to ${analysisId}:`, error);
      toast({ title: 'Erro ao adicionar tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis]);

  const handleRemoveTag = useCallback(async (analysisId: string, tagToRemove: string) => {
    if (!user || !user.uid || !analysisId) return;
    const currentUserId = user.uid;
    try {
      await removeTagAction(currentUserId, analysisId, tagToRemove);
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: (a.tags || []).filter(t => t !== tagToRemove) } : a));
      if (currentAnalysis && currentAnalysis.id === analysisId) {
        // Deixar onSnapshot atualizar.
      }
      toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleRemoveTag] Error removing tag from ${analysisId}:`, error);
      toast({ title: 'Erro ao remover tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis]);


  const handleDeleteAnalysis = useCallback(async (analysisId: string, onDeleted?: () => void) => {
    if (!user || !user.uid || !analysisId) return;
    const currentUserId = user.uid;
    try {
      await deleteAnalysisAction(currentUserId, analysisId);
      setPastAnalyses(prev => prev.filter(a => a.id !== analysisId)); // Remove da lista local
      if (currentAnalysis?.id === analysisId) {
        setCurrentAnalysis(null); // Limpa se for a análise atual
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
        // As etapas subsequentes permanecem pendentes se a primeira falhar ou estiver pendente
        for (let i = 1; i < steps.length; i++) {
            steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
        }
        return steps;
    }

    const { status, progress, errorMessage, powerQualityDataUrl, identifiedRegulations, summary, uploadProgress } = currentAnalysis;
    
    const sanitizedOverallProgress = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0;

    // Etapa 0: Upload e Preparação
    if (powerQualityDataUrl || status === 'identifying_regulations' || status === 'assessing_compliance' || status === 'completed') {
      steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
    } else if (status === 'uploading') { // Este status agora significa que o upload está em andamento OU o registro inicial foi criado
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: uploadProgress ?? 0 };
    } else if (status === 'error' && (!powerQualityDataUrl && !identifiedRegulations && !summary)) { // Erro durante o upload/preparação
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: errorMessage, progress: uploadProgress ?? 0 };
    }


    // Etapa 1: Identificando Resoluções
    if (status === 'identifying_regulations') {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: sanitizedOverallProgress };
    } else if (status === 'assessing_compliance' || status === 'completed') {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'completed', progress: 100 };
    } else if (status === 'error' && powerQualityDataUrl && (!identifiedRegulations && !summary)) { // Erro nesta etapa
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'error', details: errorMessage, progress: sanitizedOverallProgress };
    }
    
    // Etapa 2: Analisando Conformidade
    if (status === 'assessing_compliance') {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: sanitizedOverallProgress };
    } else if (status === 'completed') {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'completed', progress: 100 };
    } else if (status === 'error' && powerQualityDataUrl && identifiedRegulations && !summary) { // Erro nesta etapa
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'error', details: errorMessage, progress: sanitizedOverallProgress };
    }

    // Etapa 3: Gerando Resultados (Considerada em progresso se as anteriores estiverem completas mas a análise geral não)
    // Ou completa se a análise geral estiver completa.
    if (status === 'completed') {
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 };
    } else if (status === 'error' && summary) { // Erro na etapa final ou após ter sumário
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'error', details: errorMessage, progress: sanitizedOverallProgress };
    } else if (steps[0].status === 'completed' && steps[1].status === 'completed' && steps[2].status === 'completed' && status !== 'error') {
        // Se as etapas anteriores estão completas, mas o status geral ainda não é 'completed', esta está em progresso.
        // Isso cobre o caso onde o 'completedAt' ainda não foi setado.
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'in_progress', progress: sanitizedOverallProgress };
    }
    
    // Se o status geral for erro, e não foi capturado por uma etapa específica, a última etapa em progresso ou pendente mostra o erro.
    if (status === 'error' && !steps.find(s => s.status === 'error')) {
        let errorAssigned = false;
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].status === 'in_progress' || steps[i].status === 'pending') {
                steps[i] = { ...steps[i], status: 'error', details: errorMessage, progress: steps[i].progress === 100 ? sanitizedOverallProgress : steps[i].progress };
                errorAssigned = true;
                break;
            }
        }
        if (!errorAssigned) { // Se todas já estavam 'completed', mas o status geral é erro (improvável mas seguro)
            steps[steps.length -1] = { ...steps[steps.length-1], status: 'error', details: errorMessage, progress: sanitizedOverallProgress};
        }
    }


    return steps;
  }, [currentAnalysis]);


  return {
    currentAnalysis,
    setCurrentAnalysis, // Permite que a HomePage defina a análise após o upload
    pastAnalyses,
    isLoadingPastAnalyses,
    tagInput,
    setTagInput,
    fetchPastAnalyses, // Para carregar análises passadas
    startAiProcessing, // Para iniciar o processamento AI após o upload
    handleAddTag,
    handleRemoveTag,
    handleDeleteAnalysis,
    downloadReportAsTxt,
    displayedAnalysisSteps,
  };
}

