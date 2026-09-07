import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HasibWeb X AdVista',
  description: 'Client billing and WhatsApp reminder dashboard',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
