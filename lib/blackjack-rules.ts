import { blackjackValue, freshDeck, type Card } from "./cards";
import type { BlackjackState } from "./game-types";

export function blackjackDealerChoices(state:BlackjackState):Card[]{
  const available=new Set(state.deck);
  if(!state.dealerRevealed&&state.dealer[1]) available.add(state.dealer[1]);
  if(state.dealerRevealed&&blackjackValue(state.dealer)>=17) return [];
  return freshDeck().filter(card=>available.has(card));
}

export function chooseBlackjackDealerCard(state:BlackjackState,move:"REVEAL"|"DRAW",selection:unknown){
  if(typeof selection!=="string"||!/^([2-9TJQKA])([SHDC])$/.test(selection)){
    throw new Error("Choisis une carte valide");
  }
  const card=selection as Card;

  if(move==="REVEAL"){
    if(state.dealerRevealed) throw new Error("La carte cachée est déjà révélée");
    const hidden=state.dealer[1];
    if(!hidden) throw new Error("Carte cachée introuvable");
    if(card!==hidden){
      const index=state.deck.indexOf(card);
      if(index<0) throw new Error("Cette carte n'est plus disponible");
      // Swap rather than duplicate: the old hidden card goes back into the deck.
      state.deck[index]=hidden;
      state.dealer[1]=card;
    }
    state.dealerRevealed=true;
    return;
  }

  if(!state.dealerRevealed) throw new Error("Révèle d'abord la carte cachée");
  if(blackjackValue(state.dealer)>=17) throw new Error("À 17 ou plus, le croupier doit rester");
  const index=state.deck.indexOf(card);
  if(index<0) throw new Error("Cette carte n'est plus disponible");
  state.deck.splice(index,1);
  state.dealer.push(card);
}

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
