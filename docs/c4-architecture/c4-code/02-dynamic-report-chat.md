
# C4 Dynamic Diagram: Report Chat Interaction

[<- Back to Level C4 (Code)](./index.md)

This diagram illustrates the communication flow when a user interacts with the AI agent via a report's chat interface, including the possibility of report revision.

```mermaid
C4Dynamic
  title Report Chat Interaction Flow

  Person(user, "User", "Interacts with the chat UI.", $sprite="fa:fa-user")
  Container(frontendApp, "Frontend Web App", "Next.js/React", "Report and chat interface.", $sprite="fa:fa-desktop")
  Container(serverActions, "Backend API (Server Actions)", "Next.js", "Orchestrates chat interaction.", $sprite="fa:fa-cogs")
  Component(orchestrationFlow, "`orchestrateReportInteractionFlow`", "Genkit Flow (in Server Actions)", "Processes user input, uses AI and tools.", $sprite="fa:fa-brain")
  Component(revisorTool, "`callRevisorTool`", "Genkit Tool", "Invokes review flow to modify report.", $sprite="fa:fa-tools")
  Component(reviewFlow, "`reviewComplianceReportFlow`", "Genkit Flow", "Reviews/refines the structured report.", $sprite="fa:fa-clipboard-check")
  ContainerDb(rtdb, "Firebase Realtime DB", "NoSQL", "Stores chat messages.", $sprite="fa:fa-comments")
  ContainerDb(firestore, "Firebase Firestore", "NoSQL", "Stores structured report.", $sprite="fa:fa-database")
  Container(storage, "Firebase Storage", "Blob Storage", "Stores MDX reports.", $sprite="fa:fa-archive")
  System_Ext(googleAI, "Google AI (Gemini)", "LLM for Genkit.", $sprite="fa:fa-robot")

  Rel(user, frontendApp, "1. Sends chat message (text, report context)")
  Rel(frontendApp, serverActions, "2. Calls `askReportOrchestratorAction`")
  Rel(serverActions, rtdb, "3. Saves user message and AI placeholder to RTDB")
  Rel(serverActions, orchestrationFlow, "4. Invokes flow with report data and user message")
  
  Rel(orchestrationFlow, googleAI, "5. Processes query using LLM")
  Rel(orchestrationFlow, revisorTool, "6. Optional: Calls `callRevisorTool` tool if user requests revision")
  Rel(revisorTool, reviewFlow, "7. Optional: Invokes `reviewComplianceReportFlow` review flow")
  Rel(reviewFlow, googleAI, "8. Optional: Uses LLM to review structured report")
  Rel(reviewFlow, revisorTool, "9. Optional: Returns revised structured report")
  Rel(revisorTool, orchestrationFlow, "10. Optional: Returns revised report to main flow")
  Rel(orchestrationFlow, serverActions, "11. Returns AI response and (optionally) revised report")

  Rel(serverActions, rtdb, "12. Updates/Streams final AI response (streaming) in RTDB")
  Rel(serverActions, firestore, "13. Optional: Updates structured report in Firestore if modified")
  Rel(serverActions, storage, "14. Optional: Saves new MDX to Storage if modified")
  Rel(frontendApp, rtdb, "15. Listens to RTDB updates to display messages")
  Rel(frontendApp, firestore, "16. Optional: Listens for report updates (MDX/Structured) to re-render")


  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)")
  UpdateElementStyle(frontendApp, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(68, 158, 228)")
  UpdateElementStyle(orchestrationFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)")
  UpdateElementStyle(revisorTool, $fontColor="black", $bgColor="rgb(200, 200, 200)")
  UpdateElementStyle(reviewFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)")
  UpdateElementStyle(rtdb, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)")
```

## Flow Description

1.  The **User** types a message in the **Frontend Web App**'s chat interface and sends it. The message includes user text and the current report context (MDX and structured).
2.  The **Frontend Web App** calls the `askReportOrchestratorAction` Server Action (part of the **Backend API (Server Actions)** container).
3.  The **Server Action** saves the user's message to **Firebase Realtime Database (RTDB)** and creates a placeholder for the future AI response.
4.  The **Server Action** invokes the Genkit flow **`orchestrateReportInteractionFlow`** (a component within Server Actions), passing the user message and report context.
5.  The **`orchestrateReportInteractionFlow`** uses **Google AI (Gemini)** to understand the user's query.
6.  **Optional:** If the user requests a review or modification of the report, **`orchestrateReportInteractionFlow`** may decide to use the Genkit tool **`callRevisorTool`**.
7.  **Optional:** The **`callRevisorTool`** invokes another Genkit flow, **`reviewComplianceReportFlow`**.
8.  **Optional:** The **`reviewComplianceReportFlow`** uses **Google AI (Gemini)** to review and refine the structured report (JSON).
9.  **Optional:** The revised structured report is returned by **`reviewComplianceReportFlow`** to **`callRevisorTool`**.
10. **Optional:** The **`callRevisorTool`** returns the revised report to **`orchestrateReportInteractionFlow`**.
11. The **`orchestrateReportInteractionFlow`** formulates the final response for the user (and includes the revised report, if any) and returns it to the **Server Action**.
12. The **Server Action** streams the AI's response (potentially in chunks) to **Firebase Realtime Database**, updating the previously created placeholder.
13. **Optional:** If the report was modified, the **Server Action** updates the structured report (JSON) in **Firebase Firestore**.
14. **Optional:** If the report was modified, the **Server Action** generates new MDX and saves it to **Firebase Storage**.
15. The **Frontend Web App** listens to updates in **Firebase Realtime Database** and displays new messages (from user and AI) in real time.
16. **Optional:** The **Frontend Web App** can also listen for changes in the **Firebase Firestore** document (for the structured report and MDX path) and update the report view if it's modified by the AI.

This diagram highlights the collaboration between the frontend, server actions, Genkit flows, and Firebase services to provide an interactive chat experience.

    