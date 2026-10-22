import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({rootUpdate:vi.fn(),txUpdate:vi.fn(),lock:vi.fn(),transaction:vi.fn()}));
vi.mock("@prisma/client",()=>({PrismaClient:class{
  player={update:m.rootUpdate};
  $transaction=m.transaction;
}}));
import {prisma,withRoomMutation} from "../lib/prisma";
beforeEach(()=>{
  vi.clearAllMocks();
  m.transaction.mockImplementation(async work=>work({$queryRaw:m.lock,player:{update:m.txUpdate}}));
});
it("binds engine and ledger helpers to the locked transaction and restores the normal client afterwards",async()=>{
  await withRoomMutation("room",async()=>{
    await prisma.player.update({where:{id:"p"},data:{balance:100}});
    await prisma.$transaction(async tx=>{await tx.player.update({where:{id:"q"},data:{balance:200}});});
    await prisma.$transaction([prisma.player.update({where:{id:"p"},data:{balance:300}})]);
  });
  expect(m.transaction).toHaveBeenCalledTimes(1);expect(m.lock).toHaveBeenCalledTimes(1);
  expect(m.lock.mock.calls[0][1]).toBe("room");expect(m.txUpdate).toHaveBeenCalledTimes(3);
  expect(m.rootUpdate).not.toHaveBeenCalled();
  await prisma.player.update({where:{id:"p"},data:{balance:400}});
  expect(m.rootUpdate).toHaveBeenCalledTimes(1);
});
it("does not start a nested transaction while repairing a snapshot during an action",async()=>{
  await withRoomMutation("room",()=>withRoomMutation("room",async()=>{await prisma.player.update({where:{id:"p"},data:{balance:1}});}));
  expect(m.transaction).toHaveBeenCalledTimes(1);expect(m.lock).toHaveBeenCalledTimes(1);
});
it("propagates a failed refund to the transaction instead of committing a success response",async()=>{
  m.txUpdate.mockRejectedValueOnce(new Error("Refund failed"));
  await expect(withRoomMutation("room",async()=>{
    await prisma.player.update({where:{id:"p"},data:{balance:10}});
  })).rejects.toThrow("Refund failed");
  await prisma.player.update({where:{id:"p"},data:{balance:1}});expect(m.rootUpdate).toHaveBeenCalledTimes(1);
});
