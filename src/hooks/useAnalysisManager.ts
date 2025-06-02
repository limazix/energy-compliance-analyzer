
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, Timestamp, FirestoreError } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { processAnalysisFile, getPastAnalysesAction, addTagToAction, removeTagAction, deleteAnalysisAction, getAnalysisReportAction } from '@/app/actions';
import type { AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report';

const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
  { name: 'Upload do Arquivo e Preparação' },
  { name: 'Sumarizando Dados da Qualidade de Energia' },
  { name: 'Identificando Resoluções ANEEL' },
  { name: 'Analisando Conformidade' },
  { name: 'Gerando Relatório Estruturado' }, // Etapa final atualizada
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
              
              const validStatuses: Analysis['status'][] = ['uploading', 'summarizing_data', 'identifying_regulations', 'assessing_compliance', 'completed', 'error', 'deleted'];
              const statusIsValid = data.status && validStatuses.includes(data.status as Analysis['status']);

              const updatedAnalysis: Analysis = {
                id: docSnap.id,
                userId: typeof data.userId === 'string' ? data.userId : user.uid,
                fileName: typeof data.fileName === 'string' ? data.fileName : currentAnalysis?.fileName || 'Nome de arquivo desconhecido',
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
    link.download = `${analysisData.fileName.replace(/\.[^/.]+$/, "")}_relatorio_conformidade_estruturado.txt`;
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
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: currentAnalysis?.errorMessage ? 'error': 'pending', details: errorMsg, progress: Math.max(0, Math.min(100, currentAnalysis?.uploadProgress ?? 0))};
        for (let i = 1; i < steps.length; i++) {
            steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
        }
        return steps;
    }

    const { status, progress, errorMessage, powerQualityDataUrl, powerQualityDataSummary, identifiedRegulations, structuredReport, uploadProgress } = currentAnalysis;
    const overallProgress = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0;

    // Step 0: Upload and Preparation
    if (powerQualityDataUrl || ['summarizing_data', 'identifying_regulations', 'assessing_compliance', 'completed'].includes(status)) {
      steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
    } else if (status === 'uploading') {
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: Math.max(0, Math.min(100, uploadProgress ?? 0)) };
    } else if (status === 'error' && (!powerQualityDataUrl && !powerQualityDataSummary && !identifiedRegulations && !structuredReport)) {
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, uploadProgress ?? 0)) };
    }
    
    // Step 1: Summarizing Data
    if (status === 'summarizing_data') {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: overallProgress }; 
    } else if (['identifying_regulations', 'assessing_compliance', 'completed'].includes(status)) {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'completed', progress: 100 };
    } else if (status === 'error' && powerQualityDataUrl && (!powerQualityDataSummary && !identifiedRegulations && !structuredReport)) {
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'error', details: errorMessage, progress: overallProgress };
    }

    // Step 2: Identifying Regulations
    if (status === 'identifying_regulations') {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: overallProgress };
    } else if (['assessing_compliance', 'completed'].includes(status)) {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'completed', progress: 100 };
    } else if (status === 'error' && powerQualityDataSummary && (!identifiedRegulations && !structuredReport)) {
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'error', details: errorMessage, progress: overallProgress };
    }
    
    // Step 3: Assessing Compliance (antiga) / Step 4: Gerando Relatório Estruturado (nova final)
    if (status === 'assessing_compliance') { 
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 }; 
        steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'in_progress', progress: overallProgress }; 
    } else if (status === 'completed') {
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 };
        steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'completed', progress: 100 };
    } else if (status === 'error' && identifiedRegulations && !structuredReport) { // Erro ocorreu durante 'assessing_compliance' (geração do relatório)
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 }; // A etapa anterior (identificar regulações) foi ok
        steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'error', details: errorMessage, progress: overallProgress };
    } else if (status === 'error' && structuredReport) { // Erro ocorreu após gerar relatório, o que é menos provável mas coberto
        steps[3] = { ...BASE_ANALYSIS_STEPS[3], status: 'completed', progress: 100 };
        steps[4] = { ...BASE_ANALYSIS_STEPS[4], status: 'error', details: errorMessage, progress: overallProgress };
    }
    
    if (status === 'error' && !steps.find(s => s.status === 'error')) {
        let errorAssigned = false;
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].status === 'in_progress' || (steps[i].status === 'pending' && (steps[i-1]?.status === 'completed' || i === 0 ))) {
                const stepProgressBeforeError = typeof steps[i].progress === 'number' && steps[i].progress < 100 ? steps[i].progress : overallProgress;
                steps[i] = { ...steps[i], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, stepProgressBeforeError ?? 0)) };
                errorAssigned = true;
                break;
            }
        }
        if (!errorAssigned && steps.length > 0) {
            steps[steps.length -1] = { ...steps[steps.length-1], status: 'error', details: errorMessage, progress: Math.max(0, Math.min(100, overallProgress ?? 0))};
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

    