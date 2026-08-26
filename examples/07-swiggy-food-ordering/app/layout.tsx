import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Swiggy Food Ordering Agent',
  description: 'Food-ordering agent with Swiggy via Abstraxn MCP tools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
