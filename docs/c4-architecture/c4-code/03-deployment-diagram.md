# C4 Deployment Diagram: Energy Compliance Analyzer

[<- Back to Level C4 (Code)](./index.md)

This diagram describes how the Energy Compliance Analyzer system containers are deployed to the Firebase and Google Cloud Platform (GCP) infrastructure for a typical production environment.

```mermaid
C4Deployment
  title Deployment Diagram - Energy Compliance Analyzer (Production)

  Deployment_Node(userDevice, "User's Device", "Desktop/Mobile Browser", $sprite="fa:fa-desktop") {
    Container_Instance(browserFrontendInstance, frontendApp, "Runs Frontend Web App (client-side from App Hosting)")
  }

  Deployment_Node(gcp, "Google Cloud Platform (GCP)", "Google's Managed Infrastructure", $sprite="fa:fa-cloud") {
    Deployment_Node(appHosting, "Firebase App Hosting", "Managed web app hosting", "Region: us-central1 (example)") {
      Container_Instance(nextJsAppInstance, frontendApp, "Hosts Next.js App (UI & Server Actions)", "Next.js, Node.js")
    }

    Deployment_Node(cloudFunctions, "Firebase Functions", "Serverless backend execution", "Region: us-central1 (example)") {
      Container_Instance(analysisProcessorInstance, firebaseFunctions, "Executes AI analysis pipeline", "Node.js, Genkit, Gemini")
    }

    Deployment_Node(firebaseCoreServices, "Firebase Core Services", "Managed backend platform services", $sprite="fa:fa-fire") {
      ContainerDb_Instance(firestoreInstance, firestore, "Stores analysis metadata, structured reports", "Firestore NoSQL Database")
      ContainerDb_Instance(rtdbInstance, rtdb, "Stores chat conversation history", "Realtime NoSQL Database")
      Container_Instance(storageInstance, storage, "Stores uploaded CSVs & MDX reports", "Firebase Storage (via GCS)")
      Container_Instance(authInstance, auth, "Manages user authentication", "Firebase Authentication Service")
    }
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Generative Language Model (LLM) services", $sprite="fa:fa-brain")

  Rel(browserFrontendInstance, nextJsAppInstance, "Accesses (HTTPS)")
  Rel(nextJsAppInstance, authInstance, "Authenticates via (SDK)", "HTTPS")
  Rel(nextJsAppInstance, firestoreInstance, "Reads/Writes data (SDK)", "HTTPS/gRPC")
  Rel(nextJsAppInstance, rtdbInstance, "Syncs chat (SDK)", "WebSockets")
  Rel(nextJsAppInstance, storageInstance, "Manages files (SDK)", "HTTPS")
  Rel(nextJsAppInstance, googleAI, "Calls Chat AI (Genkit API)", "HTTPS")

  Rel(firestoreInstance, analysisProcessorInstance, "Triggers Function (via Eventarc/Firestore Triggers)")
  Rel(analysisProcessorInstance, firestoreInstance, "Reads/Writes data (Admin SDK)", "HTTPS/gRPC")
  Rel(analysisProcessorInstance, storageInstance, "Reads/Writes files (Admin SDK)", "HTTPS")
  Rel(analysisProcessorInstance, googleAI, "Calls AI Pipeline (Genkit API)", "HTTPS")

  %% Alias to reference elements defined at C2 Level
  Component_Ext(frontendApp, "Frontend Web App", "C2 Level Container")
  Component_Ext(firebaseFunctions, "Background Processing", "C2 Level Container")
  ComponentDb_Ext(firestore, "Main Database (Firestore)", "C2 Level Container")
  ComponentDb_Ext(rtdb, "Chat Database (RTDB)", "C2 Level Container")
  Component_Ext(storage, "File Storage (Storage)", "C2 Level Container")
  Component_Ext(auth, "Authentication Service", "C2 Level Container")

  UpdateElementStyle(userDevice, $fontColor="white", $bgColor="rgb(13, 105, 184)")
  UpdateElementStyle(gcp, $fontColor="white", $bgColor="rgb(66, 133, 244)")
  UpdateElementStyle(appHosting, $fontColor="black", $bgColor="rgb(251, 188, 5)")
  UpdateElementStyle(cloudFunctions, $fontColor="black", $bgColor="rgb(251, 188, 5)")
  UpdateElementStyle(firebaseCoreServices, $fontColor="black", $bgColor="rgb(255, 160, 0)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)")
```
