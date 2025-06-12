# C3: Component - Upload Components (fileUploadUI)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **Upload Components** provide the user interface for users to select CSV files, add metadata (title, description), and initiate the upload and analysis process.

## Responsibilities (Behaviors)

- **File Selection:**
  - Presents a file input for the user to select a CSV file from their local system.
  - Validates the file type (allows only `.csv`).
- **Metadata Input:**
  - Allows the user to enter a title for the analysis (pre-filled with the filename).
  - Allows the user to enter an optional description for the analysis.
- **Upload Logic:**
  - Uses the custom hook `useFileUploadManager` to manage the state of the selected file, upload progress, and errors.
  - On submission, invokes the `uploadFileAndCreateRecord` function from the `useFileUploadManager` hook.
  - This function, in turn, calls Server Actions to:
    1.  Create an initial analysis record in Firestore (`createInitialAnalysisRecordAction`).
    2.  Upload the file to Firebase Storage (via `uploadBytesResumable`).
    3.  Update upload progress in Firestore (`updateAnalysisUploadProgressAction`).
    4.  Finalize the analysis record in Firestore with the file URL and appropriate status (`finalizeFileUploadRecordAction`).
    5.  In case of upload failure, mark the analysis as an error (`markUploadAsFailedAction`).
- **User Feedback:**
  - Displays the name of the selected file.
  - Shows a progress bar during upload.
  - Presents error messages if the upload fails.
  - Allows cancellation of the upload process before sending.

## Technologies and Key Aspects

- **React Components:** Primarily `NewAnalysisForm.tsx`.
- **ShadCN UI:** `Card`, `Input`, `Textarea`, `Button`, `Label`, `Progress`, `Alert` to build the form and display feedback.
- **Custom Hooks:** `useFileUploadManager` to encapsulate upload logic and interaction with Server Actions.
- **Server Actions:** (Invoked by `useFileUploadManager`) To interact with the backend (Firestore, Storage).
- **Validation:** Client-side file type validation.
