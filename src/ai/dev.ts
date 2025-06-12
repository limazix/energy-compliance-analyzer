import { config } from 'dotenv';

import '@/ai/flows/analyze-compliance-report';
import '@/ai/flows/identify-aneel-resolutions';
import '@/ai/flows/orchestrate-report-interaction'; // Added new flow
import '@/ai/flows/review-compliance-report';
import '@/ai/flows/summarize-power-quality-data';

config();
