
# C4 Deployment Diagram: Energy Compliance Analyzer

[<- Back to Level C4 (Code)](./index.md)

This diagram describes how the Energy Compliance Analyzer system containers are deployed to the Firebase and Google Cloud Platform (GCP) infrastructure for a typical production environment.

```mermaid
C4Deployment
  title Deployment Diagram - Energy Compliance Analyzer (Production)

  Deployment_Node(userDevice, "User's Device", "Desktop/Mobile Browser", $sprite="fa:fa-desktop") {
    Container_Instance(browser, "Web Browser", "Client Application (Next.js/React)", "Runs the Frontend Web App downloaded from App Hosting.")
  }

  Deployment_Node(gcp, "Google Cloud Platform (GCP)", "Google's Managed Infrastructure and Services", $sprite="fa:fa-cloud") {
    Deployment_Node(appHosting, "Firebase App Hosting", "Managed hosting service for web applications", "Region: us-central1 (configurable)") {
      Container_Instance(nextJsAppInstance, frontendApp, "Frontend Web App & Server Actions", "Next.js v15+, Node.js v20+")
    }

    Deployment_Node(cloudFunctions, "Firebase Functions", "Serverless platform for backend code", "Region: us-central1 (configurable)") {
      Container_Instance(analysisProcessorInstance, firebaseFunctions, "Background Processing (AI Pipeline)", "Node.js v20+, Genkit, Gemini API")
    }

    Deployment_Node(firebaseCoreServices, "Firebase Core Services", "Fully managed backend services", $sprite="fa:fa-fire") {
      ContainerDb_Instance(firestoreInstance, firestore, "Main Database", "Firestore NoSQL Database (Multi-Region or Regional)")
      ContainerDb_Instance(rtdbInstance, rtdb, "Chat Database", "Realtime NoSQL Database (Regional)")
      Container_Instance(storageInstance, storage, "File Storage", "Firebase Storage (GCS Buckets Multi-Regional or Regional)")
      Container_Instance(authInstance, auth, "Authentication Service", "Firebase Authentication Service (Global)")
    }
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Generative Language Model (LLM) services for AI.", $sprite="fa:fa-brain")

  Rel(browser, nextJsAppInstance, "Accesses (HTTPS)")
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

## Deployment Description

*   **User's Device:**
    *   Users access the Energy Compliance Analyzer via a **Web Browser** on their devices (desktops, tablets, smartphones).
    *   The browser runs the client application (Frontend Web App), which is a Single Page Application built with Next.js/React.

*   **Google Cloud Platform (GCP) / Firebase:**
    *   **Firebase App Hosting:**
        *   Hosts the **Frontend Web App & Server Actions** (container `nextJsAppInstance`).
        *   This service manages the build, deployment, and scaling of the Next.js application.
        *   The deployment region is typically `us-central1` or another configured during Firebase App Hosting setup.
    *   **Firebase Functions:**
        *   Hosts the **Background Processing** container (`analysisProcessorInstance`).
        *   These are serverless Node.js functions that execute the AI pipeline (Genkit with Gemini API) in response to triggers (e.g., Firestore updates).
        *   The region is also configurable (e.g., `us-central1`).
    *   **Firebase Core Services:**
        *   **Firebase Firestore (`firestoreInstance`):** Used as the main NoSQL database for storing analysis metadata, status, tags, and structured reports (JSON). Can be configured as multi-regional or regional.
        *   **Firebase Realtime Database (`rtdbInstance`):** Used for the interactive chat conversation history, providing real-time synchronization. It is generally regional.
        *   **Firebase Storage (`storageInstance`):** Stores CSV files uploaded by users and generated MDX reports. Storage buckets can be multi-regional or regional.
        *   **Firebase Authentication (`authInstance`):** Manages user authentication (via Google Sign-In). It is a global service.

*   **Google AI (Gemini) (External System):**
    *   Generative language models (LLMs) are accessed via API.
    *   Server Actions (for chat) and Firebase Functions (for the analysis pipeline) make API calls to Gemini through the Genkit framework.

## Key Interactions in Deployment

*   The user's **Web Browser** downloads and runs the Frontend App from **Firebase App Hosting**.
*   The Frontend App interacts with **Firebase Core Services** (Auth, Firestore, RTDB, Storage) using Firebase SDKs via HTTPS and WebSockets (for RTDB).
*   The Frontend App (specifically Server Actions) interacts with **Google AI** via Genkit for chat functionality.
*   Updates in **Firebase Firestore** (made by Server Actions) can trigger **Firebase Functions**.
*   **Firebase Functions** interact with **Firebase Firestore**, **Firebase Storage** (using the Firebase Admin SDK), and **Google AI** (via Genkit) to perform analysis processing.

This deployment diagram provides an overview of how the different parts of the system are hosted and interact in a production environment.

    