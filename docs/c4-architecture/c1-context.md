# C4 Model: Level 1 - System Context - Energy Compliance Analyzer

This diagram shows the Energy Compliance Analyzer system in its environment, interacting with users and other external systems.

```plantuml
@startuml C4_Context_ECA
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml
!include <GCP/GCPCommon>
!include <GCP/AI/VertexAI>
!include <GCP/Firebase/FirebasePlatform>

title "System Context for the Energy Compliance Analyzer"

Person(user, "User", "Engineers, analysts, or consultants needing to verify power quality data compliance.")

System_Boundary(analyzer_boundary, "Energy Compliance Analyzer") {
  System(energyAnalyzer, "Energy Compliance Analyzer", "Web platform for uploading, analyzing electrical power quality data against ANEEL standards, and generating interactive reports.")
}

System_Ext(googleAI, "Google AI (Gemini)", "Generative AI service (LLM) for data analysis, standards identification, report generation/review, and chat.", $sprite="gcp_vertex_ai")
System_Ext(firebase, "Firebase Platform", "Google's platform for auth, database (Firestore, RTDB), file storage (Storage), and backend execution (Functions & App Hosting).", $sprite="gcp_firebase_platform")

Rel(user, energyAnalyzer, "Uses", "HTTPS")
Rel(energyAnalyzer, googleAI, "Utilizes for AI processing", "API Calls")
Rel(energyAnalyzer, firebase, "Hosted on & uses services of", "SDKs, APIs")

SHOW_LEGEND()
@enduml
```

[Next Level: Container Diagram (C2)](./c2-containers/index.md)
