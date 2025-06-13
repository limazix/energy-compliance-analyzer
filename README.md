# Energy Compliance Analyzer

This is a Next.js project to analyze the compliance of electrical power quality data based on the normative resolutions of ANEEL (Brazilian National Electrical Energy Agency). The application allows users to upload CSV files, identifies pertinent ANEEL resolutions, and generates a compliance report. Core data processing leverages an event-driven pipeline with Firebase Functions, and an interactive chat interface allows users to dialogue and refine the generated reports.

## Project Description

The Energy Compliance Analyzer simplifies compliance verification for the electrical sector. It uses an artificial intelligence (Genkit) agent pipeline to automate the analysis of power quality data against ANEEL regulations. Key backend operations, such as file upload finalization and data processing, are handled by event-driven Firebase Functions, triggered by Pub/Sub events or Firestore document changes. This ensures a decoupled and resilient architecture. An interactive chat interface, powered by Next.js Server Actions and Genkit, allows users to interact with and refine generated reports, with AI responses streamed in real-time.

## Core Components

- **Frontend:** Next.js, React, ShadCN UI, Tailwind CSS.
- **Backend API & Event Triggers:** Next.js Server Actions (for frontend interactions, like the report chat, and for publishing events to Pub/Sub).
- **Background Processing & Event Handling:** Firebase Functions (Node.js, TypeScript) for:
  - Event-driven finalization of file uploads (triggered by Pub/Sub).
  - Event-driven AI analysis pipeline (triggered by Firestore).
  - Event-driven handling of analysis deletion requests (triggered by Pub/Sub and Firestore).
- **Artificial Intelligence:** Genkit & Google AI (Gemini) running in Firebase Functions (for the main analysis and report generation pipeline with specialist agents: Data Analyst, Engineer, Reporter, Reviewer) and in Next.js Server Actions (for the interactive chat orchestrator agent).
- **Database, Storage, Messaging & Chat:** Firebase (Authentication, Firestore, Storage, Pub/Sub, Realtime Database for chat).
- **Hosting:** Firebase App Hosting for the Next.js application.

## Key Features

- Upload CSV files of power quality data.
- Event-driven finalization of file uploads using Pub/Sub and Firebase Functions.
- Analysis pipeline with Specialized AI Agents in Firebase Functions (triggered by Firestore changes):
  - **Senior Data Analyst:** Preprocessing, initial analysis, suggestion of transformations and visualizations.
  - **Electrical Engineer (Implicit):** Identification of ANEEL resolutions and compliance analysis.
  - **Reporter (Implicit):** Initial structuring of the report.
  - **Reviewer:** Refinement, grammatical correction, and formatting of the report.
- Generation of structured compliance report (JSON and MDX).
- Interactive Chat Interface on the report page:
  - Allows the user to ask for clarifications, further details, and request changes to the report.
  - Uses an Orchestrator Agent (via Next.js Server Actions and Genkit) to mediate the interaction.
  - AI responses are streamed in real-time.
  - Persistent chat history via Firebase Realtime Database.
- Analysis management:
  - Viewing, tags.
  - Event-driven deletion of analyses and associated files (via Pub/Sub and Firebase Functions).
  - Ability to retry failed analyses.
  - Confirmation for cancelling in-progress analyses.

## High-Level Architecture

The diagram below illustrates the main components and interactions within the Energy Compliance Analyzer. It highlights the event-driven nature of backend processing, utilizing Firebase Pub/Sub and Firestore triggers to orchestrate Firebase Functions for tasks like file upload finalization, data analysis, and deletion management.

