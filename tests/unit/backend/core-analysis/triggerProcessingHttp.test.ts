// functions/src/core-analysis/__tests__/triggerProcessingHttp.test.ts
'use strict';

/**
 * @fileOverview Unit test suite for the httpsCallableTriggerProcessing Firebase Function.
 */
import * as functions from 'firebase-functions';

import { APP_CONFIG } from '../../../../config/appConfig';
import { httpsCallableTriggerProcessing } from '../../../../functions/src/core-analysis/triggerProcessingHttp';

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
const MOCK_USER_ID_TRIGGER = 'test-user-trigger';
const MOCK_ANALYSIS_ID_TRIGGER = 'analysis-id-trigger';

interface TriggerProcessingRequest {
  analysisId: string;
}

describe('httpsCallableTriggerProcessing (Unit)', () => {
  beforeEach(() => {
    mockDocGet.mockReset();
    mockDocUpdate.mockReset();
    if (jest.isMockFunction(mockFirestoreService.doc)) {
      mockFirestoreService.doc.mockClear();
    }
  });

  const validAuthContext = {
    auth: { uid: MOCK_USER_ID_TRIGGER },
  } as functions.https.CallableContext;
  const validData = { analysisId: MOCK_ANALYSIS_ID_TRIGGER };

  it('should throw "unauthenticated" if no auth context', async () => {
    await expect(
      httpsCallableTriggerProcessing(validData, {} as functions.https.CallableContext)
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    await expect(
      httpsCallableTriggerProcessing(
        {} as TriggerProcessingRequest,
        validAuthContext as functions.https.CallableContext
      )
    ).rejects.toMatchObject(<functions.https.HttpsError>{
      message: 'ID da análise é obrigatório.',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    await expect(httpsCallableTriggerProcessing(validData, validAuthContext)).rejects.toMatchObject(
      {
        code: 'not-found',
        message: `Documento da análise ${MOCK_ANALYSIS_ID_TRIGGER} não encontrado.`,
      }
    );
    expect(mockFirestoreService.doc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID_TRIGGER}/analyses/${MOCK_ANALYSIS_ID_TRIGGER}`
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
      status: 'failed', // Use 'failed' instead of 'error' as per common lifecycle
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
        `Análise ${MOCK_ANALYSIS_ID_TRIGGER} está em status '${terminalStatus}'`
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

    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData }); // For main logic
    mockDocUpdate.mockRejectedValueOnce(firestoreUpdateError); // First update fails
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData }); // For error update attempt
    mockDocUpdate.mockResolvedValueOnce({}); // Error update succeeds

    await expect(httpsCallableTriggerProcessing(validData, validAuthContext)).rejects.toMatchObject(
      {
        code: 'internal',
        message: expect.stringContaining(
          'Falha ao enfileirar para processamento: Firestore update failed'
        ),
      }
    );
    expect(mockDocUpdate).toHaveBeenCalledTimes(2); // One for trigger, one for error update
    expect(mockDocUpdate).toHaveBeenLastCalledWith({
      status: 'failed',
      errorMessage: expect.stringContaining(
        'Erro ao enfileirar para processamento (TriggerHttp): Firestore update failed'
      ),
    });
  });
});
