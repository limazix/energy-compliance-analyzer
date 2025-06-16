// src/features/file-upload/actions/fileUploadActions.test.ts
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { APP_CONFIG } from '@/config/appConfig';
import {
  createInitialAnalysisRecordAction,
  markUploadAsFailedAction,
  notifyFileUploadCompleteAction, // Changed from finalizeFileUploadRecordAction
  updateAnalysisUploadProgressAction,
} from '@/features/file-upload/actions/fileUploadActions';
import { functionsInstance } from '@/lib/firebase'; // Firebase Functions instance for client SDK
// Mock firebase-admin for Pub/Sub used in notifyFileUploadCompleteAction
const mockPublishMessage = jest.fn();
const mockTopic = jest.fn(() => ({ publishMessage: mockPublishMessage }));
jest.mock('@/lib/firebase-admin', () => ({
  adminDb: {}, // Placeholder for adminDb if not used by SUT here
  adminPubSub: { topic: mockTopic }, // Provide the mock for adminPubSub
}));

// Mock firebase/functions for httpsCallable
jest.mock('firebase/functions', () => {
  const original = jest.requireActual('firebase/functions');
  return {
    ...original,
    httpsCallable: jest.fn(),
  };
});

const mockHttpsCallable = httpsCallable as jest.Mock;
const FILE_UPLOAD_COMPLETED_TOPIC = APP_CONFIG.TOPIC_FILE_UPLOAD_COMPLETED;

const MOCK_USER_ID = 'test-user-upload';
const MOCK_ANALYSIS_ID = 'test-analysis-upload';
const MOCK_FILE_NAME = 'test-file.csv';

describe('File Upload Server Actions (Unit)', () => {
  let mockCallableFn: jest.Mock;

  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockCallableFn = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallableFn);
    mockPublishMessage.mockReset();
    mockTopic.mockClear();
  });

  describe('createInitialAnalysisRecordAction', () => {
    it('should call httpsCreateInitialAnalysisRecord and return analysisId', async () => {
      const mockResponse: HttpsCallableResult<{ analysisId: string }> = {
        data: { analysisId: MOCK_ANALYSIS_ID },
      };
      mockCallableFn.mockResolvedValueOnce(mockResponse);
      const result = await createInitialAnalysisRecordAction(MOCK_USER_ID, MOCK_FILE_NAME);
      expect(mockHttpsCallable).toHaveBeenCalledWith(
        functionsInstance,
        'httpsCreateInitialAnalysisRecord'
      );
      expect(mockCallableFn).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: MOCK_FILE_NAME })
      );
      expect(result.analysisId).toBe(MOCK_ANALYSIS_ID);
    });

    it('should return an error if httpsCreateInitialAnalysisRecord fails', async () => {
      mockCallableFn.mockRejectedValueOnce(new Error('Function call failed'));
      const result = await createInitialAnalysisRecordAction(MOCK_USER_ID, MOCK_FILE_NAME);
      expect(result.error).toContain('Function Call Error');
    });
  });

  describe('updateAnalysisUploadProgressAction', () => {
    it('should call httpsUpdateAnalysisUploadProgress and return success', async () => {
      mockCallableFn.mockResolvedValueOnce({ data: { success: true } });
      const result = await updateAnalysisUploadProgressAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 50);
      expect(mockHttpsCallable).toHaveBeenCalledWith(
        functionsInstance,
        'httpsUpdateAnalysisUploadProgress'
      );
      expect(mockCallableFn).toHaveBeenCalledWith({
        analysisId: MOCK_ANALYSIS_ID,
        uploadProgress: 50,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('notifyFileUploadCompleteAction', () => {
    const mockDownloadURL = 'https://fake.storage.url/file.csv';
    it('should publish a message to Pub/Sub and return success', async () => {
      mockPublishMessage.mockResolvedValueOnce('mock-message-id');
      const result = await notifyFileUploadCompleteAction(
        MOCK_USER_ID,
        MOCK_ANALYSIS_ID,
        mockDownloadURL
      );
      expect(mockTopic).toHaveBeenCalledWith(FILE_UPLOAD_COMPLETED_TOPIC);
      expect(mockPublishMessage).toHaveBeenCalledWith({
        json: { userId: MOCK_USER_ID, analysisId: MOCK_ANALYSIS_ID, downloadURL: mockDownloadURL },
      });
      expect(result.success).toBe(true);
    });

    it('should return an error if Pub/Sub publishing fails', async () => {
      mockPublishMessage.mockRejectedValueOnce(new Error('Pub/Sub publish failed'));
      const result = await notifyFileUploadCompleteAction(
        MOCK_USER_ID,
        MOCK_ANALYSIS_ID,
        mockDownloadURL
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Falha ao notificar conclusão do upload (SA Pub/Sub): Pub/Sub publish failed'
      );
    });
  });

  describe('markUploadAsFailedAction', () => {
    it('should call httpsMarkUploadAsFailed and return success', async () => {
      mockCallableFn.mockResolvedValueOnce({ data: { success: true } });
      const result = await markUploadAsFailedAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'Test error');
      expect(mockHttpsCallable).toHaveBeenCalledWith(functionsInstance, 'httpsMarkUploadAsFailed');
      expect(mockCallableFn).toHaveBeenCalledWith({
        analysisId: MOCK_ANALYSIS_ID,
        uploadErrorMessage: 'Test error',
      });
      expect(result.success).toBe(true);
    });
  });
});
