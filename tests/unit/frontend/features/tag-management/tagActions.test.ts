// src/features/tag-management/actions/tagActions.test.ts
import { httpsCallable } from 'firebase/functions';

import { addTagToAction, removeTagAction } from '@/features/tag-management/actions/tagActions';
import { functionsInstance } from '@/lib/firebase';

// Mock firebase/functions
jest.mock('firebase/functions', () => {
  const original = jest.requireActual('firebase/functions');
  return {
    ...original,
    httpsCallable: jest.fn(),
  };
});

const mockHttpsCallable = httpsCallable as jest.Mock;

const MOCK_USER_ID = 'test-user-123';
const MOCK_ANALYSIS_ID = 'test-analysis-456';

describe('Tag Management Server Actions (Unit)', () => {
  let mockCallableFn: jest.Mock;

  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockCallableFn = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallableFn);
  });

  describe('addTagToAction', () => {
    it('should call httpsCallableAddTag and return success', async () => {
      mockCallableFn.mockResolvedValueOnce({ data: { success: true, message: 'Tag added.' } });
      const result = await addTagToAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'new-tag');
      expect(mockHttpsCallable).toHaveBeenCalledWith(functionsInstance, 'httpsCallableAddTag');
      expect(mockCallableFn).toHaveBeenCalledWith({ analysisId: MOCK_ANALYSIS_ID, tag: 'new-tag' });
      expect(result.success).toBe(true);
    });

    it('should return error if httpsCallableAddTag fails', async () => {
      mockCallableFn.mockRejectedValueOnce(new Error('Add tag failed'));
      const result = await addTagToAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'new-tag');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao adicionar tag: Add tag failed');
    });
  });

  describe('removeTagAction', () => {
    it('should call httpsCallableRemoveTag and return success', async () => {
      mockCallableFn.mockResolvedValueOnce({ data: { success: true, message: 'Tag removed.' } });
      const result = await removeTagAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'old-tag');
      expect(mockHttpsCallable).toHaveBeenCalledWith(functionsInstance, 'httpsCallableRemoveTag');
      expect(mockCallableFn).toHaveBeenCalledWith({ analysisId: MOCK_ANALYSIS_ID, tag: 'old-tag' });
      expect(result.success).toBe(true);
    });

    it('should return error if httpsCallableRemoveTag fails', async () => {
      mockCallableFn.mockRejectedValueOnce(new Error('Remove tag failed'));
      const result = await removeTagAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'old-tag');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao remover tag: Remove tag failed');
    });
  });
});
