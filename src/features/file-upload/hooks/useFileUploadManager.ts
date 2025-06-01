
// src/features/file-upload/hooks/useFileUploadManager.ts
'use client';

import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, type FirebaseStorageError } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/firebase';
import {
  createInitialAnalysisRecordAction,
  updateAnalysisUploadProgressAction,
  finalizeFileUploadRecordAction,
  markUploadAsFailedAction,
} from '@/features/file-upload/actions/fileUploadActions';

export interface FileUploadManagerResult {
  analysisId: string | null;
  fileName: string | null;
  error?: string | null;
}

export function useFileUploadManager() {
  const { toast } = useToast();
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFileToUpload(file);
        setUploadError(null);
        setUploadProgress(0);
        console.log(`[useFileUploadManager] File selected: ${file.name}, type: ${file.type}`);
      } else {
        toast({ title: 'Arquivo inválido', description: 'Por favor, selecione um arquivo CSV.', variant: 'destructive' });
        setFileToUpload(null);
        setUploadError('Arquivo inválido. Selecione um CSV.');
      }
    } else {
      setFileToUpload(null);
    }
  }, [toast]);

  const uploadFileAndCreateRecord = useCallback(
    async (user: User | null): Promise<FileUploadManagerResult> => {
      if (!user || !user.uid || user.uid.trim() === '') {
        const msg = 'Usuário não autenticado ou UID inválido.';
        console.error(`[useFileUploadManager_upload] Critical: ${msg}`);
        toast({ title: 'Erro de Autenticação', description: msg, variant: 'destructive' });
        setUploadError(msg);
        return { analysisId: null, fileName: fileToUpload?.name || null, error: msg };
      }
      if (!fileToUpload) {
        const msg = 'Nenhum arquivo selecionado para upload.';
        console.warn(`[useFileUploadManager_upload] ${msg}`);
        toast({ title: 'Nenhum Arquivo', description: msg, variant: 'destructive' });
        setUploadError(msg);
        return { analysisId: null, fileName: null, error: msg };
      }
      if (!fileToUpload.name || fileToUpload.name.trim() === "") {
        const msg = 'Nome de arquivo inválido.';
        console.warn(`[useFileUploadManager_upload] ${msg}`);
        toast({ title: 'Nome Inválido', description: msg, variant: 'destructive' });
        setUploadError(msg);
        return { analysisId: null, fileName: null, error: msg };
      }

      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      const currentUserId = user.uid;
      const currentFileName = fileToUpload.name;

      console.log(`[useFileUploadManager_upload] Attempting to create initial record for: ${currentFileName}, User: ${currentUserId}`);
      const { analysisId: newAnalysisId, error: createRecordError } =
        await createInitialAnalysisRecordAction(currentUserId, currentFileName);

      if (createRecordError || !newAnalysisId) {
        const detailedError = `[useFileUploadManager_upload] Failed to create initial Firestore record: ${createRecordError || 'newAnalysisId is null/undefined'}. FileName: ${currentFileName}`;
        console.error(detailedError);
        toast({ title: 'Erro ao Iniciar Análise', description: createRecordError || 'Não foi possível criar o registro da análise no Firestore.', variant: 'destructive' });
        setIsUploading(false);
        setUploadError(createRecordError || 'Falha na criação do registro no Firestore.');
        // Retorna o erro, o upload para o Storage não deve prosseguir
        return { analysisId: null, fileName: currentFileName, error: createRecordError || 'Falha na criação do registro no Firestore.' };
      }

      console.log(`[useFileUploadManager_upload] Initial Firestore record created. Analysis ID: ${newAnalysisId}. Starting Storage upload for: ${currentFileName}`);
      
      const filePath = `user_uploads/${currentUserId}/${newAnalysisId}/${currentFileName}`;
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

      return new Promise<FileUploadManagerResult>((resolve) => {
        uploadTask.on(
          'state_changed',
          async (snapshot) => {
            try {
              const currentUploadPercentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(currentUploadPercentage);
              // Atualiza o progresso no Firestore de forma "best-effort"
              if (newAnalysisId) { // Verifica se newAnalysisId é válido
                await updateAnalysisUploadProgressAction(currentUserId, newAnalysisId, currentUploadPercentage);
              }
            } catch (progressError) {
                console.warn(`[useFileUploadManager_upload] Non-critical error updating upload progress in Firestore for ${newAnalysisId}:`, progressError);
            }
          },
          async (storageError: FirebaseStorageError) => {
            try {
              const errorMessage = `Falha no upload para o Firebase Storage: ${storageError.code} - ${storageError.message}`;
              console.error(`[useFileUploadManager_upload] Firebase Storage upload error for analysis ${newAnalysisId}, file ${currentFileName}:`, storageError);
              toast({ title: 'Erro no Upload do Arquivo', description: errorMessage, variant: 'destructive' });
              setIsUploading(false);
              setUploadError(errorMessage);
              if (newAnalysisId) { // Verifica se newAnalysisId é válido
                await markUploadAsFailedAction(currentUserId, newAnalysisId, errorMessage);
              }
              resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: errorMessage });
            } catch (markFailError) {
              const finalErrorMsg = `Erro no upload e também ao marcar falha: ${markFailError instanceof Error ? markFailError.message : String(markFailError)}`;
              console.error(`[useFileUploadManager_upload] Error marking upload as failed for ${newAnalysisId} after Storage error:`, markFailError);
              resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: finalErrorMsg });
            }
          },
          async () => { // On Success
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log(`[useFileUploadManager_upload] Storage Upload complete for ${newAnalysisId}. URL: ${downloadURL}. Finalizing Firestore record.`);
              
              const { success: finalizeSuccess, error: finalizeError } = await finalizeFileUploadRecordAction(
                currentUserId,
                newAnalysisId, // newAnalysisId deve ser válido aqui
                downloadURL
              );

              if (!finalizeSuccess) {
                const errorMessage = `Erro ao finalizar registro do upload no Firestore: ${finalizeError || 'Erro desconhecido'}`;
                console.error(`[useFileUploadManager_upload] ${errorMessage} for analysis ${newAnalysisId}`);
                toast({ title: 'Erro Pós-Upload', description: errorMessage, variant: 'destructive' });
                setIsUploading(false);
                setUploadError(errorMessage);
                await markUploadAsFailedAction(currentUserId, newAnalysisId, errorMessage);
                resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: errorMessage });
                return;
              }
              
              toast({ title: 'Upload Concluído', description: `Arquivo "${currentFileName}" enviado. O processamento será iniciado.` });
              setIsUploading(false);
              setFileToUpload(null); 
              resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: null });
            } catch (completionError) {
              const errorMsg = completionError instanceof Error ? completionError.message : String(completionError);
              const finalErrorMessage = `Erro crítico na conclusão do upload: ${errorMsg}`;
              console.error(`[useFileUploadManager_upload] ${finalErrorMessage} for analysis ${newAnalysisId}:`, completionError);
              toast({ title: 'Erro Crítico Pós-Upload', description: finalErrorMessage, variant: 'destructive' });
              setIsUploading(false);
              setUploadError(finalErrorMessage);
              if (newAnalysisId) {
                try {
                  await markUploadAsFailedAction(currentUserId, newAnalysisId, finalErrorMessage);
                } catch (markError) {
                  console.error(`[useFileUploadManager_upload] Error marking upload as failed after completion error for ${newAnalysisId}:`, markError);
                }
              }
              resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: finalErrorMessage });
            }
          }
        );
      });
    },
    [toast, fileToUpload]
  );

  return {
    fileToUpload,
    isUploading,
    uploadProgress,
    uploadError,
    handleFileSelection,
    uploadFileAndCreateRecord,
  };
}
