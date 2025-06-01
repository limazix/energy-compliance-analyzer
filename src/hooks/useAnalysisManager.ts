
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, addDoc, collection, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { Timestamp } from 'firebase/firestore';
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
  const [_uploadProgress, setUploadProgressInternal] = useState(0); // Internal for upload task
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (user && currentAnalysis?.id && currentAnalysis.status !== 'completed' && currentAnalysis.status !== 'error' && currentAnalysis.status !== 'deleted') {
      const unsub = onSnapshot(doc(db, 'users', user.uid, 'analyses', currentAnalysis.id), 
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const updatedAnalysis: Analysis = {
              id: docSnap.id,
              userId: typeof data.userId === 'string' ? data.userId : user.uid,
              fileName: typeof data.fileName === 'string' ? data.fileName : 'Nome de arquivo desconhecido',
              status: data.status || 'error',
              progress: typeof data.progress === 'number' ? data.progress : 0,
              powerQualityDataUrl: typeof data.powerQualityDataUrl === 'string' ? data.powerQualityDataUrl : undefined,
              identifiedRegulations: Array.isArray(data.identifiedRegulations) ? data.identifiedRegulations.map(String) : undefined,
              summary: typeof data.summary === 'string' ? data.summary : undefined,
              complianceReport: typeof data.complianceReport === 'string' ? data.complianceReport : undefined,
              errorMessage: typeof data.errorMessage === 'string' ? data.errorMessage : undefined,
              tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
              createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
              completedAt: (data.completedAt as Timestamp)?.toDate ? (data.completedAt as Timestamp).toDate().toISOString() : undefined,
            };
            setCurrentAnalysis(updatedAnalysis);
          } else {
            setCurrentAnalysis(prev => prev ? { ...prev, status: 'error', errorMessage: 'Documento da análise não encontrado.' } : null);
          }
        },
        (error) => {
          console.error("Error in onSnapshot:", error);
          toast({ title: 'Erro ao Sincronizar', description: `Não foi possível obter atualizações da análise: ${error.message}`, variant: 'destructive' });
          setCurrentAnalysis(prev => prev ? { ...prev, status: 'error', errorMessage: `Erro ao sincronizar: ${error.message}` } : null);
        }
      );
      return () => unsub();
    }
  }, [user, currentAnalysis?.id, toast]);

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

  const handleUploadAndAnalyze = useCallback(async (onSuccess: () => void) => {
    if (!fileToUpload || !user) return;

    setIsUploading(true);
    setUploadProgressInternal(0);
    
    const tempAnalysisId = `temp-${Date.now()}`;
    // Set a preliminary currentAnalysis to show progress UI immediately
    setCurrentAnalysis({
        id: tempAnalysisId, // Temporary ID until Firestore doc is created
        userId: user.uid,
        fileName: fileToUpload.name,
        status: 'uploading',
        progress: 0,
        createdAt: new Date().toISOString(),
        tags: []
    });

    let analysisDocId = '';

    try {
      const newAnalysisRef = collection(db, 'users', user.uid, 'analyses');
      const analysisDoc = await addDoc(newAnalysisRef, {
        userId: user.uid,
        fileName: fileToUpload.name,
        status: 'uploading',
        progress: 0,
        createdAt: serverTimestamp(),
        tags: [],
      });
      analysisDocId = analysisDoc.id;

      // Update currentAnalysis with the real ID
      setCurrentAnalysis(prev => ({
        ...(prev || { userId: user.uid, fileName: fileToUpload.name, createdAt: new Date().toISOString(), tags: [] }), // ensure prev exists
        id: analysisDocId,
        status: 'uploading',
        progress: 0,
      }));

      const filePath = `user_uploads/${user.uid}/${analysisDocId}/${fileToUpload.name}`;
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgressInternal(progress);
          // Update Firestore directly, onSnapshot will pick it up for currentAnalysis
          updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDocId), {
             progress: Math.round(progress) 
          }).catch(err => console.error("Error updating upload progress in Firestore:", err));
        },
        async (error) => {
          console.error("Upload error:", error);
          toast({ title: 'Erro no Upload', description: error.message, variant: 'destructive' });
          setIsUploading(false);
          if (analysisDocId) {
            await updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDocId), {
              status: 'error',
              errorMessage: `Upload failed: ${error.message}`,
              progress: 0,
            });
          } else {
            // If docId was never created, update the temp one
             setCurrentAnalysis(prev => prev?.id === tempAnalysisId ? {...prev, status: 'error', errorMessage: `Upload failed: ${error.message}`} : prev);
          }
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, 'users', user.uid, 'analyses', analysisDocId), {
            powerQualityDataUrl: downloadURL,
            status: 'identifying_regulations',
            progress: 0, // Reset progress for the next AI step
          });
          setIsUploading(false);
          setFileToUpload(null);
          onSuccess(); // Navigate to progress/results view
          
          // Trigger AI processing. Firestore updates will be handled by onSnapshot
          await processAnalysisFile(analysisDocId, user.uid);
        }
      );
    } catch (error) {
      console.error("Error starting analysis:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Erro ao Iniciar Análise', description: errorMessage, variant: 'destructive' });
      setIsUploading(false);
       // Update currentAnalysis to reflect the error, using the most recent ID available
      const idToUpdate = analysisDocId || tempAnalysisId;
      setCurrentAnalysis(prev => 
          prev?.id === idToUpdate ? 
          { ...prev, status: 'error', errorMessage } : 
          { 
              id: idToUpdate, 
              userId: user.uid, 
              fileName: fileToUpload?.name || "Arquivo desconhecido", 
              status: 'error', 
              progress: 0, 
              createdAt: new Date().toISOString(), 
              tags: [], 
              errorMessage 
          }
      );
    }
  }, [fileToUpload, user, toast]);

  const fetchPastAnalyses = useCallback(async () => {
    if (!user) return;
    setIsLoadingPastAnalyses(true);
    try {
      const analyses = await getPastAnalysesAction(user.uid);
      setPastAnalyses(analyses.filter(a => a.status !== 'deleted'));
    } catch (error) {
      toast({ title: 'Erro ao buscar análises', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsLoadingPastAnalyses(false);
    }
  }, [user, toast]);

  const handleAddTag = useCallback(async (analysisId: string, tag: string) => {
    if (!user || !tag.trim() || !analysisId) return;
    try {
      await addTagToAction(user.uid, analysisId, tag.trim());
      // Firestore onSnapshot will update currentAnalysis. Update pastAnalyses manually for immediate UI feedback.
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: [...(a.tags || []), tag.trim()] } : a));
      setTagInput('');
      toast({ title: 'Tag adicionada', description: `Tag "${tag.trim()}" adicionada.` });
    } catch (error) {
      toast({ title: 'Erro ao adicionar tag', description: (error as Error).message, variant: 'destructive' });
    }
  }, [user, toast]);

  const handleRemoveTag = useCallback(async (analysisId: string, tagToRemove: string) => {
    if (!user || !analysisId) return;
    try {
      await removeTagAction(user.uid, analysisId, tagToRemove);
      // Firestore onSnapshot will update currentAnalysis. Update pastAnalyses manually.
      setPastAnalyses(prev => prev.map(a => a.id === analysisId ? { ...a, tags: (a.tags || []).filter(t => t !== tagToRemove) } : a));
      toast({ title: 'Tag removida', description: `Tag "${tagToRemove}" removida.` });
    } catch (error) {
      toast({ title: 'Erro ao remover tag', description: (error as Error).message, variant: 'destructive' });
    }
  }, [user, toast]);

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
      toast({ title: 'Erro ao excluir', description: (error as Error).message, variant: 'destructive' });
    }
  }, [user, toast, currentAnalysis?.id]);

  const downloadReportAsTxt = (reportText: string | undefined, fileName: string) => {
    if (!reportText) {
      toast({ title: "Download não disponível", description: "O relatório está vazio.", variant: "destructive" });
      return;
    }
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName.replace('.csv', '')}_relatorio_conformidade.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const displayedAnalysisSteps = useMemo(() => {
    let steps: AnalysisStep[] = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending', progress: 0 }));

    if (currentAnalysis) {
      const { status, progress, errorMessage, powerQualityDataUrl, identifiedRegulations, summary } = currentAnalysis;
      
      // Determine current actual step progress based on overall analysis progress if it's not specifically for upload
      const currentOverallProgress = status === 'uploading' ? _uploadProgress : progress;

      switch (status) {
        case 'uploading':
          steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'in_progress', progress: Math.round(_uploadProgress) };
          break;
        case 'identifying_regulations':
          steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
          steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'in_progress', progress: currentOverallProgress };
          break;
        case 'assessing_compliance':
          steps[0] = { ...BASE_ANALYSIS_STEPS[0], status: 'completed', progress: 100 };
          steps[1] = { ...BASE_ANALYSIS_STEPS[1], status: 'completed', progress: 100 };
          steps[2] = { ...BASE_ANALYSIS_STEPS[2], status: 'in_progress', progress: currentOverallProgress };
          break;
        case 'completed':
          steps = BASE_ANALYSIS_STEPS.map(s => ({ ...s, status: 'completed', progress: 100 }));
          break;
        case 'error':
          let errorStepIndex = 0;
          // Simplified error step determination.
          // Assumes error happens at the current named status if not upload.
          // For upload, error is always at step 0.
          if (!powerQualityDataUrl) { // Error likely during or before upload completion
            errorStepIndex = 0; 
          } else if (!identifiedRegulations) { // Error likely during identifying regulations
            errorStepIndex = 1; 
          } else if (!summary ) { // Error likely during assessing compliance
            errorStepIndex = 2; 
          } else { // Error during final report generation or unknown
            errorStepIndex = 3; 
          }
          
          steps = steps.map((step, index) => {
            if (index < errorStepIndex) return { ...step, status: 'completed', progress: 100 };
            if (index === errorStepIndex) return { ...step, status: 'error', details: errorMessage || 'Erro desconhecido' };
            return { ...step, status: 'pending', progress: 0 };
          });
          break;
        default:
          // All pending or unknown state
          break;
      }
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

    