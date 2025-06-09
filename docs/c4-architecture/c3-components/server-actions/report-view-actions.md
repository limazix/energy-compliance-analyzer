
# C3: Componente - Ações de Visualização de Relatório (`reportViewActions`)

[<- Voltar para Componentes das Server Actions](./../02-server-actions-components.md)

## Descrição

O componente **Ações de Visualização de Relatório** (`src/features/report-viewing/actions/reportViewingActions.ts`) é um módulo de Server Actions responsável por buscar os dados necessários para exibir um relatório de análise detalhado ao usuário.

## Responsabilidades (Comportamentos)

*   **Busca de Dados do Relatório (`getAnalysisReportAction`):**
    *   Recebe o ID do usuário e o ID da análise.
    *   Busca o documento da análise no Firebase Firestore.
    *   Verifica as permissões do usuário para acessar o relatório.
    *   Obtém o caminho do arquivo MDX do relatório (`mdxReportStoragePath`) a partir do documento do Firestore.
    *   Obtém o nome do arquivo original (`fileName`) do documento do Firestore.
    *   Obtém o relatório estruturado (`structuredReport`) do documento do Firestore (necessário para o contexto do chat).
    *   Lê o conteúdo do arquivo MDX do Firebase Storage usando o caminho obtido.
    *   Retorna um objeto contendo o conteúdo MDX, o nome do arquivo original, o ID da análise, o relatório estruturado e um possível estado de erro.
    *   Trata cenários onde o relatório ou a análise não são encontrados, ou o usuário não tem permissão.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para tipagem dos dados do relatório e dos parâmetros da ação.
*   **Next.js Server Actions:** Para expor a funcionalidade de busca de forma segura.
*   **Firebase Firestore:**
    *   `getDoc` para buscar o documento da análise e obter metadados como `mdxReportStoragePath`, `fileName` e `structuredReport`.
*   **Firebase Storage:**
    *   Utiliza uma função utilitária (ex: `getFileContentFromStorage` de `src/lib/gcsUtils.ts`) que usa `getDownloadURL` e `fetch` (ou o SDK Admin do Storage, se executado em um contexto de Function, mas aqui é Server Action) para ler o conteúdo do arquivo MDX.
*   **Permissões:** Lógica implícita ou explícita para verificar se o `userId` corresponde ao proprietário da análise.
*   **Tratamento de Erros:** Gerencia e propaga erros que podem ocorrer ao buscar dados do Firestore ou Storage.
*   **Interface `AnalysisReportData`:** Define a estrutura dos dados retornados pela ação.
