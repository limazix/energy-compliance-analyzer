
'use client'; // This page needs to be a client component to use hooks like useAuth and useEffect

import { Suspense, useEffect, useState } from 'react';
import { MDXRemote, type MDXRemoteProps } from 'next-mdx-remote/rsc'; // Note: if this causes issues on client, we might need 'next-mdx-remote' directly
import { getAnalysisReportAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MessageSquarePlus, Send, AlertTriangle, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header'; 
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import type { AnalysisReportData } from '@/types/analysis';

// Define a type for the report data state
interface ReportDataState extends AnalysisReportData {
  isLoading: boolean;
}

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const analysisId = params.analysisId as string; // Assuming analysisId will always be a string based on route structure

  const { user, loading: authLoading } = useAuth();

  const [reportData, setReportData] = useState<ReportDataState>({
    mdxContent: null,
    fileName: null,
    analysisId: analysisId,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (authLoading) {
      return; // Wait for authentication to resolve
    }

    if (!user) {
      router.replace('/login'); // Redirect if not authenticated
      return;
    }

    if (user && user.uid && analysisId) {
      setReportData(prev => ({ ...prev, isLoading: true, error: null, analysisId: analysisId }));
      getAnalysisReportAction(user.uid, analysisId)
        .then(data => {
          if (data.error) {
            setReportData({
              mdxContent: null,
              fileName: null,
              analysisId: analysisId,
              isLoading: false,
              error: data.error,
            });
          } else {
            setReportData({
              mdxContent: data.mdxContent || null,
              fileName: data.fileName || 'Relatório',
              analysisId: data.analysisId || analysisId,
              isLoading: false,
              error: null,
            });
          }
        })
        .catch(e => {
          setReportData({
            mdxContent: null,
            fileName: null,
            analysisId: analysisId,
            isLoading: false,
            error: `Erro ao carregar o relatório: ${e instanceof Error ? e.message : String(e)}`,
          });
        });
    } else if (!analysisId && user && !authLoading) { // Handle case where analysisId might be missing from params
        setReportData({
            mdxContent: null,
            fileName: null,
            analysisId: null,
            isLoading: false,
            error: "ID da análise não encontrado na URL.",
        });
    }
  }, [analysisId, user, authLoading, router]);

  if (authLoading || reportData.isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-slate-100">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
         </footer>
      </div>
    );
  }

  if (reportData.error) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10 bg-destructive/10 border border-destructive rounded-md p-6">
            <h1 className="text-2xl font-bold text-destructive flex items-center justify-center">
              <AlertTriangle className="mr-2 h-7 w-7"/> Falha ao Carregar Relatório
            </h1>
            <p className="text-destructive-foreground mt-2">{reportData.error}</p>
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-slate-100">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
         </footer>
      </div>
    );
  }
  
  if (!reportData.mdxContent) {
     return (
      <div className="flex flex-col min-h-screen">
        <AppHeader />
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10">
            <h1 className="text-2xl font-bold text-destructive">Relatório Não Encontrado</h1>
            <p className="text-muted-foreground mt-2">O conteúdo do relatório para a análise com ID: {reportData.analysisId || 'desconhecido'} não pôde ser carregado ou não existe.</p>
            <Button asChild className="mt-6">
              <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
            </Button>
          </div>
        </main>
         <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-slate-100">
           © {new Date().getFullYear()} Energy Compliance Analyzer. Todos os direitos reservados.
         </footer>
      </div>
    );
  }

  const mdxProps: MDXRemoteProps = {
    source: reportData.mdxContent,
    // components: { /* Custom components if any */ }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
       <AppHeader />
      <main className="container mx-auto py-8 px-4 flex-1">
        <div className="mb-6 flex justify-between items-center">
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Análises
            </Link>
          </Button>
        </div>

        <div className="mb-4 p-4 bg-white rounded-lg shadow">
            <h1 className="text-3xl font-bold text-primary">{reportData.fileName ? `Relatório: ${reportData.fileName}` : 'Relatório Detalhado'}</h1>
            <p className="text-sm text-muted-foreground">Análise ID: {reportData.analysisId}</p>
            <p className="text-xs text-amber-700 mt-1">
                Nota: Esta página busca o relatório através de uma Server Action segura.
            </p>
        </div>

        <article className="prose prose-slate lg:prose-xl max-w-none bg-white p-6 sm:p-8 md:p-10 rounded-lg shadow-lg">
          <Suspense fallback={<div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/> Carregando relatório...</div>}>
            {/* 
              Using MDXRemote from 'next-mdx-remote/rsc' in a client component might be problematic.
              If 'next-mdx-remote/rsc' is strictly for RSC, we should use the standard 'next-mdx-remote'
              and potentially serialize on the server (though our server action returns a string).
              For now, assuming it can handle string source on client.
              If errors occur related to MDXRemote, this import might need changing.
              The error "Export getAnalysisReportAction doesn't exist in target module" could also be
              related to how client components interact with server actions if MDXRemote is misbehaving.
            */}
             {/* @ts-expect-error MDXRemoteProps might be expecting compiledSource from serialize, but we're passing raw string */}
            <MDXRemote {...mdxProps} />
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
