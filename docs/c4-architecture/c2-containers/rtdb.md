
# C2 Model: Detalhe do Contêiner - Banco de Dados de Chat (Firebase Realtime Database)

[<- Voltar para Visão Geral dos Contêineres (C2)](./index.md)

## Descrição

O **Firebase Realtime Database (RTDB)** é um banco de dados NoSQL hospedado na nuvem que permite armazenar e sincronizar dados entre usuários em tempo real. Neste sistema, ele é utilizado especificamente para gerenciar o histórico de conversas do chat interativo associado a cada relatório de análise.

## Responsabilidades (Comportamentos)

*   **Armazenamento de Histórico de Chat:**
    *   Persiste todas as mensagens trocadas entre o usuário e o Agente Orquestrador do Chat para uma análise específica.
    *   Cada mensagem de chat inclui:
        *   ID único da mensagem.
        *   Identificador do remetente ('user' ou 'ai').
        *   O conteúdo textual da mensagem.
        *   Timestamp de quando a mensagem foi enviada/recebida.
        *   Potencialmente, um status para mensagens da IA (ex: 'streaming', 'completed', 'error').
*   **Sincronização em Tempo Real:**
    *   Permite que a interface de chat no Frontend Web App se inscreva (listen) a um nó de chat específico.
    *   Quando novas mensagens são adicionadas ou mensagens existentes são atualizadas no RTDB, essas alterações são enviadas automaticamente para todos os clientes inscritos em tempo real.
    *   Isso garante que a interface de chat seja atualizada dinamicamente à medida que a conversa acontece, incluindo o streaming de respostas da IA.
*   **Organização de Dados:**
    *   Os dados de chat são tipicamente organizados por ID de análise, por exemplo, em um caminho como `/chats/{analysisId}/messages/{messageId}`.

## Tecnologias e Restrições

*   **Tecnologia Principal:** Firebase Realtime Database.
*   **Tipo de Banco:** NoSQL. Os dados são armazenados como um grande objeto JSON (uma árvore JSON).
*   **Modelo de Dados:** Os dados são estruturados hierarquicamente. É crucial planejar a estrutura de dados para otimizar a performance e a segurança.
*   **Segurança:** O acesso aos dados é controlado por Regras de Segurança do Realtime Database, que são baseadas em JSON e podem usar variáveis de autenticação e caminhos de dados.
*   **Otimização para Tempo Real:** Projetado para baixa latência e alta concorrência para aplicações que necessitam de sincronização instantânea de dados.
*   **Limitações de Consulta:** As capacidades de consulta são mais limitadas em comparação com o Firestore. É otimizado para buscar dados por caminho direto ou consultas simples. Ordenação e filtragem complexas podem ser desafiadoras ou exigir desnormalização de dados.
*   **Escalabilidade:** Escala para um grande número de conexões simultâneas.
*   **Custos:** O faturamento é baseado na quantidade de dados armazenados, na quantidade de dados baixados e no número de conexões simultâneas.
*   **SDKs:** O Firebase SDK para cliente (web) e o Firebase Admin SDK (para Next.js Server Actions ou Firebase Functions) são usados para interagir com o RTDB.
