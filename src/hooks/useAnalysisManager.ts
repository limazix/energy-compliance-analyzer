
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { processAnalysisFile, getPastAnalysesAction, addTagToAction, removeTagAction, deleteAnalysisAction, getAnalysisReportAction, cancelAnalysisAction } from '@/app/actions';
import type { AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report';

const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
  { name: 'Upload do Arquivo e Preparação' },
  { name: 'Sumarizando Dados da Qualidade de Energia' },
  { name: 'Identificando Resoluções ANEEL' },
  { name: 'Analisando Conformidade' },
  { name: 'Gerando Relatório Estruturado' }, 
];

// Helper para formatar o relatório estruturado para TXT
function formatStructuredReportToTxt(report: AnalyzeComplianceReportOutput | undefined, fileName: string): string {
  if (!report) return "Relatório estruturado não disponível.";

  let txt = `RELATÓRIO DE CONFORMIDADE DA QUALIDADE DE ENERGIA ELÉTRICA\n`;
  txt += `========================================================\n\n`;
  
  if (report.reportMetadata) {
    txt += `Título: ${report.reportMetadata.title || 'N/A'}\n`;
    if (report.reportMetadata.subtitle) txt += `Subtítulo: ${report.reportMetadata.subtitle}\n`;
    txt += `Autor: ${report.reportMetadata.author || 'N/A'}\n`;
    txt += `Data de Geração: ${report.reportMetadata.generatedDate || 'N/A'}\n`;
    txt += `Arquivo Analisado: ${fileName}\n\n`;
  }

  if (report.tableOfContents && report.tableOfContents.length > 0) {
    txt += `SUMÁRIO\n`;
    txt += `-------\n`;
    report.tableOfContents.forEach(item => {
      txt += `- ${item}\n`;
    });
    txt += `\n`;
  }

  if (report.introduction) {
    txt += `INTRODUÇÃO\n`;
    txt += `----------\n`;
    txt += `Objetivo: ${report.introduction.objective || 'N/A'}\n`;
    txt += `Resumo dos Resultados: ${report.introduction.overallResultsSummary || 'N/A'}\n`;
    txt += `Visão Geral das Normas Utilizadas: ${report.introduction.usedNormsOverview || 'N/A'}\n\n`;
  }

  if (report.analysisSections && report.analysisSections.length > 0) {
    report.analysisSections.forEach(section => {
      txt += `SEÇÃO: ${section.title.toUpperCase()}\n`;
      txt += `---------------------------------------------\n`;
      txt += `Conteúdo da Análise:\n${section.content || 'N/A'}\n\n`;
      if (section.insights && section.insights.length > 0) {
        txt += `Insights Chave:\n`;
        section.insights.forEach(insight => txt += `- ${insight}\n`);
        txt += `\n`;
      }
      if (section.relevantNormsCited && section.relevantNormsCited.length > 0) {
        txt += `Normas Citadas nesta Seção:\n`;
        section.relevantNormsCited.forEach(norm => txt += `- ${norm}\n`);
        txt += `\n`;
      }
      if (section.chartOrImageSuggestion) {
        txt += `Sugestão de Gráfico/Imagem:\n${section.chartOrImageSuggestion}\n\n`;
      }
    });
  }

  if (report.finalConsiderations) {
    txt += `CONSIDERAÇÕES FINAIS\n`;
    txt += `--------------------\n`;
    txt += `${report.finalConsiderations}\n\n`;
  }

  if (report.bibliography && report.bibliography.length > 0) {
    txt += `REFERÊNCIAS BIBLIOGRÁFICAS\n`;
    txt += `--------------------------\n`;
    report.bibliography.forEach(ref => {
      txt += `- ${ref.text}`;
      if (ref.link) txt += ` (Disponível em: ${ref.link})`;
      txt += `\n`;
    });
  }
  return txt;
}


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
              
              const validStatuses: Analysis['status'][] = ['uploading', 'summarizing_data', 'identifying_regulations', 'assessing_compliance', 'completed', 'error', 'deleted', 'cancelling', 'cancelled'];
              const statusIsValid = data.status && validStatuses.includes(data.status as Analysis['status']);

              const updatedAnalysis: Analysis = {
                id: docSnap.id,
                userId: typeof data.userId === 'string' ? data.userId : user.uid,
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
      // This is a fire-and-forget call from the client's perspective.
      // The server action runs, and the client relies on onSnapshot for updates.
      processAnalysisFile(analysisId, userIdFromCaller).then(result => {
        // Log the final result of the server action if needed, but UI updates primarily via onSnapshot
        console.log(`[useAnalysisManager_startAiProcessing] Server action processAnalysisFile completed for ID: ${analysisId}. Success: ${result.success}, Error: ${result.error}`);
        if (!result.success) {
            // onSnapshot should eventually reflect this error state from Firestore
            // Optionally, update local state immediately if Firestore update is slow or fails for the error
             setCurrentAnalysis(prev => {
                if (prev && prev.id === analysisId && prev.status !== 'error' && prev.status !== 'cancelled') {
                    return { ...prev, status: 'error', errorMessage: `Falha ao processar análise: ${result.error}`};
                }
                return prev;
            });
        }
      }).catch(networkOrUnexpectedError => {
        // This catch is if the call to processAnalysisFile itself fails (e.g., network issue, Next.js internal error before action runs)
        const errorMsg = networkOrUnexpectedError instanceof Error ? networkOrUnexpectedError.message : String(networkOrUnexpectedError);
        console.error(`[useAnalysisManager_startAiProcessing] Error calling processAnalysisFile for ${analysisId}:`, networkOrUnexpectedError);
        setCurrentAnalysis(prev => {
            if (prev && prev.id === analysisId && prev.status !== 'error' && prev.status !== 'cancelled') {
                return { ...prev, status: 'error', errorMessage: `Erro de comunicação: ${errorMsg}`};
            }
            return prev;
        });
        toast({ title: 'Erro de Comunicação', description: `Não foi possível iniciar o processamento: ${errorMsg}`, variant: 'destructive'});
      });
    } catch (e) {
        // Should not happen if processAnalysisFile().then().catch() is used, but as a safeguard
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error(`[useAnalysisManager_startAiProcessing] Unexpected synchronous error for ${analysisId}:`, e);
        setCurrentAnalysis(prev => {
            if (prev && prev.id === analysisId && prev.status !== 'error' && prev.status !== 'cancelled') {
                return { ...prev, status: 'error', errorMessage: `Erro inesperado: ${errorMsg}`};
            }
            return prev;
        });
        toast({ title: 'Erro Inesperado', description: `Ocorreu um erro inesperado: ${errorMsg}`, variant: 'destructive'});
    }
  }, [toast]);


  const fetchPastAnalyses = useCallback(async () => {
    if (!user || !user.uid || typeof user.uid !== 'string' || user.uid.trim() === '') {
      console.warn('[useAnalysisManager_fetchPastAnalyses] No user or invalid user.uid, skipping fetch. User:', JSON.stringify(user));
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
    if (!user || !user.uid || typeof user.uid !== 'string' || user.uid.trim() === '' || !tag.trim() || !analysisId || typeof analysisId !== 'string' || analysisId.trim() === '') {
        console.warn('[useAnalysisManager_handleAddTag] Invalid parameters. User UID:', user?.uid, 'Tag:', tag, 'AnalysisId:', analysisId);
        toast({title: "Erro", description: "Não foi possível adicionar a tag devido a parâmetros inválidos.", variant: "destructive"});
        return;
    }
    const currentUserId = user.uid;
    try {
      await addTagToAction(currentUserId, analysisId, tag.trim());
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: [...new Set([...(a.tags || []), tag.trim()])]} : a));
      if (currentAnalysis && currentAnalysis.id === analysisId) {
        setCurrentAnalysis(prev => prev ? {...prev, tags: [...new Set([...(prev.tags || []), tag.trim()])]} : null);
      }
      setTagInput('');
      toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleAddTag] Error adding tag to ${analysisId}:`, error);
      toast({ title: 'Erro ao adicionar tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis]);

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
      if (currentAnalysis && currentAnalysis.id === analysisId) {
        setCurrentAnalysis(prev => prev ? {...prev, tags: (prev.tags || []).filter(t => t !== tagToRemove)} : null);
      }
      toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleRemoveTag] Error removing tag from ${analysisId}:`, error);
      toast({ title: 'Erro ao remover tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis]);


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

  const handleCancelAnalysis = useCallback(async (analysisId: string) => {
    if (!user || !user.uid || !analysisId) {
      toast({ title: 'Erro', description: 'Não foi possível solicitar o cancelamento: dados inválidos.', variant: 'destructive' });
      return;
    }
    console.log(`[useAnalysisManager_handleCancel] Requesting cancellation for analysis ID: ${analysisId}`);
    try {
      const result = await cancelAnalysisAction(user.uid, analysisId);
      if (result.success) {
        toast({ title: 'Cancelamento Solicitado', description: 'A análise será interrompida em breve.' });
        // onSnapshot will update currentAnalysis to 'cancelling' then 'cancelled'
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
    let steps: AnalysisStep[] = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0 }));

    if (!currentAnalysis || currentAnalysis.id.startsWith('error-')) {
        const errorMsg = currentAnalysis?.errorMessage || 'Aguardando início da análise ou configuração inicial.';
        const uploadProg = Math.max(0, Math.min(100, currentAnalysis?.uploadProgress ?? 0));
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: currentAnalysis?.errorMessage ? 'error': 'pending', details: errorMsg, progress: uploadProg};
        for (let i = 1; i < steps.length; i++) {
            steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
        }
        return steps;
    }

    const { status, progress, errorMessage, powerQualityDataUrl, powerQualityDataSummary, identifiedRegulations, structuredReport, uploadProgress } = currentAnalysis;
    const overallProgress = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0;
    
    const markPreviousStepsCompleted = (currentIndex: number) => {
        for (let i = 0; i < currentIndex; i++) {
            steps[i] = { ...steps[i], status: 'completed', progress: 100 };
        }
    };
    const markFollowingStepsPending = (currentIndex: number) => {
        for (let i = currentIndex + 1; i < steps.length; i++) {
            steps[i] = { ...steps[i], status: 'pending', progress: 0 };
        }
    };
    
    const markAllStepsCancelled = (details?: string) => {
      steps.forEach((step, i) => {
        if (steps[i].status === 'completed') return; // Don't change already completed steps
        steps[i] = { ...steps[i], status: 'cancelled', details: i === 0 ? details : undefined, progress: steps[i].progress ?? 0 };
      });
    }

    if (status === 'cancelled') {
      markAllStepsCancelled(errorMessage || 'Análise cancelada.');
      return steps;
    }
    if (status === 'cancelling') {
      steps.forEach((step, i) => {
         if (steps[i].status === 'completed') return;
         steps[i] = { ...steps[i], status: 'pending', details: 'Cancelamento em andamento...', progress: steps[i].progress ?? 0 };
      });
       // Try to show the current in-progress step as 'cancelling' if possible
      if (steps[0].status !== 'completed' && (currentAnalysis.status === 'uploading' || (powerQualityDataUrl && currentAnalysis.status === 'summarizing_data')) ) steps[0].details = 'Cancelando...';
      else if (steps[1].status !== 'completed' && currentAnalysis.status === 'summarizing_data') steps[1].details = 'Cancelando...';
      else if (steps[2].status !== 'completed' && currentAnalysis.status === 'identifying_regulations') steps[2].details = 'Cancelando...';
      else if (steps[3].status !== 'completed' && currentAnalysis.status === 'assessing_compliance') steps[3].details = 'Cancelando...'; // This covers step 4 too
      else if (steps[4].status !== 'completed' && currentAnalysis.status === 'assessing_compliance') steps[4].details = 'Cancelando...';
      return steps;
    }


    switch (status) {
        case 'uploading':
            steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: Math.max(0, Math.min(100, uploadProgress ?? 0)) };
            markFollowingStepsPending(0);
            break;
        case 'summarizing_data':
            markPreviousStepsCompleted(1);
            steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: Math.max(0, Math.min(100, overallProgress -10)) }; // Progress relative to this phase
            markFollowingStepsPending(1);
            break;
        case 'identifying_regulations':
            markPreviousStepsCompleted(2);
            steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: Math.max(0, Math.min(100, overallProgress - 40)) };
            markFollowingStepsPending(2);
            break;
        case 'assessing_compliance': // This status covers two UI steps
            markPreviousStepsCompleted(3); // Summarizing and Identifying Regs are done
            steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 }; // Compliance analysis is done
            steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'in_progress', progress: Math.max(0, Math.min(100, overallProgress - 70)) }; // Report generation in progress
            markFollowingStepsPending(4);
            break;
        case 'completed':
            steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'completed', progress: 100 }));
            break;
        case 'error':
            // Find which step failed based on progress or available data
            if (!powerQualityDataUrl && overallProgress < 10) { // Error during upload or pre-summary
                steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, uploadProgress ?? 0))};
                markFollowingStepsPending(0);
            } else if (!powerQualityDataSummary && overallProgress < 40) { // Error during summarization
                markPreviousStepsCompleted(1);
                steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, overallProgress -10)) };
                markFollowingStepsPending(1);
            } else if (!identifiedRegulations && overallProgress < 70) { // Error during regulation identification
                markPreviousStepsCompleted(2);
                steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, overallProgress - 40)) };
                markFollowingStepsPending(2);
            } else if (!structuredReport && overallProgress < 100) { // Error during compliance assessment or report generation
                markPreviousStepsCompleted(3);
                 steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 }; // Assume compliance assessment part was okay if report gen failed
                steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, overallProgress - 70)) };
                markFollowingStepsPending(4);
            } else { // Generic error, mark all as error or last known step
                let errorAssigned = false;
                for (let i = steps.length - 1; i >= 0; i--) {
                     if (steps[i].status === 'in_progress' || (steps[i].status === 'pending' && (steps[i-1]?.status === 'completed' || i === 0 ))) {
                        steps[i] = { ...steps[i], status: 'error', details: errorMessage, progress: steps[i].progress ?? 0};
                        errorAssigned = true;
                        break;
                    }
                }
                 if (!errorAssigned && steps.length > 0) steps[steps.length -1] = { ...steps[steps.length-1], status: 'error', details: errorMessage, progress: steps[steps.length-1].progress ?? 0};
            }
            break;
        default: // Default to pending for all if status is unknown
             steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0, details: 'Status desconhecido' }));
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
    handleCancelAnalysis,
    downloadReportAsTxt,
    displayedAnalysisSteps,
  };
}

    
