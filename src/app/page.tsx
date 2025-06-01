
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { useAuth } from '@/contexts/auth-context';
import { useFileUploadManager, type FileUploadManagerResult } from '@/features/file-upload/hooks/useFileUploadManager';
import { useAnalysisManager } from '@/hooks/useAnalysisManager';

import { DashboardView } from '@/components/features/dashboard/DashboardView';
import { NewAnalysisForm } from '@/components/features/analysis/NewAnalysisForm';
import { AnalysisView } from '@/components/features/analysis/AnalysisView';
import { PastAnalysesView } from '@/components/features/past-analyses/PastAnalysesView';
import type { Analysis } from '@/types/analysis';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';


type ViewState = 'dashboard' | 'new_analysis' | 'analysis_view' | 'past_analyses';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>('dashboard');

  const {
    fileToUpload,
    isUploading,
    uploadProgress, // Progresso do upload do arquivo
    uploadError,
    handleFileSelection,
    uploadFileAndCreateRecord,
  } = useFileUploadManager();

  const {
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
  } = useAnalysisManager(user);


  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Observa o resultado do upload e inicia o processamento AI se necessário
  const handleUploadResult = useCallback(async (result: FileUploadManagerResult) => {
    if (result.analysisId && !result.error && user && user.uid) {
      // Upload e criação do registro foram bem-sucedidos.
      // Buscar o documento completo para definir currentAnalysis.
      try {
        const analysisDocRef = doc(db, 'users', user.uid, 'analyses', result.analysisId);
        const docSnap = await getDoc(analysisDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const fetchedAnalysis: Analysis = { // Construir o objeto Analysis
            id: docSnap.id,
            userId: data.userId,
            fileName: data.fileName,
            status: data.status,
            progress: data.progress,
            uploadProgress: data.uploadProgress,
            powerQualityDataUrl: data.powerQualityDataUrl,
            identifiedRegulations: data.identifiedRegulations,
            summary: data.summary,
            complianceReport: data.complianceReport,
            errorMessage: data.errorMessage,
            tags: data.tags || [],
            createdAt: data.createdAt.toDate().toISOString(),
            completedAt: data.completedAt ? data.completedAt.toDate().toISOString() : undefined,
          };
          setCurrentAnalysis(fetchedAnalysis);
          setViewState('analysis_view'); // Navega para a visualização da análise
          // Inicia o processamento AI
          if (fetchedAnalysis.status === 'identifying_regulations') { // Ou o status que indica pronto para processar
             await startAiProcessing(result.analysisId, user.uid);
          }
        } else {
          console.error(`[HomePage_handleUploadResult] Document ${result.analysisId} not found after upload.`);
           setCurrentAnalysis({
            id: `error-fetch-${Date.now()}`, userId: user.uid, fileName: result.fileName || "Desconhecido",
            status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
            errorMessage: 'Falha ao buscar o documento da análise recém-criado após upload.'
           });
           setViewState('analysis_view');
        }
      } catch (fetchError) {
        console.error(`[HomePage_handleUploadResult] Error fetching document ${result.analysisId}:`, fetchError);
         setCurrentAnalysis({
            id: `error-fetch-catch-${Date.now()}`, userId: user.uid, fileName: result.fileName || "Desconhecido",
            status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
            errorMessage: 'Erro ao buscar detalhes da análise após upload.'
           });
        setViewState('analysis_view');
      }
    } else if (result.error) {
      // Erro durante o upload, currentAnalysis pode precisar ser definido para um estado de erro se um ID foi criado
      if (result.analysisId && user && user.uid) {
         setCurrentAnalysis({
            id: result.analysisId, // usa o ID que pode ter sido criado
            userId: user.uid,
            fileName: result.fileName || "Desconhecido",
            status: 'error',
            progress: 0,
            uploadProgress: uploadProgress, // usa o progresso atual do upload
            errorMessage: result.error,
            tags: [],
            createdAt: new Date().toISOString(),
        });
      } else if (user && user.uid) { // Nenhum ID foi criado, mas houve um erro de upload
         setCurrentAnalysis({
            id: `error-upload-${Date.now()}`,
            userId: user.uid,
            fileName: result.fileName || "Desconhecido",
            status: 'error',
            progress: 0,
            uploadProgress: uploadProgress,
            errorMessage: result.error,
            tags: [],
            createdAt: new Date().toISOString(),
        });
      }
      setViewState('analysis_view'); // Mostra a view de análise com o erro
    }
  }, [user, setCurrentAnalysis, startAiProcessing, uploadProgress]);


  const handleStartUploadAndAnalyze = useCallback(async () => {
    if (!user) {
      // Deveria ser pego antes, mas como segurança
      router.replace('/login');
      return;
    }
    // setCurrentAnalysis(null); // Limpa análise anterior antes de iniciar uma nova
    const result = await uploadFileAndCreateRecord(user);
    await handleUploadResult(result);
  }, [user, uploadFileAndCreateRecord, handleUploadResult, router]);
  

  // Efeito para mudar para 'analysis_view' quando currentAnalysis é definido ou atualizado
  // (e não é um estado inicial de "nova análise")
  useEffect(() => {
    if (currentAnalysis && viewState !== 'analysis_view') {
       // Se currentAnalysis existe e não estamos já na view de análise, navega para lá.
       // Isso cobre casos onde currentAnalysis é setado por selecionar uma análise passada,
       // ou após o upload iniciar (que agora acontece via handleUploadResult).
       if (currentAnalysis.status !== 'uploading' || currentAnalysis.powerQualityDataUrl) { // Evita transição se ainda estiver no meio do upload inicial
        setViewState('analysis_view');
       }
    }
  }, [currentAnalysis, viewState]);


  const navigateToDashboard = () => {
    setCurrentAnalysis(null);
    setViewState('dashboard');
  }
  const navigateToNewAnalysis = () => {
    setCurrentAnalysis(null); // Limpa qualquer análise anterior
    setViewState('new_analysis');
  };
  

  const navigateToPastAnalyses = useCallback(() => {
    fetchPastAnalyses().then(() => {
      setViewState('past_analyses');
    });
  }, [fetchPastAnalyses]);

  const viewAnalysisDetails = (analysis: Analysis) => {
    setCurrentAnalysis(analysis); // Isso acionará o useEffect acima para mudar a view
  };
  
  const afterDeleteAnalysis = () => {
    if (viewState === 'analysis_view' && !currentAnalysis) { // Se a análise atual foi deletada
        navigateToDashboard();
    }
    // Se estiver em past_analyses, a lista já foi atualizada pelo hook.
  };


  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <AppHeader />
      <main className="flex-1 container mx-auto py-8 px-4">
        {viewState === 'dashboard' && (
          <DashboardView
            userName={user?.displayName}
            onStartNewAnalysis={navigateToNewAnalysis}
            onViewPastAnalyses={navigateToPastAnalyses}
            isLoadingPastAnalyses={isLoadingPastAnalyses}
          />
        )}

        {viewState === 'new_analysis' && (
          <NewAnalysisForm
            fileToUpload={fileToUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress} // Passa o progresso do upload
            uploadError={uploadError} // Passa o erro do upload
            onFileChange={handleFileSelection}
            onUploadAndAnalyze={handleStartUploadAndAnalyze}
            onCancel={navigateToDashboard}
          />
        )}

        {viewState === 'analysis_view' && currentAnalysis && (
          <AnalysisView
            analysis={currentAnalysis}
            analysisSteps={displayedAnalysisSteps} // Usa as etapas do useAnalysisManager
            onDownloadReport={downloadReportAsTxt}
            tagInput={tagInput}
            onTagInputChange={setTagInput}
            onAddTag={(tag) => handleAddTag(currentAnalysis.id, tag)}
            onRemoveTag={(tag) => handleRemoveTag(currentAnalysis.id, tag)}
            onStartNewAnalysis={navigateToNewAnalysis}
            onViewPastAnalyses={navigateToPastAnalyses}
          />
        )}

        {viewState === 'past_analyses' && (
          <PastAnalysesView
            analyses={pastAnalyses}
            isLoading={isLoadingPastAnalyses}
            onViewDetails={viewAnalysisDetails}
            onDeleteAnalysis={(id) => handleDeleteAnalysis(id, afterDeleteAnalysis)}
            onBackToDashboard={navigateToDashboard}
          />
        )}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
      </footer>
    </div>
  );
}
