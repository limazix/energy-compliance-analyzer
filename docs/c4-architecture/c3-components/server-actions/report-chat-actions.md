
# C3: Component - Report Chat Actions (`reportChatActions`)

[<- Back to Server Actions Components](./../02-server-actions-components.md)

## Description

The **Report Chat Actions** component (`src/features/report-chat/actions/reportChatActions.ts`) is a Server Actions module that orchestrates user interaction with the analysis report via a chat interface. It uses Genkit and the Gemini model to process user messages and generate responses.

## Responsibilities (Behaviors)

*   **Process User Message (`askReportOrchestratorAction`):**
    *   Receives user ID, analysis ID, user message text, current MDX report content, structured report object (JSON), original filename, and language code.
    *   Validates inputs.
    *   Saves the user's message to Firebase Realtime Database (RTDB) in the chat node corresponding to the analysis (`chats/{analysisId}`).
    *   Creates a placeholder or initial AI message in RTDB.
    *   Invokes the Genkit flow `orchestrateReportInteractionFlow` (defined in `src/ai/flows/orchestrate-report-interaction.ts`).
        *   This flow receives context (user message, MDX, structured report, filename, power quality data summary, language).
        *   Uses the Gemini model to generate a textual response.
        *   May use the `callRevisorTool` if the user requests report modifications. The tool, in turn, calls the `reviewComplianceReportFlow`.
    *   Streams the AI's response (in chunks, if applicable) back to the client by updating the AI's message in RTDB.
    *   **If the report is modified by the AI (via `callRevisorTool`):**
        *   Updates the structured report object (JSON) in the Firebase Firestore analysis document.
        *   Generates a new MDX file from the revised structured report (using `convertStructuredReportToMdx`).
        *   Saves the new MDX file to Firebase Storage, replacing or versioning the previous one.
        *   Returns an indication that the report was modified, along with the new content (or paths), so the frontend can update the view.
    *   Returns an object indicating the success of the operation, the AI's message ID in RTDB, and whether the report was modified.

## Technologies and Key Aspects

*   **TypeScript:** For typing input/output data and action logic.
*   **Next.js Server Actions:** To provide the secure endpoint for the chat interface.
*   **Genkit:**
    *   Invokes the `interactionPrompt` (which uses `orchestrateReportInteractionFlow`).
    *   Manages the use of tools (like `callRevisorTool`).
*   **Google AI (Gemini):** Used by Genkit flows for natural language processing and response generation.
*   **Firebase Realtime Database:**
    *   `push` to add new messages (user and AI).
    *   `update` to stream AI responses in chunks to the placeholder message.
    *   `serverTimestamp` to record message times.
*   **Firebase Firestore:**
    *   `updateDoc` to save the revised structured report if the AI modifies it.
*   **Firebase Storage:**
    *   `uploadString` (or similar) to save the new MDX file if the report is modified.
*   **Utilities:**
    *   `convertStructuredReportToMdx` to generate MDX from the structured report.
*   **Response Streaming:** The action is designed to support streaming AI responses to RTDB, allowing the frontend to display the response as it's generated.
*   **Error Handling:** Manages errors from AI communication, Firebase, or other processing issues.

    