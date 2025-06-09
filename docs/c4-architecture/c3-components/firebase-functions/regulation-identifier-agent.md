
# C3: Component - Agent: Resolution Identifier (`regulationIdentifierAgent`)

[<- Back to Firebase Functions Components](./../03-firebase-functions-components.md)

## Description

The **Resolution Identifier Agent** is a Genkit flow (`identifyAEEEResolutionsFlow` defined in `functions/src/processAnalysis.js` and using the prompt from `src/ai/prompt-configs/identify-aneel-resolutions-prompt-config.ts`) that acts as an expert in Brazilian electrical regulations. Its function is to analyze the summary of power quality data (provided by `dataSummarizerAgent`) and identify pertinent ANEEL Normative Resolutions.

## Responsibilities (Behaviors)

*   **Summary Analysis:**
    *   Receives the aggregated textual summary of power quality data as input.
    *   Interprets key metrics, anomalies, and trends described in the summary.
*   **Standards Identification:**
    *   Based on the summary analysis, determines which ANEEL (Brazilian National Electrical Energy Agency) Normative Resolutions are relevant to the phenomena observed in the data.
    *   Prioritizes accuracy in identifying the correct resolutions (e.g., PRODIST Module 8, specific RENs).
*   **Output Format:**
    *   Returns a list of names or numbers of the identified ANEEL resolutions.
    *   The resolution names/numbers should be kept in their original Portuguese form, while the descriptive text around the list should be in the specified language.

## Technologies and Key Aspects

*   **Genkit:**
    *   Defined as an `ai.definePrompt`.
    *   Uses the prompt configured in `identifyAEEEResolutionsPromptConfig`.
*   **Google AI (Gemini):** The language model that performs inference to identify resolutions based on the summary.
*   **Input/Output Schemas (Zod):** Uses Zod schemas (`IdentifyAEEEResolutionsInputSchema`, `IdentifyAEEEResolutionsOutputSchema`) for input structure (data summary, language code) and output (list of resolutions).
*   **Specialized Knowledge (Simulated):** The prompt is crucial for guiding the Gemini model to act as an expert in ANEEL standards.

## Interactions

*   **Called by:** Pipeline Orchestrator (`processAnalysisFn`).
*   **Uses:** Google AI (Gemini) via Genkit.
*   **Input:** Aggregated power quality data summary, language code.
*   **Output:** Object containing the `relevantResolutions` list.

    