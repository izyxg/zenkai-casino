import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({findUnique:vi.fn(),create:vi.fn(),logEvent:vi.fn()}));
vi.mock("../lib/prisma",()=>({prisma:{room:{findUnique:mocks.findUnique,create:mocks.create}}}));
vi.mock("../lib/game-engine",()=>({logEvent:mocks.logEvent}));
import { POST } from "../app/api/rooms/route";

beforeEach(()=>{
  vi.resetAllMocks();
  vi.stubEnv("ROOM_CREATE_CODE","test-manual-secret");
  vi.stubEnv("ROOM_CREATE_RANDOM_CODE","test-random-secret");
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue({id:"room",code:"ROOM01",players:[{id:"host",name:"Host"}]});
});
afterEach(()=>vi.unstubAllEnvs());

function create(accessCode:string,extra:Record<string,unknown>={}){
  return POST(new Request("http://localhost/api/rooms",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({accessCode,name:"Host",gameType:"BLACKJACK",minBet:10,maxBet:100,maxPlayers:9,
      startingBalance:1000,blackjackDealerMode:"HOST",...extra})}));
}

describe("server-only table access codes",()=>{
  it.each([["test-manual-secret",true],["test-random-secret",false]])("stores permission for %s only on the server",async(code,enabled)=>{
    const response=await create(code as string);
    expect(response.status).toBe(200);
    expect(mocks.create.mock.calls[0][0].data.dealerCardChoiceEnabled).toBe(enabled);
    const body=await response.json();
    expect(Object.keys(body).sort()).toEqual(["code","playerId","sessionToken"]);
    expect(JSON.stringify(body)).not.toContain(code);
  });
  it("ignores client-supplied permission",async()=>{
    await create("test-random-secret",{dealerCardChoiceEnabled:true});
    expect(mocks.create.mock.calls[0][0].data.dealerCardChoiceEnabled).toBe(false);
  });
  it("rejects an unconfigured code without creating a room",async()=>{
    expect((await create("test-retired-secret")).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(["missing","identical"])("fails closed when secrets are %s",async variant=>{
    vi.stubEnv("ROOM_CREATE_RANDOM_CODE",variant==="missing"?"":"test-manual-secret");
    expect((await create("test-manual-secret")).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
