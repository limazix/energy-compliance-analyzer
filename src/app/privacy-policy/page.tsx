
import { AppHeader } from '@/components/app-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <AppHeader />
      <main className="container mx-auto max-w-3xl py-8 px-4 flex-1">
        <div className="mb-6">
          <Link href="/login" className="text-sm text-primary hover:underline flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
          </Link>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US')}</p>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none dark:prose-invert">
            <p><em><strong>Attention:</strong> This is a sample privacy policy and does not constitute legal advice. Adapt this content to your specific needs and consult a legal professional.</em></p>

            <h2>1. Introduction</h2>
            <p>Welcome to EMA - Electric Magnitudes Analizer ("We", "Our"). This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our application.</p>

            <h2>2. Information We Collect</h2>
            <p>We may collect the following types of information:</p>
            <ul>
              <li><strong>Account Information:</strong> When you register using your Google account, we collect basic profile information provided by Google (name, email, profile picture) to create and manage your account.</li>
              <li><strong>Power Quality Data:</strong> We collect the CSV files you upload, containing electrical power quality data. This data is used exclusively to provide analysis services and generate reports.</li>
              <li><strong>Usage Data:</strong> We may collect information about how you use the application, such as analyses created, reports generated, and tags used, to improve our services.</li>
            </ul>

            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide, operate, and maintain our services.</li>
              <li>Process your CSV files and generate compliance reports.</li>
              <li>Enable interaction with generated reports through the chat interface.</li>
              <li>Manage your account and provide customer support.</li>
              <li>Improve and personalize our services.</li>
              <li>Monitor the usage of our services for security and operational purposes.</li>
            </ul>

            <h2>4. Information Sharing</h2>
            <p>We do not share your personal information with third parties, except in the following circumstances:</p>
            <ul>
              <li><strong>Service Providers:</strong> We use Firebase (Google) for authentication, data storage (Firestore, Storage), real-time database (Realtime Database for chat), and hosting. We use Genkit and Google AI (Gemini) for natural language processing and analysis generation. These providers have limited access to your data only to perform these tasks on our behalf and are obligated not to disclose or use it for other purposes.</li>
              <li><strong>Legal Requirements:</strong> We may disclose your information if required by law.</li>
            </ul>

            <h2>5. Data Storage and Security</h2>
            <p>Your data, including CSV files and generated reports, are stored using Firebase Storage and Firestore. We implement security measures to protect your information, but no security system is impenetrable.</p>
            <p>The content of CSV files and generated reports are processed by AI models (Gemini via Genkit) to provide analysis results. We do not use this data to train global AI models.</p>

            <h2>6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the information we hold about you.</li>
              <li>Request the correction of inaccurate information.</li>
              <li>Delete your analyses and associated data through the application's functionalities. Deleting an analysis will remove the original CSV file and generated reports from Firebase Storage, and mark the record in Firestore as deleted.</li>
              <li>Delete your account (subject to Firebase's data retention policy).</li>
            </ul>

            <h2>7. Cookies</h2>
            <p>We use essential cookies for Firebase Authentication to function and to manage your session in the application.</p>

            <h2>8. Changes to This Privacy Policy</h2>
            <p>We may update our Privacy Policy periodically. We will notify you of any changes by posting the new Privacy Policy on this page. We recommend that you review this Privacy Policy periodically for any changes.</p>

            <h2>9. Contact</h2>
            <p>If you have any questions about this Privacy Policy, please contact us via email at: [Your Contact Email Address].</p>
          </CardContent>
        </Card>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/50 bg-muted/20">
        © {new Date().getFullYear()} EMA - Electric Magnitudes Analizer. All rights reserved.
        <div className="mt-1">
          <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          {' | '}
          <Link href="/terms-of-service" className="hover:underline">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}

    