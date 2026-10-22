import type { PokerState } from "./game-types";
import {canReopenRaise,hasRaiseOpponent,pokerCallAmount,pokerPotLayers} from "./poker-rules";

export function pokerControls(state: PokerState, playerId: string, balance: number) {
  const seat=state.seats.find(s=>s.playerId===playerId);
  const contributed=seat?.roundBet??0;
  const call=pokerCallAmount(state,playerId);
  const minRaise=state.currentBet+state.minRaise;
  const maxRaise=contributed+balance;
  const reopened=canReopenRaise(state,playerId);
  const opponent=hasRaiseOpponent(state,playerId);
  return {seat,call,callPayment:Math.min(call,balance),minRaise,maxRaise,
    canRaise:!!seat&&!seat.folded&&!seat.allIn&&opponent&&reopened&&maxRaise>=minRaise,
    canAllIn:!!seat&&!seat.folded&&!seat.allIn&&balance>0&&(opponent&&reopened||balance<=call),
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
  return pokerPotLayers(state.seats).filter(p=>p.contributors.length>1).map(p=>p.amount);
}
