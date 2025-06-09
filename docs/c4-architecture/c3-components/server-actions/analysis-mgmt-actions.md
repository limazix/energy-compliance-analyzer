
# C3: Componente - Ações de Gerenciamento de Análise (`analysisMgmtActions`)

[<- Voltar para Componentes das Server Actions](./../02-server-actions-components.md)

## Descrição

O componente **Ações de Gerenciamento de Análise** (`src/features/analysis-management/actions/analysisManagementActions.ts`) é um módulo de Server Actions que lida com operações de ciclo de vida de uma análise, como exclusão e cancelamento.

## Responsabilidades (Comportamentos)

*   **Exclusão de Análise (`deleteAnalysisAction`):**
    *   Recebe o ID do usuário e o ID da análise a ser excluída.
    *   Atualiza o documento da análise no Firestore, definindo o status como "deleted".
    *   Pode opcionalmente limpar campos como `summary`, `structuredReport`, `mdxReportStoragePath`, `powerQualityDataUrl` para indicar que os dados não estão mais acessíveis ou para economizar espaço.
    *   Dispara a exclusão dos arquivos associados (CSV original e relatório MDX) do Firebase Storage.
    *   Loga a ação e trata possíveis erros durante o processo.
*   **Cancelamento de Análise (`cancelAnalysisAction`):**
    *   Recebe o ID do usuário e o ID da análise a ser cancelada.
    *   Verifica se a análise está em um estado que permite cancelamento (ex: não 'completed', 'error', 'cancelled' ou 'deleted').
    *   Atualiza o documento da análise no Firestore, definindo o status como "cancelling".
    *   A Firebase Function responsável pelo processamento da análise deve observar esse status "cancelling" e interromper sua execução o mais breve possível, atualizando o status para "cancelled".
    *   Pode registrar uma mensagem de erro inicial indicando que o cancelamento foi solicitado.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para tipagem e organização do código.
*   **Next.js Server Actions:** Para executar lógica de backend de forma segura.
*   **Firebase Firestore:**
    *   `getDoc` para verificar o estado atual da análise.
    *   `updateDoc` para alterar o status da análise para "deleted" ou "cancelling".
*   **Firebase Storage:**
    *   `deleteObject` e `ref` (de `firebase/storage`) para remover os arquivos associados (CSV, MDX) quando uma análise é excluída.
*   **Gerenciamento de Estado:** As ações precisam lidar com diferentes estados da análise para determinar se a exclusão ou cancelamento é uma operação válida.
*   **Tratamento de Erros:** Gerencia erros de forma robusta durante as interações com o Firestore e Storage.
