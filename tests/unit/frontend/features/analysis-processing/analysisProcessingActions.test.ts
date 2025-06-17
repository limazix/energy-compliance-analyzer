// src/features/analysis-processing/actions/analysisProcessingActions.test.ts
import { httpsCallable } from 'firebase/functions';

import { APP_CONFIG } from '@/config/appConfig';
import {
  processAnalysisFile,
  retryAnalysisAction,
} from '@/features/analysis-processing/actions/analysisProcessingActions';
import { functionsInstance } from '@/lib/firebase'; // For httpsCallable mock

import type { HttpsCallableResult } from 'firebase/functions';

// Mock firebase-admin
const mockAdminUpdate = jest.fn();
const mockAdminDocGet = jest.fn();
const mockAdminDoc = jest.fn(() => ({
  get: mockAdminDocGet,
  update: mockAdminUpdate,
}));
const mockAdminFirestore = {
  doc: mockAdminDoc,
};

jest.mock('@/lib/firebase-admin', () => ({
  adminDb: mockAdminFirestore,
}));

// Mock firebase/functions
jest.mock('firebase/functions', () => {
  const original = jest.requireActual('firebase/functions');
  return {
    ...original,
    httpsCallable: jest.fn(),
  };
});

const mockHttpsCallable = httpsCallable as jest.Mock;
const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;

const MOCK_USER_ID = 'test-user-proc';
const MOCK_ANALYSIS_ID = 'test-analysis-proc';

