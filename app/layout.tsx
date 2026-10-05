import "./globals.css";
import type { Metadata } from "next";

export const metadata:Metadata={
  title:"Le Cercle du Ryô",
  description:"Le Cercle du Ryô — maison de jeu privée, tables de Blackjack, Poker et Pile ou Face."
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="fr"><body>{children}</body></html>;
}
