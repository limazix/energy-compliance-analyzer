
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { useAuth } from '@/contexts/auth-context';
import { useAnalysisManager } from '@/hooks/useAnalysisManager';

import { DashboardView } from '@/components/features/dashboard/DashboardView';
import { NewAnalysisForm } from '@/components/features/analysis/NewAnalysisForm';
import { AnalysisView } from '@/components/features/analysis/AnalysisView';
import { PastAnalysesView } from '@/components/features/past-analyses/PastAnalysesView';
import type { Analysis } from '@/types/analysis';


type ViewState = 'dashboard' | 'new_analysis' | 'analysis_view' | 'past_analyses';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>('dashboard');

  const {
    currentAnalysis,
    setCurrentAnalysis,
    pastAnalyses,
    isLoadingPastAnalyses,
    fileToUpload,
    isUploading,
    tagInput,
    setTagInput,
    handleFileChange,
    handleUploadAndAnalyze,
    fetchPastAnalyses,
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

  // Navigate to analysis view when currentAnalysis is set (e.g., after upload starts or selecting past analysis)
  useEffect(() => {
    if (currentAnalysis && (viewState === 'new_analysis' || viewState === 'past_analyses')) {
      // Check if it's a new upload that just started or an existing analysis being viewed
      if (currentAnalysis.status === 'uploading' || currentAnalysis.status === 'identifying_regulations' || currentAnalysis.status === 'assessing_compliance' || currentAnalysis.status === 'completed' || currentAnalysis.status === 'error') {
         setViewState('analysis_view');
      }
    }
  }, [currentAnalysis, viewState]);


  const navigateToDashboard = () => setViewState('dashboard');
  const navigateToNewAnalysis = () => {
    setCurrentAnalysis(null); // Clear any previous analysis
    setViewState('new_analysis');
  };
  
  const handleStartUploadAndAnalyze = useCallback(async () => {
    await handleUploadAndAnalyze(() => {
      // This callback is called on successful start of upload process (after Firestore doc is created)
      // The useEffect above will then navigate to 'analysis_view' when currentAnalysis is updated by onSnapshot
    });
  }, [handleUploadAndAnalyze]);


  const navigateToPastAnalyses = useCallback(() => {
    fetchPastAnalyses().then(() => {
      setViewState('past_analyses');
    });
  }, [fetchPastAnalyses]);

  const viewAnalysisDetails = (analysis: Analysis) => {
    setCurrentAnalysis(analysis);
    setViewState('analysis_view');
  };
  
  const afterDeleteAnalysis = () => {
    // If current view is analysis_view and that analysis was deleted, go to dashboard
    if (viewState === 'analysis_view' && !currentAnalysis) {
        navigateToDashboard();
    }
    // If viewing past analyses and one is deleted, pastAnalyses state is already updated by the hook
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
            onFileChange={handleFileChange}
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
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
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

    