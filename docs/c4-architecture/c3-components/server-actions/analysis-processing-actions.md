
# C3: Componente - Ações de Processamento de Análise (`analysisProcessingActions`)

[<- Voltar para Componentes das Server Actions](./../02-server-actions-components.md)

## Descrição

O componente **Ações de Processamento de Análise** (`src/features/analysis-processing/actions/analysisProcessingActions.ts`) é um módulo de Server Actions focado em preparar e sinalizar uma análise para que seja processada em segundo plano pela Firebase Function `processAnalysisOnUpdate`.

## Responsabilidades (Comportamentos)

*   **Sinalizar Início do Processamento (`processAnalysisFile`):**
    *   Recebe o ID da análise e o ID do usuário.
    *   Verifica se o documento da análise existe no Firebase Firestore e se a URL do arquivo CSV (`powerQualityDataUrl`) está presente.
    *   **Se o upload do arquivo foi concluído e a `powerQualityDataUrl` existe:**
        *   Atualiza o status do documento da análise no Firestore para "summarizing_data" (ou um estado similar que ative o gatilho da Firebase Function).
        *   Garante que o progresso inicial (ex: 10%) esteja definido.
        *   Limpa quaisquer mensagens de erro anteriores do documento.
        *   Reseta campos que serão preenchidos pela Firebase Function (ex: `powerQualityDataSummary`, `structuredReport`, `mdxReportStoragePath`, `summary`, `completedAt`).
    *   **Se a `powerQualityDataUrl` não existir:**
        *   Define o status da análise como "error" e registra uma mensagem de erro apropriada no Firestore.
    *   **Se a análise já estiver em um estado final (completed, cancelled, deleted) ou em processo de cancelamento:**
        *   Não realiza nenhuma ação de re-processamento, a menos que esteja explicitamente sendo re-processada a partir de um estado de 'error'.
    *   Retorna um status de sucesso ou falha ao cliente.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para tipagem e organização do código.
*   **Next.js Server Actions:** Para executar a lógica de preparação no servidor.
*   **Firebase Firestore:**
    *   `getDoc` para verificar o estado atual da análise e a presença da `powerQualityDataUrl`.
    *   `updateDoc` para alterar o status da análise para "summarizing_data" (ou o status de gatilho da Function) e limpar/resetar campos relevantes.
*   **Interação com Firebase Functions:** Esta ação não invoca diretamente a Firebase Function. Em vez disso, ela modifica o estado de um documento no Firestore de uma maneira que aciona a Function (`processAnalysisOnUpdate`) que está configurada para ouvir essas mudanças (especificamente a transição para "summarizing_data").
*   **Validação de Estado:** Antes de sinalizar para processamento, verifica se a análise está em um estado apropriado (ex: upload concluído) e não em um estado terminal.
*   **Tratamento de Erros:** Gerencia erros como documento não encontrado ou falhas ao atualizar o Firestore.
