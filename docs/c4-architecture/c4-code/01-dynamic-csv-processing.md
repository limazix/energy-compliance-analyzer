# C4 Dynamic Diagram: CSV Analysis Processing

[<- Back to Level C4 (Code)](./index.md)

This diagram illustrates the sequence of interactions and data flow when a user uploads a CSV file and the compliance analysis is processed by the AI pipeline in Firebase Functions.

```mermaid
C4Dynamic
  title CSV Analysis Processing (Upload to Report)

  Person(user, "User", "Interacts for upload.", $sprite="fa:fa-user")
  Container(frontendApp, "Frontend Web App", "Next.js/React", "UI for upload.", $sprite="fa:fa-desktop")
  Container(serverActions, "Backend API (SA)", "Next.js", "Initial upload & triggering.", $sprite="fa:fa-cogs")
  ContainerDb(firestore, "Firebase Firestore", "NoSQL", "Analysis metadata/status.", $sprite="fa:fa-database")
  Container(storage, "Firebase Storage", "Blob", "CSV & MDX files.", $sprite="fa:fa-archive")
  Container(firebaseFunctions, "Background Processing (Functions)", "Node.js, Genkit", "AI pipeline.", $sprite="fa:fa-bolt")
  System_Ext(googleAI, "Google AI (Gemini)", "LLM", "Analysis & generation.", $sprite="fa:fa-brain")

  Rel_Back(user, frontendApp, "1. Uploads CSV & metadata")
  Rel(frontendApp, serverActions, "2. Calls create/finalize actions; Manages Storage upload")
  Rel(serverActions, firestore, "3. Creates record (status 'uploading'); Updates (status 'summarizing_data', URL)")
  Rel(frontendApp, storage, "4. Uploads CSV to Storage (client-side)")
  // Step 5 & 6 from original are covered by step 3's combined action description.

  Rel(firestore, firebaseFunctions, "5. Triggers 'processAnalysisOnUpdate'")
  Rel(firebaseFunctions, storage, "6. Reads CSV from Storage")
  Rel(firebaseFunctions, googleAI, "7. Executes AI Agent pipeline (Summarizer, Identifier, Analyzer, Reviewer)")
  Rel(firebaseFunctions, firestore, "8. Saves structured report (JSON) to Firestore")
  Rel(firebaseFunctions, storage, "9. Converts to MDX, saves to Storage")
  Rel(firebaseFunctions, firestore, "10. Updates status to 'completed' & MDX path in Firestore")
  Rel(frontendApp, firestore, "11. Listens for status updates (onSnapshot) & displays result")

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)")
  UpdateElementStyle(frontendApp, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(68, 158, 228)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(firebaseFunctions, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)")
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
