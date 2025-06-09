
# C3: Component - State Management & UI Logic (stateMgmt)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **State Management & UI Logic** component represents the collection of React Contexts and Custom Hooks that manage the application's global state, authentication state, analysis data, file upload logic, and user notifications.

## Responsibilities (Behaviors)

*   **`AuthProvider` (`contexts/auth-context.tsx`):**
    *   Manages the user's authentication state throughout the application.
    *   Uses `onAuthStateChanged` from Firebase to listen for login state changes.
    *   Provides the `user` object (or `null`) and `loading` state to child components via the `useAuth` hook.
*   **`QueryProvider` (`contexts/query-provider.tsx`):**
    *   Sets up the `QueryClient` from TanStack Query (React Query).
    *   Allows the use of React Query for caching, refetching, and managing server state data, although current usage is more focused on `onSnapshot` and direct Server Actions. Can be expanded.
*   **`useAuth` (`contexts/auth-context.tsx`):**
    *   Custom hook to consume `AuthContext` and easily access `user` and `loading`.
*   **`useAnalysisManager` (`hooks/useAnalysisManager.ts`):**
    *   Centralizes analysis management logic:
        *   Fetches past analyses (`getPastAnalysesAction`).
        *   Manages the selected `currentAnalysis`.
        *   Handles creation and removal of `tags` (`addTagToAction`, `removeTagAction`).
        *   Initiates AI processing for an analysis (`processAnalysisFile` action, which signals the Firebase Function).
        *   Triggers deletion of analyses (`deleteAnalysisAction`).
        *   Triggers cancellation of analyses (`cancelAnalysisAction`).
        *   Formats the structured report for TXT download.
        *   Calculates `displayedAnalysisSteps` for the UI.
        *   Uses `onSnapshot` from Firestore for real-time updates of `currentAnalysis`.
*   **`useFileUploadManager` (`features/file-upload/hooks/useFileUploadManager.ts`):**
    *   Encapsulates all logic related to the file upload process:
        *   Manages the state of `fileToUpload`, `isUploading`, `uploadProgress`, and `uploadError`.
        *   Handles file selection.
        *   Orchestrates calls to relevant Server Actions: `createInitialAnalysisRecordAction`, `updateAnalysisUploadProgressAction`, `finalizeFileUploadRecordAction`, `markUploadAsFailedAction`.
*   **`useToast` (`hooks/use-toast.ts`):**
    *   Provides a centralized way to display notifications (toasts) to the user (success, error, information).
    *   Manages the state of toasts to be displayed.

## Technologies and Key Aspects

*   **React:** Context API, Custom Hooks.
*   **Firebase SDK:** `onAuthStateChanged`, `onSnapshot` (via `useAnalysisManager`).
*   **TanStack Query (React Query):** (Potential for server state management, currently more focused on direct listeners).
*   **Server Actions:** Custom hooks (like `useAnalysisManager` and `useFileUploadManager`) interact with Server Actions for backend operations.
*   **ShadCN UI:** `Toast` and `Toaster` are used by `useToast`.
*   **Local State:** Individual components also use `useState` and `useEffect` for their local state, complementing global state managed by contexts and hooks.

    