
# C2 Model: Detalhe do Contêiner - Frontend Web App

[<- Voltar para Visão Geral dos Contêineres (C2)](./index.md)

## Descrição

O **Frontend Web App** é a principal interface através da qual os usuários interagem com o Energy Compliance Analyzer. É uma Single Page Application (SPA) moderna, construída com Next.js e React, projetada para ser responsiva e intuitiva. É hospedada no Firebase App Hosting.

## Responsabilidades (Comportamentos)

*   **Autenticação de Usuários:** Gerencia o login e logout de usuários utilizando o Google Sign-In através do Firebase Authentication.
*   **Interface de Upload:** Permite que os usuários selecionem arquivos CSV contendo dados de qualidade de energia, forneçam um título e uma descrição para a análise.
*   **Visualização de Análises:** Exibe uma lista de análises passadas com seus status, tags associadas e datas. Permite ao usuário expandir uma análise para ver detalhes.
*   **Exibição de Progresso e Resultados:** Mostra o progresso de análises que estão em andamento e os resultados de análises concluídas.
*   **Renderização de Relatórios:** Exibe o relatório de conformidade final, que está em formato MDX (Markdown com componentes JSX).
*   **Chat Interativo:** Fornece uma interface de chat para que os usuários possam interagir com um agente de IA sobre o relatório gerado, pedir esclarecimentos, sugerir modificações ou aprofundar em detalhes.
*   **Gerenciamento de Estado da UI:** Controla o estado local da interface do usuário, como qual análise está selecionada, o estado do formulário de upload, etc.
*   **Notificações ao Usuário:** Apresenta feedback ao usuário através de toasts/notificações (ex: sucesso no upload, erros).

## Tecnologias e Restrições

*   **Framework Principal:** Next.js (com App Router).
*   **Biblioteca de UI:** React.
*   **Componentes de UI:** ShadCN UI.
*   **Estilização:** Tailwind CSS.
*   **SDKs Firebase (Cliente):**
    *   `firebase/app` para inicialização.
    *   `firebase/auth` para autenticação.
    *   `firebase/firestore` para ouvir atualizações de status de análises em tempo real (opcional, primariamente para a lista).
    *   `firebase/storage` (usado indiretamente via Server Actions para uploads).
    *   `firebase/database` para a funcionalidade de chat em tempo real com o Firebase Realtime Database.
*   **Comunicação com Backend:** Utiliza Next.js Server Actions para todas as operações que requerem lógica de servidor ou acesso seguro a dados/serviços (ex: iniciar upload, buscar relatórios, interagir com o chat AI).
*   **Hospedagem:** Firebase App Hosting.
*   **Estado Global (Opcional):** Pode utilizar React Context para gerenciamento de estado global (ex: estado de autenticação, dados do usuário).
*   **Segurança:** Interações com o backend (Server Actions) são protegidas e validam a identidade do usuário.
