import type {PokerSeat,PokerState} from "./game-types";

export function canReopenRaise(state:PokerState,playerId:string) {
  if(!state.acted.includes(playerId)) return true;
  const previous=state.lastActionBet?.[playerId];
  return previous!==undefined&&state.currentBet-previous>=state.minRaise;
}

export function hasRaiseOpponent(state:PokerState,playerId:string){
  return state.seats.some(s=>s.playerId!==playerId&&!s.folded&&!s.allIn);
}

export function pokerCallAmount(state:PokerState,playerId:string){
  const seat=state.seats.find(s=>s.playerId===playerId);
  const highestOpponent=Math.max(0,...state.seats.filter(s=>s.playerId!==playerId&&!s.folded).map(s=>s.roundBet));
  const target=hasRaiseOpponent(state,playerId)?state.currentBet:Math.min(state.currentBet,highestOpponent);
  return Math.max(0,target-(seat?.roundBet??0));
}

export function pokerPotLayers(seats:PokerSeat[]){
  const levels=[...new Set(seats.map(s=>s.totalBet).filter(n=>n>0))].sort((a,b)=>a-b);
  let previous=0;
  return levels.map(level=>{
    const contributors=seats.filter(s=>s.totalBet>=level);
    const amount=(level-previous)*contributors.length;
    previous=level;
    return {amount,contributors,eligible:contributors.filter(s=>!s.folded)};
  });
}

export function nextPokerDealer(ids:string[],previousId?:string,previousOrder?:string[]){
  if(previousId&&previousOrder?.includes(previousId)){
    const index=previousOrder.indexOf(previousId);
    for(let step=1;step<=previousOrder.length;step++){
      const next=ids.indexOf(previousOrder[(index+step)%previousOrder.length]);
      if(next>=0) return next;
    }
  }
  const previous=ids.indexOf(previousId??"");
  return previous<0?0:(previous+1)%ids.length;
}
