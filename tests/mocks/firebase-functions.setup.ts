import { Request, Response } from 'express';

import type { EventContext, https, pubsub, firestore } from 'firebase-functions';

export const mockHttpsCallableStore: { [key: string]: jest.Mock } = {};

export interface FirebaseFunctionsMock {
  __mockHttpsCallableStore: {
    [key: string]: jest.Mock;
  };
}

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn((_functions, name) => {
    if (!mockHttpsCallableStore[name]) {
      mockHttpsCallableStore[name] = jest.fn();
    }
    return mockHttpsCallableStore[name];
  }),
}));

jest.mock(
  'firebase-functions',
  () => {
    const https = {
      onCall: (
        handler: (
          data: https.CallableRequest,
          context: https.CallableContext
        ) => Promise<void> | void
      ) => {
        // Return a function that can be invoked in tests
        // with the data and context objects.
        return (data: https.CallableRequest, context: https.CallableContext) =>
          handler(data, context);
      },
      onRequest: (handler: (req: Request, res: Response) => void) => handler,
    };

    const pubsub = {
      topic: (_topicName: string) => ({
        onPublish: (
          handler: (message: pubsub.Message, context: EventContext) => Promise<void> | void
        ) => {
          return (message: pubsub.Message, context: EventContext) => handler(message, context);
        },
      }),
    };

    const firestore = {
      document: (_path: string) => ({
        onUpdate: (
          handler: (
            change: firestore.DocumentSnapshotChange,
            context: EventContext
          ) => Promise<void> | void
        ) => {
          return (change: firestore.DocumentSnapshotChange, context: EventContext) =>
            handler(change, context);
        },
        onDelete: (
          handler: (snapshot: firestore.DocumentSnapshot, context: EventContext) => unknown
        ) => {
          return (snapshot: firestore.DocumentSnapshot, context: EventContext) =>
            handler(snapshot, context);
        },
      }),
    };

    return {
      https,
      pubsub,
      firestore,
      config: () => ({
        firebase: {
          projectId: 'test-project',
        },
      }),
    };
  },
  { virtual: true }
);
