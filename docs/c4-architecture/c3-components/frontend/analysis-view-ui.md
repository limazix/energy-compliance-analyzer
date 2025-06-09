
# C3: Component - Analysis View (analysisViewUI)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **Analysis View** component (`AnalysisView.tsx`) is responsible for displaying the details of a specific analysis, whether it is in progress or completed. It shows progress, results (if completed), and allows actions like tag management and deletion.

## Responsibilities (Behaviors)

*   **Display of Analysis Metadata:**
    *   Shows the title, description, and original filename of the analysis.
*   **Analysis Progress (if in progress):**
    *   Uses the `AnalysisProgressDisplay` component to show the stages of the analysis process and their status (pending, in progress, completed, error).
    *   Displays the overall numerical progress of the analysis.
    *   Allows the user to request cancellation of the analysis if it's in progress.
*   **Analysis Results (if completed):**
    *   Uses the `AnalysisResultsDisplay` component to:
        *   Show a summary of results and a preview of the structured report.
        *   Provide a link to the detailed MDX report view page (`ReportPage`).
        *   Allow downloading the report in TXT and JSON formats.
*   **Error Display:**
    *   If the analysis resulted in an error, displays the error message and the state of the steps up to the point of failure.
*   **Tag Management:**
    *   Uses the `TagEditor` component to allow the user to add or remove tags from the analysis.
*   **Analysis Actions:**
    *   Provides a button to delete the analysis (with a confirmation dialog).
*   **Interaction with `useAnalysisManager`:**
    *   Receives the `currentAnalysis` object and `displayedAnalysisSteps` from the hook.
    *   Calls functions from the hook to add/remove tags, delete analysis, and cancel analysis.

## Technologies and Key Aspects

*   **React Components:** `AnalysisView.tsx`, `AnalysisProgressDisplay.tsx`, `AnalysisResultsDisplay.tsx`, `AnalysisStepItem.tsx`, `TagEditor.tsx`.
*   **ShadCN UI:** `Card`, `Button`, `Badge`, `Progress`, `AlertDialog`, `Input` to build the interface.
*   **Lucide-react:** Icons for buttons and status indicators.
*   **Custom Hooks:** `useAnalysisManager` to get analysis data and perform actions.
*   **Server Actions:** (Indirectly via `useAnalysisManager`) For backend operations like adding/removing tags, deleting, and canceling analyses.
*   **Next.js:** `Link` for navigation to the report page.

    