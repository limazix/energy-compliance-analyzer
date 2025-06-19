// functions/src/core-analysis/onUpdateTrigger.ts
'use strict';

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import { AnalysisContext } from './analysis-context';
import { AnalysisExecutionVisitor } from './analysis-execution.visitor';
import { AnalysisProgressVisitor } from './analysis-progress.visitor';
import { APP_CONFIG } from '../config/appConfig';
import { firebaseServerProvider } from '../lib/firebase-server-provider';
import { AnalysisData } from '../types';

const MAX_ERROR_MSG_LENGTH = APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH;

export const processAnalysisOnUpdate = functions.firestore
  .document('users/{userId}/analyses/{analysisId}')
  .onUpdate(async (change, context) => {
    const analysisDataAfter = change.after.data() as AnalysisData;
    const analysisId = context.params.analysisId;
    const analysisRef = firebaseServerProvider.getFirestore().doc(change.after.ref.path);

    if (analysisDataAfter.status !== 'summarizing_data') {
      return;
    }

    const analysisContext = new AnalysisContext(analysisDataAfter);
    const executionVisitor = new AnalysisExecutionVisitor();
    const progressVisitor = new AnalysisProgressVisitor(firebaseServerProvider.getFirestore());

    try {
      while (analysisContext.getState().constructor.name !== 'CompletedState') {
        await analysisContext.getState().accept(executionVisitor);
        await analysisContext.getState().accept(progressVisitor);
        await analysisContext.getState().transition();
      }

      await analysisRef.update({
        status: 'completed',
        progress: 100,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        errorMessage: null,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing analysis ${analysisId}:`, error);
      await analysisRef.update({
        status: 'error',
        errorMessage: `Falha (OnUpdate): ${errorMessage.substring(0, MAX_ERROR_MSG_LENGTH)}`,
      });
    }
  });
