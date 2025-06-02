
'use server';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Analysis, AnalysisReportData } from '@/types/analysis';
import { getFileContentFromStorage } from '@/lib/gcsUtils';

const CLIENT_ERROR_MESSAGE_MAX_LENGTH = 250;

export async function getAnalysisReportAction(
  userIdInput: string,
  analysisIdInput: string
): Promise<AnalysisReportData> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  console.log(`[getAnalysisReportAction] Effective userId: '${userId}', analysisId: '${analysisId}' (Inputs: '${userIdInput}', '${analysisIdInput}')`);
  
  const baseReturn = { mdxContent: null, fileName: null, analysisId: analysisIdInput || null };

  if (!userId || !analysisId) {
    const errorMsg = "[getAnalysisReportAction] User ID e Analysis ID são obrigatórios.";
    console.error(errorMsg + ` User: ${userIdInput}, Analysis: ${analysisIdInput}`);
    return { ...baseReturn, analysisId: analysisId || null, error: errorMsg };
  }

  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.log(`[getAnalysisReportAction] Fetching report from ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);

  try {
    const docSnap = await getDoc(analysisRef);
    if (!docSnap.exists()) {
      return { ...baseReturn, error: "Análise não encontrada ou você não tem permissão." };
    }

    const analysisData = docSnap.data() as Analysis;
    if (analysisData.userId !== userId) {
      return { ...baseReturn, error: "Você não tem permissão para acessar este relatório." };
    }
    if (analysisData.status === 'deleted') {
        return { ...baseReturn, fileName: analysisData.fileName, error: "Esta análise foi excluída." };
    }
    if (analysisData.status === 'cancelled' || analysisData.status === 'cancelling') {
        return { ...baseReturn, fileName: analysisData.fileName, error: "Esta análise foi cancelada." };
    }
    if (!analysisData.mdxReportStoragePath) {
      return { ...baseReturn, fileName: analysisData.fileName, error: "Relatório MDX não encontrado para esta análise." };
    }

    const mdxContent = await getFileContentFromStorage(analysisData.mdxReportStoragePath);
    return { mdxContent, fileName: analysisData.fileName, analysisId, error: null };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getAnalysisReportAction] Error for ${analysisDocPath}:`, errorMessage);
    return { ...baseReturn, error: `Erro ao carregar o relatório: ${errorMessage.substring(0, CLIENT_ERROR_MESSAGE_MAX_LENGTH)}` };
  }
}
