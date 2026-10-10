import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";
import { blackjackValue, freshDeck, shuffle } from "../cards";
import { chooseBlackjackDealerCard, resolveBlackjackHand } from "../blackjack-rules";
import type { BlackjackState } from "../game-types";
import { changeBalance, logEvent } from "./shared";

function activePlayableHands(state:BlackjackState){
  return Object.values(state.hands).filter(h=>h.status!=="BUST");
}

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
      ?"Au moins un joueur doit confirmer une mise avant de distribuer"
      :"Au moins un joueur doit confirmer une mise valide avant de distribuer");
  }

  const deck=shuffle(freshDeck());
  const hands:BlackjackState["hands"]={};

  // Bets are taken before cards are dealt. Losing hands receive no refund later.
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

  if(state.turnIndex>=state.order.length){
    state.dealerPhase="DEALER";
  }

  return state;
}

export async function settleBlackjack(game:any,state:BlackjackState,autoDraw=true){
  if(state.settled) return;

  let dealerDraws=0;
  if(autoDraw&&activePlayableHands(state).length>0){
    while(blackjackValue(state.dealer)<17){
      state.dealer.push(state.deck.pop()!);
      dealerDraws++;
    }
  }

  const dealerValue=blackjackValue(state.dealer);
  const dealerBust=dealerValue>21;

  for(const [pid,h] of Object.entries(state.hands)){
    const result=resolveBlackjackHand(h.cards,h.bet,h.status,state.dealer);
    h.outcome=result.outcome;
    h.payout=result.payout;
    h.net=result.net;

    if(result.payout>0){
      const type=result.outcome==="PUSH"?"REFUND":"WIN";
      const reason=
        result.outcome==="BLACKJACK"?"Blackjack naturel":
        result.outcome==="WIN"?"Victoire Blackjack":
        "Égalité Blackjack";
      await changeBalance(game.roomId,pid,result.payout,type,reason);
    }

    const player=await prisma.player.findUnique({where:{id:pid}});
    if(player){
      const resultMessage=
        result.outcome==="BUST"
          ?`${player.name} dépasse 21 et perd ${h.bet} Ryôs.`
          :result.outcome==="LOSS"
            ?`${player.name} perd ${h.bet} Ryôs.`
            :result.outcome==="PUSH"
              ?`${player.name} fait égalité et récupère ${h.bet} Ryôs.`
              :result.outcome==="BLACKJACK"
                ?`${player.name} fait Blackjack : +${Math.max(0,result.net)} Ryôs net.`
                :`${player.name} gagne +${Math.max(0,result.net)} Ryôs net.`;
      await logEvent(game.roomId,"BLACKJACK_RESULT",resultMessage,game.id,{
        playerId:pid,
        outcome:result.outcome,
        bet:h.bet,
        payout:result.payout,
        net:result.net
      });
    }

    h.status="DONE";
  }

  state.dealerRevealed=true;
  state.dealerPhase="SETTLED";
  state.settled=true;

  await prisma.$transaction([
    prisma.game.update({
      where:{id:game.id},
      data:{state:state as any,status:"FINISHED",endedAt:new Date()}
    }),
    prisma.room.update({
      where:{id:game.roomId},
      data:{status:"LOBBY"}
    }),
    prisma.player.updateMany({
      where:{roomId:game.roomId},
      data:{currentBet:0}
    })
  ]);

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
    "BLACKJACK_SUMMARY",
    `Le croupier termine à ${dealerValue}${dealerBust?" et saute":""}.`,
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
    if(value>21){
      h.status="BUST";
      eventMessage=`${player.name} tire une carte, monte à ${value} et perd sa mise de ${h.bet} Ryôs.`;
    }else if(value===21){
      h.status="STAND";
      eventMessage=`${player.name} tire une carte et atteint 21.`;
    }else{
      eventMessage=`${player.name} tire une carte et passe à ${value}.`;
    }
  }

  if(action==="STAND"){
    const value=blackjackValue(h.cards);
    h.status="STAND";
    eventMessage=`${player.name} reste à ${value}.`;
  }

  if(action==="DOUBLE"){
    if(h.cards.length!==2) throw new Error("Tu peux doubler uniquement avec tes 2 premières cartes");
    if(player.balance<h.bet) throw new Error("Solde insuffisant pour doubler");

    await changeBalance(game.roomId,playerId,-h.bet,"BET","Double Blackjack");
    h.bet*=2;
    h.doubled=true;
    h.cards.push(state.deck.pop()!);

    const value=blackjackValue(h.cards);
    h.status=value>21?"BUST":"STAND";
    eventMessage=value>21
      ?`${player.name} double à ${h.bet} Ryôs, tire ${value} et perd la mise.`
      :`${player.name} double à ${h.bet} Ryôs, tire une dernière carte et reste à ${value}.`;
  }

  if(eventMessage){
    await logEvent(game.roomId,"BLACKJACK_ACTION",eventMessage,game.id);
  }

  if(h.status!=="PLAYING") state.turnIndex++;

  while(
    state.turnIndex<state.order.length&&
    state.hands[state.order[state.turnIndex]].status!=="PLAYING"
  ){
    state.turnIndex++;
  }

  if(state.turnIndex>=state.order.length){
    // If everyone busted, there is no reason to make the dealer draw.
    if(activePlayableHands(state).length===0){
      return settleBlackjack(game,state,false);
    }

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

export async function blackjackDealerAction(gameId:string,playerId:string,action:"REVEAL"|"DRAW"|"SETTLE",card?:unknown){
  const game=await prisma.game.findUniqueOrThrow({where:{id:gameId}});
  const state=structuredClone(game.state) as unknown as BlackjackState;

  if(game.status!=="ACTIVE"||state.kind!=="BLACKJACK"||state.settled) throw new Error("La manche est déjà terminée");
  if(state.dealerMode!=="HOST"||state.dealerPlayerId!==playerId) throw new Error("Action réservée au croupier");
  if(state.dealerPhase!=="DEALER") throw new Error("Attends que tous les joueurs aient terminé");
  if(!["REVEAL","DRAW","SETTLE"].includes(action)) throw new Error("Action croupier inconnue");

  async function saveChoice(){
    const saved=await prisma.game.updateMany({
      where:{id:game.id,status:"ACTIVE",state:{equals:game.state as Prisma.InputJsonObject}},
      data:{state:state as any}
    });
    if(saved.count!==1) throw new Error("La main a changé. Actualise la table avant de choisir une carte.");
  }

  if(action==="REVEAL"){
    chooseBlackjackDealerCard(state,"REVEAL",card);
    await saveChoice();
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
    chooseBlackjackDealerCard(state,"DRAW",card);
    const nextValue=blackjackValue(state.dealer);
    await saveChoice();
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
