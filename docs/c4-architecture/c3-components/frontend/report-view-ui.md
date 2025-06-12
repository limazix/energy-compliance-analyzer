# C3: Component - Report View (reportViewUI)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **Report View** component (`ReportPage.tsx`) is a dedicated page for displaying the full content of the compliance report in MDX format. It also integrates the chat interface for interaction with the report.

## Responsibilities (Behaviors)

- **Fetching Report Data:**
  - On load, uses the `analysisId` from URL parameters to call the `getAnalysisReportAction` Server Action.
  - This action fetches analysis metadata from Firestore and MDX file content from Firebase Storage.
- **MDX Rendering:**
  - Uses the `next-mdx-remote` library to render the fetched MDX content.
  - Supports Remark plugins like `remark-gfm` (for tables, etc.) and `remark-mermaidjs` (for rendering Mermaid diagrams within MDX).
- **Metadata Display:**
  - Shows the original filename of the analysis and the analysis ID.
- **Chat Interface:**
  - Integrates the `ReportChatUI` component (part of this page's logic) to allow the user to chat with an AI agent about the report.
- **Loading and Error Feedback:**
  - Displays a loading state while the MDX report is being fetched.
  - Shows error messages if the report cannot be loaded (e.g., analysis not found, error fetching MDX).
  - Allows the user to retry loading the report in case of failure.
- **Structured Report Synchronization:**
  - Maintains the state of the `structuredReport` (obtained initially from Firestore via `getAnalysisReportAction` and potentially updated by the chat) to provide context to the chat agent.
  - Listens for updates on the analysis document in Firestore for `structuredReport` and `mdxReportStoragePath`. If changed (e.g., by a chat action), re-fetches the MDX to update the view.

## Technologies and Key Aspects

- **React Components:** Primarily `ReportPage.tsx`.
- **Next.js:** App Router for dynamic route (`/report/[analysisId]`), `useParams` to get the analysis ID.
- **MDX:** `next-mdx-remote` for rendering, `remark-gfm`, `remark-mermaidjs` for extended Markdown functionalities.
- **ShadCN UI:** `Button`, `Textarea`, `ScrollArea`, `Avatar` (for chat), `Alert` (for errors).
- **Lucide-react:** Icons.
- **Server Actions:** `getAnalysisReportAction` to fetch report content.
- **Firebase:** (Indirectly, via Server Action and `ReportChatUI`) Firestore for metadata and `structuredReport`, Storage for MDX files, Realtime Database for chat.
- **State Management:** `useState`, `useEffect`, `useCallback` to manage the state of report data, chat messages, and interactions.
