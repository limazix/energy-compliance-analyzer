// Prototype for the mock firestore object
const firestoreMockPrototype = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  get: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
};

// Factory function for creating mock firestore objects
export function createFirestoreMock(overrides = {}) {
  const firestoreMock = Object.create(firestoreMockPrototype);
  Object.assign(firestoreMock, overrides);
  return firestoreMock;
}
