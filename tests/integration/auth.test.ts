// tests/integration/auth.test.ts
import { getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  User,
} from 'firebase/auth';

// Define test user credentials
const testUserEmail = 'test-integration-auth@example.com';
const testUserPassword = 'password123';

describe('Authentication Integration Tests', () => {
  let testUser: User | null = null;

  // Create a test user before all tests run
  beforeAll(async () => {
    const app = getApp();
    const auth = getAuth(app);

    try {
      // Attempt to create the user. If they already exist from a previous run, this might fail,
      // but subsequent login tests should still work if the user is there.
      // For robust cleanup, consider admin SDK in a test helper or emulator specific commands.
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        testUserEmail,
        testUserPassword
      );
      testUser = userCredential.user;
      console.log(`Created test user: ${testUser.uid}`);
    } catch (error: any) {
      // If user creation fails (e.g., already exists), try logging in to get the user object
      if (error.code === 'auth/email-already-in-use') {
        console.warn('Test user already exists. Attempting to log in.');
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            testUserEmail,
            testUserPassword
          );
          testUser = userCredential.user;
          console.log(`Logged in existing test user: ${testUser.uid}`);
        } catch (loginError) {
          console.error('Failed to create or log in test user:', loginError);
          // Depending on test setup, you might want to throw here or handle.
        }
      } else {
        console.error('Error creating test user:', error);
        // Depending on test setup, you might want to throw here.
      }
    }
  }, 20000); // Increase timeout for user creation

  // Optional: Clean up test user after all tests run
  // This requires Firebase Admin SDK or calling the emulator's REST API.
  // Given the --export-on-exit and --import flags in the npm script,
  // emulator state is managed between runs, so explicit deletion might not be strictly necessary
  // if you are fine with the user persisting across `npm run test:integration` runs.
  // If you need clean state each time, consider adding logic here or using
  // emulator-specific REST API calls in setup.
  afterAll(async () => {
    // Example of potential cleanup logic (requires admin SDK or API call)
    // try {
    //   const adminAuth = getAuth(adminApp); // Assuming adminApp is initialized for tests
    //   if (testUser?.uid) {
    //     await adminAuth.deleteUser(testUser.uid);
    //     console.log(`Deleted test user: ${testUser.uid}`);
    //   }
    // } catch (error) {
    //   console.error('Error deleting test user:', error);
    // }
    const app = getApp();
    const auth = getAuth(app);
    // Ensure signed out at the end
    try {
      await signOut(auth);
    } catch (error) {
      // Ignore if already signed out
    }
  }, 20000); // Increase timeout

  it('should allow a user to log in with email and password', async () => {
    const app = getApp();
    const auth = getAuth(app);

    // Ensure signed out before attempting login
    try {
      await signOut(auth);
    } catch (error) {
      // Ignore if already signed out
    }

    const userCredential = await signInWithEmailAndPassword(
      auth,
      testUserEmail,
      testUserPassword
    );

    // Assert that the user object is returned upon successful login
    expect(userCredential.user).not.toBeNull();
    expect(userCredential.user.email).toBe(testUserEmail);
    expect(getAuth().currentUser).not.toBeNull();
    expect(getAuth().currentUser?.email).toBe(testUserEmail);
  });

  it('should allow a logged-in user to log out', async () => {
    const app = getApp();
    const auth = getAuth(app);

    // Ensure user is logged in before testing logout
    // In a real scenario, you'd typically log in here if not guaranteed by previous test/setup
    // For simplicity, assuming login from previous test or a shared beforeEach login setup
    // A more isolated test would perform login within the test itself.
    // For now, let's ensure we are in a logged-in state for the check:
    let currentUser = getAuth().currentUser;
    if (!currentUser || currentUser.email !== testUserEmail) {
       // Attempt to log in if not already authenticated as the test user
       try {
         await signInWithEmailAndPassword(auth, testUserEmail, testUserPassword);
         currentUser = getAuth().currentUser;
       } catch (e) {
         console.error("Failed to ensure logged-in state for logout test:", e);
         fail("Could not ensure logged-in state for logout test");
       }
    }
     expect(currentUser).not.toBeNull(); // Verify we are logged in

    await signOut(auth);

    // Assert that the current user is null after logout
    expect(getAuth().currentUser).toBeNull();
  });

  // Add more authentication related tests here (e.g., password reset, sign up)
});