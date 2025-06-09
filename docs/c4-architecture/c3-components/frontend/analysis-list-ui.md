
# C3: Component - Analysis Listing (analysisListUI)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **Analysis Listing** component is responsible for displaying the user's history of past analyses in an organized manner, typically in an accordion format, allowing the user to view details of each.

## Responsibilities (Behaviors)

*   **Displaying Analyses:**
    *   Presents a list of analyses performed by the user.
    *   For each analysis, displays key information such as title (or filename), creation date, and current status.
    *   Uses an Accordion component (`Accordion` from ShadCN UI) where each item represents an analysis.
*   **Interaction with `useAnalysisManager`:**
    *   Obtains the `pastAnalyses` list from the `useAnalysisManager` hook.
    *   Reflects the `isLoadingPastAnalyses` state to show a loading indicator.
*   **Detail Expansion:**
    *   Clicking an accordion item expands it to show the `AnalysisView` component with details of the selected analysis.
    *   Manages which analysis is currently expanded (`expandedAnalysisId` in `HomePage.tsx`) and informs `useAnalysisManager` about the `currentAnalysis`.
*   **Empty List Feedback:**
    *   Displays an appropriate message (e.g., "No previous analyses found.") if there are no analyses to list.

## Technologies and Key Aspects

*   **React Components:** Part of `HomePage.tsx` that renders the `Accordion`.
*   **ShadCN UI:** `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`, `Card`, `Badge` for styling and structure.
*   **Custom Hooks:** `useAnalysisManager` to get the list of analyses and manage the state of the current analysis.
*   **Data Formatting:** Uses `date-fns` to format dates.
*   **Server Actions:** (Indirectly via `useAnalysisManager`) To fetch the list of analyses.

    