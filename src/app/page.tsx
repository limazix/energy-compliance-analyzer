
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Inbox, AlertTriangle } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { useAuth } from '@/contexts/auth-context';
import { useFileUploadManager, type FileUploadManagerResult } from '@/features/file-upload/hooks/useFileUploadManager';
import { useAnalysisManager } from '@/hooks/useAnalysisManager';

import { NewAnalysisForm } from '@/components/features/analysis/NewAnalysisForm';
import { AnalysisView } from '@/components/features/analysis/AnalysisView';
import type { Analysis } from '@/types/analysis';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';


const getStatusBadgeVariant = (status: Analysis['status']) => {
  switch (status) {
    case 'completed': return 'default'; 
    case 'error': return 'destructive';
    case 'cancelled': return 'outline';
    case 'cancelling': return 'outline';
    case 'reviewing_report': return 'secondary';
    default: return 'secondary';
  }
};

const getStatusLabel = (status: Analysis['status']) => {
  switch (status) {
    case 'uploading': return 'Enviando';
    case 'summarizing_data': return 'Sumarizando Dados';
    case 'identifying_regulations': return 'Identificando Resoluções';
    case 'assessing_compliance': return 'Analisando Conformidade';
    case 'reviewing_report': return 'Revisando Relatório';
    case 'completed': return 'Concluída';
    case 'error': return 'Erro';
    case 'deleted': return 'Excluída';
    case 'cancelling': return 'Cancelando...';
    case 'cancelled': return 'Cancelada';
    default: return status;
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
          if (fetchedAnalysis.status === 'summarizing_data' || fetchedAnalysis.status === 'identifying_regulations' || fetchedAnalysis.status === 'assessing_compliance' || fetchedAnalysis.status === 'reviewing_report') {
             await startAiProcessing(result.analysisId, user.uid);
          }
        } else {
          console.error(`[HomePage_handleUploadResult] Document ${result.analysisId} not found after upload.`);
           setCurrentAnalysis({
            id: `error-fetch-${Date.now()}`, userId: user.uid, fileName: result.fileName || "Desconhecido",
            title: result.title || result.fileName || "Desconhecido", description: result.description || "",
            languageCode: result.languageCode || navigator.language || 'pt-BR',
            status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
            errorMessage: 'Falha ao buscar o documento da análise recém-criado após upload.'
           });
           setShowNewAnalysisForm(false); 
           setExpandedAnalysisId(`error-fetch-${Date.now()}`);
        }
      } catch (fetchError) {
        console.error(`[HomePage_handleUploadResult] Error fetching document ${result.analysisId}:`, fetchError);
         setCurrentAnalysis({
            id: `error-fetch-catch-${Date.now()}`, userId: user.uid, fileName: result.fileName || "Desconhecido",
            title: result.title || result.fileName || "Desconhecido", description: result.description || "",
            languageCode: result.languageCode || navigator.language || 'pt-BR',
            status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
            errorMessage: 'Erro ao buscar detalhes da análise após upload.'
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
            fileName: result.fileName || "Desconhecido",
            title: result.title || result.fileName || "Desconhecido",
            description: result.description || "",
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
  }, [user, setCurrentAnalysis, startAiProcessing, uploadProgress, fetchPastAnalyses]);


  const handleStartUploadAndAnalyze = useCallback(async (title: string, description: string) => {
    if (!user) {
      router.replace('/login');
      return;
    }
    const languageCode = navigator.language || 'pt-BR';
    const result = await uploadFileAndCreateRecord(user, title, description, languageCode);
    await handleUploadResult(result);
  }, [user, uploadFileAndCreateRecord, handleUploadResult, router]);
  

  const handleToggleNewAnalysisForm = () => {
    setShowNewAnalysisForm(prev => !prev);
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
  }

  const handleAccordionChange = (value: string | undefined) => {
    const newExpandedId = value || null;
    setExpandedAnalysisId(newExpandedId);
    if (newExpandedId) {
      const analysisToExpand = pastAnalyses.find(a => a.id === newExpandedId);
      if (analysisToExpand) {
        setCurrentAnalysis(analysisToExpand); 
      }
    } else {
      setCurrentAnalysis(null);
    }
    if (showNewAnalysisForm) setShowNewAnalysisForm(false); 
  };
  
  const afterDeleteAnalysis = () => {
    fetchPastAnalyses(); 
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
      <main className="flex-1 container mx-auto py-8 px-4">
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
              <CardTitle className="text-2xl font-headline text-primary">Suas Análises Anteriores</CardTitle>
              <CardDescription>Veja o histórico de suas análises ou inicie uma nova no botão acima.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPastAnalyses && <div className="flex justify-center py-8"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}
              {!isLoadingPastAnalyses && pastAnalyses.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <Inbox className="mx-auto h-12 w-12 mb-4" />
                  <p className="text-lg">Nenhuma análise anterior encontrada.</p>
                  <p>Clique em "Nova Análise" para começar.</p>
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
                    <AccordionItem value={analysisItem.id} key={analysisItem.id} className="border-b">
                      <AccordionTrigger className="py-4 px-2 hover:bg-muted/50 w-full text-left">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full">
                          <span className="font-medium text-base text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl">
                            {analysisItem.title || analysisItem.fileName}
                          </span>
                          <div className="flex flex-col md:flex-row md:items-center text-sm text-muted-foreground mt-1 md:mt-0 md:ml-4 space-y-1 md:space-y-0 md:space-x-3">
                            <span>
                              {analysisItem.createdAt ? format(new Date(analysisItem.createdAt as string), "dd/MM/yy HH:mm", { locale: ptBR }) : 'Data N/A'}
                            </span>
                            <Badge 
                              variant={getStatusBadgeVariant(analysisItem.status)}
                              className={`
                                ${analysisItem.status === 'completed' ? 'bg-green-600 text-white' : ''} 
                                ${analysisItem.status === 'error' ? 'bg-red-600 text-white' : ''} 
                                ${analysisItem.status === 'cancelled' ? 'bg-yellow-500 text-white' : ''} 
                                ${analysisItem.status === 'cancelling' ? 'bg-yellow-400 text-yellow-900' : ''}
                                ${analysisItem.status === 'reviewing_report' ? 'bg-blue-500 text-white' : ''}
                              `}
                            >
                              {getStatusLabel(analysisItem.status)}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 bg-background">
                        {expandedAnalysisId === analysisItem.id && currentAnalysis && currentAnalysis.id === analysisItem.id ? (
                          <AnalysisView
                            analysis={currentAnalysis} 
                            analysisSteps={displayedAnalysisSteps}
                            onDownloadReport={() => downloadReportAsTxt(currentAnalysis)} 
                            tagInput={tagInput}
                            onTagInputChange={setTagInput}
                            onAddTag={(tag) => handleAddTag(currentAnalysis.id, tag)}
                            onRemoveTag={(tag) => handleRemoveTag(currentAnalysis.id, tag)}
                            onDeleteAnalysis={() => handleDeleteAnalysis(currentAnalysis.id, afterDeleteAnalysis)}
                            onCancelAnalysis={() => handleCancelAnalysis(currentAnalysis.id)}
                          />
                        ) : expandedAnalysisId === analysisItem.id && analysisItem.status === 'error' && analysisItem.id.startsWith('error-') ? (
                           <div className="p-4 bg-destructive/10 rounded-md border border-destructive">
                            <h3 className="text-xl font-semibold mb-2 text-destructive flex items-center">
                              <AlertTriangle className="mr-2" />Ocorreu um Erro
                            </h3>
                            <p className="text-destructive-foreground">Não foi possível carregar ou processar esta análise.</p>
                            <p className="text-sm mt-1"><strong>Detalhes:</strong> {analysisItem.errorMessage || 'Erro desconhecido.'}</p>
                          </div>
                        ) : expandedAnalysisId === analysisItem.id ? (
                          <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /> Carregando detalhes...</div>
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
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} EMA - Electric Magnitudes Analizer. Todos os direitos reservados.
      </footer>
    </div>
  );
}

