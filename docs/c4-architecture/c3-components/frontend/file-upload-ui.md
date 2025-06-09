
# C3: Componente - Componentes de Upload (fileUploadUI)

[<- Voltar para Componentes do Frontend](./../01-frontend-app-components.md)

## Descrição

Os **Componentes de Upload** fornecem a interface do usuário para que os usuários possam selecionar arquivos CSV, adicionar metadados (título, descrição) e iniciar o processo de upload e análise.

## Responsabilidades (Comportamentos)

*   **Seleção de Arquivo:**
    *   Apresenta um input do tipo "file" para que o usuário possa selecionar um arquivo CSV do seu sistema local.
    *   Valida o tipo de arquivo (permite apenas `.csv`).
*   **Entrada de Metadados:**
    *   Permite que o usuário insira um título para a análise (pré-preenchido com o nome do arquivo).
    *   Permite que o usuário insira uma descrição opcional para a análise.
*   **Lógica de Upload:**
    *   Utiliza o hook customizado `useFileUploadManager` para gerenciar o estado do arquivo selecionado, o progresso do upload e os erros.
    *   Ao submeter, invoca a função `uploadFileAndCreateRecord` do hook `useFileUploadManager`.
    *   Esta função, por sua vez, chama Server Actions para:
        1.  Criar um registro inicial da análise no Firestore (`createInitialAnalysisRecordAction`).
        2.  Realizar o upload do arquivo para o Firebase Storage (via `uploadBytesResumable`).
        3.  Atualizar o progresso do upload no Firestore (`updateAnalysisUploadProgressAction`).
        4.  Finalizar o registro da análise no Firestore com a URL do arquivo e o status apropriado (`finalizeFileUploadRecordAction`).
        5.  Em caso de falha no upload, marcar a análise como erro (`markUploadAsFailedAction`).
*   **Feedback ao Usuário:**
    *   Exibe o nome do arquivo selecionado.
    *   Mostra uma barra de progresso durante o upload.
    *   Apresenta mensagens de erro caso o upload falhe.
    *   Permite o cancelamento do processo de upload antes do envio.

## Tecnologias e Aspectos Chave

*   **React Components:** Principalmente `NewAnalysisForm.tsx`.
*   **ShadCN UI:** `Card`, `Input`, `Textarea`, `Button`, `Label`, `Progress`, `Alert` para construir o formulário e exibir feedback.
*   **Custom Hooks:** `useFileUploadManager` para encapsular a lógica de upload e interação com Server Actions.
*   **Server Actions:** (Invocadas pelo `useFileUploadManager`) Para interagir com o backend (Firestore, Storage).
*   **Validação:** Validação de tipo de arquivo no cliente.
