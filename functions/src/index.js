// @ts-check Convertido de TypeScript para JavaScript
'use strict';

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Export functions from other files
// Assumindo que processAnalysis.js exporta processAnalysisOnUpdate
const { processAnalysisOnUpdate } = require('./processAnalysis');
exports.processAnalysisOnUpdate = processAnalysisOnUpdate;
