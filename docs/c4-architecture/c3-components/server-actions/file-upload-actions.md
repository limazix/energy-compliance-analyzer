
# C3: Componente - Ações de Upload de Arquivo (`fileUploadActions`)

[<- Voltar para Componentes das Server Actions](./../02-server-actions-components.md)

## Descrição

O componente **Ações de Upload de Arquivo** (`src/features/file-upload/actions/fileUploadActions.ts`) é um módulo de Server Actions responsável por gerenciar as etapas iniciais do processo de análise, desde a criação do registro no Firestore até a sinalização de que o upload do arquivo CSV para o Firebase Storage foi concluído.

## Responsabilidades (Comportamentos)

*   **Criação de Registro Inicial da Análise (`createInitialAnalysisRecordAction`):**
    *   Recebe o ID do usuário, nome do arquivo, título, descrição e código de idioma.
    *   Cria um novo documento na coleção `users/{userId}/analyses` do Firestore.
    *   Define o status inicial da análise como "uploading" e o progresso como 0.
    *   Armazena metadados básicos como nome do arquivo, título, descrição, tags (inicialmente vazio) e timestamp de criação.
    *   Retorna o ID da análise recém-criada para o cliente.
*   **Atualização do Progresso do Upload (`updateAnalysisUploadProgressAction`):**
    *   Recebe o ID do usuário, ID da análise e o progresso atual do upload do arquivo (0-100).
    *   Atualiza o campo `uploadProgress` e `progress` (calculado com base no progresso do upload) no documento da análise no Firestore.
    *   Mantém o status como "uploading".
*   **Finalização do Registro do Upload (`finalizeFileUploadRecordAction`):**
    *   Recebe o ID do usuário, ID da análise e a URL de download do arquivo CSV no Firebase Storage (após o upload ser concluído pelo cliente).
    *   Atualiza o documento da análise no Firestore com:
        *   `powerQualityDataUrl`: A URL do arquivo CSV no Storage.
        *   `status`: Define como "summarizing_data" para sinalizar que a Firebase Function `processAnalysisOnUpdate` deve iniciar o processamento.
        *   `progress`: Define como um valor inicial (ex: 10%) indicando que o upload foi concluído.
        *   `uploadProgress`: Define como 100.
        *   Limpa quaisquer `errorMessage` anteriores.
        *   Reseta campos que serão preenchidos pela Function (ex: `powerQualityDataSummary`, `structuredReport`).
*   **Marcação de Falha no Upload (`markUploadAsFailedAction`):**
    *   Recebe o ID do usuário, ID da análise (pode ser nulo se a criação do registro falhou) e uma mensagem de erro.
    *   Se o ID da análise existir, atualiza o documento da análise no Firestore:
        *   `status`: Define como "error".
        *   `errorMessage`: Salva a mensagem de erro do upload.
        *   `progress`: Define como 0.
        *   `uploadProgress`: Define como 0.

## Tecnologias e Aspectos Chave

*   **TypeScript:** Para tipagem e organização do código.
*   **Next.js Server Actions:** Para executar lógica de backend diretamente a partir de componentes cliente.
*   **Firebase Firestore:**
    *   `addDoc` para criar o registro inicial da análise.
    *   `updateDoc` para atualizar o progresso, status e a URL do arquivo.
    *   `serverTimestamp` para registrar o tempo de criação.
    *   Manipulação de erros específicos do Firestore.
*   **Validação:** Assegura que IDs de usuário e arquivo sejam válidos antes de interagir com o Firestore.
