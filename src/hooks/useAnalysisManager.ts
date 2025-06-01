
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, addDoc, collection, serverTimestamp, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import type { Analysis, AnalysisStep } from '@/types/analysis';
import { processAnalysisFile, getPastAnalysesAction, addTagToAction, removeTagAction, deleteAnalysisAction } from '@/app/actions';

const BASE_ANALYSIS_STEPS: Omit<AnalysisStep, 'status' | 'progress' | 'details'>[] = [
  { name: 'Upload do Arquivo' },
  { name: 'Identificando Resoluções ANEEL' },
  { name: 'Analisando Conformidade' },
  { name: 'Gerando Resultados' },
];

export function useAnalysisManager(user: User | null) {
  const { toast } = useToast();
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [pastAnalyses, setPastAnalyses] = useState<Analysis[]>([]);
  const [isLoadingPastAnalyses, setIsLoadingPastAnalyses] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [_uploadProgress, setUploadProgressInternal] = useState(0);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    let unsub: (() => void) | undefined;
    console.log(`[useAnalysisManager_useEffect_onSnapshot] Evaluating subscription. User: ${!!user}, currentAnalysis ID: ${currentAnalysis?.id}`);

    if (user && currentAnalysis?.id && !currentAnalysis.id.startsWith('error-')) {
      console.log(`[useAnalysisManager_useEffect_onSnapshot] Attempting to subscribe to analysis ID: ${currentAnalysis.id}, Current Status: ${currentAnalysis.status}`);
      
      const analysisDocumentRef = doc(db, 'users', user.uid, 'analyses', currentAnalysis.id);
      unsub = onSnapshot(analysisDocumentRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log(`[useAnalysisManager_useEffect_onSnapshot] Snapshot received for ${currentAnalysis.id}:`, data);
            
            const validStatuses = ['uploading', 'identifying_regulations', 'assessing_compliance', 'completed', 'error', 'deleted'];
            const statusIsValid = data.status && validStatuses.includes(data.status);

            const updatedAnalysis: Analysis = {
              id: docSnap.id,
              userId: typeof data.userId === 'string' ? data.userId : user.uid,
              fileName: typeof data.fileName === 'string' ? data.fileName : 'Nome de arquivo desconhecido',
              status: statusIsValid ? data.status : 'error',
              progress: typeof data.progress === 'number' ? data.progress : 0,
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
            console.warn(`[useAnalysisManager_useEffect_onSnapshot] Document ${currentAnalysis?.id} not found. Current local status: ${currentAnalysis?.status}.`);
            // Only set to error if the document was expected to exist (not an error- ID and not already deleted/error)
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
        (error) => {
          console.error(`[useAnalysisManager_useEffect_onSnapshot] Error in onSnapshot for ${currentAnalysis?.id}:`, error);
          toast({ title: 'Erro ao Sincronizar Análise', description: `Não foi possível obter atualizações: ${error.message}`, variant: 'destructive' });
          setCurrentAnalysis(prev => {
            if (prev && currentAnalysis?.id && prev.id === currentAnalysis.id && !prev.id.startsWith('error-') && prev.status !== 'error') {
              return { ...prev, status: 'error', errorMessage: `Erro ao sincronizar com Firestore: ${error.message}` };
            }
            return prev;
          });
        }
      );
    } else {
      console.log(`[useAnalysisManager_useEffect_onSnapshot] Conditions not met for subscription. User: ${!!user}, ID: ${currentAnalysis?.id}, IsErrorID: ${!!currentAnalysis?.id?.startsWith('error-')}`);
    }
    return () => {
      if (unsub) {
        console.log(`[useAnalysisManager_useEffect_onSnapshot] Unsubscribing from analysis ID: ${currentAnalysis?.id}`);
        unsub();
      }
    };
  }, [user, currentAnalysis?.id]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFileToUpload(file);
        console.log(`[useAnalysisManager_handleFileChange] File selected: ${file.name}, type: ${file.type}`);
      } else {
        toast({ title: 'Arquivo inválido', description: 'Por favor, selecione um arquivo CSV.', variant: 'destructive' });
        setFileToUpload(null);
      }
    }
  };

  const handleUploadAndAnalyze = useCallback(async (onSuccessCallback?: () => void) => {
    if (!fileToUpload || !user) {
      console.warn('[useAnalysisManager_handleUploadAndAnalyze] Upload cancelled: No file or user.');
      toast({ title: 'Ação cancelada', description: 'Nenhum arquivo selecionado ou usuário não autenticado.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setUploadProgressInternal(0);
    setCurrentAnalysis(null); 
    
    let analysisDocId = '';

    try {
      console.log(`[useAnalysisManager_handleUploadAndAnalyze] Creating Firestore document for: ${fileToUpload.name}`);
      const newAnalysisCollectionRef = collection(db, 'users', user.uid, 'analyses');
      const analysisDocRef = await addDoc(newAnalysisCollectionRef, {
        userId: user.uid,
        fileName: fileToUpload.name,
        status: 'uploading',
        progress: 0,
        createdAt: serverTimestamp(),
        tags: [],
      });
      analysisDocId = analysisDocRef.id;
      console.log(`[useAnalysisManager_handleUploadAndAnalyze] Firestore document created with ID: ${analysisDocId}.`);

      const docSnap = await getDoc(analysisDocRef);
      if (docSnap.exists()) {
        const initialData = docSnap.data();
        const initialAnalysisData: Analysis = {
          id: analysisDocId,
          userId: user.uid,
          fileName: fileToUpload.name,
          status: 'uploading',
          progress: 0,
          createdAt: (initialData.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          tags: initialData.tags || []
        };
        setCurrentAnalysis(initialAnalysisData); 
        console.log(`[useAnalysisManager_handleUploadAndAnalyze] currentAnalysis set with real ID: ${analysisDocId}. Subscription should now be attempted.`);
      } else {
         console.error(`[useAnalysisManager_handleUploadAndAnalyze] Newly created analysis document ${analysisDocId} not found immediately.`);
         throw new Error("Newly created analysis document not found immediately.");
      }


      const filePath = `user_uploads/${user.uid}/${analysisDocId}/${fileToUpload.name}`;
      console.log(`[useAnalysisManager_handleUploadAndAnalyze] Starting GCS upload to: ${filePath}`);
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

      uploadTask.on('state_changed',
        (snapshot) => {
          const currentUploadPercentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgressInternal(currentUploadPercentage);
          if (analysisDocId) {
             updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDocId), {
               progress: currentUploadPercentage // Store precise progress
             }).catch(err => console.warn("[useAnalysisManager_handleUploadAndAnalyze_onStateChanged] Minor error updating upload progress in Firestore:", err.message));
          }
        },
        async (uploadError) => {
          console.error(`[useAnalysisManager_handleUploadAndAnalyze_uploadError] GCS Upload error for ${analysisDocId || 'unknown_id'}:`, uploadError);
          toast({ title: 'Erro no Upload do Arquivo', description: uploadError.message, variant: 'destructive' });
          setIsUploading(false);
          if (analysisDocId) {
            await updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDocId), {
              status: 'error',
              errorMessage: `Falha no upload do arquivo: ${uploadError.message}`,
              progress: 0,
            });
          } else {
             setCurrentAnalysis({
                id: `error-upload-${Date.now()}`,
                userId: user.uid,
                fileName: fileToUpload?.name || "Arquivo desconhecido",
                status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
                errorMessage: `Falha no upload do arquivo (sem ID de análise): ${uploadError.message}`
            });
          }
        },
        async () => { 
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log(`[useAnalysisManager_handleUploadAndAnalyze_uploadComplete] GCS Upload complete for ${analysisDocId}. URL: ${downloadURL}`);
            
            if (!analysisDocId) {
                console.error("[useAnalysisManager_handleUploadAndAnalyze_uploadComplete] CRITICAL: analysisDocId is empty after successful upload.");
                toast({ title: 'Erro Crítico Pós-Upload', description: 'ID da análise não encontrado. A análise pode não prosseguir.', variant: 'destructive' });
                setIsUploading(false);
                setCurrentAnalysis(prev => prev ? { ...prev, status: 'error', errorMessage: 'ID da análise perdido após upload.' } : null);
                return;
            }

            await updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDocId), {
              powerQualityDataUrl: downloadURL,
              status: 'identifying_regulations', 
              progress: 0, 
            });
            
            setIsUploading(false);
            setFileToUpload(null);
            
            onSuccessCallback?.(); 

            console.log(`[useAnalysisManager_handleUploadAndAnalyze_uploadComplete] Calling server action processAnalysisFile for ID: ${analysisDocId}`);
            await processAnalysisFile(analysisDocId, user.uid);
          } catch (postUploadError) {
            console.error(`[useAnalysisManager_handleUploadAndAnalyze_postUploadError] Error during post-GCS-upload processing for ${analysisDocId}:`, postUploadError);
            const errorMsg = postUploadError instanceof Error ? postUploadError.message : String(postUploadError);
            toast({ title: 'Erro Pós-Upload', description: errorMsg, variant: 'destructive' });
            setIsUploading(false);
            if (analysisDocId) { 
              await updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDocId), {
                  status: 'error',
                  errorMessage: `Falha no processamento pós-upload: ${errorMsg}`,
                  progress: 0,
              });
            }
          }
        }
      );
    } catch (initialError) {
      console.error("[useAnalysisManager_handleUploadAndAnalyze_initialError] Critical error starting analysis:", initialError);
      const errorMessage = initialError instanceof Error ? initialError.message : String(initialError);
      toast({ title: 'Erro Crítico ao Iniciar Análise', description: errorMessage, variant: 'destructive' });
      setIsUploading(false);
      setCurrentAnalysis({
          id: `error-initial-${Date.now()}`,
          userId: user.uid,
          fileName: fileToUpload?.name || "Arquivo desconhecido",
          status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
          errorMessage: `Falha ao criar registro da análise: ${errorMessage}`
      });
    }
  }, [fileToUpload, user, toast]);

  const fetchPastAnalyses = useCallback(async () => {
    if (!user) return;
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
    if (!user || !tag.trim() || !analysisId) return;
    try {
      await addTagToAction(user.uid, analysisId, tag.trim());
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: [...new Set([...(a.tags || []), tag.trim()])]} : a));
      if (currentAnalysis && currentAnalysis.id === analysisId) {
        setCurrentAnalysis(prev => prev ? { ...prev, tags: [...new Set([...(prev.tags || []), tag.trim()])]} : null);
      }
      setTagInput('');
      toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleAddTag] Error adding tag to ${analysisId}:`, error);
      toast({ title: 'Erro ao adicionar tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis]);

  const handleRemoveTag = useCallback(async (analysisId: string, tagToRemove: string) => {
    if (!user || !analysisId) return;
    try {
      await removeTagAction(user.uid, analysisId, tagToRemove);
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: (a.tags || []).filter(t => t !== tagToRemove) } : a));
      if (currentAnalysis && currentAnalysis.id === analysisId) {
        setCurrentAnalysis(prev => prev ? { ...prev, tags: (prev.tags || []).filter(t => t !== tagToRemove)} : null);
      }
      toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
    } catch (error) {
      console.error(`[useAnalysisManager_handleRemoveTag] Error removing tag from ${analysisId}:`, error);
      toast({ title: 'Erro ao remover tag', description: String(error instanceof Error ? error.message : error), variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis]);


  const handleDeleteAnalysis = useCallback(async (analysisId: string, onDeleted?: () => void) => {
    if (!user || !analysisId) return;
    try {
      await deleteAnalysisAction(user.uid, analysisId);
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
             steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'error', details: currentAnalysis.errorMessage, progress: 0};
        } else {
             // This state can occur if currentAnalysis is null briefly during setup
             steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'pending', details: 'Aguardando início da análise ou configuração inicial.', progress: 0};
        }
        // Ensure other steps are also marked as pending
        for (let i = 1; i < steps.length; i++) {
            steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
        }
        return steps;
    }

    const { status, progress, errorMessage, powerQualityDataUrl, identifiedRegulations, summary } = currentAnalysis;
    // Use _uploadProgress for the 'uploading' step directly, otherwise use currentAnalysis.progress
    const sanitizedProgress = (status === 'uploading') ? _uploadProgress : Math.min(100, Math.max(0, typeof progress === 'number' ? progress : 0));


    switch (status) {
      case 'uploading':
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: sanitizedProgress }; 
        break;
      case 'identifying_regulations':
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: sanitizedProgress }; 
        break;
      case 'assessing_compliance':
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'completed', progress: 100 };
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: sanitizedProgress }; 
        break;
      case 'completed':
        steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'completed', progress: 100 }));
        break;
      case 'error':
        let errorStepIndex = 3; 
        if (errorMessage?.toLowerCase().includes('upload') || (!powerQualityDataUrl && !identifiedRegulations && !summary)) {
            errorStepIndex = 0;
        } else if (errorMessage?.toLowerCase().includes('resolution') || (powerQualityDataUrl && !identifiedRegulations && !summary)) {
            errorStepIndex = 1;
        } else if (errorMessage?.toLowerCase().includes('compliance') || (powerQualityDataUrl && identifiedRegulations && !summary)) {
            errorStepIndex = 2;
        }
        
        steps = steps.map((step, index) => {
          if (index < errorStepIndex) return { ...step, status: 'completed', progress: 100 };
          if (index === errorStepIndex) return { ...step, status: 'error', details: errorMessage || 'Erro desconhecido', progress: sanitizedProgress };
          return { ...step, status: 'pending', progress: 0 };
        });
        break;
      case 'deleted':
         steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', details: 'Análise excluída', progress: 0 }));
         break;
      default:
        const exhaustiveCheck: never = status; // Ensures all statuses are handled
        console.error(`[useAnalysisManager_displayedAnalysisSteps] Unhandled status: ${exhaustiveCheck}`);
        steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'error', details: `Status desconhecido ou inválido: ${status}`, progress: 0 }));
        break;
    }
    return steps;
  }, [currentAnalysis, _uploadProgress]);


  return {
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
  };
}


    