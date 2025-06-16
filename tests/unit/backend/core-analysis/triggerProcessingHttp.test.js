// @ts-check
'use strict';

/**
 * @fileOverview Unit test suite for the httpsCallableTriggerProcessing Firebase Function.
 */

import { APP_CONFIG } from '../../../../functions/lib/shared/config/appConfig.js';
import { httpsCallableTriggerProcessing } from '../../../../functions/src/core-analysis/triggerProcessingHttp.js';

// Mock firebase-admin before importing the function
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockFirestoreService = {
  doc: jest.fn(() => ({ get: mockDocGet, update: mockDocUpdate })),
};
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestoreService),
}));

const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;
const MOCK_USER_ID = 'test-user-trigger';
const MOCK_ANALYSIS_ID = 'analysis-id-trigger';

describe('httpsCallableTriggerProcessing (Unit)', () => {
  beforeEach(() => {
    mockDocGet.mockReset();
    mockDocUpdate.mockReset();
    if (jest.isMockFunction(mockFirestoreService.doc)) {
      // Check if it's a mock before clearing
      mockFirestoreService.doc.mockClear();
    }
  });

  const validAuthContext = { auth: { uid: MOCK_USER_ID } };
  const validData = { analysisId: MOCK_ANALYSIS_ID };

  it('should throw "unauthenticated" if no auth context', async () => {
    await expect(httpsCallableTriggerProcessing(validData, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    // @ts-expect-error - Testing invalid input: missing analysisId
    await expect(httpsCallableTriggerProcessing({}, validAuthContext)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise é obrigatório.',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    await expect(httpsCallableTriggerProcessing(validData, validAuthContext)).rejects.toMatchObject(
      {
        code: 'not-found',
        message: `Documento da análise ${MOCK_ANALYSIS_ID} não encontrado.`,
      }
    );
    expect(mockFirestoreService.doc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
  });

  it('should throw "failed-precondition" and update status to error if powerQualityDataUrl is missing', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ powerQualityDataUrl: null, status: 'uploading' }),
    });
    mockDocUpdate.mockResolvedValueOnce({}); // For the error update

    await expect(httpsCallableTriggerProcessing(validData, validAuthContext)).rejects.toMatchObject(
      {
        code: 'failed-precondition',
        message:
          'URL do arquivo de dados não encontrada. Não é possível enfileirar para processamento.',
      }
    );
    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: 'URL do arquivo de dados não encontrada. Reenvie o arquivo.',
      progress: 0,
    });
  });

  ['completed', 'cancelling', 'cancelled', 'deleted'].forEach((terminalStatus) => {
    it(`should return success with message if status is already "${terminalStatus}"`, async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          powerQualityDataUrl: 'some/url.csv',
          status: terminalStatus,
        }),
      });
      const result = await httpsCallableTriggerProcessing(validData, validAuthContext);
      expect(result.success).toBe(true);
      expect(result.message).toContain(
        `Análise ${MOCK_ANALYSIS_ID} está em status '${terminalStatus}'`
      );
      expect(mockDocUpdate).not.toHaveBeenCalled();
    });
  });

  it('should update status to "summarizing_data" and return success if analysis is ready', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        powerQualityDataUrl: 'some/url.csv',
        status: 'uploading',
        progress: 5,
      }),
    });
    mockDocUpdate.mockResolvedValueOnce({});
    const result = await httpsCallableTriggerProcessing(validData, validAuthContext);
    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'summarizing_data',
      progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
      errorMessage: null,
    });
    expect(result.success).toBe(true);
    expect(result.message).toBe('Análise enfileirada para processamento.');
  });

  it('should handle Firestore update error and attempt to set error status', async () => {
    const initialDocData = {
      powerQualityDataUrl: 'some/url.csv',
      status: 'uploading',
      progress: 5,
    };
    const firestoreUpdateError = new Error('Firestore update failed');

    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData });
    mockDocUpdate.mockRejectedValueOnce(firestoreUpdateError); // First update fails
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData }); // For error update
    mockDocUpdate.mockResolvedValueOnce({}); // Error update succeeds

    await expect(httpsCallableTriggerProcessing(validData, validAuthContext)).rejects.toMatchObject(
      {
        code: 'internal',
        message: expect.stringContaining(
          'Falha ao enfileirar para processamento: Firestore update failed'
        ),
      }
    );
    expect(mockDocUpdate).toHaveBeenCalledTimes(2);
    expect(mockDocUpdate).toHaveBeenLastCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(
        'Erro ao enfileirar para processamento (TriggerHttp): Firestore update failed'
      ),
    });
  });
});
