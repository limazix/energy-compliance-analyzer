# C3: Firebase Functions Components (Container)

This diagram details the main components that make up the "Background Processing (Firebase Functions)" container of the Energy Compliance Analyzer.

[<- Back to Component Overview (C3)](./index.md)
[<- Back to Container Overview (C2)](../c2-containers/index.md)

```plantuml
@startuml C4_Component_FirebaseFunctions
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml
!include <GCP/GCPCommon>
!include <GCP/Databases/CloudFirestore>
!include <GCP/Storage/CloudStorage>
!include <GCP/AI/VertexAI>

title "Firebase Functions Components (Background Processing)"

Container_Boundary(functionsContainer, "Background Processing (Firebase Functions)") {
    Component(trigger, "Firestore Trigger", "Functions SDK", "Observes Firestore to start analysis.")
    Component(processAnalysisFn, "Pipeline Orchestrator", "TS/JS Function", "Coordinates AI agents & utilities.")

    Component(gcsUtil, "Storage Access Util", "Admin SDK", "Reads CSV from Storage.")
    Component(statusUpdaterUtil, "Status Updater Util", "Admin SDK", "Updates Firestore (progress/status).")
    Component(mdxConverterUtil, "MDX Converter Util", "TS (`reportUtils.ts`)", "Converts JSON report to MDX.")

    Component(dataSummarizerAgent, "Agent: Data Summarizer", "Genkit Flow, Gemini", "Summarizes CSV data.")
    Component(regulationIdentifierAgent, "Agent: Resolution Identifier", "Genkit Flow, Gemini", "Identifies ANEEL resolutions.")
    Component(complianceAnalyzerAgent, "Agent: Compliance Engineer", "Genkit Flow, Gemini", "Generates initial structured report.")
    Component(reportReviewerAgent, "Agent: Report Reviewer", "Genkit Flow, Gemini", "Refines structured report.")
}

ContainerDb_Ext(firestoreExt, "Firebase Firestore", "Trigger source & data store", $sprite="gcp_cloud_firestore")
Container_Ext(storageExt, "Firebase Storage", "Storage for CSVs & MDX reports", $sprite="gcp_cloud_storage")
System_Ext(genkitFunc, "Genkit & Google AI", "AI framework & LLMs", $sprite="gcp_vertex_ai")


Rel(trigger, processAnalysisFn, "Invokes")

Rel(processAnalysisFn, gcsUtil, "Uses to read CSV")
Rel(processAnalysisFn, statusUpdaterUtil, "Uses to update Firestore")
Rel(processAnalysisFn, mdxConverterUtil, "Uses to convert report to MDX")

Rel(processAnalysisFn, dataSummarizerAgent, "1. Calls Data Summarizer")
Rel(processAnalysisFn, regulationIdentifierAgent, "2. Calls Regulation Identifier")
Rel(processAnalysisFn, complianceAnalyzerAgent, "3. Calls Compliance Engineer")
Rel(processAnalysisFn, reportReviewerAgent, "4. Calls Report Reviewer")

Rel(dataSummarizerAgent, genkitFunc, "Uses Genkit/AI")
Rel(regulationIdentifierAgent, genkitFunc, "Uses Genkit/AI")
Rel(complianceAnalyzerAgent, genkitFunc, "Uses Genkit/AI")
Rel(reportReviewerAgent, genkitFunc, "Uses Genkit/AI")

Rel(gcsUtil, storageExt, "Reads CSV from")
Rel(statusUpdaterUtil, firestoreExt, "Updates status/report in")
Rel(mdxConverterUtil, storageExt, "Saves MDX report to")

SHOW_LEGEND()
@enduml
```

## Firebase Functions Component Details

The following is a list of the main components identified in the diagram. Each will have its own detail page.

- **Firestore Trigger (`trigger`)**:
  - [Details](./firebase-functions/trigger.md)
- **Agent: Data Analyst (Summarizer) (`dataSummarizerAgent`)**:
  - [Details](./firebase-functions/data-summarizer-agent.md)
- **Agent: Resolution Identifier (`regulationIdentifierAgent`)**:
  - [Details](./firebase-functions/regulation-identifier-agent.md)
- **Agent: Compliance Engineer (Initial Reporter) (`complianceAnalyzerAgent`)**:
  - [Details](./firebase-functions/compliance-analyzer-agent.md)
- **Agent: Report Reviewer (`reportReviewerAgent`)**:
  - [Details](./firebase-functions/report-reviewer-agent.md)
- **MDX Conversion Utility (`mdxConverterUtil`)**:
  - [Details](./firebase-functions/mdx-converter-util.md)
- **Status/Progress Updater (`statusUpdaterUtil`)**:
  - [Details](./firebase-functions/status-updater-util.md)
- **Storage Access Utility (`gcsUtil`)**:
  - [Details](./firebase-functions/gcs-util.md)
- **Pipeline Orchestrator (`processAnalysisFn`)**:
  - [Details](./firebase-functions/process-analysis-fn.md)

[Previous: Server Actions Components](./02-server-actions-components.md)
[Next: Code/Flow Diagram (C4)](../c4-code/index.md)
