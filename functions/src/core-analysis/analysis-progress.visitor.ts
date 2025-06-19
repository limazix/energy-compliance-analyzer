// functions/src/core-analysis/analysis-progress.visitor.ts
import * as admin from 'firebase-admin';

import { APP_CONFIG } from '@/config/appConfig';

import { AnalysisVisitor } from './analysis-visitor';
import { AssessingComplianceState } from './states/assessing-compliance.state';
import { IdentifyingRegulationsState } from './states/identifying-regulations.state';
import { ReviewingReportState } from './states/reviewing-report.state';
import { SummarizingState } from './states/summarizing.state';

const PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE =
  APP_CONFIG.ANALYSIS_PROGRESS_STAGES.SUMMARIZATION_BASE;
const PROGRESS_SUMMARIZATION_TOTAL_SPAN = APP_CONFIG.ANALYSIS_PROGRESS_STAGES.SUMMARIZATION_SPAN;

const PROGRESS_IDENTIFY_REGULATIONS_COMPLETE =
  (PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE as number) +
  (PROGRESS_SUMMARIZATION_TOTAL_SPAN as number) +
  (APP_CONFIG.ANALYSIS_PROGRESS_STAGES.IDENTIFY_REGULATIONS_INCREMENT as number);

const PROGRESS_ANALYZE_COMPLIANCE_COMPLETE: number =
  (PROGRESS_IDENTIFY_REGULATIONS_COMPLETE as number) +
  (APP_CONFIG.ANALYSIS_PROGRESS_STAGES.ANALYZE_COMPLIANCE_INCREMENT as number);

const PROGRESS_REVIEW_REPORT_COMPLETE: number =
  (PROGRESS_ANALYZE_COMPLIANCE_COMPLETE as number) +
  (APP_CONFIG.ANALYSIS_PROGRESS_STAGES.REVIEW_REPORT_INCREMENT as number);

export class AnalysisProgressVisitor implements AnalysisVisitor {
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore) {
    this.db = db;
  }

  public async visitSummarizingState(state: SummarizingState): Promise<void> {
    const { analysisData } = state.context;
    const analysisRef = this.db.doc(
      `users/${analysisData.userId}/analyses/${analysisData.analysisId}`
    );
    await analysisRef.update({
      powerQualityDataSummary: analysisData.powerQualityDataSummary,
      status: 'identifying_regulations',
      progress: PROGRESS_SUMMARIZATION_CHUNK_COMPLETE_BASE + PROGRESS_SUMMARIZATION_TOTAL_SPAN,
    });
  }

  public async visitIdentifyingRegulationsState(state: IdentifyingRegulationsState): Promise<void> {
    const { analysisData } = state.context;
    const analysisRef = this.db.doc(
      `users/${analysisData.userId}/analyses/${analysisData.analysisId}`
    );
    await analysisRef.update({
      identifiedRegulations: analysisData.identifiedRegulations,
      status: 'assessing_compliance',
      progress: PROGRESS_IDENTIFY_REGULATIONS_COMPLETE,
    });
  }

  public async visitAssessingComplianceState(state: AssessingComplianceState): Promise<void> {
    const { analysisData } = state.context;
    const analysisRef = this.db.doc(
      `users/${analysisData.userId}/analyses/${analysisData.analysisId}`
    );
    await analysisRef.update({
      structuredReport: analysisData.structuredReport,
      status: 'reviewing_report',
      progress: PROGRESS_ANALYZE_COMPLIANCE_COMPLETE,
    });
  }

  public async visitReviewingReportState(state: ReviewingReportState): Promise<void> {
    const { analysisData } = state.context;
    const analysisRef = this.db.doc(
      `users/${analysisData.userId}/analyses/${analysisData.analysisId}`
    );
    await analysisRef.update({
      structuredReport: analysisData.structuredReport,
      summary: analysisData.structuredReport.introduction?.overallResultsSummary,
      progress: PROGRESS_REVIEW_REPORT_COMPLETE,
    });
  }
}
