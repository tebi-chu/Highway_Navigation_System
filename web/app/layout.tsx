import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '高速道路アシスト',
  description: '現在地より先の高速道路施設を見やすく案内します。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
