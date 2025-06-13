// src/features/analysis-management/actions/analysisManagementActions.test.ts
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

// Mock firebase-admin
const mockPublishMessage = jest.fn();
const mockTopic = jest.fn(() => ({
  publishMessage: mockPublishMessage,
}));
const mockPubSub = jest.fn(() => ({
  topic: mockTopic,
}));

const mockAdminDocGet = jest.fn();
const mockAdminDoc = jest.fn(() => ({
  get: mockAdminDocGet,
}));
const mockAdminFirestore = {
  doc: mockAdminDoc,
};

jest.mock('@/lib/firebase-admin', () => ({
  adminDb: mockAdminFirestore,
  adminPubSub: { topic: mockTopic }, // Use the mock directly here
}));

// Mock firebase/functions
jest.mock('firebase/functions', () => {
  const original = jest.requireActual('firebase/functions');
  return {
    ...original,
    httpsCallable: jest.fn(),
  };
});

import { APP_CONFIG } from '@/config/appConfig';
import { functionsInstance } from '@/lib/firebase'; // For httpsCallable mock

import { deleteAnalysisAction, cancelAnalysisAction } from './analysisManagementActions';

const mockHttpsCallable = httpsCallable as jest.Mock;
const ANALYSIS_DELETION_TOPIC = APP_CONFIG.TOPIC_ANALYSIS_DELETION_REQUEST;

const MOCK_USER_ID = 'test-user-id-mgm';
const MOCK_ANALYSIS_ID = 'test-analysis-id-mgm';

describe('Analysis Management Server Actions', () => {
  beforeEach(() => {
    mockPublishMessage.mockClear();
    mockTopic.mockClear();
    // mockPubSub.mockClear(); // Not needed to clear if adminPubSub is directly mocked with mockTopic
    mockAdminDocGet.mockClear();
    mockAdminDoc.mockClear();
    mockHttpsCallable.mockClear();
  });

  describe('deleteAnalysisAction', () => {
    it('should publish a message to Pub/Sub if analysis exists and is not already deleted/pending', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'completed' }),
      });
      mockPublishMessage.mockResolvedValueOnce('mock-message-id');

      await deleteAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(mockAdminDoc).toHaveBeenCalledWith(
        `users/${MOCK_USER_ID}/analyses/${MOCK_ANALYSIS_ID}`
      );
      expect(mockAdminDocGet).toHaveBeenCalledTimes(1);
      expect(mockTopic).toHaveBeenCalledWith(ANALYSIS_DELETION_TOPIC);
      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: expect.any(Buffer), // Check if it's a buffer
      });
      // Optionally, decode buffer to check payload
      const sentData = JSON.parse(mockPublishMessage.mock.calls[0][0].data.toString());
      expect(sentData.userId).toBe(MOCK_USER_ID);
      expect(sentData.analysisId).toBe(MOCK_ANALYSIS_ID);
      expect(sentData.requestedAt).toBeDefined();
    });

    it('should throw an error if Pub/Sub publishing fails', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'completed' }),
      });
      const pubSubError = new Error('Pub/Sub publish error');
      mockPublishMessage.mockRejectedValueOnce(pubSubError);

      await expect(deleteAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID)).rejects.toThrow(
        expect.stringContaining(
          'Falha ao solicitar exclusão da análise (SA Pub/Sub): Pub/Sub publish error'
        )
      );
    });

    it('should throw an error if analysis document is not found', async () => {
      mockAdminDocGet.mockResolvedValueOnce({ exists: false });

      await expect(deleteAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID)).rejects.toThrow(
        'Análise não encontrada ou você não tem permissão.'
      );
      expect(mockPublishMessage).not.toHaveBeenCalled();
    });

    it('should not publish if analysis is already "deleted"', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'deleted' }),
      });

      await deleteAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);
      expect(mockPublishMessage).not.toHaveBeenCalled();
    });

    it('should not publish if analysis is already "pending_deletion"', async () => {
      mockAdminDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: 'pending_deletion' }),
      });

      await deleteAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);
      expect(mockPublishMessage).not.toHaveBeenCalled();
    });

    it('should throw an error if userId or analysisId is invalid', async () => {
      await expect(deleteAnalysisAction('', MOCK_ANALYSIS_ID)).rejects.toThrow(
        expect.stringContaining("userId ('') or analysisId ('test-analysis-id-mgm') invalid")
      );
      await expect(deleteAnalysisAction(MOCK_USER_ID, '')).rejects.toThrow(
        expect.stringContaining("userId ('test-user-id-mgm') or analysisId ('') invalid")
      );
      expect(mockPublishMessage).not.toHaveBeenCalled();
    });
  });

  describe('cancelAnalysisAction', () => {
    let mockCallableFn: jest.Mock;

    beforeEach(() => {
      mockCallableFn = jest.fn();
      mockHttpsCallable.mockReturnValue(mockCallableFn);
    });

    it('should call httpsCallableCancelAnalysis and return success', async () => {
      const mockResponse: HttpsCallableResult<{ success: boolean; message: string }> = {
        data: { success: true, message: 'Cancelamento solicitado.' },
      };
      mockCallableFn.mockResolvedValueOnce(mockResponse);

      const result = await cancelAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(mockHttpsCallable).toHaveBeenCalledWith(
        functionsInstance,
        'httpsCallableCancelAnalysis'
      );
      expect(mockCallableFn).toHaveBeenCalledWith({ analysisId: MOCK_ANALYSIS_ID });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Cancelamento solicitado.');
    });

    it('should return an error if the callable function call fails', async () => {
      const callableError = new Error('Callable function failed');
      mockCallableFn.mockRejectedValueOnce(callableError);

      const result = await cancelAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Falha ao solicitar cancelamento (SA): Callable function failed'
      );
    });

    it('should return an error if the callable function response indicates failure', async () => {
      const mockResponse: HttpsCallableResult<{ success: boolean; error: string }> = {
        data: { success: false, error: 'Analysis already completed.' },
      };
      mockCallableFn.mockResolvedValueOnce(mockResponse);

      const result = await cancelAnalysisAction(MOCK_USER_ID, MOCK_ANALYSIS_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analysis already completed.');
    });

    it('should return an error if userId or analysisId is invalid', async () => {
      const result1 = await cancelAnalysisAction('', MOCK_ANALYSIS_ID);
      expect(result1.success).toBe(false);
      expect(result1.error).toContain(
        "CRITICAL: userId ('') or analysisId ('test-analysis-id-mgm') invalid."
      );

      const result2 = await cancelAnalysisAction(MOCK_USER_ID, '');
      expect(result2.success).toBe(false);
      expect(result2.error).toContain(
        "CRITICAL: userId ('test-user-id-mgm') or analysisId ('') invalid."
      );
      expect(mockCallableFn).not.toHaveBeenCalled();
    });
  });
});
