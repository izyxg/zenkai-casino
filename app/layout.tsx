import "./globals.css";
import type { Metadata } from "next";

export const metadata:Metadata={title:"Zenkai Casino",description:"Casino RP en Ryôs pour Zenkai"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
