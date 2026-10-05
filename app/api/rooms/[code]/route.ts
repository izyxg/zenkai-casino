import { NextResponse } from "next/server";
import { authenticatePlayer, roomSnapshot } from "@/lib/room";
import { processBlackjackAutoStart } from "@/lib/game-engine";

export async function GET(req:Request,{params}:{params:Promise<{code:string}>}){
  try{
    const {code}=await params;
    const u=new URL(req.url);
    const playerId=u.searchParams.get("playerId")??"";
    const token=u.searchParams.get("token")??"";
    await authenticatePlayer(code,playerId,token);
    await processBlackjackAutoStart(code);
    const snap=await roomSnapshot(code,playerId);
    return NextResponse.json(snap);
  }catch(e:any){
    return NextResponse.json({error:e.message??"Erreur"},{status:401});
  }
}
