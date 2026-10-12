import { beforeEach, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({findUnique:vi.fn(),publicGameState:vi.fn()}));
vi.mock("../lib/prisma",()=>({prisma:{room:{findUnique:mocks.findUnique}}}));
vi.mock("../lib/game-engine",()=>({publicGameState:mocks.publicGameState}));
import { roomSnapshot } from "../lib/room";

beforeEach(()=>{
  vi.resetAllMocks();
  mocks.publicGameState.mockReturnValue({kind:"BLACKJACK",deck:[]});
  mocks.findUnique.mockResolvedValue({id:"room",code:"ROOM01",gameType:"BLACKJACK",status:"ACTIVE",
    minBet:10,maxBet:100,maxPlayers:9,startingBalance:1000,blackjackDealerMode:"HOST",
    dealerCardChoiceEnabled:true,players:[],events:[],games:[{id:"game",type:"BLACKJACK",status:"ACTIVE",state:{kind:"BLACKJACK"}}]});
});

it("uses the server permission but never serializes it to players",async()=>{
  const result=await roomSnapshot("ROOM01","guest");
  expect(mocks.publicGameState).toHaveBeenCalledWith({kind:"BLACKJACK"},"guest",true);
  expect(JSON.stringify(result)).not.toContain("dealerCardChoiceEnabled");
});
it("passes the random-room permission to the state sanitizer",async()=>{
  const room=await mocks.findUnique();room.dealerCardChoiceEnabled=false;
  await roomSnapshot("ROOM01","host");
  expect(mocks.publicGameState).toHaveBeenCalledWith({kind:"BLACKJACK"},"host",false);
});
