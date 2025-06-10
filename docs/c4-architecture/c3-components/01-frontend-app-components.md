# C3: Frontend Web App Components (Container)

This diagram details the main components that make up the "Frontend Web App" container of the Energy Compliance Analyzer.

[<- Back to Component Overview (C3)](./index.md)
[<- Back to Container Overview (C2)](../c2-containers/index.md)

```plantuml
@startuml C4_Component_Frontend
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml
!include <GCP/GCPCommon>
!include <GCP/Compute/CloudRun>
!include <GCP/Firebase/FirebaseAuthentication>
!include <GCP/Databases/FirebaseRealtimeDatabase>

title "Frontend Web App Components"

Container_Boundary(frontendContainer, "Frontend Web App") {
    Component(routing, "Routing", "Next.js App Router", "Manages navigation (Login, Home, Report).")
    Component(authUI, "Authentication UI", "React Components, Firebase SDK", "Login/logout UI, profile display.")
    Component(fileUploadUI, "Upload UI", "React Components, Hooks", "Form for CSV upload & metadata.")
    Component(analysisListUI, "Analysis Listing UI", "React Components", "Displays past analyses, status, tags.")
    Component(analysisViewUI, "Analysis View UI", "React Components", "Shows progress/results of an analysis.")
    Component(reportViewUI, "Report View UI", "React Component, MDX", "Renders MDX report & chat.")
    Component(reportChatUI, "Report Chat UI", "React Components, RTDB SDK", "User interaction with report agent.")

    Component(stateMgmt, "State & UI Logic", "Contexts, Custom Hooks", "Manages app state (auth, analysis data, notifications).")

    Component(firebaseClient, "Firebase Client Config", "Firebase SDK (`firebase.ts`)", "Initializes client-side Firebase SDK.")
    Component(uiComponents, "Reusable UI Library", "ShadCN UI, TailwindCSS", "Buttons, Cards, Inputs, etc.")
}

Container_Ext(serverActions, "Next.js Server Actions", "Backend API for data/AI.", $sprite="gcp_cloud_run")
Container_Ext(firebaseAuthExt, "Firebase Authentication", "External auth service.", $sprite="gcp_firebase_authentication")
Container_Ext(firebaseRtdbExt, "Firebase Realtime DB", "DB service for chat.", $sprite="gcp_firebase_realtime_database")

Rel(routing, authUI, "Controls access based on auth state")
Rel(routing, reportViewUI, "Navigates to report page")

Rel(authUI, firebaseAuthExt, "Authenticates user via")
Rel(authUI, stateMgmt, "Updates/reflects auth state from")

Rel(fileUploadUI, stateMgmt, "Uses/Updates upload state from")
Rel(fileUploadUI, serverActions, "Calls actions for file record & finalization")

Rel(analysisListUI, stateMgmt, "Uses analyses state from")
Rel(analysisListUI, serverActions, "Calls actions to fetch/manage analyses")

Rel(analysisViewUI, stateMgmt, "Uses current analysis state from")

Rel(reportViewUI, serverActions, "Calls action to fetch MDX report")
Rel(reportViewUI, reportChatUI, "Integrates Chat UI")

Rel(reportChatUI, serverActions, "Calls chat orchestrator Server Action")
Rel(reportChatUI, firebaseRtdbExt, "Syncs chat messages with")

Rel(stateMgmt, firebaseClient, "Utilizes configured Firebase instance from")
%% uiComponents are used by many UI components; relationship is implicit to reduce clutter.

SHOW_LEGEND()
@enduml
```

## Frontend Component Details

The following is a list of the main components identified in the diagram above. Each component will have its own detail page (to be created).

- **Authentication UI (`authUI`)**:
  - [Details](./frontend/auth-ui.md)
- **Upload UI (`fileUploadUI`)**:
  - [Details](./frontend/file-upload-ui.md)
- **Analysis Listing UI (`analysisListUI`)**:
  - [Details](./frontend/analysis-list-ui.md)
- **Analysis View UI (`analysisViewUI`)**:
  - [Details](./frontend/analysis-view-ui.md)
- **Report View UI (`reportViewUI`)**:
  - [Details](./frontend/report-view-ui.md)
- **Report Chat UI (`reportChatUI`)**:
  - [Details](./frontend/report-chat-ui.md)
- **State & UI Logic (`stateMgmt`)**:
  - [Details](./frontend/state-mgmt.md)
- **Routing (`routing`)**:
  - [Details](./frontend/routing.md)
- **Reusable UI Library (`uiComponents`)**:
  - [Details](./frontend/ui-components.md)
- **Firebase Client Config (`firebaseClient`)**:
  - [Details](./frontend/firebase-client.md)

[Next: Server Actions Components](./02-server-actions-components.md)
