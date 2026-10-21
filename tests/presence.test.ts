import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({read:vi.fn(),update:vi.fn()}));
vi.mock("../lib/prisma",()=>({prisma:{room:{findUnique:m.read},player:{update:m.update}}}));
vi.mock("../lib/game-engine",()=>({publicGameState:vi.fn()}));
import {hashToken} from "../lib/auth";
import {authenticatePlayer} from "../lib/room";
beforeEach(()=>vi.resetAllMocks());
it("does not write lastSeen on every short poll, but refreshes stale presence",async()=>{
  const player={id:"p",sessionHash:hashToken("test"),lastSeen:new Date()};
  m.read.mockResolvedValue({players:[player]});
  await authenticatePlayer("ROOM","p","test");expect(m.update).not.toHaveBeenCalled();
  player.lastSeen=new Date(Date.now()-6000);
  await authenticatePlayer("ROOM","p","test");expect(m.update).toHaveBeenCalledOnce();
});
it("does not refresh unauthenticated sessions",async()=>{
  m.read.mockResolvedValue({players:[{id:"p",sessionHash:hashToken("good"),lastSeen:new Date(0)}]});
  await expect(authenticatePlayer("ROOM","p","wrong")).rejects.toThrow("invalide");
  expect(m.update).not.toHaveBeenCalled();
});
