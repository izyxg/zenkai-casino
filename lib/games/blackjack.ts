import { prisma } from "../prisma";
import { blackjackValue, freshDeck, shuffle } from "../cards";
import type { BlackjackState } from "../game-types";
import { changeBalance, logEvent } from "./shared";

export async function newBlackjackState(room:any):Promise<BlackjackState>{
  const dealerMode:BlackjackState["dealerMode"]=room.blackjackDealerMode==="HOST"?"HOST":"AUTO";
  const dealerPlayer=dealerMode==="HOST"?room.players.find((p:any)=>p.isHost):undefined;
  if(dealerMode==="HOST"&&!dealerPlayer) throw new Error("Croupier introuvable");

  const eligible=room.players.filter((p:any)=>{
    if(dealerMode==="HOST"&&p.isHost) return false;
    return p.currentBet>=room.minBet&&p.currentBet<=room.maxBet&&p.balance>=p.currentBet;
  });
  if(!eligible.length){
    throw new Error(dealerMode==="HOST"
      ?"Au moins un joueur doit confirmer une mise avant de lancer"
      :"Au moins un joueur doit confirmer une mise valide avant de lancer");
  }

  const deck=shuffle(freshDeck());
  const hands:BlackjackState["hands"]={};

  for(const p of eligible){
    await changeBalance(room.id,p.id,-p.currentBet,"BET","Mise Blackjack");
    hands[p.id]={cards:[deck.pop()!,deck.pop()!],bet:p.currentBet,status:"PLAYING"};
  }

  const dealer=[deck.pop()!,deck.pop()!];
  for(const h of Object.values(hands)){
    if(blackjackValue(h.cards)===21) h.status="BLACKJACK";
  }

  const state:BlackjackState={
    kind:"BLACKJACK",
    deck,
    dealer,
    hands,
    order:eligible.map((p:any)=>p.id),
    turnIndex:0,
    dealerMode,
    dealerPlayerId:dealerPlayer?.id,
    dealerPhase:"PLAYERS",
    dealerRevealed:false
  };

  while(state.turnIndex<state.order.length&&state.hands[state.order[state.turnIndex]].status!=="PLAYING"){
    state.turnIndex++;
  }

  if(state.turnIndex>=state.order.length&&dealerMode==="HOST"){
    state.dealerPhase="DEALER";
  }

  return state;
}

export async function settleBlackjack(game:any,state:BlackjackState,autoDraw=true){
  let dealerDraws=0;
  if(autoDraw){
    while(blackjackValue(state.dealer)<17){
      state.dealer.push(state.deck.pop()!);
      dealerDraws++;
    }
  }

  const dv=blackjackValue(state.dealer);
  const dealerBust=dv>21;

  for(const [pid,h] of Object.entries(state.hands)){
    const v=blackjackValue(h.cards);
    let payout=0;
    let reason="Défaite Blackjack";

    if(h.status==="BLACKJACK"&&state.dealer.length===2&&dv===21){
      payout=h.bet;
      reason="Égalité Blackjack";
    }else if(h.status==="BLACKJACK"){
      payout=Math.floor(h.bet*2.5);
      reason="Blackjack naturel";
    }else if(v<=21&&(dealerBust||v>dv)){
      payout=h.bet*2;
      reason="Victoire Blackjack";
    }else if(v===dv){
      payout=h.bet;
      reason="Égalité Blackjack";
    }

    if(payout){
      await changeBalance(game.roomId,pid,payout,payout===h.bet?"REFUND":"WIN",reason);
    }
    h.status="DONE";
  }

  state.dealerRevealed=true;
  state.dealerPhase="SETTLED";
  state.settled=true;

  await prisma.game.update({
    where:{id:game.id},
    data:{state:state as any,status:"FINISHED",endedAt:new Date()}
  });
  await prisma.room.update({where:{id:game.roomId},data:{status:"LOBBY"}});

  if(dealerDraws>0){
    await logEvent(
      game.roomId,
      "BLACKJACK_DEALER",
      `Le croupier révèle sa main et tire ${dealerDraws} carte${dealerDraws>1?"s":""}.`,
      game.id
    );
  }else{
    await logEvent(game.roomId,"BLACKJACK_DEALER","Le croupier révèle sa main.",game.id);
  }
  await logEvent(
    game.roomId,
    "BLACKJACK_RESULT",
    `Le croupier termine à ${dv}${dealerBust?" et saute":""}.`,
    game.id
  );
}

