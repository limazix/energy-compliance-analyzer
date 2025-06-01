
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, addDoc, collection, serverTimestamp, updateDoc, Timestamp, getDoc, FirestoreError } from 'firebase/firestore';
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
    console.log('[useAnalysisManager_useEffect_onSnapshot] Evaluating subscription. User:', JSON.stringify(user, null, 2), 'CurrentAnalysis ID:', currentAnalysis?.id, 'Status:', currentAnalysis?.status);

    if (user && user.uid && currentAnalysis?.id && !currentAnalysis.id.startsWith('error-')) {
      console.log(`[useAnalysisManager_useEffect_onSnapshot] Attempting to subscribe to analysis ID: ${currentAnalysis.id} for user UID: ${user.uid}.`);
      const analysisDocumentRef = doc(db, 'users', user.uid, 'analyses', currentAnalysis.id);
      
      try {
        unsub = onSnapshot(analysisDocumentRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              console.log(`[useAnalysisManager_useEffect_onSnapshot] Snapshot received for ${currentAnalysis.id}:`, JSON.stringify(data, null, 2));
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
            console.error(`[useAnalysisManager_useEffect_onSnapshot] Error in onSnapshot for ${currentAnalysis?.id}: Code: ${error.code}, Message: ${error.message}`, error);
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
        console.error("[useAnalysisManager_useEffect_onSnapshot] Exception setting up onSnapshot:", e);
      }
    } else {
      console.log(`[useAnalysisManager_useEffect_onSnapshot] Conditions not met for subscription. User: ${!!user}, User UID: ${user?.uid}, CurrentAnalysis ID: ${currentAnalysis?.id}, IsErrorID: ${!!currentAnalysis?.id?.startsWith('error-')}`);
    }
    return () => {
      if (unsub) {
        console.log(`[useAnalysisManager_useEffect_onSnapshot] Unsubscribing from analysis ID: ${currentAnalysis?.id}`);
        unsub();
      }
    };
  }, [user, currentAnalysis?.id]); // Removed toast from dependencies


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
    console.log('[useAnalysisManager_handleUploadAndAnalyze] Initiated. User object:', JSON.stringify(user, null, 2));
    console.log('[useAnalysisManager_handleUploadAndAnalyze] File to upload:', fileToUpload?.name);

    if (!user) {
      console.error('[useAnalysisManager_handleUploadAndAnalyze] Error: User object is null.');
      toast({ title: 'Usuário não autenticado', description: 'O objeto de usuário é nulo. Por favor, faça login.', variant: 'destructive' });
      setIsUploading(false);
      setCurrentAnalysis(null);
      return;
    }
    if (!user.uid || user.uid.trim() === "") {
      console.error('[useAnalysisManager_handleUploadAndAnalyze] Error: User UID is missing or empty. User UID:', user.uid);
      toast({ title: 'ID de Usuário Inválido', description: 'O ID do usuário está ausente ou é inválido. Por favor, tente fazer login novamente.', variant: 'destructive' });
      setIsUploading(false);
      setCurrentAnalysis(null);
      return;
    }

    if (!fileToUpload) {
      console.warn('[useAnalysisManager_handleUploadAndAnalyze] No file selected.');
      toast({ title: 'Nenhum arquivo selecionado', description: 'Por favor, selecione um arquivo CSV para análise.', variant: 'destructive' });
      setIsUploading(false);
      setCurrentAnalysis(null);
      return;
    }
    if (!fileToUpload.name || fileToUpload.name.trim() === "") {
        console.warn('[useAnalysisManager_handleUploadAndAnalyze] Invalid file name.');
        toast({ title: 'Nome de arquivo inválido', description: 'O arquivo selecionado não possui um nome válido.', variant: 'destructive' });
        setIsUploading(false);
        setCurrentAnalysis(null);
        return;
    }

    setIsUploading(true);
    setUploadProgressInternal(0);
    setCurrentAnalysis(null); 
    
    let analysisDocId = '';
    const currentUserId = user.uid; // Capture UID to avoid issues if user object changes mid-flight
    const currentFileName = fileToUpload.name;

    try {
      console.log(`[useAnalysisManager_handleUploadAndAnalyze] User UID for Firestore operations: ${currentUserId}, File Name: ${currentFileName}`);
      
      const dataToAdd = {
        userId: currentUserId,
        fileName: currentFileName,
        status: 'uploading' as Analysis['status'],
        progress: 0,
        createdAt: serverTimestamp(),
        tags: [],
        powerQualityDataUrl: null,
        identifiedRegulations: null,
        summary: null,
        complianceReport: null,
        errorMessage: null,
        completedAt: null,
      };
      
      console.log('[useAnalysisManager_handleUploadAndAnalyze] Data to add to Firestore:', JSON.stringify(dataToAdd, null, 2));
      const newAnalysisCollectionRef = collection(db, 'users', currentUserId, 'analyses');
      const analysisDocRef = await addDoc(newAnalysisCollectionRef, dataToAdd);
      analysisDocId = analysisDocRef.id;
      console.log(`[useAnalysisManager_handleUploadAndAnalyze] Firestore document created with ID: ${analysisDocId}.`);

      const docSnap = await getDoc(analysisDocRef);
      if (docSnap.exists()) {
        const initialData = docSnap.data();
        const initialAnalysisData: Analysis = {
          id: analysisDocId,
          userId: currentUserId,
          fileName: currentFileName,
          status: 'uploading',
          progress: 0,
          createdAt: (initialData.createdAt instanceof Timestamp) ? initialData.createdAt.toDate().toISOString() : new Date().toISOString(),
          tags: initialData.tags || [],
          powerQualityDataUrl: initialData.powerQualityDataUrl || undefined,
          identifiedRegulations: initialData.identifiedRegulations || undefined,
          summary: initialData.summary || undefined,
          complianceReport: initialData.complianceReport || undefined,
          errorMessage: initialData.errorMessage || undefined,
          completedAt: initialData.completedAt ? (initialData.completedAt as Timestamp).toDate().toISOString() : undefined,
        };
        setCurrentAnalysis(initialAnalysisData);
        console.log(`[useAnalysisManager_handleUploadAndAnalyze] currentAnalysis set with real ID: ${analysisDocId}.`);
      } else {
         const criticalErrorMsg = `[useAnalysisManager_handleUploadAndAnalyze] CRITICAL: Newly created analysis document ${analysisDocId} not found immediately.`;
         console.error(criticalErrorMsg);
         // Set currentAnalysis to an error state so UI can reflect this
         setCurrentAnalysis({
             id: `error-firestore-fetch-${Date.now()}`, userId: currentUserId, fileName: currentFileName,
             status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
             errorMessage: 'Falha ao buscar o documento da análise recém-criado.'
         });
         setIsUploading(false);
         return; // Stop further processing
      }

      const filePath = `user_uploads/${currentUserId}/${analysisDocId}/${currentFileName}`;
      console.log(`[useAnalysisManager_handleUploadAndAnalyze] Starting GCS upload to: ${filePath}`);
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

      uploadTask.on('state_changed',
        (snapshot) => {
          try {
            const currentUploadPercentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgressInternal(currentUploadPercentage);
            if (analysisDocId) { // Ensure analysisDocId is available
              const progressData = { progress: currentUploadPercentage };
              updateDoc(doc(db, 'users', currentUserId, 'analyses', analysisDocId), progressData)
                .catch(err => {
                  const firestoreError = err as FirestoreError;
                  console.warn(`[useAnalysisManager_handleUploadAndAnalyze_onStateChanged] Minor error updating upload progress in Firestore (doc: ${analysisDocId}): Code: ${firestoreError.code}, Message: ${firestoreError.message}`);
                });
            }
          } catch (progressUpdateError) {
             console.error(`[useAnalysisManager_handleUploadAndAnalyze_onStateChanged] Error inside progress callback for ${analysisDocId}:`, progressUpdateError);
          }
        },
        async (uploadError) => {
          try {
            console.error(`[useAnalysisManager_handleUploadAndAnalyze_uploadErrorCallback] GCS Upload error for ${analysisDocId || 'unknown_id'}:`, uploadError);
            toast({ title: 'Erro no Upload do Arquivo', description: uploadError.message || 'Falha desconhecida no upload.', variant: 'destructive' });
            setIsUploading(false);
            if (analysisDocId) {
              const errorData = {
                status: 'error' as Analysis['status'],
                errorMessage: `Falha no upload do arquivo: ${uploadError.message || 'Erro desconhecido.'}`,
                progress: 0,
              };
              await updateDoc(doc(db, 'users', currentUserId, 'analyses', analysisDocId), errorData);
            } else {
               setCurrentAnalysis({
                  id: `error-upload-${Date.now()}`, userId: currentUserId, fileName: currentFileName,
                  status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
                  errorMessage: `Falha no upload do arquivo (sem ID de análise): ${uploadError.message || 'Erro desconhecido.'}`
              });
            }
          } catch (errorHandlingError) {
            console.error(`[useAnalysisManager_handleUploadAndAnalyze_uploadErrorCallback] CRITICAL: Error while handling GCS upload error for ${analysisDocId}:`, errorHandlingError);
          }
        },
        async () => { 
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log(`[useAnalysisManager_handleUploadAndAnalyze_uploadCompleteCallback] GCS Upload complete for ${analysisDocId}. URL: ${downloadURL}`);
            
            if (!analysisDocId) {
                const criticalMsg = "[useAnalysisManager_handleUploadAndAnalyze_uploadCompleteCallback] CRITICAL: analysisDocId is empty after successful upload.";
                console.error(criticalMsg);
                toast({ title: 'Erro Crítico Pós-Upload', description: 'ID da análise não encontrado. A análise pode não prosseguir.', variant: 'destructive' });
                setIsUploading(false);
                setCurrentAnalysis(prev => prev ? { ...prev, status: 'error', errorMessage: 'ID da análise perdido após upload.' } : {
                    id: `error-no-id-post-upload-${Date.now()}`, userId: currentUserId, fileName: currentFileName,
                    status: 'error', progress: 100, /* Mark upload as done */ createdAt: new Date().toISOString(), tags: [],
                    errorMessage: 'ID da análise perdido após upload completo do arquivo.'
                });
                return;
            }

            const postUploadData = {
              powerQualityDataUrl: downloadURL,
              status: 'identifying_regulations' as Analysis['status'],
              progress: 10, 
            };
            await updateDoc(doc(db, 'users', currentUserId, 'analyses', analysisDocId), postUploadData);
            
            setIsUploading(false);
            setFileToUpload(null); 
            
            onSuccessCallback?.(); 

            console.log(`[useAnalysisManager_handleUploadAndAnalyze_uploadCompleteCallback] Calling server action processAnalysisFile for ID: ${analysisDocId}, UserID: ${currentUserId}`);
            await processAnalysisFile(analysisDocId, currentUserId);
            console.log(`[useAnalysisManager_handleUploadAndAnalyze_uploadCompleteCallback] Server action processAnalysisFile likely completed or errored for ID: ${analysisDocId}`);

          } catch (postUploadProcessError) {
            const errorMsg = postUploadProcessError instanceof Error ? postUploadProcessError.message : String(postUploadProcessError);
            console.error(`[useAnalysisManager_handleUploadAndAnalyze_uploadCompleteCallback] Error during post-GCS-upload processing for ${analysisDocId}:`, postUploadProcessError);
            toast({ title: 'Erro Pós-Upload', description: errorMsg, variant: 'destructive' });
            setIsUploading(false); // Ensure this is reset
            if (analysisDocId) { 
              try {
                const errorData = {
                    status: 'error' as Analysis['status'],
                    errorMessage: `Falha no processamento pós-upload: ${errorMsg}`,
                    progress: 0, // Reset progress as this phase failed
                };
                await updateDoc(doc(db, 'users', currentUserId, 'analyses', analysisDocId), errorData);
              } catch (updateError) {
                 console.error(`[useAnalysisManager_handleUploadAndAnalyze_uploadCompleteCallback] CRITICAL: Failed to update Firestore with post-upload error for ${analysisDocId}:`, updateError);
              }
            } else {
                 setCurrentAnalysis({
                    id: `error-post-upload-no-id-${Date.now()}`, userId: currentUserId, fileName: currentFileName,
                    status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
                    errorMessage: `Falha no processamento pós-upload (sem ID de análise): ${errorMsg}`
                });
            }
          }
        }
      );
    } catch (initialError) {
      const errorMessage = initialError instanceof Error ? initialError.message : String(initialError);
      const firestoreErrorCode = (initialError as FirestoreError)?.code;
      console.error(`[useAnalysisManager_handleUploadAndAnalyze_initialError] Critical error starting analysis (e.g., Firestore addDoc): Code: ${firestoreErrorCode}, Message: ${errorMessage}`, initialError);
      toast({ title: 'Erro Crítico ao Iniciar Análise', description: `Erro: ${errorMessage}`, variant: 'destructive' });
      setIsUploading(false);
      setCurrentAnalysis({
          id: `error-initial-${Date.now()}`,
          userId: currentUserId || 'unknown_user', // Use captured currentUserId or fallback
          fileName: currentFileName || "Arquivo desconhecido",
          status: 'error', progress: 0, createdAt: new Date().toISOString(), tags: [],
          errorMessage: `Falha ao criar registro da análise: ${errorMessage}`
      });
    }
  }, [fileToUpload, user, toast]); // onSuccessCallback was removed as it's a param, not a hook dependency

  const fetchPastAnalyses = useCallback(async () => {
    if (!user || !user.uid) {
      console.log('[useAnalysisManager_fetchPastAnalyses] No user or user.uid, skipping fetch.');
      return;
    }
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
    if (!user || !user.uid || !tag.trim() || !analysisId) return;
    const currentUserId = user.uid;
    try {
      await addTagToAction(currentUserId, analysisId, tag.trim());
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
    if (!user || !user.uid || !analysisId) return;
    const currentUserId = user.uid;
    try {
      await removeTagAction(currentUserId, analysisId, tagToRemove);
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
    if (!user || !user.uid || !analysisId) return;
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
             steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'pending', details: 'Aguardando início da análise ou configuração inicial.', progress: 0};
        }
        for (let i = 1; i < steps.length; i++) {
            steps[i] = { ...BASE_ANALYSIS_STEPS[i], status: 'pending', progress: 0 };
        }
        return steps;
    }

    const { status, progress, errorMessage, powerQualityDataUrl, identifiedRegulations, summary } = currentAnalysis;
    
    const sanitizedProgress = typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : 0;
    const currentStepProgress = (status === 'uploading') ? _uploadProgress : sanitizedProgress;


    switch (status) {
      case 'uploading':
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: _uploadProgress }; 
        break;
      case 'identifying_regulations':
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: currentStepProgress }; 
        break;
      case 'assessing_compliance':
        steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
        steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'completed', progress: 100 };
        steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: currentStepProgress }; 
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
          if (index === errorStepIndex) return { ...step, status: 'error', details: errorMessage || 'Erro desconhecido', progress: currentStepProgress };
          return { ...step, status: 'pending', progress: 0 };
        });
        break;
      case 'deleted':
         steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', details: 'Análise excluída', progress: 0 }));
         break;
      default:
        console.error(`[useAnalysisManager_displayedAnalysisSteps] Unhandled status: ${status}`);
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
