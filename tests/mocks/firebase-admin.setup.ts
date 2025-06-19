import { createFirestoreMock } from './firestore.mock';

jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');

  const mockStorage = {
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        getSignedUrl: jest.fn(),
        exists: jest.fn(),
        delete: jest.fn(),
        save: jest.fn(),
        download: jest.fn(),
      })),
    })),
  };

  const mockAuth = {};

  const mockMessaging = {};

  const mockDatabase = {};

  const initializeApp = jest.fn();
  const firestore = jest.fn(() => createFirestoreMock());
  const storage = jest.fn(() => mockStorage);
  const auth = jest.fn(() => mockAuth);
  const messaging = jest.fn(() => mockMessaging);
  const database = jest.fn(() => mockDatabase);

  return {
    initializeApp,
    firestore,
    storage,
    auth,
    messaging,
    database,
    apps: [{}], // Mock the apps array
    credential: {
      applicationDefault: jest.fn(),
      cert: jest.fn(),
    },
    ...actualAdmin, // Spread the actual admin to get the real FieldValue
  };
});
