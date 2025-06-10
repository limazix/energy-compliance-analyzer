# C4 Deployment Diagram: Energy Compliance Analyzer

[<- Back to Level C4 (Code)](./index.md)

This diagram describes how the Energy Compliance Analyzer system containers are deployed to the Firebase and Google Cloud Platform (GCP) infrastructure for a typical production environment.

```plantuml
@startuml C4_Deployment_ECA
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Deployment.puml
!include <GCP/GCPCommon>
!include <GCP/Compute/CloudRun>
!include <GCP/Compute/CloudFunctions>
!include <GCP/Firebase/FirebasePlatform>
!include <GCP/Firebase/FirebaseAuthentication>
!include <GCP/Databases/CloudFirestore>
!include <GCP/Databases/FirebaseRealtimeDatabase>
!include <GCP/Storage/CloudStorage>
!include <GCP/AI/VertexAI>

title "Deployment Diagram - Energy Compliance Analyzer (Production)"

!define FRONTEND_APP_ALIAS frontendApp
!define FIREBASE_FUNCTIONS_ALIAS firebaseFunctions
!define FIRESTORE_ALIAS firestore
!define RTDB_ALIAS rtdb
!define STORAGE_ALIAS storage
!define AUTH_ALIAS auth

Deployment_Node(userDevice, "User's Device", "Desktop/Mobile Browser") {
    Container_Instance(FRONTEND_APP_ALIAS, browserFrontendInstance, "Runs Frontend Web App (client-side)")
}

Deployment_Node(gcp, "Google Cloud Platform (GCP)", "Google's Managed Infrastructure", $sprite="gcp_cloud_platform") {
    Deployment_Node(appHosting, "Firebase App Hosting", "Managed web app hosting (via Cloud Run)", "Region: us-central1 (example)", $sprite="gcp_cloud_run") {
        Container_Instance(FRONTEND_APP_ALIAS, nextJsAppInstance, "Hosts Next.js App (UI & Server Actions)")
    }

    Deployment_Node(cloudFunctionsNode, "Firebase Functions Execution", "Serverless backend execution", "Region: us-central1 (example)", $sprite="gcp_cloud_functions") {
        Container_Instance(FIREBASE_FUNCTIONS_ALIAS, analysisProcessorInstance, "Executes AI analysis pipeline")
    }

    Deployment_Node(firebaseCoreServices, "Firebase Core Services", "Managed backend platform services", $sprite="gcp_firebase_platform") {
        ContainerDb_Instance(FIRESTORE_ALIAS, firestoreInstance, "Stores analysis metadata, structured reports", $sprite="gcp_cloud_firestore")
        ContainerDb_Instance(RTDB_ALIAS, rtdbInstance, "Stores chat conversation history", $sprite="gcp_firebase_realtime_database")
        Container_Instance(STORAGE_ALIAS, storageInstance, "Stores uploaded CSVs & MDX reports", $sprite="gcp_cloud_storage")
        Container_Instance(AUTH_ALIAS, authInstance, "Manages user authentication", $sprite="gcp_firebase_authentication")
    }
}

System_Ext(googleAI, "Google AI (Gemini)", "Generative Language Model (LLM) services", $sprite="gcp_vertex_ai")

Rel(browserFrontendInstance, nextJsAppInstance, "Accesses", "HTTPS")
Rel(nextJsAppInstance, authInstance, "Authenticates via", "Firebase SDK")
Rel(nextJsAppInstance, firestoreInstance, "Reads/Writes data", "Firebase SDK")
Rel(nextJsAppInstance, rtdbInstance, "Syncs chat", "WebSockets/SDK")
Rel(nextJsAppInstance, storageInstance, "Manages files", "Firebase SDK")
Rel(nextJsAppInstance, googleAI, "Calls Chat AI", "Genkit API/HTTPS")

Rel(firestoreInstance, analysisProcessorInstance, "Triggers Function", "Firestore Triggers")
Rel(analysisProcessorInstance, firestoreInstance, "Reads/Writes data", "Firebase Admin SDK")
Rel(analysisProcessorInstance, storageInstance, "Reads/Writes files", "Firebase Admin SDK")
Rel(analysisProcessorInstance, googleAI, "Calls AI Pipeline", "Genkit API/HTTPS")

SHOW_LEGEND()
@enduml
```
