
# C4 Model: Nível 4 - Código (Visão Simplificada) - Energy Compliance Analyzer

Este diagrama oferece uma visão simplificada de elementos de código chave, focando no fluxo de interação do chat do relatório e na pipeline de processamento de IA.
Por ser o nível mais granular, focaremos nos principais fluxos e interações entre os principais artefatos de código (arquivos/módulos e fluxos Genkit), em vez de classes ou funções individuais detalhadamente.

## Fluxo de Interação do Chat do Relatório (Orquestração via Server Action)

Este diagrama ilustra como uma mensagem do usuário na interface de chat do relatório é processada.

```mermaid
C4Dynamic
  title Fluxo de Interação do Chat do Relatório (Server Action)

  Person(user, "Usuário", "Interage com a UI do chat.", $sprite="fa:fa-user")
  Component(reportPageUI, "ReportPage UI (React)", "Componente da página de relatório que gerencia o chat.", $sprite="fa:fa-desktop")
  Component(reportChatActions, "`reportChatActions.ts` (Server Action)", "Ponto de entrada no backend para o chat.", $sprite="fa:fa-server")
  Component(orchestrationFlow, "`orchestrateReportInteractionFlow` (Genkit Flow)", "Fluxo Genkit que usa IA para entender e responder ao usuário, podendo usar ferramentas.", $sprite="fa:fa-brain")
  Component(revisorTool, "`callRevisorTool` (Genkit Tool)", "Ferramenta Genkit que invoca o fluxo `reviewComplianceReportFlow` para modificar o relatório estruturado.", $sprite="fa:fa-tools")
  Component(reviewFlow, "`reviewComplianceReportFlow` (Genkit Flow)", "Fluxo Genkit para revisar o relatório estruturado.", $sprite="fa:fa-clipboard-check")
  ContainerDb(rtdb, "Firebase Realtime Database", "Armazena mensagens do chat.", $sprite="fa:fa-comments")
  ContainerDb(firestore, "Firebase Firestore", "Armazena o relatório estruturado (JSON).", $sprite="fa:fa-database")
  Container(storage, "Firebase Storage", "Armazena o relatório MDX.", $sprite="fa:fa-archive")
  System_Ext(googleAI, "Google AI (Gemini)", "Modelo de Linguagem para Genkit.", $sprite="fa:fa-robot")


  Rel(user, reportPageUI, "Envia mensagem de chat")
  Rel(reportPageUI, reportChatActions, "Chama `askReportOrchestratorAction` com mensagem e contexto")
  Rel(reportChatActions, orchestrationFlow, "Invoca fluxo com dados do relatório, mensagem do usuário")
  Rel(reportChatActions, rtdb, "Salva mensagem do usuário e placeholder da IA no RTDB")

  Rel(orchestrationFlow, googleAI, "Processa consulta usando LLM")
  Rel(orchestrationFlow, revisorTool, "Chama ferramenta se usuário solicitar revisão (opcional)")
  Rel(revisorTool, reviewFlow, "Invoca fluxo de revisão")
  Rel(reviewFlow, googleAI, "Usa LLM para revisar relatório estruturado")
  Rel(reviewFlow, revisorTool, "Retorna relatório estruturado revisado")
  Rel(revisorTool, orchestrationFlow, "Retorna relatório revisado ao fluxo principal")
  Rel(orchestrationFlow, reportChatActions, "Retorna resposta da IA e (opcionalmente) relatório revisado")

  Rel(reportChatActions, rtdb, "Atualiza/Transmite resposta final da IA no RTDB")
  Rel(reportChatActions, firestore, "Atualiza relatório estruturado no Firestore (se modificado)")
  Rel(reportChatActions, storage, "Salva novo MDX no Storage (se modificado)")
  Rel(reportPageUI, rtdb, "Escuta atualizações no RTDB para exibir mensagens")

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)", $borderColor="rgb(13, 105, 184)")
  UpdateElementStyle(reportPageUI, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(reportChatActions, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(orchestrationFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(revisorTool, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(reviewFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(rtdb, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")

```

## Pipeline de Processamento de Análise (Firebase Functions)

Este diagrama ilustra a sequência de operações dentro da Firebase Function (`processAnalysisOnUpdate`) quando uma nova análise é disparada.

