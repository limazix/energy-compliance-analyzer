
# Energy Compliance Analyzer Deployment Guide

This document details the manual and automated deployment processes (via GitHub Actions) for the Energy Compliance Analyzer project, which uses Firebase App Hosting for the Next.js application and Firebase Functions for backend processing.

## Deployment Overview

The project is deployed to the Firebase project `electric-magnitudes-analizer` and consists of four main parts for deployment:

1.  **Next.js Application:** Deployed to Firebase App Hosting.
2.  **Backend Functions (AI, Processing):** Deployed as Firebase Functions.
3.  **Security Rules:** Firestore, Storage, and Realtime Database rules.
4.  **Firestore Indexes:** (If any, managed by `rules/firestore.indexes.json`).

The GitHub Actions workflow (`.github/workflows/firebase-deploy.yml`) is configured to automate the deployment of all these parts.

## Automated Deployment with GitHub Actions (Recommended)

This project includes a GitHub Actions workflow to automate deployment.

### GitHub Actions Setup

1.  **App Hosting Backend ID:**
    *   In the `.github/workflows/firebase-deploy.yml` file, locate the line:
        `firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID`
    *   **Replace `YOUR_APP_HOSTING_BACKEND_ID` with the actual ID of your App Hosting backend.**
    *   You can get this ID from the Firebase Console (App Hosting > your backend) after creating it (either manually for the first time or via CLI). For example, it might be something like `energy-compliance-analyzer-backend`.

2.  **GitHub Secrets:**
    Configure the following secrets in your GitHub repository ("Settings" > "Secrets and variables" > "Actions"):

    *   **For GCP Authentication (Workload Identity Federation):**
        *   `GCP_PROJECT_NUMBER`: Your GCP project number (e.g., `123456789012`).
        *   `GCP_WORKLOAD_IDENTITY_POOL_ID`: The ID of your Workload Identity Pool in GCP.
        *   `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`: The ID of your Provider within the pool.
        *   `GCP_SERVICE_ACCOUNT_EMAIL`: The email of the GCP service account that GitHub Actions will use. This service account needs the following minimum permissions in GCP:
            *   `Firebase App Hosting Admin` (roles/firebaseapphosting.admin) - For App Hosting deployment.
            *   `Firebase Functions Developer` (roles/cloudfunctions.developer) or Admin - For Functions deployment.
            *   `Firebase Rules System` (roles/firebaserules.system) - For rules deployment.
            *   `Service Account User` (roles/iam.serviceAccountUser) - To allow Functions to run as their service account.
            *   `Service Account Token Creator` (roles/iam.serviceAccountTokenCreator) - For GitHub Actions to impersonate the service account.
            *   `Cloud Build Editor` (roles/cloudbuild.builds.editor) - Firebase Functions use Cloud Build for deployment.
            *   (Optional, but recommended for Functions) `Logs Writer` (roles/logging.logWriter) and `Monitoring Metric Writer` (roles/monitoring.metricWriter).

    *   **For Next.js Build (`NEXT_PUBLIC_` Variables):**
        *   `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase API key for the web client.
        *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Your Firebase authentication domain.
        *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Your Firebase Storage bucket.
        *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase Messaging sender ID.
        *   `NEXT_PUBLIC_FIREBASE_APP_ID`: Your Firebase application ID.
        *   `NEXT_PUBLIC_FIREBASE_DATABASE_URL`: Your Firebase Realtime Database URL.
        *   `NEXT_PUBLIC_GEMINI_API_KEY`: The Google AI (Gemini) API key **if used directly in Next.js client code**. If used only in the backend (Firebase Functions), this secret is not needed here but rather in the Functions configuration.
        *   `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`: (Optional) Your Google Analytics for Firebase measurement ID.

3.  **Firebase Functions Runtime Secrets (e.g., Gemini API Key):**
    *   The Gemini API Key (`GEMINI_API_KEY`) that your Firebase Functions use to call the AI **MUST** be configured as a secret in your Firebase Functions' runtime environment in Google Cloud.
    *   This can be done via:
        *   **Environment variables in the Function's configuration in the Google Cloud Console.**
        *   **Google Cloud Secret Manager:** And accessing them programmatically in your functions.
    *   The GitHub Actions workflow *does not* handle setting these runtime secrets for the functions. This is a separate and essential configuration you must do in GCP. The functions code (in `functions/src/processAnalysis.ts`) expects to find `process.env.GEMINI_API_KEY` or `functions.config().gemini.apikey`.

### How the Workflow Works

*   When a `git push` is made to the `main` branch (or the configured branch), or when a Pull Request is opened/synchronized to `main`, the Action is triggered.
*   **Job `test`**:
    *   Installs dependencies for the Next.js app and Firebase Functions.
    *   Builds the Firebase Functions (necessary for emulators).
    *   Runs Jest tests (`npm test`), which use Firebase Emulators.
    *   If tests fail, the workflow stops here.
*   **Job `build_and_deploy`** (only runs on `push` to `main` and if the `test` job passes):
    *   Installs dependencies and builds the Next.js application, using GitHub secrets for `NEXT_PUBLIC_*` variables.
    *   Authenticates to Google Cloud using Workload Identity Federation.
    *   Deploys the Next.js application to Firebase App Hosting.
    *   Builds and deploys Firebase Functions.
    *   Deploys Firestore, Storage, and Realtime Database rules, and Firestore indexes.

## Manual Deployment

If you need to deploy manually:

*   Ensure you have the [Firebase CLI](https://firebase.google.com/docs/cli) installed and are logged in (`firebase login`).
*   Associate your local project directory with the `electric-magnitudes-analizer` project (`firebase use electric-magnitudes-analizer`).
*   Configure your local environment variables in the `.env` file for the Next.js build, if necessary.

### 1. Deploy Next.js Application (App Hosting)

1.  **Build your Next.js application:**
    ```bash
    npm run build
    ```
2.  **Deploy using the Firebase CLI:**
    Replace `YOUR_APP_HOSTING_BACKEND_ID` and `YOUR_REGION` (e.g., `us-central1`):
    ```bash
    firebase apphosting:backends:deploy YOUR_APP_HOSTING_BACKEND_ID --project electric-magnitudes-analizer --region YOUR_REGION
    ```
    If it's the first deployment, the CLI might help create a backend.

### 2. Deploy Firebase Functions

1.  **Navigate to the functions directory:**
    ```bash
    cd functions
    ```
2.  **Install functions dependencies (if not already done):**
    ```bash
    npm install
    ```
3.  **Build the functions (TypeScript to JavaScript):**
    ```bash
    npm run build
    ```
4.  **Return to the project root directory:**
    ```bash
    cd ..
    ```
5.  **Deploy functions using the Firebase CLI:**
    ```bash
    firebase deploy --only functions --project electric-magnitudes-analizer
    ```
    **Remember**: Configure the Gemini API Key and other necessary secrets directly in the Firebase Functions environment in the Google Cloud Console.

### 3. Deploy Firebase Security Rules and Indexes

Security rules for Firestore, Firebase Storage, and Realtime Database, as well as Firestore indexes, are crucial.

1.  **Deploy rules and indexes:**
    ```bash
    firebase deploy --only firestore,storage,database --project electric-magnitudes-analizer
    ```
    (The `firestore` command includes both `firestore:rules` and `firestore:indexes`. `database` covers `database:rules`).
2.  **Verify rules and indexes in Firebase Console:** After deployment, visually confirm that the rules and indexes in the console match your local files (`rules/firestore.rules`, `rules/storage.rules`, `rules/database.rules.json`, `rules/firestore.indexes.json`).

    