'use client';
import { useCallback, useEffect, useState } from 'react';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { AppHeader } from '@/components/app-header';
import { AnalysisView } from '@/components/features/analysis/AnalysisView';
import { NewAnalysisForm } from '@/components/features/analysis/NewAnalysisForm';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import {
  useFileUploadManager,
  type FileUploadManagerResult,
} from '@/features/file-upload/hooks/useFileUploadManager';
import { useAnalysisManager } from '@/hooks/useAnalysisManager';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';

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

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [showNewAnalysisForm, setShowNewAnalysisForm] = useState(false);
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

  const handleToggleNewAnalysisForm = () => {
    setShowNewAnalysisForm((prev) => !prev);
    if (!showNewAnalysisForm) {
      setExpandedAnalysisId(null);
      setCurrentAnalysis(null);
    }
  };

  const handleNavigateToDashboard = () => {
    setShowNewAnalysisForm(false);
    setExpandedAnalysisId(null);
    setCurrentAnalysis(null);
    fetchPastAnalyses();
  };

  const handleAccordionChange = (value: string | undefined) => {
    const newExpandedId = value || null;
    setExpandedAnalysisId(newExpandedId);
    if (newExpandedId) {
      const analysisToExpand = pastAnalyses.find((a) => a.id === newExpandedId);
      if (analysisToExpand) {
        setCurrentAnalysis(analysisToExpand);
      }
    } else {
      setCurrentAnalysis(null);
    }
    if (showNewAnalysisForm) setShowNewAnalysisForm(false);
  };

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
          <NewAnalysisForm
            fileToUpload={fileToUpload}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onFileChange={handleFileSelection}
            onUploadAndAnalyze={handleStartUploadAndAnalyze}
            onCancel={() => setShowNewAnalysisForm(false)}
          />
        ) : (
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
              {!isLoadingPastAnalyses && pastAnalyses.length === 0 && (
                <div className="py-10 text-center text-muted-foreground">
                  <Inbox className="mx-auto mb-4 h-12 w-12" />
                  <p className="text-lg">Nenhuma análise anterior encontrada.</p>
                  <p>Clique em &quot;Nova Análise&quot; para começar.</p>
                </div>
              )}
              {!isLoadingPastAnalyses && pastAnalyses.length > 0 && (
                <Accordion
                  type="single"
                  collapsible
                  value={expandedAnalysisId || undefined}
                  onValueChange={handleAccordionChange}
                  className="w-full"
                >
                  {pastAnalyses.map((analysisItem) => (
                    <AccordionItem
                      value={analysisItem.id}
                      key={analysisItem.id}
                      className="border-b"
                    >
                      <AccordionTrigger className="w-full px-2 py-4 text-left hover:bg-muted/50">
                        <div className="flex w-full flex-col md:flex-row md:items-center md:justify-between">
                          <span className="max-w-[200px] truncate font-medium text-foreground sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">
                            {analysisItem.title || analysisItem.fileName}
                          </span>
                          <div className="mt-1 flex flex-col text-sm text-muted-foreground md:mt-0 md:ml-4 md:flex-row md:items-center md:space-x-3 md:space-y-0">
                            <span>
                              {analysisItem.createdAt
                                ? format(
                                    new Date(analysisItem.createdAt as string),
                                    'dd/MM/yy HH:mm',
                                    { locale: ptBR }
                                  )
                                : 'Data N/A'}
                            </span>
                            <Badge
                              variant={getStatusBadgeVariant(analysisItem.status)}
                              className={`
                                ${analysisItem.status === 'completed' ? 'bg-green-600 text-white' : ''}
                                ${analysisItem.status === 'error' ? 'bg-red-600 text-white' : ''}
                                ${analysisItem.status === 'cancelled' || analysisItem.status === 'cancelling' || analysisItem.status === 'pending_deletion' ? 'bg-yellow-500 text-white' : ''}
                                ${analysisItem.status === 'reviewing_report' ? 'bg-blue-500 text-white' : ''}
                              `}
                            >
                              {getStatusLabel(analysisItem.status)}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="bg-background p-4">
                        {expandedAnalysisId === analysisItem.id &&
                        currentAnalysis &&
                        currentAnalysis.id === analysisItem.id ? (
                          <AnalysisView
                            analysis={currentAnalysis}
                            analysisSteps={displayedAnalysisSteps}
                            onDownloadReport={() => downloadReportAsTxt(currentAnalysis)}
                            tagInput={tagInput}
                            onTagInputChange={setTagInput}
                            onAddTag={(tag) => handleAddTag(currentAnalysis.id, tag)}
                            onRemoveTag={(tag) => handleRemoveTag(currentAnalysis.id, tag)}
                            onDeleteAnalysis={() =>
                              handleDeleteAnalysis(currentAnalysis.id, afterDeleteAnalysis)
                            }
                            onCancelAnalysis={() => handleCancelAnalysis(currentAnalysis.id)}
                          />
                        ) : expandedAnalysisId === analysisItem.id &&
                          analysisItem.status === 'error' &&
                          analysisItem.id.startsWith('error-') ? (
                          <Alert variant="destructive" className="mt-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Ocorreu um Erro</AlertTitle>
                            <AlertDescription>
                              Não foi possível carregar ou processar esta análise.
                              <br />
                              <strong>Detalhes:</strong>{' '}
                              {analysisItem.errorMessage || 'Erro desconhecido.'}
                            </AlertDescription>
                          </Alert>
                        ) : expandedAnalysisId === analysisItem.id ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" /> Carregando
                            detalhes...
                          </div>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <footer className="border-t border-border/50 bg-muted/20 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} EMA - Electric Magnitudes Analizer. Todos os direitos
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
