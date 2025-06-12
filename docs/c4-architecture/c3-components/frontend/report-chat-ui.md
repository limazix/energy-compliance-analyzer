# C3: Component - Report Chat Interface (reportChatUI)

[<- Back to Frontend Components](./../01-frontend-app-components.md)

## Description

The **Report Chat Interface**, an integral part of `ReportPage.tsx`, allows the user to interact with an AI agent (Orchestrator Agent) to discuss, clarify, or request modifications to the displayed compliance report.

## Responsibilities (Behaviors)

- **Message Display:**
  - Renders the conversation history between the user and the AI agent.
  - Visually differentiates user and agent messages.
  - Shows avatars and timestamps for each message.
- **User Message Input:**
  - Provides a text field (`Textarea`) for the user to type questions or requests.
  - Allows message submission via a button or by pressing Enter.
- **Backend Communication (Server Action):**
  - When sending a message, calls the `askReportOrchestratorAction` Server Action.
  - Sends user text, current MDX report content, structured report object (JSON), original filename, and language code to the action.
- **Synchronization with Firebase Realtime Database (RTDB):**
  - Listens (`onValue`) to the RTDB node corresponding to the current analysis chat (`chats/{analysisId}`).
  - Updates the UI with new messages (from user or AI) as they arrive in RTDB.
  - Sends user messages to RTDB for persistence and so the Server Action can record the AI's response.
  - The `askReportOrchestratorAction` Server Action is responsible for writing the user message and AI response (or its initial placeholder and streaming updates) to RTDB.
- **AI Response Feedback:**
  - Indicates when the AI agent is processing a response (`isAiResponding`).
  - Displays the AI response (potentially streaming, if RTDB is updated in chunks).
  - If the AI modifies the report, the `ReportPage` (parent component) is notified and updates the MDX and `structuredReport`.
- **Chat Error Management:**
  - Displays error messages if communication with the AI agent fails or if the Server Action returns an error.

## Technologies and Key Aspects

- **React Components:** UI logic within `ReportPage.tsx`.
- **ShadCN UI:** `Textarea`, `Button`, `ScrollArea`, `Avatar`, `Badge` to build the chat interface.
- **Firebase SDK (Realtime Database):** `ref`, `onValue`, `push`, `serverTimestamp`, `off`, `child`, `update` for real-time communication.
- **Server Actions:** `askReportOrchestratorAction` to interact with the AI Orchestrator Agent.
- **State Management:** `useState`, `useEffect`, `useCallback`, `useRef` (for scroll) to manage the state of messages, user input, and AI status.
- **Lucide-react:** Icons for buttons and fallback avatars.
- **Toast Notifications:** `useToast` to notify about report updates or errors.
