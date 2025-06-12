# **App Name**: Energy Compliance Analyzer

## Core Features:

- Data Import: Allow the user to upload a CSV file containing power quality data from the PowerNET PQ-600 G4, using Firebase Storage for streaming and caching.
- Regulatory Identification: Use a generative AI tool to identify relevant ANEEL Normative Resolutions based on the uploaded data. The LLM will use reasoning as a tool to decide what data to include.
- Compliance Assessment: Use a generative AI tool to analyze the power quality data against the identified regulations and generate a compliance report. The LLM will use reasoning as a tool to decide what data to include.
- Summary Display: Display a summary of the assessment results with clear indicators of compliance and non-compliance.
- Report Generation: Generate and download a detailed compliance report in PDF format, including specific violations and recommendations.
- Error Handling: Implement robust error handling to manage large file uploads and data processing exceptions, leveraging Firebase Realtime Database for status updates.
- Conversational Interface: Provide a conversational user interface in Brazilian Portuguese with clear and polished interactions throughout the analysis process. The interface will display a list of all steps being performed, along with their real-time status and estimated completion percentage.
- User Authentication and Session Management: Implement authentication and authorization to access functionalities, using Firebase Authentication for Google accounts and Firebase Firestore for session management, allowing users to access previous sessions, analyses, and reports organized with tags.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust, stability, and professionalism.
- Background color: Light gray (#F0F2F5), providing a clean, neutral backdrop.
- Accent color: Orange (#FF9800) to highlight important compliance issues and call-to-action buttons.
- Body and headline font: 'Inter' (sans-serif) for a modern, machined look and readability.
- Use clear and intuitive icons to represent different data points, compliance status, and regulatory standards.
- Employ a clean, structured layout with intuitive navigation, emphasizing key findings and actionable insights.
- Use subtle transitions and animations to enhance user experience when displaying results or generating reports.
