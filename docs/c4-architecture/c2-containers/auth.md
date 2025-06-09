
# C2 Model: Detalhe do Contêiner - Serviço de Autenticação (Firebase Authentication)

[<- Voltar para Visão Geral dos Contêineres (C2)](./index.md)

## Descrição

O **Firebase Authentication** fornece serviços de backend, SDKs fáceis de usar e bibliotecas de UI prontas para autenticar usuários no aplicativo Energy Compliance Analyzer. Ele se integra diretamente com provedores de identidade populares, como o Google Sign-In.

## Responsabilidades (Comportamentos)

*   **Autenticação de Usuários:**
    *   Gerencia o fluxo de login de usuários através do Google Sign-In.
    *   Verifica a identidade do usuário junto ao Google e emite tokens de ID do Firebase para o cliente.
*   **Gerenciamento de Sessão:**
    *   Mantém o estado de autenticação do usuário no Frontend Web App.
    *   Fornece informações sobre o usuário atualmente logado (UID, nome de exibição, e-mail, URL da foto do perfil).
*   **Fornecimento de Identidade para Regras de Segurança:**
    *   O UID (User ID) do usuário autenticado é crucial para aplicar as Regras de Segurança do Firebase Firestore, Firebase Storage e Firebase Realtime Database.
    *   As regras utilizam o `request.auth.uid` para garantir que os usuários só possam acessar ou modificar seus próprios dados.
*   **Criação de Contas de Usuário:**
    *   Automaticamente cria um registro de usuário no backend do Firebase Authentication na primeira vez que um usuário faz login com um provedor de identidade (como o Google).

## Tecnologias e Restrições

*   **Tecnologia Principal:** Firebase Authentication.
*   **Provedores de Identidade Suportados:** Configurado para usar o Google Sign-In. Poderia ser estendido para outros provedores OAuth (Facebook, Twitter, GitHub), e-mail/senha, número de telefone, etc.
*   **SDKs:**
    *   O Firebase SDK para cliente (web) é usado no Frontend Web App para iniciar o fluxo de login e observar mudanças no estado de autenticação.
    *   O Firebase Admin SDK pode ser usado em ambientes de servidor (Next.js Server Actions, Firebase Functions) para verificar tokens de ID ou gerenciar usuários programaticamente (embora o gerenciamento de usuários não seja uma funcionalidade principal deste sistema).
*   **Tokens de ID:** Utiliza tokens de ID JWT (JSON Web Tokens) para comunicar o estado de autenticação de forma segura entre o cliente e os serviços de backend (ou para validar o acesso em Server Actions).
*   **Segurança:**
    *   Lida com a complexidade dos fluxos OAuth e o armazenamento seguro de credenciais.
    *   Ajuda a proteger contra vários vetores de ataque comuns relacionados à autenticação.
*   **Integração com Firebase:** Fortemente integrado com outros serviços Firebase, permitindo um controle de acesso granular baseado na identidade do usuário.
*   **Custos:** O Firebase Authentication possui um generoso nível gratuito para a maioria dos métodos de login (incluindo Google Sign-In). Custos podem ser aplicados para funcionalidades mais avançadas ou volumes muito altos de autenticação por telefone (SMS).
*   **Interface do Usuário:** Embora o Firebase forneça o FirebaseUI (uma biblioteca de UI drop-in), este projeto implementa uma interface de login personalizada no Frontend Web App que invoca o SDK do Firebase Authentication diretamente.
