# Troubleshooting Guide

This document provides a checklist for diagnosing and resolving common errors, including `PERMISSION_DENIED` errors and issues with Firebase Functions, Realtime Database, and Genkit.

## **Troubleshooting `PERMISSION_DENIED` Errors (Firestore/Storage)**

If you encounter `PERMISSION_DENIED` errors in Firestore or Storage, follow this checklist strictly:

1.  **Local Rules Content:**

    - Verify that the `rules/firestore.rules` and `rules/storage.rules` files in your project's `rules/` folder contain the expected rules. For example, for a scenario where users only access their own data:
    - **Expected `rules/firestore.rules`:**
      ```javascript
      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          // Rule for operations on a specific analysis document
          match /users/{userId}/analyses/{analysisId} {
            allow read, write, update, delete: if request.auth != null && request.auth.uid == userId;
          }
          // Rule for operations on a user's 'analyses' collection
          match /users/{userId}/analyses { // Rule for the collection
            allow list, create: if request.auth != null && request.auth.uid == userId;
          }
        }
      }
      ```
    - **Expected `rules/storage.rules`:**
      ```javascript
      rules_version = '2';
      service firebase.storage {
        match /b/{bucket}/o {
          match /user_uploads/{userId}/{analysisId}/{allPaths=**} { // Adjusted to include analysisId if used in path
            allow read, write: if request.auth != null && request.auth.uid == userId;
          }
          match /user_reports/{userId}/{analysisId}/{allPaths=**} { // For MDX reports
            allow read, write: if request.auth != null && request.auth.uid == userId;
          }
        }
      }
      ```

2.  **Firebase Project Selection in CLI (for manual or local deployment):**

    - Run `firebase projects:list` to see all projects associated with your account.
    - Run `firebase use electric-magnitudes-analizer` to ensure this is the active project in the CLI. If the project doesn't appear or isn't set as default (`.firebaserc`), configure it.

3.  **App Environment Variables (`.env` File):**

    - Confirm that `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in your `.env` file is **EXACTLY** `electric-magnitudes-analizer`.
    - Check other Firebase settings in the `.env` file (API Key, Auth Domain, etc.) and ensure they match those of the `electric-magnitudes-analizer` project in the Firebase Console.

4.  **Rules Deployment (for manual deployment):**

    - Run `firebase deploy --only firestore:rules,storage:rules --project electric-magnitudes-analizer`.
    - Observe the output for success and to confirm that the deployment was to the `electric-magnitudes-analizer` project. The CLI will use the paths defined in `firebase.json` (now pointing to the `rules/` folder).

5.  **CRITICAL AND VISUAL VERIFICATION - Active Rules in Firebase Console:**

    - Open the Firebase Console ([console.firebase.google.com](https://console.firebase.google.com/)).
    - Select the `electric-magnitudes-analizer` project.
    - Go to **Firestore Database > "Rules" Tab**. Compare the COMPLETE text of the rules displayed here with the content of your local `rules/firestore.rules` file. They must be _identical_.
    - Do the same for **Storage > "Rules" Tab**, comparing with your local `rules/storage.rules` file.
    - **If the rules in the console are not as expected, the deployment failed, went to the wrong project, or the automated deployment (if configured) is not working as expected.** This is the most common point of failure.

6.  **Next.js Server Logs (and Browser Console):**

    - Check your Next.js server logs (console where you ran `npm run dev`).
      - Example from the `createInitialAnalysisRecordAction` when trying to create a document:
        `[Action_createInitialAnalysisRecord] Attempting to add document to Firestore. Path: 'users/USER_ID_FROM_ACTION/analyses'. Data for user 'USER_ID_FROM_ACTION'. Using Project ID: 'SERVER_SIDE_PROJECT_ID'`
        Confirm that `SERVER_SIDE_PROJECT_ID` is `electric-magnitudes-analizer`.
      - Example server error for `getPastAnalysesAction`:
        `[getPastAnalysesAction] PERMISSION_DENIED while querying path 'users/USER_ID_FROM_ACTION/analyses' for userId 'USER_ID_FROM_ACTION'. Check Firestore rules against active project 'SERVER_SIDE_PROJECT_ID'. Auth state in rules might be incorrect or userId mismatch. Firestore error code: [error code], message: [error message]`
    - Check the browser console logs (DevTools). The `AuthProvider` logs the `currentUser` (e.g., `[AuthProvider] Auth state changed. currentUser: {"uid":"CLIENT_SIDE_USER_ID", ...}`).
    - **CONFIRM that the `USER_ID_FROM_ACTION` from server logs (for both creating and listing) is the same `CLIENT_SIDE_USER_ID` you see in the `currentUser` from browser logs.** If there's a discrepancy here, the `userId` being used to construct the Firestore path will not match `request.auth.uid` in the rules.
    - Confirm that the logged `SERVER_SIDE_PROJECT_ID` matches `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in your `.env` and the `electric-magnitudes-analizer` project you are configuring.

