// src/lib/firebase-server-provider.ts
'use strict';

/**
 * @fileOverview A provider class using the Factory Method and Singleton patterns
 * to manage and provide instances of Firebase Admin services.
 */

import * as admin from 'firebase-admin';

class FirebaseServerProvider {
  private static instance: FirebaseServerProvider;
  private _firestore: admin.firestore.Firestore;
  private _storage: admin.storage.Storage;

  private constructor() {
    // Initialize the Firebase Admin SDK if it hasn't been already.
    if (admin.apps.length === 0) {
      admin.initializeApp();
    }

    this._firestore = admin.firestore();
    this._storage = admin.storage();
  }

  /**
   * Gets the single instance of the FirebaseServerProvider.
   * @returns {FirebaseServerProvider} The singleton instance.
   */
  public static getInstance(): FirebaseServerProvider {
    if (!FirebaseServerProvider.instance) {
      FirebaseServerProvider.instance = new FirebaseServerProvider();
    }
    return FirebaseServerProvider.instance;
  }

  /**
   * Factory method to get the Firestore service instance.
   * @returns {admin.firestore.Firestore} The Firestore service instance.
   */
  public getFirestore(): admin.firestore.Firestore {
    return this._firestore;
  }

  /**
   * Factory method to get the Storage service instance.
   * @returns {admin.storage.Storage} The Storage service instance.
   */
  public getStorage(): admin.storage.Storage {
    return this._storage;
  }
}

// Export a singleton instance of the provider.
export const firebaseServerProvider = FirebaseServerProvider.getInstance();
