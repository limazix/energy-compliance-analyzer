
# C3: Component - Report Viewing Actions (`reportViewActions`)

[<- Back to Server Actions Components](./../02-server-actions-components.md)

## Description

The **Report Viewing Actions** component (`src/features/report-viewing/actions/reportViewingActions.ts`) is a Server Actions module responsible for fetching the data necessary to display a detailed analysis report to the user.

## Responsibilities (Behaviors)

*   **Fetch Report Data (`getAnalysisReportAction`):**
    *   Receives user ID and analysis ID.
    *   Fetches the analysis document from Firebase Firestore.
    *   Checks user permissions to access the report.
    *   Obtains the MDX report file path (`mdxReportStoragePath`) from the Firestore document.
    *   Obtains the original filename (`fileName`) from the Firestore document.
    *   Obtains the structured report (`structuredReport`) from the Firestore document (necessary for chat context).
    *   Reads the MDX file content from Firebase Storage using the obtained path.
    *   Returns an object containing the MDX content, original filename, analysis ID, structured report, and a possible error state.
    *   Handles scenarios where the report or analysis is not found, or the user lacks permission.

## Technologies and Key Aspects

*   **TypeScript:** For typing report data and action parameters.
*   **Next.js Server Actions:** To expose fetching functionality securely.
*   **Firebase Firestore:**
    *   `getDoc` to fetch the analysis document and get metadata like `mdxReportStoragePath`, `fileName`, and `structuredReport`.
*   **Firebase Storage:**
    *   Uses a utility function (e.g., `getFileContentFromStorage` from `src/lib/gcsUtils.ts`) that uses `getDownloadURL` and `fetch` (or the Storage Admin SDK, if executed in a Function context, but this is a Server Action) to read MDX file content.
*   **Permissions:** Implicit or explicit logic to verify if `userId` matches the analysis owner.
*   **Error Handling:** Manages and propagates errors that may occur when fetching data from Firestore or Storage.
*   **`AnalysisReportData` Interface:** Defines the structure of data returned by the action.

    