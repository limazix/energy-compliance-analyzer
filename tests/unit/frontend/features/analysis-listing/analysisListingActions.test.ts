// src/features/analysis-listing/actions/analysisListingActions.test.ts
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { getPastAnalysesAction } from '@/features/analysis-listing/actions/analysisListingActions';
import { functionsInstance } from '@/lib/firebase'; // We need this for the callable mock
import type { Analysis } from '@/types/analysis';

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
const MOCK_ANALYSES: Analysis[] = [
  {
    id: 'analysis-1',
    userId: MOCK_USER_ID,
    fileName: 'file1.csv',
    title: 'Analysis 1',
    status: 'completed',
    progress: 100,
    createdAt: new Date().toISOString(),
    tags: ['tag1'],
  } as Analysis,
  {
    id: 'analysis-2',
    userId: MOCK_USER_ID,
    fileName: 'file2.csv',
    title: 'Analysis 2',
    status: 'in_progress',
    progress: 50,
    createdAt: new Date().toISOString(),
    tags: ['tag2'],
  } as Analysis,
];

describe('getPastAnalysesAction (Unit)', () => {
  let mockCallableFunction: jest.Mock;

  beforeEach(() => {
    mockHttpsCallable.mockClear();
    mockCallableFunction = jest.fn();
    mockHttpsCallable.mockReturnValue(mockCallableFunction);
  });

  it('should call httpsCallableGetPastAnalyses and return analyses on success', async () => {
    mockCallableFunction.mockResolvedValueOnce({
      data: { analyses: MOCK_ANALYSES },
    } as HttpsCallableResult<{ analyses: Analysis[] }>);

    const result = await getPastAnalysesAction(MOCK_USER_ID);

    expect(mockHttpsCallable).toHaveBeenCalledWith(
      functionsInstance,
      'httpsCallableGetPastAnalyses'
    );
    expect(mockCallableFunction).toHaveBeenCalledWith({ userId: MOCK_USER_ID });
    expect(result).toEqual(MOCK_ANALYSES);
  });

  it('should return an empty array if the function returns no analyses', async () => {
    mockCallableFunction.mockResolvedValueOnce({
      data: { analyses: [] },
    } as HttpsCallableResult<{ analyses: Analysis[] }>);

    const result = await getPastAnalysesAction(MOCK_USER_ID);
    expect(result).toEqual([]);
  });

  it('should throw an error if the function call fails', async () => {
    const errorMessage = 'Simulated Firebase Function error';
    mockCallableFunction.mockRejectedValueOnce(new Error(errorMessage));

    await expect(getPastAnalysesAction(MOCK_USER_ID)).rejects.toThrow(
      expect.stringContaining(errorMessage)
    );
  });

  it('should throw an error if the function returns invalid data structure', async () => {
    mockCallableFunction.mockResolvedValueOnce({
      data: { message: 'Some other structure' }, // Invalid structure
    } as HttpsCallableResult<unknown>);

    await expect(getPastAnalysesAction(MOCK_USER_ID)).rejects.toThrow(
      expect.stringContaining('HTTPS Function returned invalid data structure')
    );
  });

  it('should throw an error if userId is empty or invalid', async () => {
    await expect(getPastAnalysesAction('')).rejects.toThrow(
      expect.stringContaining("CRITICAL: userId is invalid (input: '')")
    );
    // @ts-expect-error testing invalid input
    await expect(getPastAnalysesAction(null)).rejects.toThrow(
      expect.stringContaining("CRITICAL: userId is invalid (input: 'null')")
    );
    expect(mockCallableFunction).not.toHaveBeenCalled();
  });
});
