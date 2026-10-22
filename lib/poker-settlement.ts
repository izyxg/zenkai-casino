import {bestPokerHand,compareScore,isCard} from "./cards";
import type {PokerState} from "./game-types";
import {pokerPotLayers} from "./poker-rules";

export function pokerAwards(state:PokerState){
  const live=state.seats.filter(s=>!s.folded);
  if(!live.length) throw new Error("Aucune main en jeu");
  if(state.board.length!==5) throw new Error("Le tableau est incomplet");
  const dealt=[...state.board,...state.seats.flatMap(s=>state.hole[s.playerId]??[])];
  if(dealt.some(c=>!isCard(c))||new Set(dealt).size!==dealt.length) throw new Error("Distribution invalide");
  const scores=new Map(live.map(s=>[s.playerId,bestPokerHand([...state.hole[s.playerId],...state.board])]));
  const awards=new Map<string,number>();
  for(const pot of pokerPotLayers(state.seats)){
    if(!pot.eligible.length) throw new Error("Pot sans main éligible : annulez la manche pour rembourser");
    let winners=[pot.eligible[0]];
    for(const seat of pot.eligible.slice(1)){
      const compared=compareScore(scores.get(seat.playerId)!,scores.get(winners[0].playerId)!);
      if(compared>0) winners=[seat];
      else if(compared===0) winners.push(seat);
    }
    // Odd chips go clockwise from the seat immediately left of the button.
    const order=(id:string)=>(state.seats.findIndex(s=>s.playerId===id)-state.dealerIndex-1+state.seats.length)%state.seats.length;
    winners.sort((a,b)=>order(a.playerId)-order(b.playerId));
    const share=Math.floor(pot.amount/winners.length),remainder=pot.amount%winners.length;
    winners.forEach((w,i)=>awards.set(w.playerId,(awards.get(w.playerId)??0)+share+(i<remainder?1:0)));
  }
  if([...awards.values()].reduce((a,b)=>a+b,0)!==state.pot) throw new Error("Le pot ne correspond pas aux mises");
  return [...awards].map(([playerId,amount])=>({playerId,amount,label:scores.get(playerId)!.label}));
}
