# C3: Component - Agent: Data Analyst (Summarizer) (`dataSummarizerAgent`)

[<- Back to Firebase Functions Components](./../03-firebase-functions-components.md)

## Description

The **Data Analyst Agent (Summarizer)** is a Genkit flow (`summarizePowerQualityDataFlow` defined in `functions/src/processAnalysis.js` and using the prompt from `src/ai/prompt-configs/summarize-power-quality-data-prompt-config.ts`) responsible for the first AI processing step in the pipeline. Its main function is to read a chunk of power quality data in CSV format, perform an initial analysis, and generate a concise textual summary.

## Responsibilities (Behaviors)

- **CSV Data Analysis:**
  - Receives a chunk of CSV power quality data as input.
  - Identifies and extracts key metrics such as voltage, current, power factor, and frequency statistics (minimum, maximum, average).
  - Detects anomalies or notable events within the data chunk (e.g., sags, swells, interruptions, harmonic distortions).
- **Textual Summary Generation:**
  - Produces a comprehensive textual summary of the analyzed data chunk, in the specified language.
  - The summary includes identified key metrics, anomalies, and general quality trends.
- **Suggestions for Engineering Analysis:**
  - Based on the chunk analysis, suggests data transformations (e.g., THD calculation) or enrichments (e.g., correlation with external data) that would be beneficial for a detailed regulatory compliance assessment.
- **Preliminary Visualization Ideas:**
  - Suggests types of charts or visualizations that could effectively represent the characteristics or anomalies found in the chunk.
- **Token Reduction:**
  - The generated summary should be significantly smaller than the input CSV data, aiming to optimize token usage in subsequent AI pipeline stages.

## Technologies and Key Aspects

- **Genkit:**
  - Defined as an `ai.definePrompt` (formerly `ai.defineFlow` that wrapped a prompt).
  - Uses the prompt configured in `summarizePowerQualityDataPromptConfig`.
- **Google AI (Gemini):** The underlying language model that performs the analysis and summary generation.
- **Chunk Processing:** Designed to process data in segments, allowing handling of large CSV files that would exceed single AI call token limits.
- **Input/Output Schemas (Zod):** Uses Zod schemas (`SummarizePowerQualityDataInputSchema`, `SummarizePowerQualityDataOutputSchema`) to define the structure of input and output data, ensuring consistency.
- **Prompt Engineering:** The quality of the summary heavily depends on the clarity and specificity of the prompt provided to the Gemini model.

## Interactions

- **Called by:** Pipeline Orchestrator (`processAnalysisFn`).
- **Uses:** Google AI (Gemini) via Genkit.
- **Input:** CSV data chunk, language code.
- **Output:** Object containing the textual `dataSummary`.
