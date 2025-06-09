
# C3: Component - MDX Conversion Utility (`mdxConverterUtil`)

[<- Back to Firebase Functions Components](./../03-firebase-functions-components.md)

## Description

The **MDX Conversion Utility** is a TypeScript module (`src/lib/reportUtils.ts`, specifically the function `convertStructuredReportToMdx`) responsible for transforming the structured compliance report (in JSON format, after review by `reportReviewerAgent`) into MDX (Markdown with JSX) format. This MDX file is then saved to Firebase Storage and used for display in the user interface.

## Responsibilities (Behaviors)

*   **JSON to MDX Transformation:**
    *   Receives the final structured JSON report object and the original filename as input.
    *   Iterates over the JSON object's structure (metadata, introduction, analysis sections, final considerations, bibliography).
    *   Converts each part of the report into its equivalent Markdown representation.
    *   Formats titles, subtitles, lists, bold/italic text, and other Markdown elements.
*   **Inclusion of Metadata (Frontmatter):**
    *   Generates a YAML frontmatter block at the beginning of the MDX file, containing metadata such as title, subtitle, author, generation date, and filename.
*   **Embedding Mermaid Diagrams:**
    *   If the structured report sections contain diagram suggestions in Mermaid syntax (`chartOrImageSuggestion`), this utility includes them in the MDX so they can be rendered (usually within code blocks with the `mermaid` language).
*   **Content Sanitization:**
    *   Performs basic text sanitization to ensure special characters (like `<`, `>`) are correctly escaped for MDX/HTML, preventing rendering issues or XSS.
*   **Output Format:**
    *   Produces a string containing the complete report content in MDX format.

## Technologies and Key Aspects

*   **TypeScript:** For the conversion logic.
*   **String and Object Manipulation:** The function performs extensive string manipulation to construct the MDX document and navigates the JSON report object structure.
*   **MDX (Markdown with JSX):** The target output format, combining Markdown's simplicity with the ability to embed React components (though this utility primarily focuses on generating standard Markdown and including Mermaid blocks).
*   **Mermaid.js:** Supports including Mermaid syntax for diagrams.

## Interactions

*   **Called by:** Pipeline Orchestrator (`processAnalysisFn`).
*   **Uses:** No external services; it's a pure data transformation function.
*   **Input:** Revised structured JSON report object, original filename.
*   **Output:** String containing the report in MDX format.

    