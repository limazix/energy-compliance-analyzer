'use client';
import { useCallback, useEffect, useState, lazy, Suspense } from 'react';

import { format } from 'date-fns'; // Keep date-fns import
import { ptBR } from 'date-fns/locale';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AppHeader } from '@/components/app-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import {
  useFileUploadManager,
  type FileUploadManagerResult,
} from '@/features/file-upload/hooks/useFileUploadManager';
import { useAnalysisManager } from '@/hooks/useAnalysisManager';
// Import AnalysesList
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

/**
 * Lazy load components for better performance.
 */
const NewAnalysisForm = lazy(() => import('@/components/features/analysis/NewAnalysisForm'));
const AnalysesList = lazy(() => import('@/components/features/analysis/AnalysesList'));
/**
 * Determines the appropriate badge variant based on the analysis status.
 * @param status The status of the analysis.
 * @returns The corresponding badge variant string.
 */
const getStatusBadgeVariant = (status: Analysis['status']) => {
  switch (status) {
    case 'completed':
      return 'default'; // Will be styled green by custom CSS
    case 'error':
      return 'destructive';
    case 'cancelled':
    case 'cancelling':
    case 'pending_deletion': // Added
      return 'outline'; // Will be styled yellow by custom CSS
    case 'reviewing_report':
      return 'default'; // Will be styled blue by custom CSS
    default:
      return 'secondary';
  }
};

/**
 * Returns a user-friendly label for the analysis status in Portuguese.
 * @param status The status of the analysis.
 * @returns The corresponding localized status label.
 */
const getStatusLabel = (status: Analysis['status']) => {
  switch (status) {
    case 'uploading':
      return 'Enviando';
    case 'summarizing_data':
      return 'Sumarizando Dados';
    case 'identifying_regulations':
      return 'Identificando Resoluções';
    case 'assessing_compliance':
      return 'Analisando Conformidade';
    case 'reviewing_report':
      return 'Revisando Relatório';
    case 'completed':
      return 'Concluída';
    case 'error':
      return 'Erro';
    case 'deleted':
      return 'Excluída';
    case 'cancelling':
      return 'Cancelando...';
    case 'cancelled':
      return 'Cancelada';
    case 'pending_deletion': // Added
      return 'Excluindo...';
    default:
      return status;
  }
};

/**
 * The main home page component. Handles user authentication, displays the new analysis form,
 * and renders the list of past analyses with pagination.
 * @returns The HomePage component.
 */
