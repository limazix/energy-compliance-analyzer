/**
 * @fileOverview Centralized application configuration.
 * Contains static variables used for various behaviors across the Next.js app and Firebase Functions.
 */

/**
 * @typedef {object} AnalysisProgressStagesConfig
 * @property {number} FILE_READ - Progress percentage after the file is read.
 * @property {number} SUMMARIZATION_BASE - Base progress percentage before summarization starts (after file read).
 * @property {number} SUMMARIZATION_SPAN - Total percentage span allocated for the summarization process.
 * @property {number} IDENTIFY_REGULATIONS_INCREMENT - Progress increment after identifying regulations.
 * @property {number} ANALYZE_COMPLIANCE_INCREMENT - Progress increment after initial compliance analysis.
 * @property {number} REVIEW_REPORT_INCREMENT - Progress increment after report review.
 */

/**
 * Centralized configuration object for the application.
 * @property {object} APP_CONFIG
 * @property {number} APP_CONFIG.MAX_SERVER_ERROR_MESSAGE_LENGTH - Maximum length for detailed error messages logged or stored by Firebase Functions.
 * @property {number} APP_CONFIG.MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH - Maximum length for error messages surfaced to the client via Server Actions.
 * @property {string} APP_CONFIG.TOPIC_FILE_UPLOAD_COMPLETED - Pub/Sub topic name for file upload completion events.
 * @property {string} APP_CONFIG.TOPIC_ANALYSIS_DELETION_REQUEST - Pub/Sub topic name for analysis deletion requests.
 * @property {number} APP_CONFIG.PROGRESS_PERCENTAGE_UPLOAD_COMPLETE - Overall progress percentage when file upload is complete.
 * @property {number} APP_CONFIG.PROGRESS_PERCENTAGE_FINAL_COMPLETE - Overall progress percentage when analysis is fully complete.
 * @property {string} APP_CONFIG.FIREBASE_ADMIN_APP_NAME_RSC - Unique name for the Firebase Admin SDK app instance used in RSC/Server Actions.
 * @property {string} APP_CONFIG.DEFAULT_LANGUAGE_CODE - Default BCP-47 language code for the application (e.g., 'pt-BR').
 * @property {number} APP_CONFIG.TOAST_DISPLAY_LIMIT - Maximum number of toasts to display at once.
 * @property {number} APP_CONFIG.ANALYSIS_CSV_CHUNK_SIZE_BYTES - Size of CSV chunks in bytes for processing large files.
 * @property {number} APP_CONFIG.ANALYSIS_CSV_OVERLAP_SIZE_BYTES - Size of overlap in bytes between CSV chunks.
 * @property {AnalysisProgressStagesConfig} APP_CONFIG.ANALYSIS_PROGRESS_STAGES - Configuration for analysis progress stage percentages.
 */
export const APP_CONFIG = {
  // Error Message Lengths
  /**
   * Maximum length for detailed error messages logged or stored by Firebase Functions.
   * @type {number}
   */
  MAX_SERVER_ERROR_MESSAGE_LENGTH: 1000,
  /**
   * Maximum length for error messages surfaced to the client via Server Actions.
   * @type {number}
   */
  MAX_CLIENT_SERVER_ACTION_ERROR_MESSAGE_LENGTH: 350,

  // Pub/Sub Topic Names
  /**
   * Pub/Sub topic name for file upload completion events.
   * @type {string}
   */
  TOPIC_FILE_UPLOAD_COMPLETED: 'file-upload-completed-topic',
  /**
   * Pub/Sub topic name for analysis deletion requests.
   * @type {string}
   */
  TOPIC_ANALYSIS_DELETION_REQUEST: 'analysis-deletion-request-topic',

  // Progress Percentages
  /**
   * Overall progress percentage considered when the file upload part is complete.
   * @type {number}
   */
  PROGRESS_PERCENTAGE_UPLOAD_COMPLETE: 10,
  /**
   * Overall progress percentage representing full completion of an analysis.
   * @type {number}
   */
  PROGRESS_PERCENTAGE_FINAL_COMPLETE: 100,

  // Firebase Admin
  /**
   * Unique name for the Firebase Admin SDK app instance, particularly for React Server Components or Server Actions context.
   * @type {string}
   */
  FIREBASE_ADMIN_APP_NAME_RSC: 'firebase-admin-app-rsc',

  // Localization
  /**
   * Default BCP-47 language code used throughout the application (e.g., 'pt-BR', 'en-US').
   * @type {string}
   */
  DEFAULT_LANGUAGE_CODE: 'pt-BR',

  // UI Configurations
  /**
   * Maximum number of toast notifications to display simultaneously.
   * @type {number}
   */
  TOAST_DISPLAY_LIMIT: 1,
  // TOAST_REMOVE_DELAY is very specific to useToast hook's internal logic, might be better to keep it there.

  // Core Analysis (Firebase Functions)
  /**
   * Size of chunks (in bytes) for reading and processing large CSV files.
   * @type {number}
   */
  ANALYSIS_CSV_CHUNK_SIZE_BYTES: 100000,
  /**
   * Size of overlap (in bytes) between consecutive CSV chunks to ensure data integrity during processing.
   * @type {number}
   */
  ANALYSIS_CSV_OVERLAP_SIZE_BYTES: 10000,

  /**
   * Configuration for various progress percentage points during the analysis pipeline.
   * These values represent the cumulative progress after each stage.
   * @type {AnalysisProgressStagesConfig}
   */
  ANALYSIS_PROGRESS_STAGES: {
    /** Progress after the initial file read is complete. */
    FILE_READ: 10,
    /** Base progress before summarization begins (should be same or slightly more than FILE_READ). */
    SUMMARIZATION_BASE: 15,
    /** Total percentage points allocated for the summarization phase (added to SUMMARIZATION_BASE). */
    SUMMARIZATION_SPAN: 30,
    /** Additional progress points after regulations are identified. */
    IDENTIFY_REGULATIONS_INCREMENT: 15,
    /** Additional progress points after initial compliance analysis is done. */
    ANALYZE_COMPLIANCE_INCREMENT: 15,
    /** Additional progress points after the report review is complete. */
    REVIEW_REPORT_INCREMENT: 15,
    // Final generation and completion will make up the rest to reach PROGRESS_PERCENTAGE_FINAL_COMPLETE (100).
  },
} as const;
