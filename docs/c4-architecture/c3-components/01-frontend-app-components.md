
# C3: Frontend Web App Components (Container)

This diagram details the main components that make up the "Frontend Web App" container of the Energy Compliance Analyzer.

[<- Back to Component Overview (C3)](./index.md)
[<- Back to Container Overview (C2)](../c2-containers/index.md)

```mermaid
C4Component
  title Frontend Web App Components (Container)

  Container_Boundary(frontendContainer, "Frontend Web App") {
    Component(authUI, "Authentication Components", "React Components, Firebase SDK", "Interface for login/logout (AuthButton), profile display, uses AuthProvider.", $sprite="fa:fa-sign-in-alt")
    Component(fileUploadUI, "Upload Components", "React Components (NewAnalysisForm), ShadCN UI, useFileUploadManager Hook", "Form for CSV file selection, title, description, and upload logic.", $sprite="fa:fa-upload")
    Component(analysisListUI, "Analysis Listing", "React Components (Accordion), ShadCN UI", "Displays past analyses, with status and tags. Uses useAnalysisManager.", $sprite="fa:fa-list-alt")
    Component(analysisViewUI, "Analysis View", "React Components (AnalysisView, AnalysisProgressDisplay, AnalysisResultsDisplay), ShadCN UI", "Shows progress of ongoing analyses and results of completed ones. Uses useAnalysisManager.", $sprite="fa:fa-eye")
    Component(reportViewUI, "Report View", "React Component (ReportPage), next-mdx-remote", "Renders MDX report content and chat interface.", $sprite="fa:fa-file-alt")
    Component(reportChatUI, "Report Chat Interface", "React Components, ShadCN UI, Firebase RTDB SDK", "Allows user to interact with orchestrator agent about the report. Used by ReportPage.", $sprite="fa:fa-comments")
    Component(stateMgmt, "State Management & UI Logic", "React Contexts (AuthProvider), Custom Hooks (useAuth, useAnalysisManager, useFileUploadManager, useToast)", "Manages application state, authentication, analysis data, and notifications.", $sprite="fa:fa-project-diagram")
    Component(routing, "Routing", "Next.js App Router", "Manages navigation between pages (Login, Home, Report).", $sprite="fa:fa-route")
    Component(uiComponents, "Reusable UI Components", "ShadCN UI, TailwindCSS", "Buttons, Cards, Inputs, etc., used throughout the application.", $sprite="fa:fa-puzzle-piece")
    Component(firebaseClient, "Firebase Client", "Firebase SDK (`firebase.ts`)", "Initializes and configures Firebase SDK for the client.", $sprite="fa:fa-plug")
  }

  System_Ext(serverActions, "Next.js Server Actions", "Backend API for data and AI interactions.", $sprite="fa:fa-cogs")
  System_Ext(firebaseAuthExt, "Firebase Authentication", "External authentication service.", $sprite="fa:fa-key")
  System_Ext(firebaseRtdbExt, "Firebase Realtime DB", "Database service for chat.", $sprite="fa:fa-comments")

  Rel(authUI, firebaseAuthExt, "Uses to authenticate")
  Rel(authUI, stateMgmt, "Updates authentication state")
  Rel(fileUploadUI, stateMgmt, "Uses/Updates upload state")
  Rel(fileUploadUI, serverActions, "Calls actions to create record and finalize upload")
  Rel(analysisListUI, stateMgmt, "Uses analyses state")
  Rel(analysisListUI, serverActions, "Calls actions to fetch/manage analyses")
  Rel(analysisViewUI, stateMgmt, "Uses current analysis state")
  Rel(reportViewUI, serverActions, "Calls action to fetch MDX report")
  Rel(reportChatUI, serverActions, "Calls chat orchestrator action")
  Rel(reportChatUI, firebaseRtdbExt, "Syncs chat messages")
  Rel(routing, authUI, "Controls access based on authentication")
  Rel(routing, reportViewUI, "Navigates to")
  Rel(stateMgmt, firebaseClient, "Utilizes Firebase instance")
  Rel(uiComponents, "*", "Used by various UI components")

  UpdateElementStyle(authUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(fileUploadUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(analysisListUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(analysisViewUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(reportViewUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(reportChatUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(stateMgmt, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(routing, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(uiComponents, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(firebaseClient, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(firebaseAuthExt, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(firebaseRtdbExt, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
```

## Frontend Component Details

The following is a list of the main components identified in the diagram above. Each component will have its own detail page (to be created).

*   **Authentication Components (`authUI`)**:
    *   [Details](./frontend/auth-ui.md)
*   **Upload Components (`fileUploadUI`)**:
    *   [Details](./frontend/file-upload-ui.md)
*   **Analysis Listing (`analysisListUI`)**:
    *   [Details](./frontend/analysis-list-ui.md)
*   **Analysis View (`analysisViewUI`)**:
    *   [Details](./frontend/analysis-view-ui.md)
*   **Report View (`reportViewUI`)**:
    *   [Details](./frontend/report-view-ui.md)
*   **Report Chat Interface (`reportChatUI`)**:
    *   [Details](./frontend/report-chat-ui.md)
*   **State Management & UI Logic (`stateMgmt`)**:
    *   [Details](./frontend/state-mgmt.md)
*   **Routing (`routing`)**:
    *   [Details](./frontend/routing.md)
*   **Reusable UI Components (`uiComponents`)**:
    *   [Details](./frontend/ui-components.md)
*   **Firebase Client (`firebaseClient`)**:
    *   [Details](./frontend/firebase-client.md)

[Next: Server Actions Components](./02-server-actions-components.md)

    