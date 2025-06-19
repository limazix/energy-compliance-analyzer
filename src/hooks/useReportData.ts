'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useParams } from 'next/navigation';

import type { AnalyzeComplianceReportOutput } from '@/ai/prompt-configs/analyze-compliance-report-prompt-config';
import { useAuth } from '@/contexts/auth-context';
import { getAnalysisReportAction } from '@/features/report-viewing/actions/reportViewingActions';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import type { Analysis } from '@/types/analysis';

export function useReportData() {
  const params = useParams();
  const analysisId = params.analysisId as string;
  const { toast } = useToast();

  const { user } = useAuth();

  const [reportData, setReportData] = useState({
    mdxContent: null,
    fileName: null,
    analysisId: analysisId,
    isLoading: true,
    error: null,
    structuredReport: null,
  });

  const structuredReportRef = useRef(reportData.structuredReport);

  const fetchReportAndInitialStructuredData = useCallback(
    async (currentAnalysisId: string, currentUserId: string) => {
      setReportData((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        analysisId: currentAnalysisId,
      }));
      try {
        const data = await getAnalysisReportAction(currentUserId, currentAnalysisId);
        if (data.error) {
          setReportData((prev) => ({
            ...prev,
            isLoading: false,
            error: data.error,
          }));
          toast({
            title: 'Erro ao Carregar Relatório',
            description: data.error,
            variant: 'destructive',
          });
        } else {
          const analysisDocRef = doc(db, 'users', currentUserId, 'analyses', currentAnalysisId);
          const analysisSnap = await getDoc(analysisDocRef);
          let initialStructuredReport: AnalyzeComplianceReportOutput | null = null;
          if (analysisSnap.exists()) {
            initialStructuredReport = (analysisSnap.data() as Analysis).structuredReport || null;
          }

          setReportData((prev) => ({
            ...prev,
            mdxContent: data.mdxContent || null,
            fileName: data.fileName || 'Relatório',
            analysisId: data.analysisId || currentAnalysisId,
            isLoading: false,
            error: null,
            structuredReport: initialStructuredReport,
          }));
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setReportData((prev) => ({
          ...prev,
          isLoading: false,
          error: `Erro ao carregar o relatório: ${errorMsg}`,
        }));
        toast({
          title: 'Erro ao Carregar',
          description: `Detalhes: ${errorMsg}`,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  useEffect(() => {
    structuredReportRef.current = reportData.structuredReport;
  }, [reportData.structuredReport]);

  useEffect(() => {
    if (!user?.uid || !analysisId || reportData.isLoading) return;

    const analysisDocRef = doc(db, 'users', user.uid, 'analyses', analysisId);
    const unsubscribe = onSnapshot(analysisDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const analysisData = docSnap.data() as Analysis;
        const newStructuredReport = analysisData.structuredReport || null;
        const newMdxPath = analysisData.mdxReportStoragePath;

        const hasStructuredReportChanged =
          JSON.stringify(newStructuredReport) !== JSON.stringify(structuredReportRef.current);

        if (hasStructuredReportChanged) {
          // eslint-disable-next-line no-console
          console.debug(
            '[ReportPage] Firestore listener: structuredReport or mdxReportStoragePath changed. Updating state.'
          );
          setReportData((prev) => ({
            ...prev,
            structuredReport: newStructuredReport,
          }));
          if (newMdxPath && user.uid && analysisId) {
            try {
              const updatedMdxData = await getAnalysisReportAction(user.uid, analysisId);
              if (!updatedMdxData.error && updatedMdxData.mdxContent) {
                setReportData((prev) => ({
                  ...prev,
                  mdxContent: updatedMdxData.mdxContent,
                  fileName: updatedMdxData.fileName || prev.fileName,
                }));
                toast({
                  title: 'Relatório Atualizado',
                  description: 'O conteúdo do relatório foi atualizado remotamente.',
                });
              }
            } catch (fetchError) {
              // eslint-disable-next-line no-console
              console.error(
                '[ReportPage] Error re-fetching MDX after Firestore update:',
                fetchError
              );
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, [user, analysisId, reportData.isLoading, toast]);

  return { reportData, fetchReportAndInitialStructuredData };
}
