
# C2 Model: Container Detail - Frontend Web App

[<- Back to Container Overview (C2)](./index.md)

## Description

The **Frontend Web App** is the primary interface through which users interact with the Energy Compliance Analyzer. It is a modern Single Page Application (SPA), built with Next.js and React, designed to be responsive and intuitive. It is hosted on Firebase App Hosting.

## Responsibilities (Behaviors)

*   **User Authentication:** Manages user login and logout using Google Sign-In via Firebase Authentication.
*   **Upload Interface:** Allows users to select CSV files containing power quality data, provide a title, and a description for the analysis.
*   **Analysis Visualization:** Displays a list of past analyses with their statuses, associated tags, and dates. Allows the user to expand an analysis to see details.
*   **Progress and Results Display:** Shows the progress of analyses that are in progress and the results of completed analyses.
*   **Report Rendering:** Displays the final compliance report, which is in MDX (Markdown with JSX) format.
*   **Interactive Chat:** Provides a chat interface for users to interact with an AI agent about the generated report, ask for clarifications, suggest modifications, or delve into details.
*   **UI State Management:** Controls the local state of the user interface, such as which analysis is selected, the state of the upload form, etc.
*   **User Notifications:** Presents feedback to the user via toasts/notifications (e.g., upload success, errors).

## Technologies and Constraints

*   **Main Framework:** Next.js (with App Router).
*   **UI Library:** React.
*   **UI Components:** ShadCN UI.
*   **Styling:** Tailwind CSS.
*   **Firebase SDKs (Client):**
    *   `firebase/app` for initialization.
    *   `firebase/auth` for authentication.
    *   `firebase/firestore` for listening to real-time status updates of analyses (optional, primarily for the list).
    *   `firebase/storage` (used indirectly via Server Actions for uploads).
    *   `firebase/database` for real-time chat functionality with Firebase Realtime Database.
*   **Backend Communication:** Uses Next.js Server Actions for all operations requiring server logic or secure access to data/services (e.g., initiating upload, fetching reports, interacting with chat AI).
*   **Hosting:** Firebase App Hosting.
*   **Global State (Optional):** May use React Context for global state management (e.g., authentication state, user data).
*   **Security:** Interactions with the backend (Server Actions) are protected and validate user identity.

    