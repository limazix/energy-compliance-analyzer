
# C2 Model: Container Detail - Background Processing (Firebase Functions)

[<- Back to Container Overview (C2)](./index.md)

## Description

**Firebase Functions** provide the ability to execute serverless backend code in response to events, such as updates in Firebase Firestore. In this system, they are responsible for the main AI processing and analysis pipeline of power quality data, which are computationally intensive and/or long-running tasks.

## Responsibilities (Behaviors)

*   **Execution Trigger:**
    *   Are automatically triggered when an analysis document in Firebase Firestore has its status updated to "summarizing_data" (or a similar status indicating that the upload is complete and processing should begin).
*   **Data Reading:**
    *   Reads the CSV file of power quality data that was previously uploaded by the user and stored in Firebase Storage. The path to this file is obtained from the Firestore document that triggered the function.
*   **Execution of AI Analysis Pipeline:**
    *   Orchestrates a sequence of specialized AI agents (implemented as Genkit flows) to process the data:
        1.  **Data Analyst Agent (Summarizer):** Reads the CSV (potentially in chunks if large), preprocesses the data, extracts key metrics, identifies anomalies, and generates a textual summary.
        2.  **Resolution Identifier Agent:** Based on the data summary, identifies the ANEEL normative resolutions that are pertinent to the analysis.
        3.  **Compliance Engineer Agent (Initial Reporter):** Uses the data summary and identified resolutions to generate an initial draft of the compliance report in a structured JSON format.
        4.  **Report Reviewer Agent:** Reviews the structured JSON report, correcting grammar, improving clarity, ensuring correct formatting, and a professional tone.
*   **Result Storage:**
    *   Saves the final structured JSON report (after review) back to the corresponding analysis document in Firebase Firestore.
    *   Converts the structured JSON report to MDX (Markdown with JSX) format.
    *   Saves the generated MDX file to Firebase Storage.
*   **Status and Progress Updates:**
    *   Updates the progress field and status of the analysis document in Firestore at various stages of the pipeline (e.g., 'identifying_regulations', 'assessing_compliance', 'reviewing_report', 'completed', 'error').
    *   In case of an error during processing, records the error message in the analysis document in Firestore and sets the status to "error".

## Technologies and Constraints

*   **Platform:** Firebase Functions (running in a Node.js environment).
*   **Language:** TypeScript (compiled to JavaScript).
*   **Artificial Intelligence:**
    *   Genkit for defining and orchestrating AI flows (agents).
    *   Google AI (Gemini models) for the natural language processing capabilities of the agents.
*   **Firebase SDKs (Server-Side):** Firebase Admin SDK to interact with Firestore (triggers, reading/writing data) and Storage (reading CSVs, writing MDX).
*   **Triggers:** Primarily triggered by Firestore events (`onUpdate` of documents).
*   **Execution Limits:**
    *   Subject to Firebase Functions execution time limits (maximum of 9 minutes for background event-triggered functions, but configurable).
    *   Subject to memory limits configured for the function.
    *   Processing large CSV files may need to be chunked or use strategies to stay within these limits.
*   **Scalability:** Firebase Functions scale automatically based on load.
*   **Security:** Run in a trusted server environment with permissions managed via IAM Service Accounts.

    