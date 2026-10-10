import { beforeEach, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({authenticatePlayer:vi.fn(),roomSnapshot:vi.fn(),findFirst:vi.fn(),dealer:vi.fn()}));
vi.mock("../lib/room",()=>({authenticatePlayer:mocks.authenticatePlayer,roomSnapshot:mocks.roomSnapshot}));
vi.mock("../lib/prisma",()=>({prisma:{game:{findFirst:mocks.findFirst}}}));
vi.mock("../lib/game-engine",()=>({blackjackDealerAction:mocks.dealer,blackjackAction:vi.fn(),coinCommit:vi.fn(),
  logEvent:vi.fn(),pokerAction:vi.fn(),setBet:vi.fn(),startGame:vi.fn()}));
import { POST } from "../app/api/rooms/[code]/action/route";

beforeEach(()=>{
  vi.resetAllMocks();
  mocks.authenticatePlayer.mockResolvedValue({room:{id:"room"},player:{id:"host"}});
  mocks.findFirst.mockResolvedValue({id:"game"});
  mocks.roomSnapshot.mockResolvedValue({code:"TEST"});
});
function request(){
  return new Request("http://localhost/api/rooms/TEST/action",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({playerId:"host",sessionToken:"synthetic-token",action:"BLACKJACK_DEALER",payload:{move:"REVEAL",card:"5D"}})});
}

it("forwards the selected card and authenticated dealer to the engine",async()=>{
  const response=await POST(request(),{params:Promise.resolve({code:"TEST"})});
  expect(response.status).toBe(200);
  expect(mocks.authenticatePlayer).toHaveBeenCalledWith("TEST","host","synthetic-token");
  expect(mocks.dealer).toHaveBeenCalledWith("game","host","REVEAL","5D");
  expect(await response.json()).toEqual({ok:true,snapshot:{code:"TEST"}});
});
it("does not dispatch an unauthenticated selection",async()=>{
  mocks.authenticatePlayer.mockRejectedValue(new Error("Accès invalide"));
  const response=await POST(request(),{params:Promise.resolve({code:"TEST"})});
  expect(response.status).toBe(400);
  expect(mocks.dealer).not.toHaveBeenCalled();
});
it("returns engine validation errors without reporting success",async()=>{
  mocks.dealer.mockRejectedValue(new Error("Cette carte n'est plus disponible"));
  const response=await POST(request(),{params:Promise.resolve({code:"TEST"})});
  expect(response.status).toBe(400);
  expect((await response.json()).error).toContain("plus disponible");
  expect(mocks.roomSnapshot).not.toHaveBeenCalled();
});
