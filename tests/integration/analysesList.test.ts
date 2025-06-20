// tests/integration/analysesList.test.ts

import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  deleteDoc,
  doc,
  Timestamp, // Import Timestamp from client SDK
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  deleteUser,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { getApp } from 'firebase/app';

// Import necessary types
import type { Analysis } from '@/types/analysis';

// You might need to import rendering utilities if testing the UI component that uses the hook
// import { renderHook, waitFor, act } from '@testing-library/react'; // Example using react-hooks testing library
// import { render, screen, waitFor } from '@testing-library/react'; // Example if testing the UI component

// Import the hook you want to test (if testing the hook directly)
import { useAnalysisManager } from '@/hooks/useAnalysisManager';

// --- Helper function to create a dummy analysis ---
const createDummyAnalysis = (
  userId: string,
  index: number,
  createdAt: Date = new Date()
): Omit<Analysis, 'id'> => ({
  userId: userId,
  fileName: `test_file_${index}.csv`,
  title: `Test Analysis ${index}`,
  description: `Description for test analysis ${index}`,
  languageCode: 'en-US',
  status: 'completed', // Or 'uploading', etc. depending on test needs
  progress: 100,
  uploadProgress: 100,
  powerQualityDataUrl: null,
  powerQualityDataSummary: null,
  isDataChunked: false,
  identifiedRegulations: [],
  summary: `Summary for test analysis ${index}`,
  complianceReport: null,
  structuredReport: null,
  mdxReportStoragePath: null,
  errorMessage: null,
  tags: [],
  createdAt: createdAt.toISOString(), // Store as ISO string on frontend, but Firestore uses Timestamp
  completedAt: new Date().toISOString(),
  reportLastModifiedAt: null,
  deletionRequestedAt: null,
});

// --- Helper function to create a Firestore timestamp from ISO string ---
const isoToTimestamp = (isoString: string): Timestamp => {
  return Timestamp.fromDate(new Date(isoString));
};

/**
 * Integration test suite for analyses list pagination.
 * These tests run against the Firebase emulators.
 */
