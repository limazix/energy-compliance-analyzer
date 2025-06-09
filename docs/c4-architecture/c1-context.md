
# C4 Model: Nível 1 - Contexto do Sistema - Energy Compliance Analyzer

Este diagrama mostra o sistema Energy Compliance Analyzer em seu ambiente, interagindo com usuários e outros sistemas externos.

```mermaid
C4Context
  title Contexto do Sistema para o Energy Compliance Analyzer

  Actor(user, "Usuário", "Engenheiros, analistas ou consultores do setor elétrico que precisam verificar a conformidade de dados de qualidade de energia.", $sprite="fa:fa-user")

  System_Boundary(analyzer_boundary, "Energy Compliance Analyzer") {
    System(energyAnalyzer, "Energy Compliance Analyzer", "Plataforma web para upload, análise de conformidade de dados de qualidade de energia elétrica com base nas normas ANEEL, e geração de relatórios interativos.", $sprite="fa:fa-cogs")
  }

  System_Ext(googleAI, "Google AI (Gemini)", "Serviço de IA generativa (LLM) usado para análise de dados, identificação de normas, geração e revisão de relatórios, e chat interativo.", $sprite="fa:fa-brain")
  System_Ext(firebase, "Firebase Platform", "Plataforma do Google que fornece autenticação, banco de dados (Firestore, RTDB), armazenamento de arquivos (Storage), e ambiente para execução de código em backend (Functions & App Hosting).", $sprite="fa:fa-fire")

  Rel(user, energyAnalyzer, "Usa", "HTTPS")
  Rel(energyAnalyzer, googleAI, "Utiliza para processamento de IA", "API Calls")
  Rel(energyAnalyzer, firebase, "Hospedado em e utiliza serviços de", "SDKs, APIs")

  UpdateElementStyle(user, $fontColor="white", $bgColor="rgb(13, 105, 184)", $borderColor="rgb(13, 105, 184)")
  UpdateElementStyle(energyAnalyzer, $fontColor="white", $bgColor="rgb(28, 128, 74)", $borderColor="rgb(28, 128, 74)")
  UpdateElementStyle(googleAI, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
  UpdateElementStyle(firebase, $fontColor="white", $bgColor="rgb(100, 100, 100)", $borderColor="rgb(100, 100, 100)")
```

[Próximo Nível: Diagrama de Contêineres (C2)](./c2-containers.md)
