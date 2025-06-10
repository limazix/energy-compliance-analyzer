# C4 Dynamic Diagram: CSV Analysis Processing

[<- Back to Level C4 (Code)](./index.md)

This diagram illustrates the sequence of interactions and data flow when a user uploads a CSV file and the compliance analysis is processed by the AI pipeline in Firebase Functions.

![uncached image](http://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/limazix/energy-compliance-analyzer/main/docs/plantuml/c4-dynamic-csv-processing.iuml)

## Flow Description

1.  The **User** interacts with the **Frontend Web App** to select a CSV file and provide metadata.
2.  The **Frontend Web App** calls Server Actions (`createInitialAnalysisRecordAction` and manages the upload process, then `finalizeFileUploadRecordAction`).
3.  The **Server Actions** create an initial record in **Firebase Firestore** (status "uploading"), and later update it with the Storage URL and change status to "summarizing_data".
4.  The **Frontend Web App** (via `useFileUploadManager`) uploads the CSV file directly to **Firebase Storage**.
5.  The status change in **Firebase Firestore** (to "summarizing_data") triggers the `processAnalysisOnUpdate` Firebase Function.
6.  The **Firebase Function** reads the CSV file from **Firebase Storage**.
7.  The **Firebase Function** orchestrates the AI agent pipeline (using Genkit and **Google AI (Gemini)**).
8.  The **Firebase Function** saves the final structured report (JSON) to **Firebase Firestore**.
9.  The **Firebase Function** converts the JSON report to MDX and saves it to **Firebase Storage**.
10. The **Firebase Function** updates the analysis status in **Firebase Firestore** to "completed" and stores the MDX file path.
11. The **Frontend Web App** (via `useAnalysisManager` using `onSnapshot`) detects status/progress updates in **Firebase Firestore** and displays the results or final report.
