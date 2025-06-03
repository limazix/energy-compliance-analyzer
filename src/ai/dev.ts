
import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-power-quality-data.ts';
import '@/ai/flows/identify-aneel-resolutions.ts';
import '@/ai/flows/analyze-compliance-report.ts';
import '@/ai/flows/review-compliance-report.ts';
import '@/ai/flows/orchestrate-report-interaction.ts'; // Added new flow