7.  **User Authentication State:**

    - In your application, ensure the user is authenticated (`user` is not `null` and `user.uid` is present and is a valid, non-empty string _before_ attempting operations requiring authentication). The `AuthProvider` and `user.uid` logs should confirm this.

8.  **Paths in Code vs. Rules:**
    - Verify that the paths your code is trying to access in Firestore/Storage (visible in server logs) exactly match the paths defined in your rules (including the `userId` variable in the `users/{userId}/...` pattern).

Strictly following this checklist usually resolves most `PERMISSION_DENIED` issues. The most likely cause is an inconsistency between local rules, rules effectively deployed in the Firebase Console, the configured project ID, or the `userId` used in the application logic versus the `request.auth.uid` seen by Firebase.

## **Firebase Realtime Database (RTDB) Troubleshooting**

If you have problems with the report chat (which uses RTDB):

1.  **Local Rules Content (`rules/database.rules.json`):**

    - Verify that `rules/database.rules.json` in the project's `rules/` folder allows access to chat paths. Example:
      ```json
      {
        "rules": {
          "chats": {
            "$analysisId": {
              ".read": "auth != null", // Ideally, restrict further
              ".write": "auth != null" // Ideally, restrict further
            }
          }
        }
      }
      ```
    - **Important:** For production, restrict these rules to ensure only authorized users (e.g., the owner of the analysis associated with `analysisId`) can read/write to the specific chat.

2.  **Environment Variables (`.env`):**

    - Confirm that `NEXT_PUBLIC_FIREBASE_DATABASE_URL` is correctly defined in your `.env` file and points to the RTDB of the `electric-magnitudes-analizer` project.
    - Example: `NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://electric-magnitudes-analizer-default-rtdb.firebaseio.com"`

3.  **Rules Deployment (for manual deployment):**

    - Run `firebase deploy --only database:rules --project electric-magnitudes-analizer`.
    - Check the output for success.

4.  **CRITICAL AND VISUAL VERIFICATION - Active Rules in Firebase Console:**

    - Open the Firebase Console (`electric-magnitudes-analizer`).
    - Go to **Realtime Database > "Rules" Tab**. Compare with your local `rules/database.rules.json`.

5.  **Browser Console Logs:**
    - Look for RTDB connection errors or "PERMISSION_DENIED" messages specific to RTDB.
    - Verify that `rtdb` in `src/lib/firebase.ts` is initialized correctly and connects to the emulator (if local) or production.

## **Firebase Functions Troubleshooting**

If background analysis processing fails:

1.  **Functions Logs:**

    - **Firebase Console:** Go to "Functions" > "Logs" to see logs for your `processAnalysisOnUpdate` function (or whatever name you gave it). Filter by function name and severity (Error, Warning, Info).
    - **Emulator UI:** If using emulators (`http://localhost:4001`), go to the "Functions" > "Logs" tab.
    - Look for:
      - Initialization errors (e.g., Genkit not configured, API key missing).
      - Errors during file reading from Storage.
      - Errors from Genkit/AI calls.
      - Errors when writing back to Firestore.
      - Timeout messages.

