// src/features/file-upload/hooks/useFileUploadManager.ts
'use client';

import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
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
  fileName: string | null; // Adicionado para manter o nome do arquivo
  error?: string | null;
}

export function useFileUploadManager() {
  const { toast } = useToast();
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Progresso do upload do arquivo (0-100)
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFileToUpload(file);
        setUploadError(null); // Limpa erro anterior ao selecionar novo arquivo
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
        console.error(`[useFileUploadManager_upload] ${msg}`);
        toast({ title: 'Erro de Autenticação', description: msg, variant: 'destructive' });
        setUploadError(msg);
        return { analysisId: null, fileName: null, error: msg };
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

      // 1. Criar registro inicial no Firestore
      const { analysisId: newAnalysisId, error: createRecordError } =
        await createInitialAnalysisRecordAction(currentUserId, currentFileName);

      if (createRecordError || !newAnalysisId) {
        console.error(`[useFileUploadManager_upload] Failed to create initial record: ${createRecordError}`);
        toast({ title: 'Erro ao Iniciar Análise', description: createRecordError || 'Não foi possível criar o registro da análise.', variant: 'destructive' });
        setIsUploading(false);
        setUploadError(createRecordError || 'Falha na criação do registro.');
        return { analysisId: null, fileName: currentFileName, error: createRecordError || 'Falha na criação do registro.' };
      }

      console.log(`[useFileUploadManager_upload] Initial record created. Analysis ID: ${newAnalysisId}. Starting GCS upload.`);

      // 2. Fazer upload para o Firebase Storage
      const filePath = `user_uploads/${currentUserId}/${newAnalysisId}/${currentFileName}`;
      const fileStorageRef = storageRef(storage, filePath);
      const uploadTask = uploadBytesResumable(fileStorageRef, fileToUpload);

      return new Promise<FileUploadManagerResult>((resolve) => {
        uploadTask.on(
          'state_changed',
          async (snapshot) => {
            const currentUploadPercentage = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(currentUploadPercentage);
            try {
              await updateAnalysisUploadProgressAction(currentUserId, newAnalysisId, currentUploadPercentage);
            } catch (progressError) {
                console.warn(`[useFileUploadManager_upload] Minor error updating upload progress in Firestore for ${newAnalysisId}:`, progressError);
            }
          },
          async (error) => {
            console.error(`[useFileUploadManager_upload] GCS Upload error for ${newAnalysisId}:`, error);
            const errorMessage = error.message || 'Falha desconhecida no upload do arquivo.';
            toast({ title: 'Erro no Upload', description: errorMessage, variant: 'destructive' });
            setIsUploading(false);
            setUploadError(errorMessage);
            try {
              await markUploadAsFailedAction(currentUserId, newAnalysisId, errorMessage);
            } catch (markError) {
              console.error(`[useFileUploadManager_upload] Error marking upload as failed for ${newAnalysisId}:`, markError);
            }
            resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: errorMessage });
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log(`[useFileUploadManager_upload] GCS Upload complete for ${newAnalysisId}. URL: ${downloadURL}`);
              const { success, error: finalizeError } = await finalizeFileUploadRecordAction(
                currentUserId,
                newAnalysisId,
                downloadURL
              );

              if (!success) {
                console.error(`[useFileUploadManager_upload] Error finalizing upload record for ${newAnalysisId}: ${finalizeError}`);
                toast({ title: 'Erro Pós-Upload', description: finalizeError || 'Não foi possível finalizar o registro do arquivo.', variant: 'destructive' });
                setIsUploading(false);
                setUploadError(finalizeError || 'Falha na finalização do registro.');
                // Tentar marcar como falha geral se a finalização falhar
                await markUploadAsFailedAction(currentUserId, newAnalysisId, finalizeError || 'Falha ao finalizar registro do arquivo.');
                resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: finalizeError || 'Falha na finalização do registro.' });
                return;
              }
              
              toast({ title: 'Upload Concluído', description: 'Arquivo enviado com sucesso. O processamento será iniciado.' });
              setIsUploading(false);
              setFileToUpload(null); // Limpa o arquivo após o sucesso
              resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: null });
            } catch (completionError) {
              const errorMsg = completionError instanceof Error ? completionError.message : String(completionError);
              console.error(`[useFileUploadManager_upload] Error in completion callback for ${newAnalysisId}:`, completionError);
              toast({ title: 'Erro Crítico Pós-Upload', description: errorMsg, variant: 'destructive' });
              setIsUploading(false);
              setUploadError(errorMsg);
              try {
                await markUploadAsFailedAction(currentUserId, newAnalysisId, errorMsg);
              } catch (markError) {
                console.error(`[useFileUploadManager_upload] Error marking upload as failed after completion error for ${newAnalysisId}:`, markError);
              }
              resolve({ analysisId: newAnalysisId, fileName: currentFileName, error: errorMsg });
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
    uploadProgress, // Este é o progresso específico do upload do arquivo
    uploadError,
    handleFileSelection,
    uploadFileAndCreateRecord,
  };
}
