# C4 Dynamic Diagram: Report Chat Interaction

[<- Back to Level C4 (Code)](./index.md)

This diagram illustrates the communication flow when a user interacts with the AI agent via a report's chat interface, including the possibility of report revision.

```mermaid
C4Dynamic
  title Report Chat Interaction Flow

  Person(user, "User", "Interacts with chat UI.", $sprite="fa:fa-user")
  Container(frontendApp, "Frontend Web App", "Next.js/React", "Report & chat UI.", $sprite="fa:fa-desktop")
  Container(serverActions, "Backend API (SA)", "Next.js", "Orchestrates chat interaction.", $sprite="fa:fa-cogs")
  Component(orchestrationFlow, "`orchestrateReportInteractionFlow`", "Genkit Flow (in SA)", "Processes user input, uses AI/tools.", $sprite="fa:fa-brain")
  Component(revisorTool, "`callRevisorTool`", "Genkit Tool", "Invokes review flow for report modification.", $sprite="fa:fa-tools")
  Component(reviewFlow, "`reviewComplianceReportFlow`", "Genkit Flow", "Reviews/refines structured report.", $sprite="fa:fa-clipboard-check")
  ContainerDb(rtdb, "Firebase RTDB", "NoSQL", "Stores chat messages.", $sprite="fa:fa-comments")
  ContainerDb(firestore, "Firebase Firestore", "NoSQL", "Stores structured report.", $sprite="fa:fa-database")
  Container(storage, "Firebase Storage", "Blob", "Stores MDX reports.", $sprite="fa:fa-archive")
  System_Ext(googleAI, "Google AI (Gemini)", "LLM for Genkit.", $sprite="fa:fa-robot")

  Rel(user, frontendApp, "1. Sends chat message (text, report context)")
  Rel(frontendApp, serverActions, "2. Calls `askReportOrchestratorAction`")
  Rel(serverActions, rtdb, "3. Saves user message & AI placeholder to RTDB")
  Rel(serverActions, orchestrationFlow, "4. Invokes flow with user message & report data")

  Rel(orchestrationFlow, googleAI, "5. LLM processes user query")
  Rel(orchestrationFlow, revisorTool, "6. Optional: Calls `callRevisorTool` if revision needed")
  Rel(revisorTool, reviewFlow, "7. Optional: Invokes `reviewComplianceReportFlow`")
  Rel(reviewFlow, googleAI, "8. Optional: LLM reviews structured report")
  Rel(reviewFlow, revisorTool, "9. Optional: Returns revised structured report to tool")
  Rel(revisorTool, orchestrationFlow, "10. Optional: Returns revised report to main flow")
  Rel(orchestrationFlow, serverActions, "11. Returns AI response (and optionally, revised report)")

  Rel(serverActions, rtdb, "12. Updates/Streams final AI response in RTDB")
  Rel(serverActions, firestore, "13. Optional: Updates structured report in Firestore if modified")
  Rel(serverActions, storage, "14. Optional: Saves new MDX to Storage if modified")
  Rel(frontendApp, rtdb, "15. Listens to RTDB for new/updated messages")
  Rel(frontendApp, firestore, "16. Optional: Listens for report document updates (MDX/Structured) to re-render report")


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

1.  The **User** sends a message via the **Frontend Web App**'s chat interface.
2.  The **Frontend** calls the `askReportOrchestratorAction` Server Action.
3.  The **Server Action** saves the user's message and an AI placeholder to **Firebase RTDB**.
4.  The **Server Action** invokes the **`orchestrateReportInteractionFlow`** (Genkit flow).
5.  The flow uses **Google AI (Gemini)** to process the query.
6.  Optionally, if report modification is requested, the flow calls the **`callRevisorTool`**.
7.  The tool, in turn, invokes the **`reviewComplianceReportFlow`**.
8.  The review flow uses **Google AI** to refine the structured report.
9.  The revised report is returned to the tool.
10. The tool returns the revised report to the main orchestration flow.
11. The orchestration flow returns the AI's textual response and any revised report to the Server Action.
12. The **Server Action** streams/updates the AI's response in **RTDB**.
13. If the report was modified, the **Server Action** updates the structured report in **Firestore**.
14. If modified, new MDX is generated and saved to **Firebase Storage**.
15. The **Frontend** listens to **RTDB** for chat message updates.
16. The **Frontend** may also listen to **Firestore** for changes to the main report document to re-render.
