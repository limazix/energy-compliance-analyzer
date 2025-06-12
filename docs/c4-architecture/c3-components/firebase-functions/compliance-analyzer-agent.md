# C3: Component - Agent: Compliance Engineer (Initial Reporter) (`complianceAnalyzerAgent`)

[<- Back to Firebase Functions Components](./../03-firebase-functions-components.md)

## Description

The **Compliance Engineer Agent (Initial Reporter)** is a Genkit flow (`analyzeReportFlow` defined in `functions/src/processAnalysis.js` and using the prompt from `src/ai/prompt-configs/analyze-compliance-report-prompt-config.ts`). This agent acts as a specialized electrical engineer who generates the first version of the structured compliance report (in JSON format).

## Responsibilities (Behaviors)

- **Data and Standards Analysis:**
  - Receives the aggregated summary of power quality data (from `dataSummarizerAgent`) and the list of pertinent ANEEL resolutions (from `regulationIdentifierAgent`) as input.
  - Also considers the original filename and the desired language code for the report.
- **Structured Report Generation:**
  - Produces a detailed and well-structured compliance report in JSON format, following the `AnalyzeComplianceReportOutputSchema`.
  - The report includes:
    - Metadata (title, author, date).
    - Executive summary.
    - Introduction with objectives and overview of standards.
    - Multiple detailed analysis sections, where each section:
      - Describes relevant data and analyses.
      - Presents specific insights and issues.
      - Cites specific ANEEL standards (in Portuguese) that substantiate the findings.
      - Optionally, suggests Mermaid diagrams for visualization.
    - Final considerations.
    - Bibliography of cited standards (in Portuguese).
- **Language and Format:**
  - Generates the main report content in the specified language (`languageCode`).
  - Maintains ANEEL resolution names and normative texts in Portuguese.
  - Strictly adheres to the JSON output schema.

## Technologies and Key Aspects

- **Genkit:**
  - Defined as an `ai.definePrompt`.
  - Uses the prompt configured in `analyzeComplianceReportPromptConfig`.
- **Google AI (Gemini):** The language model that synthesizes information and generates the structured report.
- **Input/Output Schemas (Zod):**
  - `AnalyzeComplianceReportInputSchema` for input (data summary, resolutions, filename, language).
  - `AnalyzeComplianceReportOutputSchema` for output (the complete structured JSON report).
- **Prompt Engineering:** The detailed prompt guides Gemini to produce a technical, formal, and accurate report, with all necessary sections and schema adherence.
- **Mermaid Syntax:** Has the capability to suggest diagrams using Mermaid syntax.

## Interactions

- **Called by:** Pipeline Orchestrator (`processAnalysisFn`).
- **Uses:** Google AI (Gemini) via Genkit.
- **Input:** Data summary, list of resolutions, filename, language code.
- **Output:** The initial structured compliance report object (JSON).
