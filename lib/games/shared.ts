import { prisma } from "../prisma";

export async function logEvent(roomId:string, type:string, message:string, gameId?:string, payload?:unknown){
  await prisma.gameEvent.create({data:{roomId,type,message,gameId,payload:payload as any}});
}

export async function changeBalance(roomId:string, playerId:string, amount:number, type:string, reason:string){
  const player=await prisma.player.update({where:{id:playerId},data:{balance:{increment:amount}}});
  await prisma.transaction.create({data:{roomId,playerId,amount,balanceAfter:player.balance,type,reason}});
  return player.balance;
}
