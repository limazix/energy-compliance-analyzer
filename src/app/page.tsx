
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, History, FileText, AlertTriangle, CheckCircle2, Loader2, UploadCloud, ListChecks, FileCheck2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { processAnalysisFile, getPastAnalysesAction, deleteAnalysisAction, addTagToAction, removeTagAction } from './actions';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type ViewState = 'dashboard' | 'new_analysis' | 'analysis_progress' | 'analysis_results' | 'past_analyses';

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [viewState, setViewState] = useState<ViewState>('dashboard');
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [pastAnalyses, setPastAnalyses] = useState<Analysis[]>([]);
  const [isLoadingPastAnalyses, setIsLoadingPastAnalyses] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [tagInput, setTagInput] = useState('');


  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && currentAnalysis?.id && (currentAnalysis.status !== 'completed' && currentAnalysis.status !== 'error')) {
      const unsub = onSnapshot(doc(db, 'users', user.uid, 'analyses', currentAnalysis.id), (docSnap) => {
        if (docSnap.exists()) {
          const updatedAnalysis = { id: docSnap.id, ...docSnap.data() } as Analysis;
          setCurrentAnalysis(updatedAnalysis);
          if (updatedAnalysis.status === 'completed' || updatedAnalysis.status === 'error') {
            setViewState('analysis_results');
          }
        }
      });
      return () => unsub();
    }
  }, [user, currentAnalysis?.id, currentAnalysis?.status]);


  const fetchPastAnalyses = async () => {
    if (!user) return;
    setIsLoadingPastAnalyses(true);
    try {
      const analyses = await getPastAnalysesAction(user.uid);
      setPastAnalyses(analyses.filter(a => a.status !== 'deleted'));
      setViewState('past_analyses');
    } catch (error) {
      toast({ title: 'Erro ao buscar análises', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsLoadingPastAnalyses(false);
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFileToUpload(file);
      } else {
        toast({ title: 'Arquivo inválido', description: 'Por favor, selecione um arquivo CSV.', variant: 'destructive' });
        setFileToUpload(null);
      }
    }
  };

  const handleUploadAndAnalyze = async () => {
    if (!fileToUpload || !user) return;

    setIsUploading(true);
    setUploadProgress(0);
    setViewState('analysis_progress');

    const newAnalysisRef = collection(db, 'users', user.uid, 'analyses');
    const analysisDoc = await addDoc(newAnalysisRef, {
      userId: user.uid,
      fileName: fileToUpload.name,
      status: 'uploading',
      progress: 0,
      createdAt: serverTimestamp(),
      tags: [],
    });
    
    setCurrentAnalysis({ 
      id: analysisDoc.id, 
      userId: user.uid, 
      fileName: fileToUpload.name, 
      status: 'uploading', 
      progress: 0, 
      createdAt: new Date().toISOString(),
      tags: []
    });

    const filePath = `user_uploads/${user.uid}/${analysisDoc.id}/${fileToUpload.name}`;
    const fileStorageRef = storageRef(storage, filePath);
    const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
        setCurrentAnalysis(prev => prev ? {...prev, progress: Math.round(progress)} : null);
      },
      (error) => {
        console.error("Upload error:", error);
        toast({ title: 'Erro no Upload', description: error.message, variant: 'destructive' });
        setIsUploading(false);
        setCurrentAnalysis(prev => prev ? {...prev, status: 'error', errorMessage: error.message} : null);
        setViewState('analysis_results');
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDoc.id), {
          powerQualityDataUrl: downloadURL,
          status: 'identifying_regulations', 
          progress: 0, 
        });
        setCurrentAnalysis(prev => prev ? {...prev, powerQualityDataUrl: downloadURL, status: 'identifying_regulations', progress: 0} : null);
        setIsUploading(false);
        setFileToUpload(null);
        
        try {
          await processAnalysisFile(analysisDoc.id, user.uid);
        } catch (processingError) {
          console.error("Processing error:", processingError);
          toast({ title: 'Erro no Processamento', description: (processingError as Error).message, variant: 'destructive' });
          setCurrentAnalysis(prev => prev ? {...prev, status: 'error', errorMessage: (processingError as Error).message} : null);
          setViewState('analysis_results');
        }
      }
    );
  };

  const handleAddTag = async (analysisId: string, tag: string) => {
    if (!user || !tag.trim()) return;
    try {
      await addTagToAction(user.uid, analysisId, tag.trim());
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? {...a, tags: [...(a.tags || []), tag.trim()]} : a));
      setCurrentAnalysis(prev => prev && prev.id === analysisId ? {...prev, tags: [...(prev.tags || []), tag.trim()]} : prev);
      setTagInput('');
      toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada com sucesso.` });
    } catch (error) {
      toast({ title: 'Erro ao adicionar tag', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleRemoveTag = async (analysisId: string, tag: string) => {
    if (!user) return;
    try {
      await removeTagAction(user.uid, analysisId, tag);
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? {...a, tags: (a.tags || []).filter(t => t !== tag)} : a));
      setCurrentAnalysis(prev => prev && prev.id === analysisId ? {...prev, tags: (prev.tags || []).filter(t => t !== tag)} : prev);
      toast({ title: 'Tag removida', description: `Tag "${tag}" removida.` });
    } catch (error) {
      toast({ title: 'Erro ao remover tag', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    if (!user) return;
    try {
      await deleteAnalysisAction(user.uid, analysisId);
      setPastAnalyses(prev => prev.filter(a => a.id !== analysisId));
      if (currentAnalysis?.id === analysisId) {
        setCurrentAnalysis(null);
        setViewState('dashboard');
      }
      toast({ title: 'Análise excluída', description: 'A análise foi marcada como excluída.' });
    } catch (error) {
      toast({ title: 'Erro ao excluir', description: (error as Error).message, variant: 'destructive' });
    }
  };
  
  const downloadReportAsTxt = (reportText: string, fileName: string) => {
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName.replace('.csv', '')}_relatorio_conformidade.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  if (authLoading || (!user && !authLoading)) {
    return ( 
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const analysisSteps: AnalysisStep[] = [
    { name: 'Upload do Arquivo', status: 'pending', progress: 0 },
    { name: 'Identificando Resoluções ANEEL', status: 'pending' },
    { name: 'Analisando Conformidade', status: 'pending' },
    { name: 'Gerando Resultados', status: 'pending' },
  ];

  if (currentAnalysis) {
    switch (currentAnalysis.status) {
      case 'uploading':
        analysisSteps[0] = { name: 'Upload do Arquivo', status: 'in_progress', progress: currentAnalysis.progress };
        break;
      case 'identifying_regulations':
        analysisSteps[0] = { name: 'Upload do Arquivo', status: 'completed', progress: 100 };
        analysisSteps[1] = { name: 'Identificando Resoluções ANEEL', status: 'in_progress', progress: currentAnalysis.progress };
        break;
      case 'assessing_compliance':
        analysisSteps[0] = { name: 'Upload do Arquivo', status: 'completed', progress: 100 };
        analysisSteps[1] = { name: 'Identificando Resoluções ANEEL', status: 'completed' };
        analysisSteps[2] = { name: 'Analisando Conformidade', status: 'in_progress', progress: currentAnalysis.progress };
        break;
      case 'completed':
        analysisSteps.forEach(step => step.status = 'completed');
        analysisSteps[0].progress = 100;
        break;
      case 'error':
        const errorStepIndex = analysisSteps.findIndex(s => s.status === 'in_progress' || s.status === 'pending');
        if (errorStepIndex !== -1) {
          analysisSteps[errorStepIndex].status = 'error';
          analysisSteps[errorStepIndex].details = currentAnalysis.errorMessage;
        } else { 
           const lastCompletedStepIndex = analysisSteps.slice().reverse().findIndex(s => s.status === 'completed');
           const errorIdx = lastCompletedStepIndex !== -1 ? analysisSteps.length - 1 - lastCompletedStepIndex + 1 : 0;
           if (errorIdx < analysisSteps.length) {
             analysisSteps[errorIdx].status = 'error';
             analysisSteps[errorIdx].details = currentAnalysis.errorMessage;
           }
        }
        break;
    }
  }

  const renderStepIcon = (status: AnalysisStep['status']) => {
    if (status === 'in_progress') return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (status === 'error') return <AlertTriangle className="h-5 w-5 text-destructive" />;
    return <Loader2 className="h-5 w-5 text-muted-foreground" />; 
  };

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
      <AppHeader />
      <main className="flex-1 container mx-auto py-8 px-4">
        {viewState === 'dashboard' && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl font-headline text-primary">Bem-vindo(a), {user?.displayName}!</CardTitle>
              <CardDescription className="text-lg">O que você gostaria de fazer hoje?</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <Button size="lg" className="py-8 text-xl" onClick={() => setViewState('new_analysis')}>
                <PlusCircle className="mr-3 h-8 w-8" />
                Iniciar Nova Análise
              </Button>
              <Button size="lg" variant="outline" className="py-8 text-xl" onClick={fetchPastAnalyses} disabled={isLoadingPastAnalyses}>
                {isLoadingPastAnalyses ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <History className="mr-3 h-8 w-8" />}
                Ver Análises Anteriores
              </Button>
            </CardContent>
          </Card>
        )}

        {viewState === 'new_analysis' && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-headline text-primary">Nova Análise de Conformidade</CardTitle>
              <CardDescription>Faça upload do seu arquivo CSV de dados de qualidade de energia.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" accept=".csv" onChange={handleFileChange} className="text-base p-2 border-2 border-dashed h-auto" />
              {fileToUpload && <p className="text-sm text-muted-foreground">Arquivo selecionado: {fileToUpload.name}</p>}
              <div className="flex gap-4">
                <Button onClick={handleUploadAndAnalyze} disabled={!fileToUpload || isUploading} className="w-full md:w-auto" size="lg">
                  {isUploading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
                  {isUploading ? 'Enviando...' : 'Enviar e Analisar'}
                </Button>
                <Button variant="outline" onClick={() => setViewState('dashboard')} className="w-full md:w-auto" size="lg">Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(viewState === 'analysis_progress' || (viewState === 'analysis_results' && currentAnalysis)) && currentAnalysis && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-headline text-primary">
                {currentAnalysis.status === 'completed' ? 'Resultados da Análise' : 
                 currentAnalysis.status === 'error' ? 'Erro na Análise' : 'Análise em Andamento'}
              </CardTitle>
              <CardDescription>Arquivo: {currentAnalysis.fileName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {viewState === 'analysis_progress' && currentAnalysis.status !== 'completed' && currentAnalysis.status !== 'error' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Progresso da Análise:</h3>
                  <ul className="space-y-3">
                    {analysisSteps.map((step, index) => (
                      <li key={index} className="flex items-center p-3 bg-muted/50 rounded-md shadow-sm">
                        {renderStepIcon(step.status)}
                        <span className="ml-3 flex-1 text-md">{step.name}</span>
                        {step.status === 'in_progress' && typeof step.progress === 'number' && (
                           <div className="w-32 ml-auto flex items-center">
                             <Progress value={step.progress} className="h-2 mr-2" />
                             <span className="text-xs text-muted-foreground">{Math.round(step.progress)}%</span>
                           </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {viewState === 'analysis_results' && currentAnalysis.status === 'completed' && (
                <>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-green-600 flex items-center"><CheckCircle2 className="mr-2"/>Análise Concluída com Sucesso!</h3>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-1">Sumário da Conformidade:</h4>
                    <Card className="bg-background p-4">
                      <p className="text-sm whitespace-pre-wrap">{currentAnalysis.summary || 'Sumário não disponível.'}</p>
                    </Card>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold mb-1">Relatório Detalhado:</h4>
                    <Textarea 
                      readOnly 
                      value={currentAnalysis.complianceReport || 'Relatório detalhado não disponível.'} 
                      className="h-64 text-sm bg-background" 
                      aria-label="Relatório Detalhado"
                    />
                     <Button 
                        onClick={() => downloadReportAsTxt(currentAnalysis.complianceReport || '', currentAnalysis.fileName)} 
                        className="mt-2"
                        variant="outline"
                      >
                       <FileText className="mr-2 h-4 w-4" /> Baixar Relatório (TXT)
                     </Button>
                  </div>
                </>
              )}
              {viewState === 'analysis_results' && currentAnalysis.status === 'error' && (
                 <div className="p-4 bg-destructive/10 rounded-md border border-destructive">
                    <h3 className="text-xl font-semibold mb-2 text-destructive flex items-center"><AlertTriangle className="mr-2"/>Ocorreu um Erro</h3>
                    <p className="text-destructive-foreground">Não foi possível completar a análise.</p>
                    <p className="text-sm mt-1"><strong>Detalhes:</strong> {currentAnalysis.errorMessage || 'Erro desconhecido.'}</p>
                  </div>
              )}
              
              <div className="mt-6 space-y-2">
                <h4 className="text-md font-semibold">Tags:</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(currentAnalysis.tags || []).map(tag => (
                    <Badge key={tag} variant="secondary" className="text-sm py-1 px-3">
                      {tag}
                      <button onClick={() => handleRemoveTag(currentAnalysis.id, tag)} className="ml-2 text-muted-foreground hover:text-destructive">&times;</button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input 
                    type="text" 
                    value={tagInput} 
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Adicionar tag"
                    className="max-w-xs"
                  />
                  <Button onClick={() => handleAddTag(currentAnalysis.id, tagInput)} variant="outline" size="sm">Adicionar</Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-8">
                <Button onClick={() => { setCurrentAnalysis(null); setViewState('new_analysis'); }} size="lg">
                  <PlusCircle className="mr-2 h-5 w-5" /> Iniciar Nova Análise
                </Button>
                <Button onClick={() => { setCurrentAnalysis(null); fetchPastAnalyses(); }} variant="outline" size="lg">
                  <History className="mr-2 h-5 w-5" /> Ver Análises Anteriores
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {viewState === 'past_analyses' && (
          <>
            <div className="mb-4 flex items-center space-x-2 text-sm">
              <span 
                onClick={() => setViewState('dashboard')} 
                className="text-muted-foreground hover:text-primary cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setViewState('dashboard')}
              >
                Dashboard
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-foreground">Análises Anteriores</span>
            </div>
            <Card className="shadow-xl relative"> {/* Added relative positioning for absolute button */}
              <CardHeader>
                <CardTitle className="text-2xl font-headline text-primary">Análises Anteriores</CardTitle>
                <Button variant="outline" onClick={() => setViewState('dashboard')} className="absolute top-6 right-6">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao Dashboard
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingPastAnalyses && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
                {!isLoadingPastAnalyses && pastAnalyses.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Nenhuma análise anterior encontrada.</p>
                )}
                {!isLoadingPastAnalyses && pastAnalyses.length > 0 && (
                  <ul className="space-y-4">
                    {pastAnalyses.map(analysis => (
                      <li key={analysis.id} className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow bg-card">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-semibold text-primary-foreground">{analysis.fileName}</h3>
                            <p className="text-sm text-muted-foreground">
                              Criada em: {analysis.createdAt ? format(new Date(analysis.createdAt as string), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Data indisponível'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Status: <Badge variant={
                                analysis.status === 'completed' ? 'default' :
                                analysis.status === 'error' ? 'destructive' : 'secondary'
                              } className={analysis.status === 'completed' ? 'bg-green-500 text-white' : ''}>
                                {analysis.status === 'uploading' && 'Enviando'}
                                {analysis.status === 'identifying_regulations' && 'Identificando Resoluções'}
                                {analysis.status === 'assessing_compliance' && 'Analisando Conformidade'}
                                {analysis.status === 'completed' && 'Concluída'}
                                {analysis.status === 'error' && 'Erro'}
                              </Badge>
                            </p>
                            {analysis.tags && analysis.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {analysis.tags.map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                             <Button variant="outline" size="sm" onClick={() => { setCurrentAnalysis(analysis); setViewState('analysis_results'); }}>
                               <FileCheck2 className="mr-1 h-4 w-4" /> Ver Detalhes
                             </Button>
                             <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">Excluir</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir a análise do arquivo "{analysis.fileName}"? Esta ação marcará a análise como excluída.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteAnalysis(analysis.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
      </footer>
    </div>
  );
}

    