import { Providers } from './providers'; // 确保路径正确
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* 必须在这里套上 Providers，所有子页面才能使用钱包功能 */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}