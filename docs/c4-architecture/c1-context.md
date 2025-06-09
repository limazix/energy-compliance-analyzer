
# C4 Model: Level 1 - System Context - Energy Compliance Analyzer

This diagram shows the Energy Compliance Analyzer system in its environment, interacting with users and other external systems.

```mermaid
C4Context
  title System Context for the Energy Compliance Analyzer

  Actor(user, "User", "Engineers, analysts, or consultants in the electrical sector who need to verify the compliance of power quality data.", $sprite="fa:fa-user")

  System_Boundary(analyzer_boundary, "Energy Compliance Analyzer") {
    System(energyAnalyzer, "Energy Compliance Analyzer", "Web platform for uploading, analyzing compliance of electrical power quality data against ANEEL standards, and generating interactive reports.", $sprite="fa:fa-laptop-code")
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Generative AI service (LLM) used for data analysis, standards identification, report generation and review, and interactive chat.", $sprite="fa:fa-brain")
  System_Ext(firebase, "Firebase Platform", "Google's platform providing authentication, database (Firestore, RTDB), file storage (Storage), and backend code execution environment (Functions & App Hosting).", $sprite="fa:fa-google")

  Rel(user, energyAnalyzer, "Uses", "HTTPS")
  Rel(energyAnalyzer, googleAI, "Utilizes for AI processing", "API Calls")
  Rel(energyAnalyzer, firebase, "Hosted on and uses services of", "SDKs, APIs")

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)", $borderColor="rgb(13, 105, 184)")
  UpdateElementStyle(energyAnalyzer, $fontColor="white", $bgColor="rgb(28, 128, 74)", $borderColor="rgb(28, 128, 74)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(firebase, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
```

[Next Level: Container Diagram (C2)](./c2-containers/index.md)

    