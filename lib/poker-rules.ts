import type {PokerState} from "./game-types";

export function canReopenRaise(state:PokerState,playerId:string) {
  if(!state.acted.includes(playerId)) return true;
  const previous=state.lastActionBet?.[playerId];
  return previous!==undefined&&state.currentBet-previous>=state.minRaise;
}