describe('Analyses List Pagination Integration Tests', () => {
  let userId: string;
  const userEmail = 'test-pagination-user@example.com';
  const userPassword = 'password123';
  const analysisIds: string[] = [];
  const numberOfAnalyses = 25;
  const pageSize = 10; // Matches the limit in usePastAnalyses
  const db = getFirestore(getApp());
  const auth = getAuth(getApp());

  beforeAll(async () => {
    // Create and log in a test user
    try {
      await createUserWithEmailAndPassword(auth, userEmail, userPassword);
    } catch (e: any) {
      // If user already exists from a previous failed run, try logging in
      if (e.code === 'auth/email-already-in-use') {
        await signInWithEmailAndPassword(auth, userEmail, userPassword);
      } else {
        throw e;
      }
    }
    userId = auth.currentUser!.uid;
    console.log(`Created and logged in user: ${userId}`);

    // Clear any previous analysis data for this user in the emulator
    const analysesCollectionRef = collection(db, `users/${userId}/analyses`);
    const existingDocsSnapshot = await getDocs(analysesCollectionRef);
    const deletePromises = existingDocsSnapshot.docs.map((d) => deleteDoc(doc(db, d.ref.path)));
    await Promise.all(deletePromises);
    console.log(`Cleaned up ${existingDocsSnapshot.docs.length} existing analyses.`);


    // Create dummy analysis documents
    for (let i = 0; i < numberOfAnalyses; i++) {
      // Use slightly different timestamps to ensure stable ordering
      const createdAt = new Date(Date.now() - (numberOfAnalyses - i) * 1000);
      const dummyAnalysis = createDummyAnalysis(userId, i, createdAt);

      // We need to add the document with Firestore Timestamp for ordering
      const docRef = await addDoc(analysesCollectionRef, {
        ...dummyAnalysis,
        createdAt: Timestamp.fromDate(createdAt), // Ensure Firestore Timestamp is used
        completedAt: dummyAnalysis.completedAt ? Timestamp.fromDate(new Date(dummyAnalysis.completedAt)) : null,
      });
      analysisIds.push(docRef.id);
      console.log(`Created analysis ${docRef.id} with index ${i}.`);
    }

    // Verify creation and fetch in correct order to populate analysisIds array correctly
    const q = query(analysesCollectionRef, orderBy('createdAt', 'desc'));
    const orderedSnapshot = await getDocs(q);
    // Overwrite analysisIds with the correct order from the query
    analysisIds.length = 0; // Clear the temporary IDs
    orderedSnapshot.docs.forEach(doc => analysisIds.push(doc.id));

    console.log(`Created ${numberOfAnalyses} analyses. Ordered IDs: ${analysisIds.join(', ')}`);
    expect(analysisIds.length).toBe(numberOfAnalyses);
  });

  afterAll(async () => {
    // Clean up dummy analysis documents
    const deletePromises = analysisIds.map(id => deleteDoc(doc(db, `users/${userId}/analyses/${id}`)));
    await Promise.all(deletePromises);
    console.log(`Cleaned up ${analysisIds.length} created analyses.`);

    // Sign out and delete the test user
    if (auth.currentUser) {
      await auth.signOut();
      // Note: Deleting users from Auth emulator might require Admin SDK or specific tools,
      // but signing out is sufficient for testing app logic. For full cleanup,
      // consider using the Admin SDK within a Callable Function or a separate script.
      // For now, we'll just sign out. Deletion is more complex in client SDK against emulator.
      // await deleteUser(auth.currentUser); // This might not work directly against emulator depending on setup
    }
    console.log(`Signed out user: ${userId}`);
  });

  /**
   * Test case for fetching the first page of analyses.
   */
  it('should fetch the first page of analyses correctly', async () => {
    // To test the hook directly, you would use renderHook or a wrapper component.
    // For simplicity in this example outline, we'll assume you can access the hook's return values.
    // Replace this section with your actual hook testing implementation if needed.

    // Example using a test component wrapper (recommended for hooks interacting with context/React lifecycle)
    // const { result } = renderHook(() => useAnalysisManager(auth.currentUser));
    // const fetchPastAnalyses = result.current.fetchPastAnalyses;
    // const analyses = result.current.analyses; // Need to track updates

    // Assuming you have a way to trigger fetchPastAnalyses and observe the state changes
    // For this outline, we'll manually call the underlying action for demonstration.
    // In a real test, you'd interact with the component/hook that calls this action.

    // Manually call the action to simulate the hook's initial fetch
    const result = await getPastAnalysesAction(userId, pageSize);


    // Wait for state updates if testing a component/hook
    // await waitFor(() => expect(result.current.isLoadingPastAnalyses).toBe(false)); // If testing hook

    expect(result.analyses.length).toBe(pageSize);
    expect(result.lastDocId).toBeDefined();
    // Verify the IDs of the fetched analyses match the first page of ordered IDs
    const fetchedIds = result.analyses.map(a => a.id);
    expect(fetchedIds).toEqual(analysisIds.slice(0, pageSize));
  });

  /**
   * Test case for fetching the next page of analyses.
   */
  it('should fetch the next page of analyses correctly', async () => {
    // Similar to the first test, replace with your actual hook/component testing implementation.

    // Manually fetch the first page to get the lastDocId
    const firstPageResult = await getPastAnalysesAction(userId, pageSize);
    expect(firstPageResult.analyses.length).toBe(pageSize);
    expect(firstPageResult.lastDocId).toBeDefined();

    // Manually call the action to simulate fetching the next page
    const secondPageResult = await getPastAnalysesAction(userId, pageSize, firstPageResult.lastDocId);


    // Wait for state updates if testing a component/hook
    // await waitFor(() => expect(result.current.isLoadingMoreAnalyses).toBe(false)); // If testing hook

    // The second page should have the remaining analyses
    const expectedSecondPageSize = numberOfAnalyses - pageSize;
    expect(secondPageResult.analyses.length).toBe(expectedSecondPageSize);

    // Check if there is a lastDocId for the second page (should be undefined if it's the last page)
    expect(secondPageResult.lastDocId).toBeUndefined(); // Assuming 25 analyses, 10 per page -> 10, 10, 5. Last page is the 3rd, no more docs after it.


    // Verify the IDs of the fetched analyses match the second page of ordered IDs
    const fetchedIds = secondPageResult.analyses.map(a => a.id);
    expect(fetchedIds).toEqual(analysisIds.slice(pageSize, numberOfAnalyses));

    // If testing the hook/component, you would assert on the combined list state:
    // expect(result.current.analyses.length).toBe(numberOfAnalyses);
    // expect(result.current.analyses.map(a => a.id)).toEqual(analysisIds);
    // expect(result.current.hasMoreAnalyses).toBe(false); // After fetching the last page
  });

  // Add more test cases for edge cases:
  // - Fetching when there are fewer analyses than pageSize.
  // - Fetching when there are exactly pageSize analyses.
  // - Fetching when no analyses exist.
  // - Error handling during fetch.
  // - Testing the UI rendering of the list and "Load More" button (requires rendering the component).
});

