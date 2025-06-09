
# C2 Model: Detalhe do Contêiner - Backend API (Next.js Server Actions)

[<- Voltar para Visão Geral dos Contêineres (C2)](./index.md)

## Descrição

As **Next.js Server Actions** funcionam como a camada de API backend para o Frontend Web App. Elas são funções server-side co-localizadas com o código do Next.js, executadas no servidor em resposta a chamadas do cliente. Elas simplificam a comunicação full-stack, permitindo que o frontend invoque lógica de servidor de forma segura e direta.

## Responsabilidades (Comportamentos)

*   **Manipulação de Upload de Arquivos:**
    *   Recebe a submissão do formulário de upload do frontend (metadados como título, descrição).
    *   Cria um registro inicial para a nova análise no Firebase Firestore, marcando o status como "uploading".
    *   Retorna um ID de análise para o frontend. (O upload real para o Storage é agora gerenciado pelo `useFileUploadManager` no cliente, que então chama actions para finalizar).
*   **Atualização de Status da Análise:**
    *   Após o upload do arquivo CSV para o Firebase Storage ser concluído pelo cliente, uma Server Action é chamada para finalizar o registro.
    *   Atualiza o registro da análise no Firestore com a URL do arquivo no Storage e muda o status para "summarizing_data" (ou estado similar) para acionar as Firebase Functions.
*   **Gerenciamento de Tags:**
    *   Adiciona ou remove tags de uma análise específica no Firestore.
*   **Busca de Dados de Relatório:**
    *   Busca os metadados de uma análise (incluindo o caminho para o arquivo MDX no Storage) do Firestore.
    *   Busca o conteúdo do arquivo MDX do Firebase Storage.
    *   Retorna o conteúdo MDX e outros dados relevantes para o frontend exibir o relatório.
*   **Orquestração do Chat Interativo do Relatório:**
    *   Recebe mensagens do usuário enviadas através da interface de chat no frontend.
    *   Invoca um fluxo Genkit (Agente Orquestrador do Chat) que utiliza o Gemini para processar a mensagem do usuário no contexto do relatório atual (MDX e estruturado).
    *   Salva o histórico da conversa (mensagens do usuário e da IA) no Firebase Realtime Database.
    *   Se o Agente Orquestrador (via sua ferramenta de revisão) modificar o relatório estruturado:
        *   Atualiza o objeto do relatório estruturado (JSON) no Firestore.
        *   Gera um novo arquivo MDX a partir do relatório estruturado revisado.
        *   Salva o novo arquivo MDX no Firebase Storage, substituindo ou versionando o anterior.
        *   Retorna o novo MDX ou uma indicação de atualização para o frontend.
*   **Operações de Gerenciamento de Análise:**
    *   Excluir uma análise (marcar como 'deleted' no Firestore, remover arquivos do Storage).
    *   Cancelar uma análise em progresso (atualizar status para 'cancelling' no Firestore).

## Tecnologias e Restrições

*   **Tecnologia Principal:** Next.js Server Actions (executando em ambiente Node.js).
*   **Inteligência Artificial:** Genkit para orquestração de fluxos de IA, especificamente para o Agente Orquestrador do Chat, que utiliza o Google AI (Gemini).
*   **SDKs Firebase (Lado do Servidor):**
    *   Firebase Admin SDK (preferencialmente) ou Firebase Server SDK para interações seguras com Firestore, Storage e Realtime Database. As Server Actions têm acesso a variáveis de ambiente seguras.
*   **Execução:** Executadas como parte da aplicação Next.js no Firebase App Hosting.
*   **Segurança:** Server Actions são um mecanismo seguro para expor lógica de backend, pois o código não é enviado ao cliente. A autenticação do usuário é verificada antes de realizar operações sensíveis.
*   **Limitações:** Sujeitas aos limites de execução do ambiente de servidor do Next.js (ex: tempo de execução, memória), que podem ser diferentes dos Firebase Functions. Para processos muito longos ou intensivos, as Firebase Functions são preferíveis.
