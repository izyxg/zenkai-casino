export function handTotal(cards: readonly string[]) {
  if(cards.some(c=>c==="??")) return null;
  let total=0,aces=0;
  for(const c of cards) {
    if(c[0]==="A"){total+=11;aces++;}
    else total+=["T","J","Q","K"].includes(c[0])?10:Number(c[0]);
  }
  while(total>21&&aces>0){total-=10;aces--;}
  return total;
}
export const blackjackLabels:Record<string,string>={PLAYING:"En jeu",STAND:"Reste",BUST:"Dépassé",BLACKJACK:"Blackjack",DONE:"Terminé"};
export function blackjackOutcome(hand?:{outcome?:string;bet:number;net?:number}) {
  if(!hand?.outcome) return "La manche est terminée.";
  if(hand.outcome==="PUSH") return "Égalité · votre mise vous est rendue.";
  if(hand.outcome==="BUST"||hand.outcome==="LOSS") return "Mise perdue : "+hand.bet.toLocaleString("fr-FR")+" Ryôs.";
  return (hand.outcome==="BLACKJACK"?"Blackjack":"Victoire")+" · +"+Math.max(0,hand.net??0).toLocaleString("fr-FR")+" Ryôs nets.";
}
