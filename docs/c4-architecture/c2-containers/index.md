# C4 Model: Level 2 - Container Overview - Energy Compliance Analyzer

This diagram details the main containers (applications, data stores, etc.) that make up the Energy Compliance Analyzer system. Each container is a deployable unit or a significant data store.

```plantuml
@startuml C4_Container_ECA
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
!include <GCP/GCPCommon>
!include <GCP/Compute/CloudRun>
!include <GCP/Compute/CloudFunctions>
!include <GCP/Firebase/FirebaseAuthentication>
!include <GCP/Databases/CloudFirestore>
!include <GCP/Databases/FirebaseRealtimeDatabase>
!include <GCP/Storage/CloudStorage>
!include <GCP/AI/VertexAI>

title "Container Diagram for Energy Compliance Analyzer"

Person(user, "User", "Interacts via frontend.")

System_Boundary(c1, "Energy Compliance Analyzer") {
    Container(frontendApp, "Frontend Web App", "Next.js, React", "UI for login, upload, reports, chat. Hosted on Firebase App Hosting.", $sprite="gcp_cloud_run")
    Container(serverActions, "Backend API", "Next.js Server Actions", "Handles uploads, triggers processing, orchestrates chat. Runs on App Hosting.", $sprite="gcp_cloud_run")
    Container(firebaseFunctions, "Background Processing", "Firebase Functions", "Executes AI analysis pipeline, generates reports.", $sprite="gcp_cloud_functions")

    Container(auth, "Authentication Service", "Firebase Authentication", "Manages user authentication (Google Sign-In).", $sprite="gcp_firebase_authentication")
    ContainerDb(firestore, "Main Database", "Firebase Firestore", "Stores analysis metadata, status, tags, structured report (JSON).", $sprite="gcp_cloud_firestore")
    ContainerDb(rtdb, "Chat Database", "Firebase Realtime DB", "Stores interactive report chat history.", $sprite="gcp_firebase_realtime_database")
    Container(storage, "File Storage", "Firebase Storage", "Stores uploaded CSVs and generated MDX reports.", $sprite="gcp_cloud_storage")
}

System_Ext(googleAI, "Google AI (Gemini)", "LLMs for AI.", $sprite="gcp_vertex_ai")

Rel(user, frontendApp, "Uses", "HTTPS")

Rel(frontendApp, serverActions, "Sends requests to", "HTTPS/SA")
Rel(frontendApp, auth, "Authenticates with", "Firebase SDK")
Rel(frontendApp, rtdb, "Syncs chat messages", "Firebase SDK, WebSockets")

Rel(serverActions, firestore, "Reads/Writes (metadata, reports)", "Firebase SDK")
Rel(serverActions, storage, "Manages upload info for", "Firebase SDK")
Rel(serverActions, googleAI, "Interacts with Chat Orchestrator", "Genkit API")
Rel(serverActions, firebaseFunctions, "Triggers processing (via Firestore)", "Firestore Trigger")
Rel(serverActions, rtdb, "Saves chat messages", "Firebase Admin SDK")

Rel(firebaseFunctions, storage, "Reads CSVs & Saves MDX", "Firebase Admin SDK")
Rel(firebaseFunctions, firestore, "Reads/Updates status & saves report", "Firebase Admin SDK")
Rel(firebaseFunctions, googleAI, "Executes AI pipeline", "Genkit API")

SHOW_LEGEND()
@enduml
```

## Container Details

Click on a container below for more details on its responsibilities, technologies, and interactions:

- [Frontend Web App](./frontend-app.md)
- [Backend API (Next.js Server Actions)](./server-actions.md)
- [Background Processing (Firebase Functions)](./firebase-functions.md)
- [Main Database (Firebase Firestore)](./firestore-db.md)
- [Chat Database (Firebase Realtime Database)](./rtdb.md)
- [File Storage (Firebase Storage)](./storage.md)
- [Authentication Service (Firebase Authentication)](./auth.md)

[<- Back to: System Context (C1)](../c1-context.md)
[Next Level: Component Diagram (C3)](../c3-components/index.md)
