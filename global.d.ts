// Silence missing type errors for ESLint plugins

declare module 'eslint-plugin-import';
declare module 'eslint-plugin-jsx-a11y';
declare module 'eslint' {
  export type FlatConfigItem = unknown;
}

declare module 'firebase-functions' {
  export namespace https {
    export interface CallableContext {
      auth?: { uid: string };
    }
    export interface CallableRequest {}
  }
  export namespace pubsub {
    export interface Message {}
  }
  export namespace firestore {
    export interface DocumentSnapshot {}
    export interface DocumentSnapshotChange {}
  }
  export interface EventContext {}
}
