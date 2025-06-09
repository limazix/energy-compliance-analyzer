# C4 Deployment Diagram: Energy Compliance Analyzer

[<- Back to Level C4 (Code)](./index.md)

This diagram describes how the Energy Compliance Analyzer system containers are deployed to the Firebase and Google Cloud Platform (GCP) infrastructure for a typical production environment.

```mermaid
C4Deployment
  title Deployment Diagram - Energy Compliance Analyzer (Production)

  Deployment_Node(userDevice, "User's Device", "Desktop/Mobile Browser", $sprite="fa:fa-desktop") {
    Container_Instance(browserFrontendInstance, frontendApp, "Runs the Frontend Web App (client-side) downloaded from App Hosting.")
  }

  Deployment_Node(gcp, "Google Cloud Platform (GCP)", "Google's Managed Infrastructure and Services", $sprite="fa:fa-cloud") {
    Deployment_Node(appHosting, "Firebase App Hosting", "Managed hosting service for web applications", "Region: us-central1 (configurable)") {
      Container_Instance(nextJsAppInstance, frontendApp, "Hosts the Next.js app including UI and Server Actions.", "Next.js v15+, Node.js v20+")
    }

    Deployment_Node(cloudFunctions, "Firebase Functions", "Serverless platform for backend code", "Region: us-central1 (configurable)") {
      Container_Instance(analysisProcessorInstance, firebaseFunctions, "Executes the AI analysis pipeline.", "Node.js v20+, Genkit, Gemini API")
    }

    Deployment_Node(firebaseCoreServices, "Firebase Core Services", "Fully managed backend services", $sprite="fa:fa-fire") {
      ContainerDb_Instance(firestoreInstance, firestore, "Stores analysis metadata, status, and structured reports.", "Firestore NoSQL Database (Multi-Region or Regional)")
      ContainerDb_Instance(rtdbInstance, rtdb, "Stores chat conversation history.", "Realtime NoSQL Database (Regional)")
      Container_Instance(storageInstance, storage, "Stores uploaded CSV files and generated MDX reports.", "Firebase Storage (GCS Buckets Multi-Regional or Regional)")
      Container_Instance(authInstance, auth, "Manages user authentication.", "Firebase Authentication Service (Global)")
    }
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Generative Language Model (LLM) services for AI.", $sprite="fa:fa-brain")

  Rel(browserFrontendInstance, nextJsAppInstance, "Accesses (HTTPS)")
  Rel(nextJsAppInstance, firestoreInstance, "Reads/Writes (Firebase SDK)", "HTTPS/gRPC")
  Rel(nextJsAppInstance, rtdbInstance, "Reads/Writes (Firebase SDK)", "WebSockets")
  Rel(nextJsAppInstance, storageInstance, "Uploads/Downloads (Firebase SDK)", "HTTPS")
  Rel(nextJsAppInstance, authInstance, "Authenticates via (Firebase SDK)", "HTTPS")
  Rel(nextJsAppInstance, googleAI, "Calls for chat AI (Genkit API Call)", "HTTPS")

  Rel(firestoreInstance, analysisProcessorInstance, "Triggers (via Eventarc/Firestore Triggers)")
  Rel(analysisProcessorInstance, firestoreInstance, "Reads/Writes (Firebase Admin SDK)", "HTTPS/gRPC")
  Rel(analysisProcessorInstance, storageInstance, "Reads/Writes (Firebase Admin SDK)", "HTTPS")
  Rel(analysisProcessorInstance, googleAI, "Calls for AI pipeline (Genkit API Call)", "HTTPS")

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
