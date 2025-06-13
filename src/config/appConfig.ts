/**
 * @fileOverview Centralized application configuration.
 * Contains static variables used for various behaviors across the Next.js app and Firebase Functions.
 */

export const APP_CONFIG = {
  // Error Message Lengths
  MAX_SERVER_ERROR_MESSAGE_LENGTH: 1000, // For detailed errors logged/stored by Firebase Functions
  MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH: 350, // For errors surfaced to the client via Server Actions

  // Pub/Sub Topic Names
  TOPIC_FILE_UPLOAD_COMPLETED: 'file-upload-completed-topic',
  TOPIC_ANALYSIS_DELETION_REQUEST: 'analysis-deletion-request-topic',

  // Progress Percentages
  PROGRESS_PERCENTAGE_UPLOAD_COMPLETE: 10,
  PROGRESS_PERCENTAGE_FINAL_COMPLETE: 100,

  // Firebase Admin
  FIREBASE_ADMIN_APP_NAME_RSC: 'firebase-admin-app-rsc',

  // Localization
  DEFAULT_LANGUAGE_CODE: 'pt-BR',

  // UI Configurations
  TOAST_DISPLAY_LIMIT: 1,
  // TOAST_REMOVE_DELAY is very specific to useToast hook's internal logic, might be better to keep it there.

  // Core Analysis (Firebase Functions)
  ANALYSIS_CSV_CHUNK_SIZE_BYTES: 100000,
  ANALYSIS_CSV_OVERLAP_SIZE_BYTES: 10000,
  ANALYSIS_PROGRESS_STAGES: {
    FILE_READ: 10,
    SUMMARIZATION_BASE: 15,
    SUMMARIZATION_SPAN: 30, // Total % span for summarization after base
    IDENTIFY_REGULATIONS_INCREMENT: 15, // Increment after summarization
    ANALYZE_COMPLIANCE_INCREMENT: 15, // Increment after identifying regulations
    REVIEW_REPORT_INCREMENT: 15, // Increment after initial analysis
    // Final generation is the remainder to 100
  },
} as const;