![High-Level Architecture - Energy Compliance Analyzer](http://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/limazix/energy-compliance-analyzer/main/docs/plantuml/readme-architecture.iuml)

<p align="center" data-ai-hint="architecture diagram event-driven">Application Architecture Diagram</p>

## Running Locally

### Prerequisites

- Node.js (version 20 or higher)
- npm or yarn
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase Project (`electric-magnitudes-analizer`) with Authentication, Firestore, Storage, Realtime Database, and Pub/Sub enabled.
- Google AI (Gemini) API Key.

### Setup

1.  **Clone the repository.**
2.  **Install Next.js dependencies:** `npm install`
3.  **Install Firebase Functions dependencies:** `cd functions && npm install && cd ..`
4.  **Configure environment variables:**
    Create a `.env` file in the project root. This file will be used for local development (including the Next.js development server and Firebase Emulators).

    ```env
    # Consolidated Firebase configuration for the Next.js client
    # MUST be a valid stringified JSON.
    NEXT_PUBLIC_FIREBASE_CONFIG='{"apiKey":"YOUR_FIREBASE_API_KEY","authDomain":"YOUR_FIREBASE_AUTH_DOMAIN","projectId":"electric-magnitudes-analizer","storageBucket":"YOUR_FIREBASE_STORAGE_BUCKET","messagingSenderId":"YOUR_FIREBASE_MESSAGING_SENDER_ID","appId":"YOUR_FIREBASE_APP_ID","measurementId":"YOUR_FIREBASE_MEASUREMENT_ID","databaseURL":"YOUR_DATABASE_URL"}'

    # Gemini API Key for Genkit flows in Next.js (Server Actions) and Firebase Functions (when emulated locally)
    # For deployed Firebase Functions, this key is configured as a secret in the deployment environment.
    # This key is also used by functions if functions.config().gemini.api_key is not set.
    NEXT_PUBLIC_GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

    # Optional: If you are NOT using Firebase CLI to set runtime config for functions (functions:config:set gemini.api_key=...),
    # and you want local emulated functions to pick up the key via process.env.GEMINI_API_KEY,
    # you can set it here. If set, it takes precedence over NEXT_PUBLIC_GEMINI_API_KEY for functions.
    # GEMINI_API_KEY="YOUR_GEMINI_API_KEY_FOR_FUNCTIONS_EMULATOR"

    # Optional: For Server Actions using Firebase Admin SDK (e.g., to publish to Pub/Sub) locally.
    # Path to your Firebase service account key JSON file.
    # GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
    # Alternatively, you can set FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH if src/lib/firebase-admin.ts is configured for it.
    ```

    **Important:**

    - `NEXT_PUBLIC_FIREBASE_CONFIG`:
      - The value for `projectId` MUST be `electric-magnitudes-analizer`.
      - The value for `databaseURL` is essential for Realtime Database (chat), e.g.: `https://electric-magnitudes-analizer-default-rtdb.firebaseio.com`.
      - Ensure the entire value of this variable is a single, valid JSON string, enclosed in single or double quotes as per your shell/`.env` syntax.
    - `NEXT_PUBLIC_GEMINI_API_KEY`: Used by Genkit flows in Next.js (for chat). Also used as a fallback by Firebase Functions during local emulation if `GEMINI_API_KEY` env var or `functions.config().gemini.api_key` is not set.
    - `GEMINI_API_KEY` (optional in `.env`): If you set this variable in your root `.env` file, it will be prioritized by the emulated Firebase Functions over `NEXT_PUBLIC_GEMINI_API_KEY` and `functions.config()`. This is useful if you want to use a different key for functions emulation than for Next.js server actions. For deployed functions, this key must be set as a runtime environment variable directly in GCP or via Firebase CLI's `functions:config:set gemini.api_key=...`.
    - `GOOGLE_APPLICATION_CREDENTIALS`: Essential for Server Actions using the Firebase Admin SDK (e.g., for Pub/Sub) to authenticate when running locally. Ensure this path is correct.

5.  **Authorized Domains in Firebase Authentication:**
    In the Firebase Console (`electric-magnitudes-analizer` > Authentication > Settings > Authorized domains), add `localhost` and other development domains (e.g., `*.cloudworkstations.dev`).

6.  **Firebase Security Rules:**
    Review and, if necessary, deploy the security rules for Firestore (`rules/firestore.rules`), Storage (`rules/storage.rules`), and Realtime Database (`rules/database.rules.json`) before running locally or testing.
    Manual deployment (if not already done by CI/CD):
    `firebase deploy --only firestore,storage,database --project electric-magnitudes-analizer`

### Running the Application with Emulators (Recommended)

The project is configured to connect to Firebase Emulators (Auth, Firestore, Storage, Functions, Pub/Sub, Realtime Database) when accessed via `localhost`.

1.  **Build Firebase Functions (required for the Functions emulator):**
    ```bash
    npm run build --prefix functions
    ```
2.  **Start Firebase Emulators:**
    (In a separate terminal, in the project root)

    ```bash
    npm run emulators:start
    ```

    This uses `--import=./firebase-emulator-data --export-on-exit`. The Emulator UI will be at `http://localhost:4001`. Verify that `auth`, `firestore`, `storage`, `functions`, `pubsub`, and `database` emulators are active.
    The functions will pick up Gemini API key from `process.env.GEMINI_API_KEY` (if set in your shell or root `.env`), then `functions.config().gemini.api_key` (if you've set it via `firebase functions:config:set`), then `process.env.NEXT_PUBLIC_GEMINI_API_KEY` (from root `.env`).

3.  **Start your Next.js application:**
    (In another terminal)
    Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set in this terminal's environment if your Server Actions use the Admin SDK.

    ```bash
    npm run dev
    ```

    Access your application (`http://localhost:9002`). `src/lib/firebase.ts` will connect to the emulators for client SDKs. The Next.js application Server Actions will use the Admin SDK (potentially connecting to live Pub/Sub if `PUBSUB_EMULATOR_HOST` isn't set for that environment, or to the Pub/Sub emulator if it is). Firestore changes will trigger Functions running in the emulator. The report's interactive chat interface interacts with Genkit flows via Next.js Server Actions, which will use the `NEXT_PUBLIC_GEMINI_API_KEY` from your `.env`.

4.  **(Alternative) Emulators and dev server together with `firebase emulators:exec`:**
    The `npm run emulators:dev` script is already configured for this (it builds the functions and then runs the Next.js dev server with the emulators). Ensure `GOOGLE_APPLICATION_CREDENTIALS` is available to this script's environment.
    ```bash
    npm run emulators:dev
    ```
5.  **(Optional) Start the Genkit Development Server (to test flows in isolation):**
    If you want to test Genkit flows from the `src/ai/flows` folder in isolation, you can use:
    ```bash
    npm run genkit:dev
    ```
    This will start the Genkit development UI (usually at `http://localhost:4000/flows`).

## Testing

To run UI and integration tests (which use Firebase Emulators), execute:

```bash
npm test
```

This will use the `firebase emulators:exec --import=./firebase-emulator-data jest` script to run Jest tests in an environment with active emulators. Ensure that the functions have been built (`npm run build --prefix functions`) beforehand.
The Server Actions in tests will use the Admin SDK. Ensure necessary environment variables (like `GOOGLE_APPLICATION_CREDENTIALS` for Pub/Sub publishing, or mocks) are available.

### Test Environment Setup for Jest (Local)

Jest tests require certain environment variables to be defined to interact correctly with Firebase Emulators and for Firebase initialization itself.
The required environment variables are the same as those used by the CI workflow in `.github/workflows/tests.yml`.

**Options for configuring environment variables for local Jest tests:**

1.  **`.env.test` File (Recommended if your Jest setup supports it):**
    Some Jest configurations (especially with `dotenv`) can automatically load a `.env.test` file. If so, create this file in the project root:

    ```env
    # .env.test
    # Consolidated Firebase configuration for tests (can use dummy values if actual calls are mocked)
    NEXT_PUBLIC_FIREBASE_CONFIG='{"apiKey":"test-api-key","authDomain":"localhost","projectId":"electric-magnitudes-analizer","storageBucket":"localhost","messagingSenderId":"test-sender-id","appId":"test-app-id","databaseURL":"http://localhost:9000/?ns=electric-magnitudes-analizer"}'

    # Key for Next.js Server Actions (Genkit)
    NEXT_PUBLIC_GEMINI_API_KEY="test-gemini-key-for-jest-nextjs"

    # Key for Firebase Functions Emulators (Genkit). If functions.config().gemini.api_key is not set via CLI or if GEMINI_API_KEY is not set in the shell, this will be used as a fallback.
    # Or, explicitly set GEMINI_API_KEY here if your test runner loads this into process.env for the emulators.
    # GEMINI_API_KEY="test-gemini-key-for-jest-functions-emulator"

    # For Server Actions using Admin SDK locally (e.g., Pub/Sub publish)
    # GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json" # Replace with actual path or mock
    # PUBSUB_EMULATOR_HOST="localhost:8085" # To make Admin SDK Pub/Sub client use emulator

    # Emulator settings (match firebase.json and what CI uses)
    FIRESTORE_EMULATOR_HOST="localhost:8080"
    FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
    FIREBASE_STORAGE_EMULATOR_HOST="localhost:9199" # Or 127.0.0.1:9199
    FIREBASE_DATABASE_EMULATOR_HOST="localhost:9000"
    FUNCTIONS_EMULATOR_HOST="localhost:5001"
    FIREBASE_FUNCTIONS_EMULATOR_ORIGIN="http://localhost:5001" # Or http://127.0.0.1:5001

    # Other variables that may be needed depending on tests
    GCLOUD_PROJECT="electric-magnitudes-analizer" # Same as NEXT_PUBLIC_FIREBASE_PROJECT_ID
    GCP_REGION="us-central1" # Default region for functions

    # FIREBASE_CONFIG is a JSON string used by firebase-admin in emulators.
    # The content of FIREBASE_CONFIG is typically {"databaseURL": "http://localhost:9000/?ns=PROJECT_ID", "storageBucket": "localhost", "projectId": "PROJECT_ID"}
    # But for functions emulators, Firebase CLI usually sets it automatically.
    # If you encounter issues, you might need to set it explicitly.
    # FIREBASE_CONFIG='{"projectId":"electric-magnitudes-analizer","databaseURL":"http://localhost:9000/?ns=electric-magnitudes-analizer","storageBucket":"localhost"}'
    ```

    _Note: The `jest.setup.js` in this project NO LONGER mocks `NEXT_PUBLIC_FIREBASE_CONFIG`. You MUST provide it through your environment._

2.  **Prefixing the test command:**
    You can define the variables directly in the command:

    ```bash
    NEXT_PUBLIC_FIREBASE_CONFIG='{...}' FIRESTORE_EMULATOR_HOST="localhost:8080" npm test
    ```

    (This can become verbose).

3.  **Shell/IDE Environment Configuration:**
    Export the variables in your terminal before running `npm test`, or configure them in your IDE's run configurations for Jest tests.

Refer to the `env:` section of the `test_production` job in `.github/workflows/tests.yml` for the complete list of environment variables that the CI environment uses and that you might need to replicate for consistent local testing.

## Deployment

This project is configured for deployment to **Firebase App Hosting** (for the Next.js application) and **Firebase Functions** (for backend processing). Security rules (Firestore, Storage, Realtime Database) are also deployed.

Consult the [**Deployment Guide**](docs/DEPLOYMENT.md) for details on manual and automated deployment via GitHub Actions.

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for more details.
