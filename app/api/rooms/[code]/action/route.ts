import { NextResponse } from "next/server";
import { authenticatePlayer, roomSnapshot } from "@/lib/room";
import { prisma } from "@/lib/prisma";
import { validateCapacity } from "@/lib/table-limits";
import {
  blackjackAction,
  blackjackDealerAction,
  coinCommit,
  logEvent,
  pokerAction,
  setBet,
  startGame
} from "@/lib/game-engine";

export async function POST(req:Request,{params}:{params:Promise<{code:string}>}){
  try{
    const {code}=await params;
    const body=await req.json();
    const {playerId,sessionToken,action,payload={}}=body;
    const {room,player}=await authenticatePlayer(code,playerId,sessionToken);

    const active=await prisma.game.findFirst({
      where:{roomId:room.id,status:"ACTIVE"},
      orderBy:{startedAt:"desc"}
    });

    if(action==="SET_BET"){
      await setBet(player.id,Number(payload.bet));
      await logEvent(room.id,"BET_SET",`${player.name} prépare une mise de ${Number(payload.bet)} Ryôs.`);
    }else if(action==="SET_DEALER_MODE"){
      if(!player.isHost) throw new Error("Hôte uniquement");
      if(room.gameType!=="BLACKJACK") throw new Error("Disponible uniquement au Blackjack");
      if(active) throw new Error("Impossible pendant une partie");
      const mode=payload.mode==="HOST"?"HOST":"AUTO";
      await prisma.room.update({where:{id:room.id},data:{blackjackDealerMode:mode}});
      if(mode==="HOST"){
        await prisma.player.update({where:{id:player.id},data:{currentBet:0}});
      }
      await logEvent(room.id,"ROOM",mode==="HOST"?`${player.name} prend la place du croupier.`:"Le croupier automatique reprend la table.");
    }else if(action==="START_GAME"){
      await startGame(room.id,player.id);
    }else if(action==="COIN_COMMIT"){
      if(!active) throw new Error("Aucune partie active");
      await coinCommit(active.id,player.id,Number(payload.bet),payload.choice);
    }else if(action==="BLACKJACK"){
      if(!active) throw new Error("Aucune partie active");
      await blackjackAction(active.id,player.id,payload.move);
    }else if(action==="BLACKJACK_DEALER"){
      if(!active) throw new Error("Aucune partie active");
      await blackjackDealerAction(active.id,player.id,payload.move,payload.card);
    }else if(action==="POKER"){
      if(!active) throw new Error("Aucune partie active");
      await pokerAction(active.id,player.id,payload.move,payload.amount?Number(payload.amount):undefined);
    }else if(action==="LOCK"){
      if(!player.isHost) throw new Error("Hôte uniquement");
      await prisma.room.update({where:{id:room.id},data:{locked:!!payload.locked}});
      await logEvent(room.id,"ROOM",`${player.name} ${payload.locked?"verrouille":"déverrouille"} le salon.`);
    }else if(action==="SET_PLAYER_BALANCE"){
      if(!player.isHost) throw new Error("Action réservée à l'hôte");
      if(room.status==="CLOSED") throw new Error("Salon fermé");
      if(active) throw new Error("Impossible de modifier un solde pendant une partie");
      const targetId=payload?.playerId;
      const balance=payload?.balance;
      if(typeof targetId!=="string"||!Number.isSafeInteger(balance)||balance<0||balance>1_000_000_000){
        throw new Error("Joueur ou solde invalide (0 à 1 milliard de Ryôs)");
      }

      // Update the wallet, transaction ledger and room journal atomically.
      await prisma.$transaction(async tx=>{
        const currentRoom=await tx.room.findUnique({where:{id:room.id},select:{status:true,maxBet:true}});
        if(!currentRoom||currentRoom.status!=="LOBBY") throw new Error("La table doit être ouverte et hors partie");
        const runningGame=await tx.game.findFirst({where:{roomId:room.id,status:"ACTIVE"},select:{id:true}});
        if(runningGame) throw new Error("Impossible de modifier un solde pendant une partie");
        const target=await tx.player.findFirst({where:{id:targetId,roomId:room.id}});
        if(!target) throw new Error("Joueur introuvable dans ce salon");
        const delta=balance-target.balance;
        const increasedLimit=balance>currentRoom.maxBet;
        if(delta===0&&!increasedLimit) return;
        // The table's maximum stake follows host-granted wallet amounts.
        // The new limit applies consistently to every player in the room.
        if(increasedLimit){
          await tx.room.update({where:{id:room.id},data:{maxBet:balance}});
        }
        if(delta!==0){
          // The player must reconfirm any pending wager after an adjustment.
          await tx.player.update({where:{id:target.id},data:{balance,currentBet:0}});
          await tx.transaction.create({data:{
            roomId:room.id,playerId:target.id,amount:delta,balanceAfter:balance,
            type:"HOST_ADJUST",reason:`Ajustement du solde par ${player.name}`
          }});
        }
        await tx.gameEvent.create({data:{
          roomId:room.id,type:delta===0?"BET_LIMIT_ADJUST":"BALANCE_ADJUST",
          message:delta===0
            ?`${player.name} relève la mise maximale à ${balance.toLocaleString("fr-FR")} Ryôs.`
            :`${player.name} règle le solde de ${target.name} à ${balance.toLocaleString("fr-FR")} Ryôs.`+
              (increasedLimit?` Mise maximale : ${balance.toLocaleString("fr-FR")} Ryôs.`:""),
          payload:{playerId:target.id,previousBalance:target.balance,newBalance:balance,delta,
            ...(increasedLimit?{previousMaxBet:currentRoom.maxBet,newMaxBet:balance}:{})}
        }});
      });
    }else if(action==="SET_CAPACITY"){
      if(!player.isHost) throw new Error("Hôte uniquement");
      if(room.status==="CLOSED"||active) throw new Error("La capacité se règle entre les manches");
      await prisma.$transaction(async tx=>{
        const current=await tx.room.findUniqueOrThrow({where:{id:room.id},include:{_count:{select:{players:true}}}});
        if(current.status!=="LOBBY") throw new Error("La capacité se règle entre les manches");
        const maxPlayers=validateCapacity(current.gameType,payload.maxPlayers,current._count.players);
        await tx.room.update({where:{id:room.id},data:{maxPlayers}});
        await tx.gameEvent.create({data:{roomId:room.id,type:"ROOM",message:`Capacité du salon : ${maxPlayers} sièges.`}});
      });
    }else if(action==="RESET_BALANCES"){
      if(!player.isHost) throw new Error("Hôte uniquement");
      if(active) throw new Error("Impossible pendant une partie");
      await prisma.player.updateMany({
        where:{roomId:room.id},
        data:{balance:room.startingBalance,currentBet:0}
      });
      await logEvent(room.id,"RESET",`Les soldes sont remis à ${room.startingBalance} Ryôs.`);
    }else if(action==="KICK"){
      if(!player.isHost) throw new Error("Hôte uniquement");
      if(active) throw new Error("Impossible pendant une partie");
      const target=await prisma.player.findFirst({
        where:{id:String(payload.playerId),roomId:room.id}
      });
      if(!target||target.isHost) throw new Error("Joueur invalide");
      await prisma.player.delete({where:{id:target.id}});
      await logEvent(room.id,"KICK",`${target.name} quitte la table sur décision de l’hôte.`);
    }else if(action==="CLOSE"){
      if(!player.isHost) throw new Error("Hôte uniquement");
      if(active) throw new Error("Terminez la partie avant de fermer le salon");
      await prisma.room.update({where:{id:room.id},data:{status:"CLOSED",locked:true}});
      await logEvent(room.id,"CLOSE",`${player.name} ferme le salon.`);
    }else{
      throw new Error("Action inconnue");
    }

    const snapshot=await roomSnapshot(code,player.id);
    return NextResponse.json({ok:true,snapshot});
  }catch(e:any){
    return NextResponse.json({error:e.message??"Erreur"},{status:400});
  }
}