// You need to add the actual implementation for testing the hook/component.
// Example using @testing-library/react:
/*
import { render, screen, waitFor } from '@testing-library/react';
import { AppWrapperForTests } from './test-utils'; // Create a wrapper that provides necessary contexts (Auth, QueryProvider, etc.)

describe('Analyses List Pagination Component Integration Tests', () => {
  // ... beforeAll and afterAll hooks ...

  it('should render the first page and load more analyses', async () => {
    render(<HomePage />, { wrapper: AppWrapperForTests }); // Render the component that uses the hook

    // Wait for the initial load to complete and first page to render
    await waitFor(() => {
      expect(screen.queryByText('Carregando lista de análises...')).toBeNull();
      // Assert that the first page of analyses titles are visible
      for (let i = 0; i < pageSize; i++) {
        expect(screen.getByText(`Test Analysis ${i}`)).toBeVisible(); // Adjust based on how title is displayed
      }
    });

    // Find and click the "Load More" button
    const loadMoreButton = screen.getByText('Carregar Mais Análises');
    expect(loadMoreButton).toBeVisible();
    expect(loadMoreButton).not.toBeDisabled();

    fireEvent.click(loadMoreButton);

    // Wait for the "Load More" loading indicator to disappear
    await waitFor(() => {
      expect(screen.queryByText('Carregando Mais Análises')).toBeNull(); // Adjust text based on your component
    });

    // Assert that the second page of analyses titles are now visible
     for (let i = pageSize; i < pageSize * 2; i++) {
       expect(screen.getByText(`Test Analysis ${i}`)).toBeVisible();
     }

    // Check if the "Load More" button is still visible (if more pages exist)
    // Adjust assertion based on whether there's a 3rd page
    expect(screen.getByText('Carregar Mais Análises')).toBeVisible();
    expect(screen.getByText('Carregar Mais Análises')).not.toBeDisabled(); // Assuming a third page exists


    // Fetch the third page
    fireEvent.click(screen.getByText('Carregar Mais Análises'));
     await waitFor(() => {
      expect(screen.queryByText('Carregando Mais Análises')).toBeNull();
     });

     // Assert the last analyses are visible
     for (let i = pageSize * 2; i < numberOfAnalyses; i++) {
        expect(screen.getByText(`Test Analysis ${i}`)).toBeVisible();
      }

    // Assert that the "Load More" button is no longer visible after fetching the last page
    expect(screen.queryByText('Carregar Mais Análises')).toBeNull();


  });

  // Add more UI-focused tests: empty state, loading states, error states, etc.
});
*/