import { beforeEach, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({findUnique:vi.fn(),active:vi.fn(),repair:vi.fn(),publicGameState:vi.fn()}));
vi.mock("../lib/prisma",()=>({withRoomMutation:(_id:string,work:()=>unknown)=>work(),prisma:{room:{findUnique:mocks.findUnique},game:{findFirst:mocks.active}}}));
vi.mock("../lib/game-recovery",()=>({repairGameTurn:mocks.repair}));
vi.mock("../lib/game-engine",()=>({publicGameState:mocks.publicGameState}));
import { roomSnapshot } from "../lib/room";

beforeEach(()=>{
  vi.resetAllMocks();
  mocks.publicGameState.mockReturnValue({kind:"BLACKJACK",deck:[]});
  mocks.findUnique.mockResolvedValue({id:"room",code:"ROOM01",gameType:"BLACKJACK",status:"ACTIVE",
    minBet:10,maxBet:100,maxPlayers:9,startingBalance:1000,blackjackDealerMode:"HOST",
    dealerCardChoiceEnabled:true,players:[],events:[],games:[{id:"game",type:"BLACKJACK",status:"ACTIVE",state:{kind:"BLACKJACK",settled:true}}]});
});

it("uses the server permission but never serializes it to players",async()=>{
  const result=await roomSnapshot("ROOM01","guest");
  expect(mocks.publicGameState).toHaveBeenCalledWith({kind:"BLACKJACK",settled:true},"guest",true);
  expect(JSON.stringify(result)).not.toContain("dealerCardChoiceEnabled");
});
it("passes the random-room permission to the state sanitizer",async()=>{
  const room=await mocks.findUnique();room.dealerCardChoiceEnabled=false;
  await roomSnapshot("ROOM01","host");
  expect(mocks.publicGameState).toHaveBeenCalledWith({kind:"BLACKJACK",settled:true},"host",false);
});
it("repairs a legacy spectator turn on refresh without requiring a host action",async()=>{
  const room=await mocks.findUnique();
  room.games[0].state={kind:"BLACKJACK",settled:false,dealerPhase:"PLAYERS",order:["viewer","p"],turnIndex:0,
    hands:{p:{status:"PLAYING",bet:100,cards:["AS","5C"]}}};
  mocks.active.mockResolvedValue(room.games[0]);
  mocks.repair.mockImplementation(async()=>{room.games[0].state.turnIndex=1;});
  await roomSnapshot("ROOM01","viewer");
  expect(mocks.repair).toHaveBeenCalledTimes(1);
  expect(mocks.publicGameState).toHaveBeenCalledWith(expect.objectContaining({turnIndex:1}),"viewer",true);
});
