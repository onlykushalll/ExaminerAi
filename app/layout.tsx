import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Examiner AI — Question Extraction Engine',
  description: 'AI-powered PDF exam paper question extraction. Detects MCQ, Subjective, and Assertion-Reason questions with high accuracy.',
  keywords: ['exam', 'question extraction', 'PDF', 'MCQ', 'AI', 'education'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Preload fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
