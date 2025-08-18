import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "../styles/globals.css";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"]
});

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
