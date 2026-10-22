import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma,withRoomMutation } from "@/lib/prisma";
import { hashToken, newSessionToken } from "@/lib/auth";
import { logEvent } from "@/lib/game-engine";
import {MAX_ROOM_MEMBERS,occupiedSeats} from "@/lib/table-limits";

const schema=z.object({name:z.string().trim().min(2).max(24),code:z.string().trim().min(4).max(8),spectator:z.boolean().optional()});
export async function POST(req:Request){
  try{
    const {name,code,spectator}=schema.parse(await req.json());
    const found=await prisma.room.findUnique({where:{code:code.toUpperCase()},select:{id:true}});
    if(!found) throw new Error("Salon introuvable");
    return await withRoomMutation(found.id,async()=>{
      const room=await prisma.room.findUniqueOrThrow({where:{id:found.id},include:{players:true}});
      if(room.locked) throw new Error("Salon verrouillé");
      if(room.status==="CLOSED") throw new Error("Salon fermé");
      const isSpectator=room.gameType!=="COINFLIP"&&(spectator??room.status==="ACTIVE");
      if(!isSpectator&&occupiedSeats(room.players)>=room.maxPlayers) throw new Error("Tous les sièges sont occupés. Tu peux rejoindre en spectateur.");
      if(room.players.length>=MAX_ROOM_MEMBERS) throw new Error("Le salon a atteint sa limite de visiteurs");
      if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) throw new Error("Ce nom est déjà pris à cette table");
      const token=newSessionToken();
      const p=await prisma.player.create({data:{roomId:room.id,name,sessionHash:hashToken(token),balance:room.startingBalance,isSpectator}});
      await logEvent(room.id,"JOIN",`${name} rejoint la table${isSpectator?" en spectateur":""}.`);
      return NextResponse.json({code:room.code,playerId:p.id,sessionToken:token});
    });
  }catch(e:any){return NextResponse.json({error:e?.issues?.[0]?.message??e.message??"Erreur"},{status:400});}
}
