import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken, newSessionToken } from "@/lib/auth";
import { logEvent } from "@/lib/game-engine";

const schema=z.object({name:z.string().trim().min(2).max(24),code:z.string().trim().min(4).max(8)});
export async function POST(req:Request){
  try{const {name,code}=schema.parse(await req.json()); const room=await prisma.room.findUnique({where:{code:code.toUpperCase()},include:{players:true}}); if(!room) throw new Error("Salon introuvable"); if(room.locked) throw new Error("Salon verrouillé"); if(room.status==="CLOSED") throw new Error("Salon fermé"); if(room.players.length>=room.maxPlayers) throw new Error("Tous les sièges sont occupés"); if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase())) throw new Error("Ce nom est déjà pris à cette table");
    const token=newSessionToken(); const p=await prisma.player.create({data:{roomId:room.id,name,sessionHash:hashToken(token),balance:room.startingBalance}}); await logEvent(room.id,"JOIN",`${name} rejoint la table.`); return NextResponse.json({code:room.code,playerId:p.id,sessionToken:token});
  }catch(e:any){return NextResponse.json({error:e?.issues?.[0]?.message??e.message??"Erreur"},{status:400});}
}
