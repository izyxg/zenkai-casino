import crypto from "crypto";

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

const rankValue: Record<Rank, number> = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14};

export type HandScore = { category: number; tiebreak: number[]; label: string };

function scoreFive(cards: Card[]): HandScore {
  const vals = cards.map(c => rankValue[c[0] as Rank]).sort((a,b)=>b-a);
  const suits5 = cards.map(c=>c[1]);
  const flush = suits5.every(s=>s===suits5[0]);
  const uniq = [...new Set(vals)].sort((a,b)=>b-a);
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0]-uniq[4] === 4) straightHigh = uniq[0];
    else if (JSON.stringify(uniq) === JSON.stringify([14,5,4,3,2])) straightHigh = 5;
  }
  const counts = new Map<number, number>();
  vals.forEach(v=>counts.set(v,(counts.get(v)??0)+1));
  const groups = [...counts.entries()].sort((a,b)=> b[1]-a[1] || b[0]-a[0]);
  if (flush && straightHigh) return {category:8,tiebreak:[straightHigh],label: straightHigh===14 ? "Quinte flush royale" : "Quinte flush"};
  if (groups[0][1]===4) return {category:7,tiebreak:[groups[0][0],groups[1][0]],label:"Carré"};
  if (groups[0][1]===3 && groups[1][1]===2) return {category:6,tiebreak:[groups[0][0],groups[1][0]],label:"Full"};
  if (flush) return {category:5,tiebreak:vals,label:"Couleur"};
  if (straightHigh) return {category:4,tiebreak:[straightHigh],label:"Suite"};
  if (groups[0][1]===3) return {category:3,tiebreak:[groups[0][0],...groups.slice(1).map(x=>x[0]).sort((a,b)=>b-a)],label:"Brelan"};
  if (groups[0][1]===2 && groups[1][1]===2) {
    const pairs=[groups[0][0],groups[1][0]].sort((a,b)=>b-a); const kick=groups.find(x=>x[1]===1)![0];
    return {category:2,tiebreak:[...pairs,kick],label:"Double paire"};
  }
  if (groups[0][1]===2) return {category:1,tiebreak:[groups[0][0],...groups.slice(1).map(x=>x[0]).sort((a,b)=>b-a)],label:"Paire"};
  return {category:0,tiebreak:vals,label:"Carte haute"};
}

function combinations5<T>(arr:T[]) {
  const out:T[][]=[];
  for(let a=0;a<arr.length-4;a++) for(let b=a+1;b<arr.length-3;b++) for(let c=b+1;c<arr.length-2;c++) for(let d=c+1;d<arr.length-1;d++) for(let e=d+1;e<arr.length;e++) out.push([arr[a],arr[b],arr[c],arr[d],arr[e]]);
  return out;
}

export function compareScore(a:HandScore,b:HandScore){
  if(a.category!==b.category) return a.category-b.category;
  for(let i=0;i<Math.max(a.tiebreak.length,b.tiebreak.length);i++){const d=(a.tiebreak[i]??0)-(b.tiebreak[i]??0); if(d) return d;}
  return 0;
}

export function bestPokerHand(cards:Card[]) {
  if(cards.length<5) throw new Error("Il faut au moins 5 cartes");
  let best=scoreFive(combinations5(cards)[0] as Card[]);
  for(const combo of combinations5(cards).slice(1)) { const s=scoreFive(combo as Card[]); if(compareScore(s,best)>0) best=s; }
  return best;
}
