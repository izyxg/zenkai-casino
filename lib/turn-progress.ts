import type {AnyGameState,BlackjackState,PokerState} from "./game-types";

export function isHandParticipant(state:AnyGameState,playerId:string) {
  if(state.kind==="BLACKJACK") return !!state.hands[playerId]||state.dealerMode==="HOST"&&state.dealerPlayerId===playerId;
  if(state.kind==="POKER") return state.seats.some(s=>s.playerId===playerId);
  return !!state.commits[playerId];
}

export function blackjackTurnIndex(state:BlackjackState) {
  let i=Math.max(0,Number.isInteger(state.turnIndex)?state.turnIndex:0);
  while(i<state.order.length){
    const hand=state.hands[state.order[i]];
    if(hand?.status==="PLAYING"&&hand.bet>0&&hand.cards.length>=2) break;
    i++;
  }
  return i;
}

export function validPokerSeat(state:PokerState,playerId:string) {
  return state.hole[playerId]?.length===2;
}

export function needsTurnRepair(state:AnyGameState) {
  if(state.kind==="BLACKJACK") return !state.settled&&state.dealerPhase==="PLAYERS"&&
    (blackjackTurnIndex(state)!==state.turnIndex||state.turnIndex>=state.order.length);
  if(state.kind!=="POKER"||state.stage==="SHOWDOWN") return false;
  const current=state.seats[state.currentIndex];
  return !current||current.folded||current.allIn||
    state.seats.some(s=>!s.folded&&!validPokerSeat(state,s.playerId));
}

export function turnKey(state:AnyGameState) {
  if(state.kind==="BLACKJACK") return [state.kind,state.dealerPhase,state.turnIndex,state.dealer.length,
    state.dealerRevealed,...Object.entries(state.hands).map(([id,h])=>[id,h.status,h.cards.length,h.bet].join("/"))].join(":");
  if(state.kind==="POKER") return [state.kind,state.stage,state.currentIndex,state.pot,state.currentBet,
    state.acted.join(","),...state.seats.map(s=>[s.playerId,s.folded,s.allIn,s.roundBet].join("/"))].join(":");
  return "COINFLIP:"+Object.keys(state.commits).sort().join(",");
}