2.  **API Key Configuration (e.g., Gemini API Key for Functions):**

    - **For Deployed Functions:** The Gemini API Key **MUST** be configured as a runtime secret for your Firebase Functions in Google Cloud.
      - **Method 1 (Firebase CLI - Recommended):**
        ```bash
        firebase functions:config:set gemini.api_key="YOUR_ACTUAL_GEMINI_API_KEY" --project electric-magnitudes-analizer
        # Deploy functions after setting to apply the config.
        ```
        The functions code (`processAnalysis.js`, `reportChatHttps.js`) reads this via `functions.config().gemini.api_key`.
      - **Method 2 (GCP Console - Environment Variables):**
        Set an environment variable named `GEMINI_API_KEY` (uppercase) directly in the function's configuration in the Google Cloud Console. The code will pick this up via `process.env.GEMINI_API_KEY`.
    - **For Emulated Functions (Local Development):**
      - The functions will prioritize `process.env.GEMINI_API_KEY`. You can set this in your root `.env` file (e.g., `GEMINI_API_KEY="your_key_for_emulator"`).
      - If not found, it will check `functions.config().gemini.api_key`. You can simulate this by creating a `.runtimeconfig.json` file in your `functions` directory (e.g., `functions/.runtimeconfig.json`) with content like: `{"gemini":{"api_key":"your_key_from_runtime_config_sim"}}`. The emulator will pick this up.
      - As a final fallback, it uses `process.env.NEXT_PUBLIC_GEMINI_API_KEY` from your root `.env` file.
    - **Verify in code:** The function logs which key source it found (or if none was found) upon initialization. Check the function logs.

3.  **Timeout and Memory Limits:**

    - In `firebase.json` or the deployment configuration, does the `processAnalysisOnUpdate` function have adequate `timeoutSeconds` and `memory` for the task? AI processing can require more time and memory. The maximum for background event-triggered functions can be higher than for HTTP.

4.  **Function Service Account Permissions:**

    - The default Firebase Functions service account must have permissions to:
      - Read/write to Firestore (on the correct paths).
      - Read/write to Storage (on the correct paths).
      - Call AI services (Gemini).

5.  **Firestore Trigger (`onUpdate`):**
    - Confirm that the function is being triggered when an analysis's status is changed to `'summarizing_data'` (or the trigger status). Check function logs for invocations.

## **Genkit / AI Interactions Troubleshooting**

For problems with Genkit calls (in both Next.js Server Actions and Firebase Functions):

1.  **API Keys:**

    - **Next.js (local/Server Actions):** Is `NEXT_PUBLIC_GEMINI_API_KEY` in your `.env` file correct and accessed by the `ai` instance in `src/ai/genkit.ts`?
    - **Firebase Functions:** See item 2 in the "Firebase Functions Troubleshooting" section above. Ensure the key is correctly configured for the deployed or emulated environment.

2.  **`GenerativeAIError` Errors:**

    - If the application captures and displays them (e.g., in the analysis `errorMessage` or chat), they can provide details about what went wrong in the AI call (e.g., `BLOCK_REASON_SAFETY`, `INVALID_API_KEY`, etc.).
    - Check Next.js server logs (for Server Actions) or Firebase Functions logs.

3.  **API Quotas:**

    - Check in Google AI Studio or Google Cloud Console if you have hit Gemini API usage quotas.

4.  **Verify Flows with `genkit:dev` (for Next.js flows):**

    - Use `npm run genkit:dev` (or `genkit:watch`) to start the Genkit development UI.
    - Test your flows from `src/ai/flows/` (like `orchestrateReportInteractionFlow` used by Next.js Server Actions) directly in the Genkit UI to isolate whether the problem is in the flow itself or how it's called.
    - **Note:** Firebase Functions Genkit flows are not directly testable this way, as they are part of the function's deployed code. Test them by triggering the function.

5.  **Prompt Engineering:**
    - If AI responses are not as expected, review the prompts in `src/ai/prompt-configs/`. Are they clear? Are they guiding the AI correctly? Is the output schema well-defined?

Remember to always check logs first, as they usually contain the most direct clues about what is happening.

```

```
