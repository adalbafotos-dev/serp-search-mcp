import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SERP Research · MCP",
  description: "Pesquisa web, análise de sites e inteligência de conteúdo para seus chats.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
