
import { Suspense } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';
import { convertStructuredReportToMdx } from '@/lib/reportUtils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MessageSquarePlus, Send } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header'; // Reutilizar o cabeçalho da app

async function getAnalysisData(analysisId: string): Promise<Analysis | null> {
  // ATENÇÃO: Em produção, esta função precisaria do userId para buscar
  // o documento de forma segura: doc(db, 'users', userId, 'analyses', analysisId);
  // E a página precisaria de autenticação para obter o userId.
  // Para este protótipo, buscamos diretamente pelo analysisId.
  // Esta é uma simplificação e precisaria de uma camada de segurança.
  
  // Tentativa de encontrar o documento em um caminho genérico se o userId não for conhecido.
  // Isso NÃO é recomendado para produção.
  // Você precisará ajustar isso para buscar o documento no caminho correto do usuário.
  // Exemplo: Se você sabe que todas as análises são públicas ou se você tem uma coleção 'all_analyses'.
  // Como não temos isso, vou simular uma busca que provavelmente falhará se não soubermos o userId.
  // A maneira correta é obter o userId (ex: via autenticação na página) e usar o caminho completo.
  
  // Para este protótipo, vamos assumir que a análise está em uma coleção 'analyses' de primeiro nível
  // APENAS PARA FINS DE DEMONSTRAÇÃO, POIS NÃO TEMOS O USERID AQUI DIRETAMENTE.
  // EM UM APP REAL, VOCÊ *NÃO* FARIA ISSO. VOCÊ DEVE BUSCAR EM users/{userId}/analyses/{analysisId}
  
  // TEMPORARY AND UNSAFE for prototype: Try finding the analysis document
  // This is a placeholder and will likely require adjustment based on your Firestore structure
  // and how you decide to pass/retrieve the userId for this page.
  
  // Simulação: se você passar userId como query param (não recomendado para prod):
  // const userId = params.searchParams?.userId; // Example if userId was passed
  // if (!userId) {
  // console.error("UserID não fornecido para buscar a análise.");
  // return null;
  // }
  // const analysisDocRef = doc(db, 'users', userId, 'analyses', analysisId);
  
  // Como não temos userId, não podemos buscar o documento de forma segura e correta.
  // Esta página, como está, não funcionará corretamente sem uma estratégia para obter o userId
  // e o caminho completo do documento.
  // Para fins de prototipagem do MDX, você pode mockar os dados ou passar o structuredReport
  // de outra forma (ex: via query params, mas grandes dados em URL são ruins).

  // ******************************************************************************************
  // ** IMPORTANTE: Para este protótipo funcionar minimamente sem reestruturar a autenticação **
  // ** da página, vamos assumir que você testará com um ID de análise de um usuário conhecido **
  // ** e hardcoded aqui temporariamente. SUBSTITUA 'HARDCODED_USER_ID' PELO UID REAL DO USUÁRIO**
  // ** DONO DA ANÁLISE QUE VOCÊ QUER TESTAR. ISSO É APENAS PARA TESTE LOCAL.              **
  // ******************************************************************************************
  const HARDCODED_USER_ID_FOR_TESTING = "PLEASE_REPLACE_WITH_ACTUAL_USER_ID_FOR_TESTING"; // OU PASSE VIA VAR DE AMBIENTE

  if (HARDCODED_USER_ID_FOR_TESTING === "PLEASE_REPLACE_WITH_ACTUAL_USER_ID_FOR_TESTING") {
    console.warn("AVISO: HARDCODED_USER_ID_FOR_TESTING não foi substituído. A busca de dados da análise falhará.");
    // Retornar um objeto de Análise com um erro para que a página mostre algo
     return {
        id: analysisId,
        fileName: "Desconhecido",
        status: "error",
        errorMessage: "Configuração de usuário para teste pendente. Não foi possível buscar dados.",
        userId: "unknown",
        progress: 0,
        tags: [],
        createdAt: new Date().toISOString()
      } as Analysis;
  }
  
  const analysisDocRef = doc(db, 'users', HARDCODED_USER_ID_FOR_TESTING, 'analyses', analysisId);
  
  try {
    const docSnap = await getDoc(analysisDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        fileName: data.fileName,
        status: data.status,
        progress: data.progress,
        // ... outros campos da Análise
        structuredReport: data.structuredReport,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        tags: data.tags || [],
      } as Analysis;
    } else {
      console.log(`Análise com ID ${analysisId} não encontrada para o usuário de teste.`);
      return null;
    }
  } catch (error) {
    console.error("Erro ao buscar dados da análise:", error);
    return null;
  }
}

