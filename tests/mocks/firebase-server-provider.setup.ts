jest.mock('@/lib/firebase-server-provider', () => ({
  createFirebaseAdminApp: jest.fn(() => ({
    auth: jest.fn(),
  })),
}));
