
# C4 Dynamic Diagram: CSV Analysis Processing

[<- Back to Level C4 (Code)](./index.md)

This diagram illustrates the sequence of interactions and data flow when a user uploads a CSV file and the compliance analysis is processed by the AI pipeline in Firebase Functions.

```mermaid
C4Dynamic
  title CSV Analysis Processing (Upload to Report)

  Person(user, "User", "Interacts with the system for upload.", $sprite="fa:fa-user")
  Container(frontendApp, "Frontend Web App", "Next.js/React", "User interface for upload.", $sprite="fa:fa-desktop")
  Container(serverActions, "Backend API (Server Actions)", "Next.js", "Manages initial upload and triggering.", $sprite="fa:fa-cogs")
  ContainerDb(firestore, "Firebase Firestore", "NoSQL", "Stores analysis metadata and status.", $sprite="fa:fa-database")
  Container(storage, "Firebase Storage", "Blob Storage", "Stores CSV and MDX files.", $sprite="fa:fa-archive")
  Container(firebaseFunctions, "Background Processing (Functions)", "Node.js, Genkit", "Executes AI pipeline.", $sprite="fa:fa-bolt")
  System_Ext(googleAI, "Google AI (Gemini)", "LLM for analysis and generation.", $sprite="fa:fa-brain")

  Rel_Back(user, frontendApp, "1. Uploads CSV file and metadata")
  Rel(frontendApp, serverActions, "2. Calls 'createInitialAnalysisRecordAction' and manages upload to Storage")
  Rel(serverActions, firestore, "3. Creates analysis record (status: 'uploading')")
  Rel(frontendApp, storage, "4. Sends CSV file to Storage")
  Rel(frontendApp, serverActions, "5. Calls 'finalizeFileUploadRecordAction' with Storage URL")
  Rel(serverActions, firestore, "6. Updates record (status: 'summarizing_data', CSV URL)")

  Rel(firestore, firebaseFunctions, "7. Triggers 'processAnalysisOnUpdate' (via Firestore trigger)")
  Rel(firebaseFunctions, storage, "8. Reads CSV file from Storage")
  Rel(firebaseFunctions, googleAI, "9. Executes AI Agent pipeline (Summarizer, Resolution Identifier, Compliance Analyzer, Reviewer)")
  Rel(firebaseFunctions, firestore, "10. Saves structured report (JSON) to Firestore")
  Rel(firebaseFunctions, storage, "11. Converts to MDX and saves to Storage")
  Rel(firebaseFunctions, firestore, "12. Updates analysis status to 'completed' and MDX path")
  Rel(frontendApp, firestore, "13. Listens for status updates and displays progress/result (via onSnapshot in useAnalysisManager)")

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)")
  UpdateElementStyle(frontendApp, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(68, 158, 228)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(firebaseFunctions, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)")
```

## Flow Description

1.  The **User** interacts with the **Frontend Web App** to select a CSV file and provide metadata (title, description).
2.  The **Frontend Web App** calls Server Actions (`createInitialAnalysisRecordAction`) to register the analysis and manages the direct upload of the CSV file to Firebase Storage.
3.  The **Server Action** creates an initial record in **Firebase Firestore** with status "uploading".
4.  The **Frontend Web App** completes the CSV file upload to **Firebase Storage**.
5.  The **Frontend Web App** calls another Server Action (`finalizeFileUploadRecordAction`) with the file's Storage URL.
6.  The **Server Action** updates the analysis record in **Firebase Firestore**, changing the status to "summarizing_data" and saving the CSV URL.
7.  The status change in **Firebase Firestore** triggers the `processAnalysisOnUpdate` Firebase Function (container **Background Processing**).
8.  The **Firebase Function** reads the CSV file from **Firebase Storage**.
9.  The **Firebase Function** orchestrates the AI agent pipeline (using Genkit and **Google AI (Gemini)**) to:
    *   Summarize data.
    *   Identify ANEEL resolutions.
    *   Analyze compliance and generate an initial structured report (JSON).
    *   Review and refine the structured report.
10. The **Firebase Function** saves the final structured report (JSON) to **Firebase Firestore**.
11. The **Firebase Function** converts the JSON report to MDX and saves it to **Firebase Storage**.
12. The **Firebase Function** updates the analysis status in **Firebase Firestore** to "completed" and stores the MDX file path.
13. The **Frontend Web App** (via the `useAnalysisManager` hook using `onSnapshot`) detects status and progress updates in **Firebase Firestore** and displays the results or final report to the user.

This diagram focuses on the interaction between the main system containers during the processing of a new analysis.

    