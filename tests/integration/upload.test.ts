import { getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  deleteUser,
  User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, deleteObject } from 'firebase/storage';

// Assuming you have an Analysis type defined
// import type { Analysis } from '@/types/analysis';

describe('File Upload and Initial Analysis Record Creation Integration', () => {
  let testUser: User;
  let testUserId: string;
  const testUserEmail = 'test-upload@example.com';
  const testUserPassword = 'password123';
  const testFileName = 'test-file.txt';
  const testFileContent = new TextEncoder().encode('This is some test file content.');
  const testAnalysisId = 'test-analysis-id-upload'; // Using a known ID for simplicity in this test

  beforeAll(async () => {
    const auth = getAuth(getApp());
    // Create a test user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      testUserEmail,
      testUserPassword
    );
    testUser = userCredential.user;
    testUserId = testUser.uid;

    // Sign in the test user
    await signInWithEmailAndPassword(auth, testUserEmail, testUserPassword);
  });

  afterAll(async () => {
    const auth = getAuth(getApp());
    const firestore = getFirestore(getApp());
    const storage = getStorage(getApp());

    // Sign out the user
    await auth.signOut();

    // Clean up the test user
    if (testUser) {
      try {
        await deleteUser(testUser);
      } catch (e) {
        // Handle cases where user might have already been deleted
        console.warn('Failed to delete test user during cleanup:', e);
      }
    }

    // Clean up the uploaded file from Storage emulator
    try {
      const fileRef = ref(storage, `users/${testUserId}/uploads/${testAnalysisId}/${testFileName}`);
      await deleteObject(fileRef);
    } catch (e) {
      // Handle cases where file might not exist
      console.warn('Failed to delete test file from storage during cleanup:', e);
    }

    // Clean up the Firestore document from Firestore emulator
    try {
      const analysisDocRef = doc(firestore, `users/${testUserId}/analyses/${testAnalysisId}`);
      await deleteDoc(analysisDocRef);
    } catch (e) {
      // Handle cases where document might not exist
      console.warn('Failed to delete test analysis document from firestore during cleanup:', e);
    }
  });

  /**
   * Tests the process of uploading a file to Firebase Storage
   * and verifying the creation of the initial analysis record in Firestore.
   * This test simulates the steps that would occur after a user selects a file.
   */
  it('should upload a file to Storage and create an initial analysis record in Firestore', async () => {
    const firestore = getFirestore(getApp());
    const storage = getStorage(getApp());

    // Step 1: Simulate file upload to Storage
    // In a real app, this would be handled by the file upload logic,
    // but here we directly use uploadBytes for integration testing.
    const fileRef = ref(storage, `users/${testUserId}/uploads/${testAnalysisId}/${testFileName}`);
    const uploadResult = await uploadBytes(fileRef, testFileContent);

    // Assert that the upload was successful
    expect(uploadResult.ref.fullPath).toBe(`users/${testUserId}/uploads/${testAnalysisId}/${testFileName}`);
    // You could add more assertions about metadata if needed

    // Step 2: Simulate the creation of the initial analysis record in Firestore
    // In a real app, this would likely happen as part of the file upload flow.
    // Here, we create it directly for this test.
    const analysisDocRef = doc(firestore, `users/${testUserId}/analyses/${testAnalysisId}`);
    const initialAnalysisData = {
      userId: testUserId,
      fileName: testFileName,
      title: testFileName, // Assuming title defaults to file name
      description: '',
      languageCode: 'en-US', // Example default
      status: 'uploading', // Or whatever your initial status is
      progress: 0,
      createdAt: new Date(), // Use a real Date object
      tags: [],
      // Add other initial fields expected by your schema
    };

    await setDoc(analysisDocRef, initialAnalysisData);

    // Step 3: Verify the document exists and contains the initial data
    const docSnap = await getDoc(analysisDocRef);

    expect(docSnap.exists()).toBe(true);

    const analysisData = docSnap.data();
    expect(analysisData).toBeDefined();
    expect(analysisData?.userId).toBe(testUserId);
    expect(analysisData?.fileName).toBe(testFileName);
    expect(analysisData?.status).toBe('uploading');
    // Add assertions for other initial fields
    // For timestamp fields, you might need to compare within a range or check type
    expect(analysisData?.createdAt).toBeInstanceOf(firebase_firestore.Timestamp);
  });
});