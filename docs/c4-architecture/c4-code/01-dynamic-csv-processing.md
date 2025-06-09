
# C4 Dynamic Diagram: Processamento de Análise de CSV

[<- Voltar para Nível C4 (Código)](./index.md)

Este diagrama ilustra a sequência de interações e o fluxo de dados quando um usuário faz upload de um arquivo CSV e a análise de conformidade é processada pela pipeline de IA nas Firebase Functions.

```mermaid
C4Dynamic
  title Processamento de Análise de CSV (Upload até Relatório)

  Person(user, "Usuário", "Interage com o sistema para upload.", $sprite="fa:fa-user")
  Container(frontendApp, "Frontend Web App", "Next.js/React", "Interface do usuário para upload.", $sprite="fa:fa-desktop")
  Container(serverActions, "Backend API (Server Actions)", "Next.js", "Gerencia o upload inicial e o acionamento.", $sprite="fa:fa-cogs")
  ContainerDb(firestore, "Firebase Firestore", "NoSQL", "Armazena metadados e status da análise.", $sprite="fa:fa-database")
  Container(storage, "Firebase Storage", "Blob Storage", "Armazena arquivos CSV e MDX.", $sprite="fa:fa-archive")
  Container(firebaseFunctions, "Processamento em Background (Functions)", "Node.js, Genkit", "Executa a pipeline de IA.", $sprite="fa:fa-bolt")
  System_Ext(googleAI, "Google AI (Gemini)", "LLM para análise e geração.", $sprite="fa:fa-brain")

  Rel_Back(user, frontendApp, "1. Faz upload do arquivo CSV e metadados")
  Rel(frontendApp, serverActions, "2. Chama 'createInitialAnalysisRecordAction' e gerencia upload para Storage")
  Rel(serverActions, firestore, "3. Cria registro da análise (status: 'uploading')")
  Rel(frontendApp, storage, "4. Envia arquivo CSV para o Storage")
  Rel(frontendApp, serverActions, "5. Chama 'finalizeFileUploadRecordAction' com URL do Storage")
  Rel(serverActions, firestore, "6. Atualiza registro (status: 'summarizing_data', URL do CSV)")

  Rel(firestore, firebaseFunctions, "7. Aciona 'processAnalysisOnUpdate' (via gatilho do Firestore)")
  Rel(firebaseFunctions, storage, "8. Lê arquivo CSV do Storage")
  Rel(firebaseFunctions, googleAI, "9. Executa pipeline de Agentes IA (Sumarizador, Identificador de Resoluções, Analisador de Conformidade, Revisor)")
  Rel(firebaseFunctions, firestore, "10. Salva relatório estruturado (JSON) no Firestore")
  Rel(firebaseFunctions, storage, "11. Converte para MDX e salva no Storage")
  Rel(firebaseFunctions, firestore, "12. Atualiza status da análise para 'completed' e caminho do MDX")
  Rel(frontendApp, firestore, "13. Ouve atualizações de status e exibe o progresso/resultado (via onSnapshot no useAnalysisManager)")

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)")
  UpdateElementStyle(frontendApp, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(serverActions, $fontColor="white", $bgColor="rgb(68, 158, 228)")
  UpdateElementStyle(firestore, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(storage, $fontColor="white", $bgColor="rgb(112, 112, 214)")
  UpdateElementStyle(firebaseFunctions, $fontColor="white", $bgColor="rgb(43, 135, 209)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)")
```

## Descrição do Fluxo

1.  O **Usuário** interage com o **Frontend Web App** para selecionar um arquivo CSV e fornecer metadados (título, descrição).
2.  O **Frontend Web App** chama Server Actions (`createInitialAnalysisRecordAction`) para registrar a análise e gerencia o upload direto do arquivo CSV para o Firebase Storage.
3.  A **Server Action** cria um registro inicial no **Firebase Firestore** com o status "uploading".
4.  O **Frontend Web App** completa o upload do arquivo CSV para o **Firebase Storage**.
5.  O **Frontend Web App** chama outra Server Action (`finalizeFileUploadRecordAction`) com a URL do arquivo no Storage.
6.  A **Server Action** atualiza o registro da análise no **Firebase Firestore**, mudando o status para "summarizing_data" e salvando a URL do CSV.
7.  A mudança de status no **Firebase Firestore** aciona a Firebase Function `processAnalysisOnUpdate` (contêiner **Processamento em Background**).
8.  A **Firebase Function** lê o arquivo CSV do **Firebase Storage**.
9.  A **Firebase Function** orquestra a pipeline de agentes de IA (usando Genkit e **Google AI (Gemini)**) para:
    *   Sumarizar os dados.
    *   Identificar resoluções ANEEL.
    *   Analisar a conformidade e gerar um relatório estruturado inicial (JSON).
    *   Revisar e refinar o relatório estruturado.
10. A **Firebase Function** salva o relatório estruturado final (JSON) no **Firebase Firestore**.
11. A **Firebase Function** converte o relatório JSON para MDX e o salva no **Firebase Storage**.
12. A **Firebase Function** atualiza o status da análise no **Firebase Firestore** para "completed" e armazena o caminho para o arquivo MDX.
13. O **Frontend Web App** (através do hook `useAnalysisManager` que utiliza `onSnapshot`) detecta as atualizações de status e progresso no **Firebase Firestore** e exibe os resultados ou o relatório final para o usuário.

Este diagrama foca na interação entre os principais contêineres do sistema durante o processamento de uma nova análise.
