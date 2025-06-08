
'use server';

import { Timestamp, getDocs, orderBy, query, FirestoreError, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';
import type { AnalyzeComplianceReportOutput } from '@/ai/flows/analyze-compliance-report';

function statusIsValid(status: any): status is Analysis['status'] {
    const validStatuses: Analysis['status'][] = ['uploading', 'summarizing_data', 'identifying_regulations', 'assessing_compliance', 'completed', 'error', 'deleted', 'cancelling', 'cancelled', 'reviewing_report'];
    return typeof status === 'string' && validStatuses.includes(status as Analysis['status']);
}

export async function getPastAnalysesAction(userIdInput: string): Promise<Analysis[]> {
  const userId = userIdInput?.trim() ?? '';
  console.debug(`[getPastAnalysesAction] Effective userId: '${userId}' (Input: '${userIdInput}')`);

  if (!userId) {
    const errorMsg = `[getPastAnalysesAction] CRITICAL: userId is invalid (input: '${userIdInput}').`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysesCollectionPath = `users/${userId}/analyses`;
  console.info(`[getPastAnalysesAction] Fetching for userId: ${userId}, path: '${analysesCollectionPath}', Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysesCol = collection(db, analysesCollectionPath);
  const q = query(analysesCol, orderBy('createdAt', 'desc'));

  try {
    const snapshot = await getDocs(q);
    console.info(`[getPastAnalysesAction] Found ${snapshot.docs.length} analyses for userId: ${userId}`);

    const mapTimestampToISO = (timestampFieldValue: any): string | undefined => {
      if (timestampFieldValue && typeof timestampFieldValue.toDate === 'function') {
        return (timestampFieldValue as Timestamp).toDate().toISOString();
      }
      if (typeof timestampFieldValue === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(timestampFieldValue)) {
        return timestampFieldValue;
      }
      return undefined;
    };

    return snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const analysisResult: Partial<Analysis> = {
        id: docSnap.id,
        userId: data.userId as string,
        fileName: data.fileName as string,
        title: data.title as string | undefined,
        description: data.description as string | undefined,
        languageCode: data.languageCode as string | undefined,
        status: data.status as Analysis['status'],
        progress: data.progress as number,
        uploadProgress: data.uploadProgress as number | undefined,
        powerQualityDataUrl: data.powerQualityDataUrl as string | undefined,
        powerQualityDataSummary: data.powerQualityDataSummary as string | undefined,
        isDataChunked: data.isDataChunked as boolean | undefined,
        identifiedRegulations: data.identifiedRegulations as string[] | undefined,
        summary: data.summary as string | undefined, 
        structuredReport: data.structuredReport as AnalyzeComplianceReportOutput | undefined,
        mdxReportStoragePath: data.mdxReportStoragePath as string | undefined,
        errorMessage: data.errorMessage as string | undefined,
        tags: (data.tags || []) as string[],
      };

      analysisResult.createdAt = mapTimestampToISO(data.createdAt) || new Date(0).toISOString();
      analysisResult.completedAt = mapTimestampToISO(data.completedAt);
      
      if (!statusIsValid(analysisResult.status)) {
        console.warn(`[getPastAnalysesAction] Analysis ${docSnap.id} has invalid status: ${analysisResult.status}. Defaulting to 'error'.`);
        analysisResult.status = 'error';
        analysisResult.errorMessage = analysisResult.errorMessage || `Status inválido (${data.status}) recebido do Firestore.`;
      }

      return analysisResult as Analysis;
    });
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[getPastAnalysesAction] Error fetching for userId ${userId} from ${analysesCollectionPath}:`, originalErrorMessage, error);
    if (error instanceof FirestoreError && (error.code === 'permission-denied' || error.code === 7)) {
        console.error(`[getPastAnalysesAction] PERMISSION_DENIED query path '${analysesCollectionPath}' for userId '${userId}'. Project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}'. Firestore error: ${error.code}, ${error.message}`);
    }
    throw new Error(`Falha ao buscar análises: ${originalErrorMessage}`);
  }
}


    