# C4 Dynamic Diagram: CSV Analysis Processing

[<- Back to Level C4 (Code)](./index.md)

This diagram illustrates the sequence of interactions and data flow when a user uploads a CSV file and the compliance analysis is processed by the AI pipeline in Firebase Functions.

```plantuml
@startuml Dynamic_CSV_Processing
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
!include <GCP/GCPCommon>
!include <GCP/Compute/CloudRun>
!include <GCP/Databases/CloudFirestore>
!include <GCP/Storage/CloudStorage>
!include <GCP/Compute/CloudFunctions>
!include <GCP/AI/VertexAI>

title "CSV Analysis Processing (Upload to Report)"

actor User as user
participant "Frontend Web App" as frontendApp <<Container>>
participant "Backend API (SA)" as serverActions <<Container>>
database "Firebase Firestore" as firestore <<ContainerDb>> #APPLICATION;sprite=gcp_cloud_firestore
participant "Firebase Storage" as storage <<Container>> #APPLICATION;sprite=gcp_cloud_storage
participant "Background Processing (Functions)" as firebaseFunctions <<Container>> #APPLICATION;sprite=gcp_cloud_functions
participant "Google AI (Gemini)" as googleAI <<System_Ext>> #EXTERNAL_SYSTEM;sprite=gcp_vertex_ai

autonumber "<b>[0]"

user -> frontendApp: Uploads CSV & metadata
frontendApp -> serverActions: Calls create/finalize SA; Manages Storage upload
serverActions -> firestore: Creates record (status 'uploading'); Updates (status 'summarizing_data', URL)
frontendApp -> storage: Uploads CSV to Storage (client-side)

firestore -> firebaseFunctions: Triggers 'processAnalysisOnUpdate'
firebaseFunctions -> storage: Reads CSV from Storage
firebaseFunctions -> googleAI: Executes AI Agent pipeline (Summarizer, Identifier, Analyzer, Reviewer)
firebaseFunctions -> firestore: Saves structured report (JSON) to Firestore
firebaseFunctions -> storage: Converts to MDX, saves to Storage
firebaseFunctions -> firestore: Updates status to 'completed' & MDX path in Firestore
frontendApp <-- firestore: Listens for status updates (onSnapshot) & displays result

@enduml
```

## Flow Description

1.  The **User** interacts with the **Frontend Web App** to select a CSV file and provide metadata.
2.  The **Frontend Web App** calls Server Actions (`createInitialAnalysisRecordAction` and manages the upload process, then `finalizeFileUploadRecordAction`).
3.  The **Server Actions** create an initial record in **Firebase Firestore** (status "uploading"), and later update it with the Storage URL and change status to "summarizing_data".
4.  The **Frontend Web App** (via `useFileUploadManager`) uploads the CSV file directly to **Firebase Storage**.
5.  The status change in **Firebase Firestore** (to "summarizing_data") triggers the `processAnalysisOnUpdate` Firebase Function.
6.  The **Firebase Function** reads the CSV file from **Firebase Storage**.
7.  The **Firebase Function** orchestrates the AI agent pipeline (using Genkit and **Google AI (Gemini)**).
8.  The **Firebase Function** saves the final structured report (JSON) to **Firebase Firestore**.
9.  The **Firebase Function** converts the JSON report to MDX and saves it to **Firebase Storage**.
10. The **Firebase Function** updates the analysis status in **Firebase Firestore** to "completed" and stores the MDX file path.
11. The **Frontend Web App** (via `useAnalysisManager` using `onSnapshot`) detects status/progress updates in **Firebase Firestore** and displays the results or final report.
