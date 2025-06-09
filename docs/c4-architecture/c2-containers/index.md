# C4 Model: Level 2 - Container Overview - Energy Compliance Analyzer

This diagram details the main containers (applications, data stores, etc.) that make up the Energy Compliance Analyzer system. Each container is a deployable unit or a significant data store.

```mermaid
C4Container
  title Container Diagram for the Energy Compliance Analyzer

  Person(user, "User", "Interacts with the system via frontend.", $sprite="fa:fa-user")

  System_Boundary(c1, "Energy Compliance Analyzer") {
    Container(frontendApp, "Frontend Web App", "Next.js, React, ShadCN UI, TailwindCSS", "User interface for login, file upload, viewing analyses, reports, and interactive chat. Hosted on Firebase App Hosting.", $sprite="fa:fa-desktop")
    Container(serverActions, "Backend API", "Next.js Server Actions, Node.js, Genkit", "Handles file uploads, triggers processing, orchestrates report chat, and interacts with Firebase services. Runs on Firebase App Hosting.", $sprite="fa:fa-cogs")
    Container(firebaseFunctions, "Background Processing", "Firebase Functions, Node.js, TypeScript, Genkit", "Executes the main AI analysis pipeline (specialist agents) for CSV data and generates structured reports.", $sprite="fa:fa-bolt")
    ContainerDb(firestore, "Main Database", "Firebase Firestore (NoSQL, Document DB)", "Stores analysis metadata, status, tags, and the structured report (JSON).", $sprite="fa:fa-database")
    ContainerDb(rtdb, "Chat Database", "Firebase Realtime Database (NoSQL, Realtime JSON DB)", "Stores the conversation history of the interactive report chat.", $sprite="fa:fa-comments")
    Container(storage, "File Storage", "Firebase Storage (Blob Storage)", "Stores CSV files uploaded by users and the generated MDX reports.", $sprite="fa:fa-archive")
    Container(auth, "Authentication Service", "Firebase Authentication (OAuth, Identity Management)", "Manages user authentication via Google Sign-In.", $sprite="fa:fa-key")
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Generative Language Models (LLMs) for AI.", $sprite="fa:fa-brain")

  Rel(user, frontendApp, "Uses", "HTTPS")
  Rel(frontendApp, serverActions, "Sends requests to", "HTTPS/Server Actions")
  Rel(frontendApp, auth, "Authenticates with", "Firebase SDK")
  Rel(frontendApp, rtdb, "Syncs chat messages with", "Firebase SDK, WebSockets")

  Rel(serverActions, firestore, "Reads/Writes metadata and reports in", "Firebase SDK")
  Rel(serverActions, storage, "Manages upload information for", "Firebase SDK")
  Rel(serverActions, googleAI, "Interacts with Orchestrator Agent for chat via", "Genkit API Call")
  Rel(serverActions, firebaseFunctions, "Triggers (indirectly via Firestore)", "Firestore Trigger")
  Rel(serverActions, rtdb, "Saves chat messages and updates report via", "Firebase Admin SDK (indirect, via Functions or Server Actions)")

  Rel(firebaseFunctions, storage, "Reads CSVs and Saves MDX reports in", "Firebase Admin SDK")
  Rel(firebaseFunctions, firestore, "Reads/Updates status and saves structured report in", "Firebase Admin SDK")
  Rel(firebaseFunctions, googleAI, "Executes AI pipeline (specialist agents) via", "Genkit API Call")

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
