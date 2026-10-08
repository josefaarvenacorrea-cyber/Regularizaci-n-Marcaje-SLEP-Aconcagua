import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

// Roboto es la fuente oficial del UI Kit del Gobierno Digital de Chile —
// se usa tanto para títulos como para texto de cuerpo, igual que en el kit.
const roboto = Roboto({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Regularización de Marcajes · SLEP Aconcagua",
  description: "Gestión de la regularización de inconsistencias de marcaje.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={roboto.variable}>
      <body>{children}</body>
    </html>
  );
}