export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  /**
   * State variable to control the visibility of the New Analysis Form.
   */
  const [showNewAnalysisForm, setShowNewAnalysisForm] = useState(false);
  /**
   * State variable to control which analysis accordion item is expanded.
   * Stores the ID of the expanded analysis or null if none are expanded.
   */
  const [expandedAnalysisId, setExpandedAnalysisId] = useState<string | null>(null);
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
    analyses, // Renamed from pastAnalyses
    isLoadingMoreAnalyses, // Added
    hasMoreAnalyses, // Added
    isLoadingPastAnalyses,
    tagInput,
    setTagInput,
    fetchPastAnalyses,
    startAiProcessing,
    handleAddTag,
    handleRemoveTag,
    handleDeleteAnalysis,
    handleRetryAnalysis, // Added
    handleCancelAnalysis,
    downloadReportAsTxt,
    displayedAnalysisSteps,
  } = useAnalysisManager(user);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      fetchPastAnalyses();
    }
  }, [user, authLoading, router, fetchPastAnalyses]);

  const handleUploadResult = useCallback(
    async (result: FileUploadManagerResult) => {
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
              title: data.title,
              description: data.description,
              languageCode: data.languageCode,
              status: data.status,
              progress: data.progress,
              uploadProgress: data.uploadProgress,
              powerQualityDataUrl: data.powerQualityDataUrl,
              powerQualityDataSummary: data.powerQualityDataSummary,
              isDataChunked: data.isDataChunked,
              identifiedRegulations: data.identifiedRegulations,
              summary: data.summary,
              complianceReport: data.complianceReport,
              structuredReport: data.structuredReport,
              mdxReportStoragePath: data.mdxReportStoragePath,
              errorMessage: data.errorMessage,
              tags: data.tags || [],
              createdAt: data.createdAt.toDate().toISOString(),
              completedAt: data.completedAt ? data.completedAt.toDate().toISOString() : undefined,
            };
            setCurrentAnalysis(fetchedAnalysis);
            setExpandedAnalysisId(fetchedAnalysis.id);
            setShowNewAnalysisForm(false);
            await fetchPastAnalyses();
            if (
              fetchedAnalysis.status === 'summarizing_data' ||
              fetchedAnalysis.status === 'identifying_regulations' ||
              fetchedAnalysis.status === 'assessing_compliance' ||
              fetchedAnalysis.status === 'reviewing_report'
            ) {
              await startAiProcessing(result.analysisId, user.uid);
            }
          } else {
            // eslint-disable-next-line no-console
            console.error(
              `[HomePage_handleUploadResult] Document ${result.analysisId} not found after upload.`
            );
            setCurrentAnalysis({
              id: `error-fetch-${Date.now()}`,
              userId: user.uid,
              fileName: result.fileName || 'Desconhecido',
              title: result.title || result.fileName || 'Desconhecido',
              description: result.description || '',
              languageCode: result.languageCode || navigator.language || 'pt-BR',
              status: 'error',
              progress: 0,
              createdAt: new Date().toISOString(),
              tags: [],
              errorMessage: 'Falha ao buscar o documento da análise recém-criado após upload.',
            });
            setShowNewAnalysisForm(false);
            setExpandedAnalysisId(`error-fetch-${Date.now()}`);
          }
        } catch (fetchError) {
          // eslint-disable-next-line no-console
          console.error(
            `[HomePage_handleUploadResult] Error fetching document ${result.analysisId}:`,
            fetchError
          );
          setCurrentAnalysis({
            id: `error-fetch-catch-${Date.now()}`,
            userId: user.uid,
            fileName: result.fileName || 'Desconhecido',
            title: result.title || result.fileName || 'Desconhecido',
            description: result.description || '',
            languageCode: result.languageCode || navigator.language || 'pt-BR',
            status: 'error',
            progress: 0,
            createdAt: new Date().toISOString(),
            tags: [],
            errorMessage: 'Erro ao buscar detalhes da análise após upload.',
          });
          setShowNewAnalysisForm(false);
          setExpandedAnalysisId(`error-fetch-catch-${Date.now()}`);
        }
      } else if (result.error) {
        const errorAnalysisId = result.analysisId || `error-upload-${Date.now()}`;
        if (user && user.uid) {
          setCurrentAnalysis({
            id: errorAnalysisId,
            userId: user.uid,
            fileName: result.fileName || 'Desconhecido',
            title: result.title || result.fileName || 'Desconhecido',
            description: result.description || '',
            languageCode: result.languageCode || navigator.language || 'pt-BR',
            status: 'error',
            progress: 0,
            uploadProgress: uploadProgress,
            errorMessage: result.error,
            tags: [],
            createdAt: new Date().toISOString(),
          });
        }
        setShowNewAnalysisForm(false);
        setExpandedAnalysisId(errorAnalysisId);
      }
    },
    [user, setCurrentAnalysis, startAiProcessing, uploadProgress, fetchPastAnalyses]
  );

  const handleStartUploadAndAnalyze = useCallback(
    async (title: string, description: string) => {
      if (!user) {
        router.replace('/login');
        return;
      }
      const languageCode = navigator.language || 'pt-BR';
      const result = await uploadFileAndCreateRecord(user, title, description, languageCode);
      await handleUploadResult(result);
    },
    [user, uploadFileAndCreateRecord, handleUploadResult, router]
  );

  /**
   * Toggles the visibility of the New Analysis Form.
   * If showing the form, collapses any currently expanded analysis.
   * @param value The ID of the analysis item being expanded or undefined if collapsing.
   */
  const handleToggleNewAnalysisForm = () => {
    setShowNewAnalysisForm((prev) => !prev);
    if (!showNewAnalysisForm) {
      setExpandedAnalysisId(null);
      setCurrentAnalysis(null);
    }
  };

  const handleNavigateToDashboard = () => {
    /**
     * Resets the component state to show the list of past analyses
     * and fetches the initial list.
     */
    setShowNewAnalysisForm(false);
    setExpandedAnalysisId(null);
    setCurrentAnalysis(null);
    fetchPastAnalyses();
  };

  const handleAccordionChange = (value: string | undefined) => {
    /**
     * Handles the change in the Accordion component, updating the expanded analysis ID
     * and setting the current analysis for display in the AnalysisView.
     */
    const newExpandedId = value || null;
    setExpandedAnalysisId(newExpandedId);
    if (newExpandedId) {
      const analysisToExpand = analyses.find((a) => a.id === newExpandedId); // Use analyses state
      if (analysisToExpand) {
        setCurrentAnalysis(analysisToExpand);
      }
    } else {
      setCurrentAnalysis(null);
    }
    if (showNewAnalysisForm) setShowNewAnalysisForm(false);
  };

  /**
   * Callback function executed after an analysis is successfully deleted.
   * Refreshes the list of past analyses and collapses any expanded items.
   */
  const afterDeleteAnalysis = async () => {
    await fetchPastAnalyses(); // Await the fetchPastAnalyses call
    setExpandedAnalysisId(null);
    setCurrentAnalysis(null);
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
        onStartNewAnalysis={handleToggleNewAnalysisForm}
        onNavigateToDashboard={handleNavigateToDashboard}
      />
      <main className="container mx-auto flex-1 px-4 py-8">
        {showNewAnalysisForm ? (
          // Wrap the NewAnalysisForm with Suspense
          <Suspense fallback={<div>Carregando formulário...</div>}>
            <NewAnalysisForm
              fileToUpload={fileToUpload}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              uploadError={uploadError}
              onFileChange={handleFileSelection}
              onUploadAndAnalyze={handleStartUploadAndAnalyze}
              onCancel={() => setShowNewAnalysisForm(false)}
            />
          </Suspense>
        ) : (
          // Wrap the Card (containing AnalysesList) with Suspense
          <Suspense fallback={<div>Carregando lista de análises...</div>}>
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-headline text-primary">
                  Suas Análises Anteriores
                </CardTitle>
                <CardDescription>
                  Veja o histórico de suas análises ou inicie uma nova no botão acima.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPastAnalyses && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  </div>
                )}
                {!isLoadingPastAnalyses && analyses.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground">
                    <Inbox className="mx-auto mb-4 h-12 w-12" />
                    <p className="text-lg">Nenhuma análise anterior encontrada.</p>
                    <p>Clique em &quot;Nova Análise&quot; para começar.</p>
                  </div>
                )}
                {!isLoadingPastAnalyses && analyses.length > 0 && (
                  // Render AnalysesList component
                  <AnalysesList
                    analyses={analyses}
                    expandedAnalysisId={expandedAnalysisId}
                    currentAnalysis={currentAnalysis}
                    displayedAnalysisSteps={displayedAnalysisSteps}
                    tagInput={tagInput}
                    onAccordionChange={handleAccordionChange}
                    onDownloadReport={downloadReportAsTxt}
                    onTagInputChange={setTagInput}
                    onAddTag={handleAddTag}
                    onRemoveTag={handleRemoveTag}
                    onDeleteAnalysis={handleDeleteAnalysis}
                    afterDeleteAnalysis={afterDeleteAnalysis}
                    onCancelAnalysis={handleCancelAnalysis}
                    onRetryAnalysis={handleRetryAnalysis}
                    getStatusBadgeVariant={getStatusBadgeVariant} // Pass helper function
                    getStatusLabel={getStatusLabel} // Pass helper function
                  />
                )}
                {/* Load More Button */}
                {hasMoreAnalyses && !isLoadingPastAnalyses && (
                  <div className="flex justify-center py-4">
                    <Button
                      onClick={() => fetchPastAnalyses(true)}
                      disabled={isLoadingMoreAnalyses}
                      variant="outline"
                    >
                      {isLoadingMoreAnalyses ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Carregar Mais Análises
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </Suspense>
        )}
      </main>
      <footer className="border-t border-border/50 bg-muted/20 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} EMA - Electric Magnitudes Analyzer. Todos os direitos
        reservados.
        <div className="mt-1">
          <Link href="/privacy-policy" className="hover:underline">
            Política de Privacidade
          </Link>
          {' | '}
          <Link href="/terms-of-service" className="hover:underline">
            Termos de Serviço
          </Link>
        </div>
      </footer>
    </div>
  );
}
