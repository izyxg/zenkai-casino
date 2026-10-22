import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken, newSessionToken, randomRoomCode } from "@/lib/auth";
import { logEvent } from "@/lib/game-engine";
import { timingSafeEqual } from "crypto";
import { MAX_TABLE_PLAYERS } from "@/lib/table-limits";

const schema=z.object({
  accessCode:z.string().min(1).max(128),
  name:z.string().trim().min(2).max(24),
  gameType:z.enum(["COINFLIP","BLACKJACK","POKER"]),
  minBet:z.coerce.number().int().min(1).max(1000000000),
  maxBet:z.coerce.number().int().min(1).max(1000000000),
  maxPlayers:z.coerce.number().int().min(2).max(MAX_TABLE_PLAYERS),
  startingBalance:z.coerce.number().int().min(100).max(1000000000),
  blackjackDealerMode:z.enum(["AUTO","HOST"]).optional().default("AUTO"),
  hostSpectator:z.boolean().optional().default(false)
})
  .refine(x=>x.maxBet>=x.minBet,{message:"La mise max doit être supérieure à la mise min"})
  .refine(x=>x.gameType!=="POKER"||x.minBet<=500000000&&x.startingBalance*x.maxPlayers<=2000000000,{message:"Le capital total du poker doit rester inférieur ou égal à 2 milliards de Ryôs"})
  .refine(x=>!x.hostSpectator||x.gameType==="POKER",{message:"Hôte spectateur disponible au poker uniquement"});

export async function POST(req:Request){
  try{
    const raw=schema.parse(await req.json());
    const manualCode=process.env.ROOM_CREATE_CODE;
    const randomCode=process.env.ROOM_CREATE_RANDOM_CODE;
    if(!manualCode||!randomCode||manualCode===randomCode) throw new Error("La création de room est temporairement indisponible");

    const provided=Buffer.from(raw.accessCode);
    const matches=(value:string)=>{
      const expected=Buffer.from(value);
      return provided.length===expected.length&&timingSafeEqual(provided,expected);
    };
    const dealerCardChoiceEnabled=matches(manualCode);
    const randomAuthorized=matches(randomCode);
    const authorized=dealerCardChoiceEnabled||randomAuthorized;
    if(!authorized){
      return NextResponse.json({error:"Code de création incorrect"},{status:403});
    }

    const {
      name,
      gameType,
      minBet,
      maxBet,
      maxPlayers,
      startingBalance,
      blackjackDealerMode
    }=raw;

    const roomMaxPlayers=gameType==="COINFLIP"?2:maxPlayers;

    let code="";
    for(let i=0;i<10;i++){
      const candidate=randomRoomCode();
      if(!(await prisma.room.findUnique({where:{code:candidate}}))){
        code=candidate;
        break;
      }
    }
    if(!code) throw new Error("Impossible de générer un code");

    const token=newSessionToken();
    const room=await prisma.room.create({
      data:{
        code,
        gameType,
        minBet,
        maxBet,
        maxPlayers:roomMaxPlayers,
        startingBalance,
        blackjackDealerMode:gameType==="BLACKJACK"?blackjackDealerMode:"AUTO",
        dealerCardChoiceEnabled,
        players:{
          create:{
            name,
            sessionHash:hashToken(token),
            balance:startingBalance,
            isHost:true,
            isSpectator:raw.hostSpectator
          }
        }
      },
      include:{players:true}
    });

    const player=room.players[0];
    await logEvent(room.id,"JOIN",`${player.name} crée la table ${room.code}.`);

    return NextResponse.json({
      code:room.code,
      playerId:player.id,
      sessionToken:token
    });
  }catch(e:any){
    return NextResponse.json({error:e?.issues?.[0]?.message??e.message??"Erreur"},{status:400});
  }
}
