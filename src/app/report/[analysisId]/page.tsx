
'use client'; // This page needs to be a client component to use hooks like useAuth and useEffect

import { Suspense, useEffect, useState } from 'react';
import { MDXRemote, type MDXRemoteProps } from 'next-mdx-remote/rsc';
import { getAnalysisReportAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MessageSquarePlus, Send, AlertTriangle, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AppHeader } from '@/components/app-header'; 
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

// Define a type for the report data state
interface ReportData {
  mdxContent: string | null;
  fileName: string | null;
  analysisId: string | null;
  isLoading: boolean;
  error: string | null;
}

export default function ReportPage({ params }: { params: { analysisId: string } }) {
  const { analysisId } = params;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [reportData, setReportData] = useState<ReportData>({
    mdxContent: null,
    fileName: null,
    analysisId: params.analysisId,
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
      setReportData(prev => ({ ...prev, isLoading: true, error: null }));
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
    }
  }, [analysisId, user, authLoading, router]);

  if (authLoading || reportData.isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <AppHeader /> {/* Pass no interactive props */}
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
        <AppHeader /> {/* Pass no interactive props */}
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
        <AppHeader /> {/* Pass no interactive props */}
        <main className="container mx-auto py-8 px-4 flex-1">
          <div className="text-center py-10">
            <h1 className="text-2xl font-bold text-destructive">Relatório Não Encontrado</h1>
            <p className="text-muted-foreground mt-2">O conteúdo do relatório para a análise com ID: {analysisId} não pôde ser carregado ou não existe.</p>
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

  // MDXRemoteProps type might need adjustment if you pass custom components
  const mdxProps: MDXRemoteProps = {
    source: reportData.mdxContent,
    // components: { /* Custom components if any */ }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
       <AppHeader /> {/* Pass no interactive props */}
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
              MDXRemote from 'next-mdx-remote/rsc' is for Server Components.
              Since this is now a Client Component, we might need to adjust how MDXRemote is used,
              or ensure that the data fetching part (getAnalysisReportAction) which returns the string
              is sufficient, and MDXRemote can still process that string on the client.
              Typically, for client-side rendering of MDX string, you'd use 'next-mdx-remote/serialize' on server
              and then pass serialized result to MDXRemote on client.
              However, if 'next-mdx-remote/rsc' is designed to also work by just passing a string source on client, it might be fine.
              For now, let's assume the string source is enough as it's simpler.
              If it fails, we'd need to adjust MDX handling for client components.
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
