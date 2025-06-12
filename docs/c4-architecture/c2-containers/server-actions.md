# C2 Model: Container Detail - Backend API (Next.js Server Actions)

[<- Back to Container Overview (C2)](./index.md)

## Description

**Next.js Server Actions** function as the backend API layer for the Frontend Web App. They are server-side functions co-located with Next.js code, executed on the server in response to client calls. They simplify full-stack communication, allowing the frontend to invoke server logic securely and directly.

## Responsibilities (Behaviors)

- **File Upload Handling:**
  - Receives upload form submission from the frontend (metadata like title, description).
  - Creates an initial record for the new analysis in Firebase Firestore, marking the status as "uploading".
  - Returns an analysis ID to the frontend. (Actual upload to Storage is now managed by `useFileUploadManager` on the client, which then calls actions to finalize).
- **Analysis Status Update:**
  - After the CSV file upload to Firebase Storage is completed by the client, a Server Action is called to finalize the record.
  - Updates the analysis record in Firestore with the file URL in Storage and changes the status to "summarizing_data" (or similar state) to trigger Firebase Functions.
- **Tag Management:**
  - Adds or removes tags from a specific analysis in Firestore.
- **Report Data Fetching:**
  - Fetches analysis metadata (including the path to the MDX file in Storage) from Firestore.
  - Fetches the MDX file content from Firebase Storage.
  - Returns the MDX content and other relevant data to the frontend for report display.
- **Interactive Report Chat Orchestration:**
  - Receives user messages sent via the chat interface on the frontend.
  - Invokes a Genkit flow (Chat Orchestrator Agent) that uses Gemini to process the user's message in the context of the current report (MDX and structured).
  - Saves the conversation history (user and AI messages) in Firebase Realtime Database.
  - If the Orchestrator Agent (via its review tool) modifies the structured report:
    - Updates the structured report object (JSON) in Firestore.
    - Generates a new MDX file from the revised structured report.
    - Saves the new MDX file to Firebase Storage, replacing or versioning the previous one.
    - Returns the new MDX or an update indication to the frontend.
- **Analysis Management Operations:**
  - Delete an analysis (mark as 'deleted' in Firestore, remove files from Storage).
  - Cancel an analysis in progress (update status to 'cancelling' in Firestore).

## Technologies and Constraints

- **Core Technology:** Next.js Server Actions (running in a Node.js environment).
- **Artificial Intelligence:** Genkit for orchestrating AI flows, specifically for the Chat Orchestrator Agent, which uses Google AI (Gemini).
- **Firebase SDKs (Server-Side):**
  - Firebase Admin SDK (preferably) or Firebase Server SDK for secure interactions with Firestore, Storage, and Realtime Database. Server Actions have access to secure environment variables.
- **Execution:** Executed as part of the Next.js application on Firebase App Hosting.
- **Security:** Server Actions are a secure mechanism for exposing backend logic, as the code is not sent to the client. User authentication is verified before performing sensitive operations.
- **Limitations:** Subject to the execution limits of the Next.js server environment (e.g., runtime, memory), which may differ from Firebase Functions. For very long or intensive processes, Firebase Functions are preferred.
