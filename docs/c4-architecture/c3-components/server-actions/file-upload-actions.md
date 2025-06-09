
# C3: Component - File Upload Actions (`fileUploadActions`)

[<- Back to Server Actions Components](./../02-server-actions-components.md)

## Description

The **File Upload Actions** component (`src/features/file-upload/actions/fileUploadActions.ts`) is a Server Actions module responsible for managing the initial steps of the analysis process, from creating the record in Firestore to signaling that the CSV file upload to Firebase Storage is complete.

## Responsibilities (Behaviors)

*   **Create Initial Analysis Record (`createInitialAnalysisRecordAction`):**
    *   Receives user ID, filename, title, description, and language code.
    *   Creates a new document in the `users/{userId}/analyses` Firestore collection.
    *   Sets the initial analysis status to "uploading" and progress to 0.
    *   Stores basic metadata like filename, title, description, tags (initially empty), and creation timestamp.
    *   Returns the ID of the newly created analysis to the client.
*   **Update Upload Progress (`updateAnalysisUploadProgressAction`):**
    *   Receives user ID, analysis ID, and current file upload progress (0-100).
    *   Updates the `uploadProgress` and `progress` (calculated based on upload progress) fields in the analysis document in Firestore.
    *   Maintains status as "uploading".
*   **Finalize Upload Record (`finalizeFileUploadRecordAction`):**
    *   Receives user ID, analysis ID, and the download URL of the CSV file in Firebase Storage (after client-side upload completion).
    *   Updates the analysis document in Firestore with:
        *   `powerQualityDataUrl`: The URL of the CSV file in Storage.
        *   `status`: Sets to "summarizing_data" to signal that the `processAnalysisOnUpdate` Firebase Function should start processing.
        *   `progress`: Sets to an initial value (e.g., 10%) indicating upload completion.
        *   `uploadProgress`: Sets to 100.
        *   Clears any previous `errorMessage`.
        *   Resets fields that will be populated by the Function (e.g., `powerQualityDataSummary`, `structuredReport`).
*   **Mark Upload as Failed (`markUploadAsFailedAction`):**
    *   Receives user ID, analysis ID (can be null if record creation failed), and an error message.
    *   If analysis ID exists, updates the analysis document in Firestore:
        *   `status`: Sets to "error".
        *   `errorMessage`: Saves the upload error message.
        *   `progress`: Sets to 0.
        *   `uploadProgress`: Sets to 0.

## Technologies and Key Aspects

*   **TypeScript:** For typing and code organization.
*   **Next.js Server Actions:** To execute backend logic directly from client components.
*   **Firebase Firestore:**
    *   `addDoc` to create the initial analysis record.
    *   `updateDoc` to update progress, status, and file URL.
    *   `serverTimestamp` to record creation time.
    *   Firestore-specific error handling.
*   **Validation:** Ensures user and file IDs are valid before interacting with Firestore.

    