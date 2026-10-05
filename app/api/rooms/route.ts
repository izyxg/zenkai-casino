import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken, newSessionToken, randomRoomCode } from "@/lib/auth";
import { logEvent } from "@/lib/game-engine";

const schema=z.object({name:z.string().trim().min(2).max(24),gameType:z.enum(["COINFLIP","BLACKJACK","POKER"]),minBet:z.coerce.number().int().min(1),maxBet:z.coerce.number().int().min(1),maxPlayers:z.coerce.number().int().min(2).max(8),startingBalance:z.coerce.number().int().min(100)}).refine(x=>x.maxBet>=x.minBet,{message:"La mise max doit être supérieure à la mise min"});

export async function POST(req:Request){
  try{
    const raw=schema.parse(await req.json()); const data={...raw,maxPlayers:raw.gameType==="COINFLIP"?2:raw.maxPlayers}; let code=""; for(let i=0;i<10;i++){const c=randomRoomCode(); if(!(await prisma.room.findUnique({where:{code:c}}))){code=c;break;}} if(!code) throw new Error("Impossible de générer un code");
    const token=newSessionToken();
    const room=await prisma.room.create({data:{code,...data,players:{create:{name:data.name,sessionHash:hashToken(token),balance:data.startingBalance,isHost:true}}},include:{players:true}});
    const player=room.players[0]; await logEvent(room.id,"JOIN",`${player.name} crée la table ${room.code}.`);
    return NextResponse.json({code:room.code,playerId:player.id,sessionToken:token});
  }catch(e:any){return NextResponse.json({error:e?.issues?.[0]?.message??e.message??"Erreur"},{status:400});}
}
