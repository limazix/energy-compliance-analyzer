
import { Suspense } from 'react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL, getBlob } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';
// convertStructuredReportToMdx não é mais necessário aqui, pois o MDX virá do Storage
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MessageSquarePlus, Send, AlertTriangle, Download } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header'; 

async function getAnalysisMdxContent(userId: string, analysisId: string): Promise<string | null> {
  const analysisDocRef = doc(db, 'users', userId, 'analyses', analysisId);
  try {
    const docSnap = await getDoc(analysisDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as Analysis;
      if (data.mdxReportStoragePath) {
        const fileRef = storageRef(storage, data.mdxReportStoragePath);
        const downloadURL = await getDownloadURL(fileRef);
        const response = await fetch(downloadURL);
        if (!response.ok) {
          throw new Error(`Failed to download MDX file: ${response.statusText}`);
        }
        const mdxText = await response.text();
        return mdxText;
      } else {
        console.log(`mdxReportStoragePath não encontrado para a análise ${analysisId}.`);
        return null;
      }
    } else {
      console.log(`Análise com ID ${analysisId} não encontrada para o usuário ${userId}.`);
      return null;
    }
  } catch (error) {
    console.error("Erro ao buscar conteúdo MDX da análise:", error);
    return null;
  }
}


export default async function ReportPage({ params }: { params: { analysisId: string } }) {
  const { analysisId } = params;

  // ******************************************************************************************
  // ** IMPORTANTE: Para este protótipo funcionar minimamente sem reestruturar a autenticação **
  // ** da página, vamos assumir que você testará com um ID de análise de um usuário conhecido **
  // ** e hardcoded aqui temporariamente. SUBSTITUA 'HARDCODED_USER_ID_FOR_TESTING' PELO UID REAL DO USUÁRIO**
  // ** DONO DA ANÁLISE QUE VOCÊ QUER TESTAR. ISSO É APENAS PARA TESTE LOCAL.              **
  // ** Em uma implementação de produção, você obteria o userId do usuário autenticado.     **
  // ******************************************************************************************
  const HARDCODED_USER_ID_FOR_TESTING = "PLEASE_REPLACE_WITH_ACTUAL_USER_ID_FOR_TESTING"; 

  let mdxSource: string | null = null;
  let errorMessage: string | null = null;
  let analysisDetailsForPage: Pick<Analysis, 'fileName'> | null = null;

  if (HARDCODED_USER_ID_FOR_TESTING === "PLEASE_REPLACE_WITH_ACTUAL_USER_ID_FOR_TESTING") {
    errorMessage = "Configuração de usuário para teste pendente. Não foi possível buscar dados do relatório. Edite src/app/report/[analysisId]/page.tsx.";
  } else {
    try {
      // Primeiro, busca os detalhes da análise para obter o nome do arquivo.
      const analysisDocRef = doc(db, 'users', HARDCODED_USER_ID_FOR_TESTING, 'analyses', analysisId);
      const analysisSnap = await getDoc(analysisDocRef);
      if (analysisSnap.exists()) {
        analysisDetailsForPage = { fileName: analysisSnap.data().fileName || 'Relatório' };
        mdxSource = await getAnalysisMdxContent(HARDCODED_USER_ID_FOR_TESTING, analysisId);
        if (!mdxSource) {
          errorMessage = `Não foi possível carregar o conteúdo do relatório MDX para a análise ID: ${analysisId}. Verifique se o relatório foi gerado e o caminho no Storage está correto.`;
        }
      } else {
        errorMessage = `Análise com ID ${analysisId} não encontrada para o usuário de teste.`;
      }
    } catch (e) {
        errorMessage = `Erro ao carregar o relatório: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  if (errorMessage && !mdxSource) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader onStartNewAnalysis={() => {}} onNavigateToDashboard={() => {}} />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-md p-6">
            <h1 className="text-2xl font-bold text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-7 w-7"/> Falha ao Carregar Relatório
            </h1>
            <p className="text-destructive-foreground mt-2">{errorMessage}</p>
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }
  
  if (!mdxSource) { // Fallback se mdxSource ainda for null por algum motivo não pego antes
     return (
      <div className="flex flex-col min-h-screen">
        <AppHeader onStartNewAnalysis={() => {}} onNavigateToDashboard={() => {}} />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10">
            <h1 className="text-2xl font-bold text-destructive">Relatório Não Encontrado</h1>
            <p className="text-muted-foreground mt-2">O conteúdo do relatório para a análise com ID: {analysisId} não pôde ser carregado.</p>
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
       <AppHeader onStartNewAnalysis={() => { /* No-op ou redirecionar para home? */ }} onNavigateToDashboard={() => { /* No-op ou redirecionar para home? */ }} />
      <main className="container mx-auto py-8 px-4 flex-1">
        <div className="mb-6 flex justify-between items-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Análises
            </Link>
          </Button>
          {/* Adicionar um botão de download para o MDX bruto, se útil */}
          {/* <Button variant="outline" size="sm" onClick={Como implementar download de string?}>
            <Download className="mr-2 h-4 w-4" /> Baixar MDX
          </Button> */}
        </div>

        <div className="mb-4 p-4 bg-white rounded-lg shadow">
            <h1 className="text-3xl font-bold text-primary">{analysisDetailsForPage?.fileName ? `Relatório: ${analysisDetailsForPage.fileName}` : 'Relatório Detalhado'}</h1>
            <p className="text-sm text-muted-foreground">Análise ID: {analysisId}</p>
            <p className="text-xs text-amber-700 mt-1">
                Nota: Esta página busca o relatório do Storage. Em produção, uma Firebase Function autenticada gerenciaria esse acesso.
            </p>
        </div>

        <article className="prose prose-slate lg:prose-xl max-w-none bg-white p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
          <Suspense fallback={<div className="text-center py-10">Carregando relatório...</div>}>
            <MDXRemote source={mdxSource} />
          </Suspense>
        </article>

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
          <Button disabled> 
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
