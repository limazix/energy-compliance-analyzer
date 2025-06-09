
# C3: Component - Analysis Management Actions (`analysisMgmtActions`)

[<- Back to Server Actions Components](./../02-server-actions-components.md)

## Description

The **Analysis Management Actions** component (`src/features/analysis-management/actions/analysisManagementActions.ts`) is a Server Actions module that handles lifecycle operations for an analysis, such as deletion and cancellation.

## Responsibilities (Behaviors)

*   **Delete Analysis (`deleteAnalysisAction`):**
    *   Receives the user ID and the ID of the analysis to be deleted.
    *   Updates the analysis document in Firestore, setting the status to "deleted".
    *   May optionally clear fields like `summary`, `structuredReport`, `mdxReportStoragePath`, `powerQualityDataUrl` to indicate data is no longer accessible or to save space.
    *   Triggers deletion of associated files (original CSV and MDX report) from Firebase Storage.
    *   Logs the action and handles potential errors during the process.
*   **Cancel Analysis (`cancelAnalysisAction`):**
    *   Receives the user ID and the ID of the analysis to be canceled.
    *   Checks if the analysis is in a state that allows cancellation (e.g., not 'completed', 'error', 'cancelled', or 'deleted').
    *   Updates the analysis document in Firestore, setting the status to "cancelling".
    *   The Firebase Function responsible for processing the analysis should observe this "cancelling" status and stop its execution as soon as possible, updating the status to "cancelled".
    *   May record an initial error message indicating cancellation was requested.

## Technologies and Key Aspects

*   **TypeScript:** For typing and code organization.
*   **Next.js Server Actions:** To execute backend logic securely.
*   **Firebase Firestore:**
    *   `getDoc` to check the current state of the analysis.
    *   `updateDoc` to change the analysis status to "deleted" or "cancelling".
*   **Firebase Storage:**
    *   `deleteObject` and `ref` (from `firebase/storage`) to remove associated files (CSV, MDX) when an analysis is deleted.
*   **State Management:** Actions need to handle different analysis states to determine if deletion or cancellation is a valid operation.
*   **Error Handling:** Robustly manages errors during interactions with Firestore and Storage.

    