
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { AppHeader, type HeaderTabValue } from '@/components/app-header';
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
    uploadProgress,
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

  const handleUploadResult = useCallback(async (result: FileUploadManagerResult) => {
    if (result.analysisId && !result.error && user && user.uid) {
      try {
        const analysisDocRef = doc(db, 'users', user.uid, 'analyses', result.analysisId);
        const docSnap = await getDoc(analysisDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const fetchedAnalysis: Analysis = {
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
          setViewState('analysis_view');
          if (fetchedAnalysis.status === 'identifying_regulations') {
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
      if (result.analysisId && user && user.uid) {
         setCurrentAnalysis({
            id: result.analysisId,
            userId: user.uid,
            fileName: result.fileName || "Desconhecido",
            status: 'error',
            progress: 0,
            uploadProgress: uploadProgress,
            errorMessage: result.error,
            tags: [],
            createdAt: new Date().toISOString(),
        });
      } else if (user && user.uid) {
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
      setViewState('analysis_view');
    }
  }, [user, setCurrentAnalysis, startAiProcessing, uploadProgress]);


  const handleStartUploadAndAnalyze = useCallback(async () => {
    if (!user) {
      router.replace('/login');
      return;
    }
    const result = await uploadFileAndCreateRecord(user);
    await handleUploadResult(result);
  }, [user, uploadFileAndCreateRecord, handleUploadResult, router]);
  

  useEffect(() => {
    if (currentAnalysis && viewState !== 'analysis_view') {
       if (currentAnalysis.status !== 'uploading' || currentAnalysis.powerQualityDataUrl) {
        setViewState('analysis_view');
       }
    }
  }, [currentAnalysis, viewState]);


  const navigateToDashboard = () => {
    setCurrentAnalysis(null);
    setViewState('dashboard');
  }
  const navigateToNewAnalysis = () => {
    setCurrentAnalysis(null);
    setViewState('new_analysis');
  };
  
  const navigateToPastAnalyses = useCallback(() => {
    setCurrentAnalysis(null); // Clear current analysis before fetching/navigating
    fetchPastAnalyses().then(() => {
      setViewState('past_analyses');
    });
  }, [fetchPastAnalyses, setCurrentAnalysis]);

  const viewAnalysisDetails = (analysis: Analysis) => {
    setCurrentAnalysis(analysis);
    // viewState will be updated by the useEffect monitoring currentAnalysis or explicitly if needed
    setViewState('analysis_view');
  };
  
  const afterDeleteAnalysis = () => {
    // If currentAnalysis was deleted and now it's null
    if (viewState === 'analysis_view' && !currentAnalysis) {
        navigateToPastAnalyses(); // Go back to list view after deleting the current one
    } else {
        fetchPastAnalyses(); // Or just refresh the list if a different one was deleted
    }
  };

  const handleTabChange = (tabValue: HeaderTabValue) => {
    setCurrentAnalysis(null); // Always clear current analysis when changing main tabs
    if (tabValue === 'past_analyses') {
      navigateToPastAnalyses();
    }
    // No other tabs to handle for now directly changing viewState,
    // navigation to dashboard is handled by AppHeader's onNavigateToDashboard prop
  };

  const getActiveTab = (): HeaderTabValue | undefined => {
    if (viewState === 'past_analyses' && !currentAnalysis) { // Only active if viewing the list
      return 'past_analyses';
    }
    return undefined;
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
      <AppHeader 
        activeTab={getActiveTab()} 
        onTabChange={handleTabChange} 
        onNavigateToDashboard={navigateToDashboard} 
      />
      <main className="flex-1 container mx-auto py-8 px-4">
        {viewState === 'dashboard' && (
          <DashboardView
            userName={user?.displayName}
            onStartNewAnalysis={navigateToNewAnalysis}
            isLoadingPastAnalyses={isLoadingPastAnalyses}
          />
        )}

        {viewState === 'new_analysis' && (
          <NewAnalysisForm
            fileToUpload={fileToUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onFileChange={handleFileSelection}
            onUploadAndAnalyze={handleStartUploadAndAnalyze}
            onCancel={navigateToDashboard}
          />
        )}

        {viewState === 'analysis_view' && currentAnalysis && (
          <AnalysisView
            analysis={currentAnalysis}
            analysisSteps={displayedAnalysisSteps}
            onDownloadReport={downloadReportAsTxt}
            tagInput={tagInput}
            onTagInputChange={setTagInput}
            onAddTag={(tag) => handleAddTag(currentAnalysis.id, tag)}
            onRemoveTag={(tag) => handleRemoveTag(currentAnalysis.id, tag)}
            onNavigateToDashboard={navigateToDashboard}
            onNavigateToPastAnalyses={navigateToPastAnalyses}
          />
        )}

        {viewState === 'past_analyses' && !currentAnalysis && ( // Ensure currentAnalysis is null to show list
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
