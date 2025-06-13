// src/features/tag-management/actions/tagActions.test.ts
import { httpsCallable } from 'firebase/functions';

import { functionsInstance } from '@/lib/firebase'; // We need this for the callable mock

import { addTagToAction, removeTagAction } from './tagActions';

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

describe('Tag Management Server Actions', () => {
  let mockCallableFunction: jest.Mock;

  beforeEach(() => {
    // Reset all mocks before each test
    mockHttpsCallable.mockClear();
    mockCallableFunction = jest.fn(); // This will be our specific mock for each function
    mockHttpsCallable.mockReturnValue(mockCallableFunction);
  });

  describe('addTagToAction', () => {
    it('should call httpsCallableAddTag and return success on successful tag addition', async () => {
      mockCallableFunction.mockResolvedValueOnce({
        data: { success: true, message: 'Tag adicionada com sucesso.' },
      });

      const result = await addTagToAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'new-tag');

      expect(mockHttpsCallable).toHaveBeenCalledWith(functionsInstance, 'httpsCallableAddTag');
      expect(mockCallableFunction).toHaveBeenCalledWith({
        analysisId: MOCK_ANALYSIS_ID,
        tag: 'new-tag',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Tag adicionada com sucesso.');
      expect(result.error).toBeUndefined();
    });

    it('should return an error if httpsCallableAddTag fails', async () => {
      mockCallableFunction.mockRejectedValueOnce(new Error('Simulated Firebase Function error'));

      const result = await addTagToAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'another-tag');

      expect(mockHttpsCallable).toHaveBeenCalledWith(functionsInstance, 'httpsCallableAddTag');
      expect(mockCallableFunction).toHaveBeenCalledWith({
        analysisId: MOCK_ANALYSIS_ID,
        tag: 'another-tag',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro ao adicionar tag: Simulated Firebase Function error');
    });

    it('should return an error if analysisId is empty', async () => {
      const result = await addTagToAction(MOCK_USER_ID, '', 'valid-tag');
      expect(result.success).toBe(false);
      expect(result.error).toBe('[SA_addTag] ID da análise e tag são obrigatórios.');
      expect(mockCallableFunction).not.toHaveBeenCalled();
    });

    it('should return an error if tag is empty', async () => {
      const result = await addTagToAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, '  '); // Empty after trim
      expect(result.success).toBe(false);
      expect(result.error).toBe('[SA_addTag] ID da análise e tag são obrigatórios.');
      expect(mockCallableFunction).not.toHaveBeenCalled();
    });
  });

  describe('removeTagAction', () => {
    it('should call httpsCallableRemoveTag and return success on successful tag removal', async () => {
      mockCallableFunction.mockResolvedValueOnce({
        data: { success: true, message: 'Tag removida com sucesso.' },
      });

      const result = await removeTagAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'tag-to-remove');

      expect(mockHttpsCallable).toHaveBeenCalledWith(functionsInstance, 'httpsCallableRemoveTag');
      expect(mockCallableFunction).toHaveBeenCalledWith({
        analysisId: MOCK_ANALYSIS_ID,
        tag: 'tag-to-remove',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Tag removida com sucesso.');
      expect(result.error).toBeUndefined();
    });

    it('should return an error if httpsCallableRemoveTag fails', async () => {
      mockCallableFunction.mockRejectedValueOnce(
        new Error('Simulated Firebase Function removal error')
      );

      const result = await removeTagAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, 'tag-to-remove');

      expect(mockHttpsCallable).toHaveBeenCalledWith(functionsInstance, 'httpsCallableRemoveTag');
      expect(mockCallableFunction).toHaveBeenCalledWith({
        analysisId: MOCK_ANALYSIS_ID,
        tag: 'tag-to-remove',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'Erro ao remover tag: Simulated Firebase Function removal error'
      );
    });

    it('should return an error if analysisId is empty for removal', async () => {
      const result = await removeTagAction(MOCK_USER_ID, '', 'valid-tag');
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        '[SA_removeTag] ID da análise e tag para remover são obrigatórios.'
      );
      expect(mockCallableFunction).not.toHaveBeenCalled();
    });

    it('should return an error if tag to remove is empty', async () => {
      const result = await removeTagAction(MOCK_USER_ID, MOCK_ANALYSIS_ID, '  '); // Empty after trim
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        '[SA_removeTag] ID da análise e tag para remover são obrigatórios.'
      );
      expect(mockCallableFunction).not.toHaveBeenCalled();
    });
  });
});
