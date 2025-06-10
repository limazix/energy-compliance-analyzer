# C4 Dynamic Diagram: Report Chat Interaction

[<- Back to Level C4 (Code)](./index.md)

This diagram illustrates the communication flow when a user interacts with the AI agent via a report's chat interface, including the possibility of report revision.

```plantuml
@startuml Dynamic_Report_Chat
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml
!include <GCP/GCPCommon>
!include <GCP/Databases/FirebaseRealtimeDatabase>
!include <GCP/Databases/CloudFirestore>
!include <GCP/Storage/CloudStorage>
!include <GCP/AI/VertexAI>

title "Report Chat Interaction Flow"

actor User as user
participant "Frontend Web App" as frontendApp <<Container>>
participant "Backend API (SA)" as serverActions <<Container>>
participant "`orchestrateReportInteractionFlow`" as orchestrationFlow <<Component>>
participant "`callRevisorTool`" as revisorTool <<Component>>
participant "`reviewComplianceReportFlow`" as reviewFlow <<Component>>
database "Firebase RTDB" as rtdb <<ContainerDb>> #APPLICATION;sprite=gcp_firebase_realtime_database
database "Firebase Firestore" as firestore <<ContainerDb>> #APPLICATION;sprite=gcp_cloud_firestore
participant "Firebase Storage" as storage <<Container>> #APPLICATION;sprite=gcp_cloud_storage
participant "Google AI (Gemini)" as googleAI <<System_Ext>> #EXTERNAL_SYSTEM;sprite=gcp_vertex_ai

autonumber "<b>[0]"

user -> frontendApp: Sends chat message (text, report context)
frontendApp -> serverActions: Calls `askReportOrchestratorAction` SA
serverActions -> rtdb: Saves user message & AI placeholder to RTDB
serverActions -> orchestrationFlow: Invokes flow with user message & report data

orchestrationFlow -> googleAI: LLM processes user query
alt Optional: Report Revision Requested
  orchestrationFlow -> revisorTool: Calls `callRevisorTool` if revision needed
  revisorTool -> reviewFlow: Invokes `reviewComplianceReportFlow`
  reviewFlow -> googleAI: LLM reviews structured report
  reviewFlow --> revisorTool: Returns revised structured report
  revisorTool --> orchestrationFlow: Returns revised report to main flow
end
orchestrationFlow --> serverActions: Returns AI response (and optionally, revised report) to SA

serverActions -> rtdb: Updates/Streams final AI response in RTDB
alt Optional: Report was Modified
  serverActions -> firestore: Updates structured report in Firestore
  serverActions -> storage: Saves new MDX to Storage
end
frontendApp <-- rtdb: Listens to RTDB for new/updated messages
alt Optional: Report content updated
  frontendApp <-- firestore: Listens for report document updates (MDX/Structured) to re-render report
end

@enduml
```

## Flow Description

1.  The **User** sends a message via the **Frontend Web App**'s chat interface.
2.  The **Frontend** calls the `askReportOrchestratorAction` Server Action.
3.  The **Server Action** saves the user's message and an AI placeholder to **Firebase RTDB**.
4.  The **Server Action** invokes the **`orchestrateReportInteractionFlow`** (Genkit flow).
5.  The flow uses **Google AI (Gemini)** to process the query.
6.  Optionally, if report modification is requested, the flow calls the **`callRevisorTool`**.
7.  The tool, in turn, invokes the **`reviewComplianceReportFlow`**.
8.  The review flow uses **Google AI** to refine the structured report.
9.  The revised report is returned to the tool.
10. The tool returns the revised report to the main orchestration flow.
11. The orchestration flow returns the AI's textual response and any revised report to the Server Action.
12. The **Server Action** streams/updates the AI's response in **RTDB**.
13. If the report was modified, the **Server Action** updates the structured report in **Firestore**.
14. If modified, new MDX is generated and saved to **Firebase Storage**.
15. The **Frontend** listens to **RTDB** for chat message updates.
16. The **Frontend** may also listen to **Firestore** for changes to the main report document to re-render.
