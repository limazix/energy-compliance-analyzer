# C4 Model: Level 2 - Container Overview - Energy Compliance Analyzer

This diagram details the main containers (applications, data stores, etc.) that make up the Energy Compliance Analyzer system. Each container is a deployable unit or a significant data store.

```mermaid
C4Container
  title "Container Diagram for Energy Compliance Analyzer"

  Person(user, "User", "Interacts via frontend.", $sprite="fa:fa-user")

  System_Boundary(c1, "Energy Compliance Analyzer") {
    %% User-facing and API Layer
    Container(frontendApp, "Frontend Web App", "Next.js, React, ShadCN UI", "UI for login, upload, reports, chat. Hosted on Firebase App Hosting.", $sprite="fa:fa-desktop")
    Container(serverActions, "Backend API", "Next.js Server Actions, Genkit", "Handles uploads, triggers processing, orchestrates chat. Runs on App Hosting.", $sprite="fa:fa-cogs")

    %% Backend Processing Layer
    Container(firebaseFunctions, "Background Processing", "Firebase Functions, Node.js, Genkit", "Executes AI analysis pipeline, generates reports.", $sprite="fa:fa-bolt")

    %% Data Storage & Auth Layer
    Container(auth, "Authentication Service", "Firebase Authentication", "Manages user authentication (Google Sign-In).", $sprite="fa:fa-key")
    ContainerDb(firestore, "Main Database", "Firebase Firestore", "Stores analysis metadata, status, tags, structured report (JSON).", $sprite="fa:fa-database")
    ContainerDb(rtdb, "Chat Database", "Firebase Realtime DB", "Stores interactive report chat history.", $sprite="fa:fa-comments")
    Container(storage, "File Storage", "Firebase Storage", "Stores uploaded CSVs and generated MDX reports.", $sprite="fa:fa-archive")
  }

  System_Ext(googleAI, "Google AI (Gemini)", "LLMs for AI.", $sprite="fa:fa-brain")

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

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)", $borderColor="rgb(13, 105, 184)")
  UpdateElementStyle(frontendApp, $fontColor="white", $bgColor="rgb(43, 135, 209)", $borderColor="rgb(43, 135, 209)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(43, 135, 209)", $borderColor="rgb(43, 135, 209)")
  UpdateElementStyle(firebaseFunctions, $fontColor="white", $bgColor="rgb(43, 135, 209)", $borderColor="rgb(43, 135, 209)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(rtdb, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(auth, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")

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