export async function blackjackAction(gameId:string,playerId:string,action:"HIT"|"STAND"|"DOUBLE"){
  const game=await prisma.game.findUniqueOrThrow({where:{id:gameId}});
  const state=game.state as unknown as BlackjackState;

  if(state.kind!=="BLACKJACK"||state.settled) throw new Error("La manche est déjà terminée");
  if(state.dealerPhase!=="PLAYERS") throw new Error("Le tour des joueurs est terminé");
  if(state.order[state.turnIndex]!==playerId) throw new Error("Attends ton tour");

  const h=state.hands[playerId];
  if(!h||h.status!=="PLAYING") throw new Error("Ta main n'est plus active");
  const player=await prisma.player.findUniqueOrThrow({where:{id:playerId}});

  let eventMessage="";

  if(action==="HIT"){
    h.cards.push(state.deck.pop()!);
    const value=blackjackValue(h.cards);
    if(value>21) h.status="BUST";
    eventMessage=value>21
      ?`${player.name} tire une carte et dépasse 21.`
      :`${player.name} tire une carte.`;
  }

  if(action==="STAND"){
    h.status="STAND";
    eventMessage=`${player.name} reste à ${blackjackValue(h.cards)}.`;
  }

  if(action==="DOUBLE"){
    if(h.cards.length!==2) throw new Error("Tu peux doubler uniquement avec tes 2 premières cartes");
    if(player.balance<h.bet) throw new Error("Solde insuffisant pour doubler");
    await changeBalance(game.roomId,playerId,-h.bet,"BET","Double Blackjack");
    h.bet*=2;
    h.doubled=true;
    h.cards.push(state.deck.pop()!);
    h.status=blackjackValue(h.cards)>21?"BUST":"STAND";
    eventMessage=`${player.name} double sa mise à ${h.bet} Ryôs et tire une dernière carte.`;
  }

  if(eventMessage){
    await logEvent(game.roomId,"BLACKJACK_ACTION",eventMessage,game.id);
  }

  if(h.status!=="PLAYING") state.turnIndex++;
  while(state.turnIndex<state.order.length&&state.hands[state.order[state.turnIndex]].status!=="PLAYING"){
    state.turnIndex++;
  }

  if(state.turnIndex>=state.order.length){
    if(state.dealerMode==="AUTO"){
      return settleBlackjack(game,state,true);
    }
    state.dealerPhase="DEALER";
    await prisma.game.update({where:{id:game.id},data:{state:state as any}});
    await logEvent(game.roomId,"BLACKJACK_DEALER","Tous les joueurs ont fini. Le croupier prend la main.",game.id);
    return;
  }

  await prisma.game.update({where:{id:game.id},data:{state:state as any}});
}

export async function blackjackDealerAction(gameId:string,playerId:string,action:"REVEAL"|"DRAW"|"SETTLE"){
  const game=await prisma.game.findUniqueOrThrow({where:{id:gameId}});
  const state=game.state as unknown as BlackjackState;

  if(state.kind!=="BLACKJACK"||state.settled) throw new Error("La manche est déjà terminée");
  if(state.dealerMode!=="HOST"||state.dealerPlayerId!==playerId) throw new Error("Action réservée au croupier");
  if(state.dealerPhase!=="DEALER") throw new Error("Attends que tous les joueurs aient terminé");

  if(action==="REVEAL"){
    if(state.dealerRevealed) throw new Error("La carte cachée est déjà révélée");
    state.dealerRevealed=true;
    await prisma.game.update({where:{id:game.id},data:{state:state as any}});
    await logEvent(
      game.roomId,
      "BLACKJACK_DEALER",
      `Le croupier révèle sa main : ${blackjackValue(state.dealer)}.`,
      game.id
    );
    return;
  }

  if(!state.dealerRevealed) throw new Error("Révèle d'abord la carte cachée");

  const value=blackjackValue(state.dealer);

  if(action==="DRAW"){
    if(value>=17) throw new Error("À 17 ou plus, le croupier doit rester");
    state.dealer.push(state.deck.pop()!);
    const nextValue=blackjackValue(state.dealer);
    await prisma.game.update({where:{id:game.id},data:{state:state as any}});
    await logEvent(
      game.roomId,
      "BLACKJACK_DEALER",
      `Le croupier tire une carte et passe à ${nextValue}.`,
      game.id
    );
    return;
  }

  if(action==="SETTLE"){
    if(value<17) throw new Error("Le croupier doit tirer jusqu'à 17");
    return settleBlackjack(game,state,false);
  }
}
