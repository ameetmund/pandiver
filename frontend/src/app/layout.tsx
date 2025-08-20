import type { Metadata } from "next";
import { poppins } from "../lib/fonts";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Pandiver - Smart PDF Parser",
  description: "Transform PDFs into structured data with our Smart PDF Parser. Extract, organize, and export data from PDF files with an intuitive drag-and-drop interface.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
