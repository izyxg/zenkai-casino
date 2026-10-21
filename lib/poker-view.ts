import type { PokerState } from "./game-types";
import {canReopenRaise} from "./poker-rules";

export function pokerControls(state: PokerState, playerId: string, balance: number) {
  const seat=state.seats.find(s=>s.playerId===playerId);
  const contributed=seat?.roundBet??0;
  const call=Math.max(0,state.currentBet-contributed);
  const minRaise=state.currentBet+state.minRaise;
  const maxRaise=contributed+balance;
  const reopened=canReopenRaise(state,playerId);
  return {seat,call,callPayment:Math.min(call,balance),minRaise,maxRaise,
    canRaise:!!seat&&!seat.folded&&!seat.allIn&&reopened&&maxRaise>=minRaise,
    canAllIn:!!seat&&!seat.folded&&!seat.allIn&&balance>0&&(reopened||balance<=call),
    presets:[{label:"Minimum",amount:minRaise},
      {label:"½ pot",amount:contributed+call+Math.ceil((state.pot+call)/2)},
      {label:"Pot",amount:contributed+call+state.pot+call}]
      .map(p=>({...p,amount:Math.max(minRaise,Math.min(maxRaise,p.amount))}))};
}

export function pokerPositions(state: PokerState, index: number) {
  const count=state.seats.length;
  const small=count===2?state.dealerIndex:(state.dealerIndex+1)%count;
  const big=(small+1)%count;
  return [index===state.dealerIndex?"D":null,index===small?"SB":null,index===big?"BB":null].filter(Boolean);
}

export function pokerPots(state: PokerState) {
  const levels=[...new Set(state.seats.map(s=>s.totalBet).filter(n=>n>0))].sort((a,b)=>a-b);
  let previous=0;
  return levels.map(level=>{
    const amount=(level-previous)*state.seats.filter(s=>s.totalBet>=level).length;
    previous=level;
    return amount;
  });
}
