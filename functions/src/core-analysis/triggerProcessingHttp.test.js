// @ts-check
'use strict';

/**
 * @fileOverview Test suite for the httpsCallableTriggerProcessing Firebase Function.
 */

const admin = require('firebase-admin');
const functionsTest = require('firebase-functions-test')();

// Mock firebase-admin before importing the function
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    ...actualAdmin,
    initializeApp: jest.fn(),
    firestore: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      update: jest.fn(),
    }),
  };
});

// Import the function to be tested
const { httpsCallableTriggerProcessing } = require('./triggerProcessingHttp');
const { APP_CONFIG } = require('../../lib/shared/config/appConfig.js');

const UPLOAD_COMPLETED_OVERALL_PROGRESS = APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE;
const MOCK_USER_ID = 'test-user-trigger';
const MOCK_ANALYSIS_ID = 'analysis-id-trigger';

describe('httpsCallableTriggerProcessing', () => {
  let mockFirestoreDoc;
  let mockDocGet;
  let mockDocUpdate;

  beforeEach(() => {
    // @ts-ignore
    mockFirestoreDoc = admin.firestore().doc;
    // @ts-ignore
    mockDocGet = admin.firestore().get;
    // @ts-ignore
    mockDocUpdate = admin.firestore().update;

    mockFirestoreDoc.mockClear();
    mockDocGet.mockClear();
    mockDocUpdate.mockClear();
  });

  afterAll(() => {
    functionsTest.cleanup();
  });

  const wrapped = functionsTest.wrap(httpsCallableTriggerProcessing);
  const validAuthContext = { auth: { uid: MOCK_USER_ID } };
  const validData = { analysisId: MOCK_ANALYSIS_ID };

  it('should throw "unauthenticated" if no auth context', async () => {
    await expect(wrapped(validData, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('should throw "invalid-argument" if analysisId is missing', async () => {
    // @ts-ignore
    await expect(wrapped({}, validAuthContext)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'ID da análise é obrigatório.',
    });
  });

  it('should throw "not-found" if analysis document does not exist', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

    await expect(wrapped(validData, validAuthContext)).rejects.toMatchObject({
      code: 'not-found',
      message: `Documento da análise ${MOCK_ANALYSIS_ID} não encontrado.`,
    });
    expect(mockFirestoreDoc).toHaveBeenCalledWith(
      `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
    );
  });

  it('should throw "failed-precondition" and update status to error if powerQualityDataUrl is missing', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ powerQualityDataUrl: null, status: 'uploading' }),
    });
    mockDocUpdate.mockResolvedValueOnce({}); // For the error update
    mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

    await expect(wrapped(validData, validAuthContext)).rejects.toMatchObject({
      code: 'failed-precondition',
      message:
        'URL do arquivo de dados não encontrada. Não é possível enfileirar para processamento.',
    });
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
      mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

      const result = await wrapped(validData, validAuthContext);
      expect(result.success).toBe(true);
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
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
        progress: 5, // Less than UPLOAD_COMPLETED_OVERALL_PROGRESS
      }),
    });
    mockDocUpdate.mockResolvedValueOnce({});
    mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

    const result = await wrapped(validData, validAuthContext);

    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'summarizing_data',
      progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
      errorMessage: null,
    });
    expect(result.success).toBe(true);
    expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
    expect(result.message).toBe('Análise enfileirada para processamento.');
  });

  it('should keep progress if it is higher than UPLOAD_COMPLETED_OVERALL_PROGRESS when updating to summarizing_data', async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        powerQualityDataUrl: 'some/url.csv',
        status: 'error', // e.g., retrying from an error state
        progress: 25, // Higher than UPLOAD_COMPLETED_OVERALL_PROGRESS
      }),
    });
    mockDocUpdate.mockResolvedValueOnce({});
    mockFirestoreDoc.mockReturnValueOnce({ get: mockDocGet, update: mockDocUpdate });

    await wrapped(validData, validAuthContext);

    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'summarizing_data',
      progress: 25, // Should keep the existing higher progress
      errorMessage: null,
    });
  });

  it('should handle Firestore update error and attempt to set error status', async () => {
    const initialDocData = {
      powerQualityDataUrl: 'some/url.csv',
      status: 'uploading',
      progress: 5,
    };
    const firestoreUpdateError = new Error('Firestore update failed');

    // First get for initial check
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData });
    // Update to 'summarizing_data' fails
    mockDocUpdate.mockRejectedValueOnce(firestoreUpdateError);
    // Second get (inside catch block)
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData });
    // Update to 'error' (inside catch block)
    mockDocUpdate.mockResolvedValueOnce({});

    mockFirestoreDoc.mockReturnValue({ get: mockDocGet, update: mockDocUpdate });

    await expect(wrapped(validData, validAuthContext)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        'Falha ao enfileirar para processamento: Firestore update failed'
      ),
    });

    // Check the update call to set 'summarizing_data'
    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'summarizing_data',
      progress: UPLOAD_COMPLETED_OVERALL_PROGRESS,
      errorMessage: null,
    });
    // Check the subsequent update call to set 'error' status
    expect(mockDocUpdate).toHaveBeenCalledWith({
      status: 'error',
      errorMessage: expect.stringContaining(
        'Erro ao enfileirar para processamento (TriggerHttp): Firestore update failed'
      ),
    });
    expect(mockDocGet).toHaveBeenCalledTimes(2); // Called once initially, once in error handler
    expect(mockDocUpdate).toHaveBeenCalledTimes(2); // Called for 'summarizing_data' (failed), then for 'error'
  });

  it('should handle Firestore update error and also fail to update error status', async () => {
    const initialDocData = {
      powerQualityDataUrl: 'some/url.csv',
      status: 'uploading',
      progress: 5,
    };
    const firestoreUpdateError = new Error('Firestore primary update failed');
    const firestoreSecondaryUpdateError = new Error('Firestore error status update failed');

    // First get for initial check
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData });
    // Update to 'summarizing_data' fails
    mockDocUpdate.mockRejectedValueOnce(firestoreUpdateError);
    // Second get (inside catch block)
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => initialDocData });
    // Update to 'error' (inside catch block) also fails
    mockDocUpdate.mockRejectedValueOnce(firestoreSecondaryUpdateError);

    mockFirestoreDoc.mockReturnValue({ get: mockDocGet, update: mockDocUpdate });

    // We still expect the original error to be surfaced
    await expect(wrapped(validData, validAuthContext)).rejects.toMatchObject({
      code: 'internal',
      message: expect.stringContaining(
        'Falha ao enfileirar para processamento: Firestore primary update failed'
      ),
    });

    expect(mockDocGet).toHaveBeenCalledTimes(2);
    expect(mockDocUpdate).toHaveBeenCalledTimes(2);
  });
});