```mermaid
C4Dynamic
  title Pipeline de Processamento de Análise em Firebase Functions (Foco nos Fluxos Genkit)

  System_Ext(firestoreTrigger, "Gatilho Firestore", "`onUpdate('users/{userId}/analyses/{analysisId}')` quando status é 'summarizing_data'", $sprite="fa:fa-bell")
  Component(processAnalysisFn, "`processAnalysis.js`", "Função principal orquestradora da pipeline de análise em Firebase Functions.", $sprite="fa:fa-cogs")
  Component(gcsReader, "`getFileContentFromStorage`", "Lê conteúdo do arquivo CSV do Firebase Storage.", $sprite="fa:fa-download")
  Component(summarizeDataFlow, "`summarizePowerQualityDataFlow`", "Fluxo Genkit (usa `summarize-power-quality-data.ts`). Sumariza CSV.", $sprite="fa:fa-compress-alt")
  Component(identifyResolutionsFlow, "`identifyAEEEResolutionsFlow`", "Fluxo Genkit (usa `identify-aneel-resolutions.ts`). Identifica resoluções.", $sprite="fa:fa-search-location")
  Component(analyzeReportFlow, "`analyzeComplianceReportFlow`", "Fluxo Genkit (usa `analyze-compliance-report.ts`). Gera relatório estruturado JSON.", $sprite="fa:fa-file-signature")
  Component(reviewReportFlow, "`reviewComplianceReportFlow`", "Fluxo Genkit (usa `review-compliance-report.ts`). Revisa relatório JSON.", $sprite="fa:fa-user-check")
  Component(mdxConverter, "`convertStructuredReportToMdx`", "Utilitário (`reportUtils.ts`). Converte JSON para MDX.", $sprite="fa:fa-file-code")
  System_Ext(googleAI, "Google AI (Gemini)", "Modelo de Linguagem para Genkit.", $sprite="fa:fa-robot")
  ContainerDb(storage, "Firebase Storage", "Armazena CSVs e relatórios MDX.", $sprite="fa:fa-archive")
  ContainerDb(firestore, "Firebase Firestore", "Armazena metadados, status, e relatório JSON.", $sprite="fa:fa-database")


  Rel(firestoreTrigger, processAnalysisFn, "Dispara execução de")
  Rel(processAnalysisFn, gcsReader, "Chama para obter conteúdo do CSV")
  Rel(gcsReader, storage, "Lê arquivo de")
  Rel(processAnalysisFn, summarizeDataFlow, "(1) Chama com conteúdo do CSV")
  Rel(summarizeDataFlow, googleAI, "Usa")
  Rel(summarizeDataFlow, processAnalysisFn, "Retorna sumário dos dados")

  Rel(processAnalysisFn, identifyResolutionsFlow, "(2) Chama com sumário")
  Rel(identifyResolutionsFlow, googleAI, "Usa")
  Rel(identifyResolutionsFlow, processAnalysisFn, "Retorna resoluções identificadas")

  Rel(processAnalysisFn, analyzeReportFlow, "(3) Chama com sumário e resoluções")
  Rel(analyzeReportFlow, googleAI, "Usa")
  Rel(analyzeReportFlow, processAnalysisFn, "Retorna relatório estruturado (JSON) inicial")

  Rel(processAnalysisFn, reviewReportFlow, "(4) Chama com relatório JSON inicial")
  Rel(reviewReportFlow, googleAI, "Usa")
  Rel(reviewReportFlow, processAnalysisFn, "Retorna relatório JSON revisado")

  Rel(processAnalysisFn, mdxConverter, "(5) Chama com relatório JSON revisado")
  Rel(mdxConverter, storage, "Salva arquivo MDX em")
  Rel(processAnalysisFn, firestore, "Atualiza status para 'completed' e salva relatório JSON final")

  UpdateElementStyle(firestoreTrigger, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(processAnalysisFn, $fontColor="white", $bgColor="rgb(68, 158, 228)", $borderColor="rgb(68, 158, 228)")
  UpdateElementStyle(gcsReader, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(summarizeDataFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(identifyResolutionsFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(analyzeReportFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(reviewReportFlow, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(mdxConverter, $fontColor="black", $bgColor="rgb(200, 200, 200)", $borderColor="rgb(150,150,150)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)", $borderColor="rgb(112, 112, 214)")
```

[Voltar para: Diagrama de Componentes (C3)](./c3-components.md)
