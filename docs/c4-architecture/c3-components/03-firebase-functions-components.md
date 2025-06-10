# C3: Firebase Functions Components (Container)

This diagram details the main components that make up the "Background Processing (Firebase Functions)" container of the Energy Compliance Analyzer.

[<- Back to Component Overview (C3)](./index.md)
[<- Back to Container Overview (C2)](../c2-containers/index.md)

![uncached image](http://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/limazix/energy-compliance-analyzer/main/docs/plantuml/c3-firebase-functions-components.iuml)

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
