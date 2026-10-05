import { blackjackValue, type Card } from "./cards";

export type BlackjackOutcome="BLACKJACK"|"WIN"|"PUSH"|"LOSS"|"BUST";

export function resolveBlackjackHand(
  cards:Card[],
  bet:number,
  status:string,
  dealer:Card[]
):{outcome:BlackjackOutcome;payout:number;net:number;playerValue:number;dealerValue:number}{
  const playerValue=blackjackValue(cards);
  const dealerValue=blackjackValue(dealer);
  const playerBust=status==="BUST"||playerValue>21;
  const playerNatural=status==="BLACKJACK"&&cards.length===2&&playerValue===21;
  const dealerNatural=dealer.length===2&&dealerValue===21;
  const dealerBust=dealerValue>21;

  let outcome:BlackjackOutcome="LOSS";
  let payout=0;

  // A player who busts always loses, even if the dealer later busts too.
  if(playerBust){
    outcome="BUST";
  }else if(playerNatural&&dealerNatural){
    outcome="PUSH";
    payout=bet;
  }else if(playerNatural){
    outcome="BLACKJACK";
    payout=Math.floor(bet*2.5);
  }else if(dealerNatural){
    outcome="LOSS";
  }else if(dealerBust||playerValue>dealerValue){
    outcome="WIN";
    payout=bet*2;
  }else if(playerValue===dealerValue){
    outcome="PUSH";
    payout=bet;
  }

  return {outcome,payout,net:payout-bet,playerValue,dealerValue};
}
