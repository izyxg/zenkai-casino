import crypto from "crypto";
import {Hand} from "pokersolver";

export type Suit = "S" | "H" | "D" | "C";
export type Rank = "2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"T"|"J"|"Q"|"K"|"A";
export type Card = `${Rank}${Suit}`;

const suits: Suit[] = ["S", "H", "D", "C"];
const ranks: Rank[] = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];

export function freshDeck(): Card[] {
  return suits.flatMap(s => ranks.map(r => `${r}${s}` as Card));
}

export function shuffle<T>(input: T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function blackjackValue(cards: Card[]) {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = c[0] as Rank;
    if (r === "A") { total += 11; aces++; }
    else if (["T","J","Q","K"].includes(r)) total += 10;
    else total += Number(r);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export type HandScore = { category: number; tiebreak: number[]; label: string };

export function compareScore(a:HandScore,b:HandScore){
  if(a.category!==b.category) return a.category-b.category;
  for(let i=0;i<Math.max(a.tiebreak.length,b.tiebreak.length);i++){const d=(a.tiebreak[i]??0)-(b.tiebreak[i]??0); if(d) return d;}
  return 0;
}

export function bestPokerHand(cards:Card[]):HandScore {
  if(cards.length<5||cards.length>7) throw new Error("Il faut entre 5 et 7 cartes");
  if(cards.some(card=>!isCard(card))||new Set(cards).size!==cards.length) throw new Error("Cartes invalides ou dupliquées");
  const solved=Hand.solve(cards.map(c=>c[0]+c[1].toLowerCase()),"standard");
  const category=solved.rank-1;
  const tiebreak=solved.cards.slice(0,5).map(c=>c.rank+1);
  const labels=["Carte haute","Paire","Double paire","Brelan","Suite","Couleur","Full","Carré","Quinte flush"];
  return {category,tiebreak,label:category===8&&tiebreak[0]===14?"Quinte flush royale":labels[category]};
}

export function isCard(card:unknown):card is Card {
  return typeof card==="string"&&/^[2-9TJQKA][SHDC]$/.test(card);
}
