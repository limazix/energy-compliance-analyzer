# C3: Next.js Server Actions Components (Container)

This diagram details the main components that make up the "Backend API (Next.js Server Actions)" container of the Energy Compliance Analyzer.

[<- Back to Component Overview (C3)](./index.md)
[<- Back to Container Overview (C2)](../c2-containers/index.md)

```plantuml
@startuml C4_Component_ServerActions
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml
!include <GCP/GCPCommon>
!include <GCP/Databases/CloudFirestore>
!include <GCP/Storage/CloudStorage>
!include <GCP/Databases/FirebaseRealtimeDatabase>
!include <GCP/AI/VertexAI>


title "Next.js Server Actions Components"

Container_Boundary(serverActionsContainer, "Backend API (Next.js Server Actions)") {
    Component(fileUploadActions, "File Upload Actions", "TS module", "Manages analysis record creation & upload finalization.")
    Component(analysisProcessingActions, "Analysis Processing Actions", "TS module", "Updates Firestore status to trigger Function processing.")
    Component(analysisMgmtActions, "Analysis Management Actions", "TS module", "Handles deletion/cancellation of analyses.")
    Component(analysisListActions, "Analysis Listing Actions", "TS module", "Fetches user's analyses from Firestore.")
    Component(tagActions, "Tag Management Actions", "TS module", "Adds/Removes tags from analyses in Firestore.")
    Component(reportViewActions, "Report Viewing Actions", "TS module", "Fetches MDX path from Firestore & content from Storage.")
    Component(reportChatActions, "Report Chat Actions", "TS module, Genkit", "Orchestrates report chat: calls Genkit, saves to RTDB, updates report.")
}

ContainerDb_Ext(firestoreExt, "Firebase Firestore", "Firestore DB service", $sprite="gcp_cloud_firestore")
Container_Ext(storageExt, "Firebase Storage", "File storage service", $sprite="gcp_cloud_storage")
ContainerDb_Ext(rtdbExt, "Firebase Realtime DB", "Chat DB service", $sprite="gcp_firebase_realtime_database")
System_Ext(genkitSA, "Genkit (in Server Actions)", "AI Framework/SDK", $sprite="gcp_vertex_ai") %% Representing AI interaction part

Rel(fileUploadActions, firestoreExt, "Creates/Updates analysis records")

Rel(analysisProcessingActions, firestoreExt, "Updates status to trigger Functions")

Rel(analysisMgmtActions, firestoreExt, "Updates records (delete/cancel)")
Rel(analysisMgmtActions, storageExt, "Removes files from Storage")

Rel(analysisListActions, firestoreExt, "Reads analysis records")

Rel(tagActions, firestoreExt, "Updates tags in analysis records")

Rel(reportViewActions, firestoreExt, "Reads report metadata")
Rel(reportViewActions, storageExt, "Reads MDX content")

Rel(reportChatActions, rtdbExt, "Saves chat history")
Rel(reportChatActions, firestoreExt, "Updates structured report (if AI modified)")
Rel(reportChatActions, storageExt, "Saves new MDX (if AI modified)")
Rel(reportChatActions, genkitSA, "Calls Chat Orchestrator Agent")

SHOW_LEGEND()
@enduml
```

## Server Actions Component Details

The following is a list of the main components (action modules) identified in the diagram above. Each will have its own detail page.

- **File Upload Actions (`fileUploadActions`)**:
  - [Details](./server-actions/file-upload-actions.md)
- **Analysis Management Actions (`analysisMgmtActions`)**:
  - [Details](./server-actions/analysis-mgmt-actions.md)
- **Analysis Listing Actions (`analysisListActions`)**:
  - [Details](./server-actions/analysis-list-actions.md)
- **Tag Management Actions (`tagActions`)**:
  - [Details](./server-actions/tag-actions.md)
- **Report Viewing Actions (`reportViewActions`)**:
  - [Details](./server-actions/report-view-actions.md)
- **Report Chat Actions (`reportChatActions`)**:
  - [Details](./server-actions/report-chat-actions.md)
- **Analysis Processing Actions (`analysisProcessingActions`)**:
  - [Details](./server-actions/analysis-processing-actions.md)

[Previous: Frontend Components](./01-frontend-app-components.md)
[Next: Firebase Functions Components](./03-firebase-functions-components.md)