export default async function ReportPage({ params }: { params: { analysisId: string } }) {
  const { analysisId } = params;
  const analysisData = await getAnalysisData(analysisId);

  if (!analysisData) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader onStartNewAnalysis={() => { /* Lógica para nova análise, talvez redirecionar para home */ }} onNavigateToDashboard={() => { /* Lógica para dashboard, talvez redirecionar para home */ }} />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10">
            <h1 className="text-2xl font-bold text-destructive">Relatório Não Encontrado</h1>
            <p className="text-muted-foreground mt-2">Não foi possível carregar os dados para a análise com ID: {analysisId}.</p>
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (analysisData.status === 'error' && analysisData.errorMessage?.includes("Configuração de usuário para teste pendente")) {
     return (
      <div className="flex flex-col min-h-screen">
        <AppHeader onStartNewAnalysis={() => {}} onNavigateToDashboard={() => {}} />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10 bg-amber-50 border border-amber-200 rounded-md p-6">
            <h1 className="text-2xl font-bold text-amber-700">Configuração Pendente para Visualização</h1>
            <p className="text-amber-600 mt-2">
              Para visualizar este relatório, o ID do usuário proprietário da análise precisa ser configurado
              no arquivo <code>src/app/report/[analysisId]/page.tsx</code> na variável <code>HARDCODED_USER_ID_FOR_TESTING</code>.
            </p>
            <p className="text-sm text-muted-foreground mt-4">Esta é uma medida de segurança temporária para o desenvolvimento. Em produção, a autenticação do usuário determinaria o acesso.</p>
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }


  const mdxSource = convertStructuredReportToMdx(analysisData.structuredReport, analysisData.fileName);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
       <AppHeader onStartNewAnalysis={() => { /* No-op ou redirecionar para home? */ }} onNavigateToDashboard={() => { /* No-op ou redirecionar para home? */ }} />
      <main className="container mx-auto py-8 px-4 flex-1">
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Análises
            </Link>
          </Button>
        </div>

        <article className="prose prose-slate lg:prose-xl max-w-none bg-white p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
          <Suspense fallback={<div className="text-center py-10">Carregando relatório...</div>}>
            <MDXRemote source={mdxSource} />
          </Suspense>
        </article>

        {/* Placeholder para funcionalidade de comentários/revisões */}
        <section className="mt-12 p-6 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-primary flex items-center">
            <MessageSquarePlus className="mr-3 h-7 w-7" /> Sugestões e Revisões
          </h2>
          <p className="text-muted-foreground mb-4">
            Esta seção é um placeholder para a funcionalidade de revisão interativa.
            No futuro, você poderá selecionar partes do texto e solicitar alterações diretamente aqui.
          </p>
          <Textarea
            placeholder="Digite suas sugestões ou comentários sobre o relatório aqui..."
            className="mb-4 min-h-[120px]"
            aria-label="Caixa de texto para sugestões e revisões"
          />
          <Button disabled> {/* Desabilitado pois a funcionalidade não está implementada */}
            <Send className="mr-2 h-4 w-4" /> Enviar Sugestões
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            (Funcionalidade de envio de sugestões ainda não implementada)
          </p>
        </section>
      </main>
       <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-slate-100">
        © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
      </footer>
    </div>
  );
}
