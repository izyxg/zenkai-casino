import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),active:vi.fn(),snapshot:vi.fn(),transaction:vi.fn(),read:vi.fn(),update:vi.fn(),event:vi.fn()}));
vi.mock("../lib/room",()=>({authenticatePlayer:m.auth,roomSnapshot:m.snapshot}));
vi.mock("../lib/prisma",()=>({prisma:{game:{findFirst:m.active},$transaction:m.transaction}}));
vi.mock("../lib/game-engine",()=>({blackjackAction:vi.fn(),blackjackDealerAction:vi.fn(),coinCommit:vi.fn(),logEvent:vi.fn(),pokerAction:vi.fn(),setBet:vi.fn(),startGame:vi.fn()}));
import {POST} from "../app/api/rooms/[code]/action/route";
beforeEach(()=>{
  vi.resetAllMocks();
  m.auth.mockResolvedValue({room:{id:"r",status:"LOBBY"},player:{id:"h",isHost:true}});
  m.active.mockResolvedValue(null);
  m.read.mockResolvedValue({status:"LOBBY",gameType:"POKER",_count:{players:6}});
  m.transaction.mockImplementation(fn=>fn({room:{findUniqueOrThrow:m.read,update:m.update},gameEvent:{create:m.event}}));
});
const post=(n:unknown)=>POST(new Request("http://localhost/api/rooms/ROOM/action",{method:"POST",
  body:JSON.stringify({playerId:"h",sessionToken:"test",action:"SET_CAPACITY",payload:{maxPlayers:n}})}),{params:Promise.resolve({code:"ROOM"})});
it("allows the host to choose any capacity up to 13 and records it",async()=>{
  expect((await post(13)).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({where:{id:"r"},data:{maxPlayers:13}});
  expect(m.event.mock.calls[0][0].data.message).toContain("13");
});
it.each([1,5,14,3.5,"13",null])("rejects invalid or below-occupancy capacity %s",async n=>{
  expect((await post(n)).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
});
it("rejects a member, active hand and closed room",async()=>{
  m.auth.mockResolvedValueOnce({room:{id:"r"},player:{isHost:false}});
  expect((await post(13)).status).toBe(400);
  m.active.mockResolvedValueOnce({id:"g"});expect((await post(13)).status).toBe(400);
  m.read.mockResolvedValueOnce({status:"CLOSED",gameType:"POKER",_count:{players:6}});
  expect((await post(13)).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
});
it("keeps coinflip at exactly two seats",async()=>{
  m.read.mockResolvedValue({status:"LOBBY",gameType:"COINFLIP",_count:{players:2}});
  expect((await post(3)).status).toBe(400);expect((await post(2)).status).toBe(200);
});
