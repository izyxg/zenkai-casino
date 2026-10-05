import type { Card } from "./cards";

export type CoinState = {
  kind: "COINFLIP";
  commits: Record<string,{bet:number;choice:"PILE"|"FACE"}>;
  result?: "PILE"|"FACE";
  winnerId?: string;
};

export type BlackjackHand = {
  cards: Card[];
  bet:number;
  status:"PLAYING"|"STAND"|"BUST"|"BLACKJACK"|"DONE";
  doubled?:boolean;
  outcome?:"BLACKJACK"|"WIN"|"PUSH"|"LOSS"|"BUST";
  payout?:number;
  net?:number;
};

export type BlackjackState = {
  kind:"BLACKJACK";
  deck:Card[];
  dealer:Card[];
  hands:Record<string,BlackjackHand>;
  order:string[];
  turnIndex:number;
  dealerMode:"AUTO"|"HOST";
  dealerPlayerId?:string;
  dealerPhase:"PLAYERS"|"DEALER"|"SETTLED";
  dealerRevealed:boolean;
  settled?:boolean;
};

export type PokerSeat = { playerId:string; folded:boolean; allIn:boolean; roundBet:number; totalBet:number };
export type PokerState = {
  kind:"POKER";
  deck:Card[];
  board:Card[];
  hole:Record<string,Card[]>;
  seats:PokerSeat[];
  dealerIndex:number;
  currentIndex:number;
  stage:"PREFLOP"|"FLOP"|"TURN"|"RIVER"|"SHOWDOWN";
  currentBet:number;
  minRaise:number;
  pot:number;
  acted:string[];
  winners?:Array<{playerId:string;amount:number;label:string}>;
};

export type AnyGameState = CoinState|BlackjackState|PokerState;