describe('Analysis Processing Server Actions (Unit)', () => {
  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockAdminUpdate.mockReset();
    mockAdminDocGet.mockReset();
    mockAdminDoc.mockClear();
  });

  describe('processAnalysisFile', () => {
    let mockCallableFn: jest.Mock;

    beforeEach(() => {
      mockCallableFn = jest.fn();
      mockHttpsCallable.mockReturnValue(mockCallableFn);
    });

    it('should call httpsCallableTriggerProcessing and return success', async () => {
      const mockResponse: HttpsCallableResult<{
        success: boolean;
        analysisId: string;
        message?: string;
      }> = {
        data: {
          success: true,
          analysisId: MOCK_ANALYSIS_ID,
          message: 'Processing triggered.',
        },
      };
      mockCallableFn.mockResolvedValueOnce(mockResponse);

      const result = await processAnalysisFile(MOCK_ANALYSIS_ID, MOCK_USER_ID);

      expect(mockHttpsCallable).toHaveBeenCalledWith(
        functionsInstance,
        'httpsCallableTriggerProcessing'
      );
      expect(mockCallableFn).toHaveBeenCalledWith({
        analysisId: MOCK_ANALYSIS_ID,
      });
      expect(result.success).toBe(true);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toBeUndefined();
    });

    it('should return an error if the callable function call fails', async () => {
      const callableError = new Error('Callable function failed');
      mockCallableFn.mockRejectedValueOnce(callableError);

      const result = await processAnalysisFile(MOCK_ANALYSIS_ID, MOCK_USER_ID);

      expect(result.success).toBe(false);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toContain('Erro ao enfileirar (SA): Callable function failed');
    });

    it('should return an error if the callable function response indicates failure', async () => {
      const mockResponse: HttpsCallableResult<{
        success: boolean;
        analysisId: string;
        error: string;
      }> = {
        data: {
          success: false,
          analysisId: MOCK_ANALYSIS_ID,
          error: 'Precondition failed in function.',
        },
      };
      mockCallableFn.mockResolvedValueOnce(mockResponse);

      const result = await processAnalysisFile(MOCK_ANALYSIS_ID, MOCK_USER_ID);

      expect(result.success).toBe(false);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toBe('Precondition failed in function.');
    });

    it('should return an error if analysisId is empty', async () => {
      const result = await processAnalysisFile('', MOCK_USER_ID);
      expect(result.success).toBe(false);
      expect(result.analysisId).toBe('');
      expect(result.error).toContain(`CRITICAL: analysisId is invalid ('' -> ''). Aborting.`);
      expect(mockCallableFn).not.toHaveBeenCalled();
    });

    it('should handle cases where analysisId is null or undefined', async () => {
      // @ts-expect-error - testing invalid input: analysisId cannot be null
      const resultNull = await processAnalysisFile(null, MOCK_USER_ID);
      expect(resultNull.success).toBe(false);
      expect(resultNull.analysisId).toBe('unknown_id'); // As per action's error handling
      expect(resultNull.error).toContain(
        `CRITICAL: analysisId is invalid ('null' -> ''). Aborting.`
      );

      // @ts-expect-error - testing invalid input: analysisId cannot be undefined
      const resultUndefined = await processAnalysisFile(undefined, MOCK_USER_ID);
      expect(resultUndefined.success).toBe(false);
      expect(resultUndefined.analysisId).toBe('unknown_id');
      expect(resultUndefined.error).toContain(
        `CRITICAL: analysisId is invalid ('undefined' -> ''). Aborting.`
      );
      expect(mockCallableFn).not.toHaveBeenCalled();
    });
  });

  describe('retryAnalysisAction', () => {
    it('should update Firestore and return success if analysis can be retried', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'error',
          powerQualityDataUrl: 'some/url/file.csv',
        }),
      });
      mockAdminUpdate.mockResolvedValueOnce(undefined);

      const result = await retryAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(mockAdminDoc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
      );
      expect(mockAdminDocGet).toHaveBeenCalledTimes(1);
      expect(mockAdminUpdate).toHaveBeenCalledWith({
        status: 'summarizing_data',
        progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
        errorMessage: null,
        powerQualityDataSummary: null,
        identifiedRegulations: null,
        structuredReport: null,
        mdxReportStoragePath: null,
        summary: null,
        completedAt: null,
      });
      expect(result.success).toBe(true);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toBeUndefined();
    });

    it('should return an error if analysis document is not found', async () => {
      mockAdminDocGet.mockResolvedValueOnce({ exists: false });

      const result = await retryAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(result.success).toBe(false);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toBe('Análise não encontrada.');
      expect(mockAdminUpdate).not.toHaveBeenCalled();
    });

    it('should return an error if analysis is not in "error" state', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'completed' }), // Not 'error'
      });

      const result = await retryAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(result.success).toBe(false);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toBe('A análise não está em estado de erro.');
      expect(mockAdminUpdate).not.toHaveBeenCalled();
    });

    it('should return an error if powerQualityDataUrl is missing', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'error', powerQualityDataUrl: null }), // Missing URL
      });

      const result = await retryAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(result.success).toBe(false);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toBe(
        'Dados do arquivo original ausentes. Não é possível tentar novamente.'
      );
      expect(mockAdminUpdate).not.toHaveBeenCalled();
    });

    it('should return an error if Firestore update fails', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'error',
          powerQualityDataUrl: 'some/url/file.csv',
        }),
      });
      const firestoreError = new Error('Firestore update failed');
      mockAdminUpdate.mockRejectedValueOnce(firestoreError);

      const result = await retryAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(result.success).toBe(false);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result.error).toContain('Erro ao reiniciar análise: Firestore update failed');
    });

    it('should return an error if userId or analysisId is invalid', async () => {
      const result1 = await retryAnalysisAction('', MOCK_ANALYSIS_ID);
      expect(result1.success).toBe(false);
      expect(result1.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(result1.error).toContain(
        `CRITICAL: userId ('') or analysisId ('${MOCK_ANALYSIS_ID}') is invalid. Aborting.`
      );

      const result2 = await retryAnalysisAction(MOCK_USER_ID, '');
      expect(result2.success).toBe(false);
      expect(result2.analysisId).toBe('');
      expect(result2.error).toContain(
        `CRITICAL: userId ('${MOCK_USER_ID}') or analysisId ('') is invalid. Aborting.`
      );
      expect(mockAdminDocGet).not.toHaveBeenCalled();
      expect(mockAdminUpdate).not.toHaveBeenCalled();
    });
  });
});
