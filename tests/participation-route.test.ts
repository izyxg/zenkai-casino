import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),snapshot:vi.fn(),active:vi.fn(),update:vi.fn(),recovery:vi.fn(),log:vi.fn(),poker:vi.fn()}));
vi.mock("../lib/room",()=>({authenticatePlayer:m.auth,roomSnapshot:m.snapshot}));
vi.mock("../lib/prisma",()=>({withRoomMutation:(_id:string,work:()=>unknown)=>work(),prisma:{game:{findFirst:m.active},player:{update:m.update}}}));
vi.mock("../lib/game-recovery",()=>({recoverGame:m.recovery}));
vi.mock("../lib/game-engine",()=>({blackjackAction:vi.fn(),blackjackDealerAction:vi.fn(),coinCommit:vi.fn(),logEvent:m.log,pokerAction:m.poker,setBet:vi.fn(),startGame:vi.fn()}));
import {POST} from "../app/api/rooms/[code]/action/route";
import {turnKey} from "../lib/turn-progress";
const post=(action:string,payload:any)=>POST(new Request("http://localhost/api/rooms/ROOM/action",{method:"POST",body:JSON.stringify({playerId:"p",sessionToken:"token",action,payload})}),{params:Promise.resolve({code:"ROOM"})});
beforeEach(()=>{
  vi.clearAllMocks();m.auth.mockResolvedValue({room:{id:"r",gameType:"POKER",status:"LOBBY"},player:{id:"p",name:"Joueur",isHost:false}});
  m.active.mockResolvedValue(null);m.snapshot.mockResolvedValue({code:"ROOM"});
});
it("lets a player sit out and clears a stale wager",async()=>{
  expect((await post("SET_PARTICIPATION",{spectator:true})).status).toBe(200);
  expect(m.update).toHaveBeenCalledWith({where:{id:"p"},data:{isSpectator:true,currentBet:0}});
});
it("lets a viewer opt in for the next round without entering the current hand",async()=>{
  m.active.mockResolvedValue({state:{kind:"POKER",seats:[{playerId:"other"}]}});
  expect((await post("SET_PARTICIPATION",{spectator:false})).status).toBe(200);
});
it("does not let a player turn spectator to escape an active hand",async()=>{
  m.active.mockResolvedValue({state:{kind:"POKER",seats:[{playerId:"p"}]}});
  expect((await post("SET_PARTICIPATION",{spectator:true})).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
});
it("does not let a spectator take a fourteenth playing seat",async()=>{
  m.auth.mockResolvedValue({room:{id:"r",gameType:"POKER",status:"LOBBY",maxPlayers:13,
    players:Array.from({length:13},()=>({isSpectator:false}))},player:{id:"p",isSpectator:true}});
  expect((await post("SET_PARTICIPATION",{spectator:false})).status).toBe(400);
  expect(m.update).not.toHaveBeenCalled();
});
it.each([null,"true",1,undefined])("rejects malformed participation %s",async spectator=>{
  expect((await post("SET_PARTICIPATION",{spectator})).status).toBe(400);expect(m.update).not.toHaveBeenCalled();
});
it("dispatches recovery using the authenticated player and room",async()=>{
  const payload={mode:"CANCEL",gameId:"g",turnKey:"turn"};
  expect((await post("RECOVER_GAME",payload)).status).toBe(200);
  expect(m.recovery).toHaveBeenCalledWith("r",expect.objectContaining({id:"p",isHost:false}),payload);
});
it("refuses stale player actions instead of applying them to a new hand or street",async()=>{
  const state={kind:"POKER" as const,stage:"FLOP" as const,currentIndex:0,pot:100,currentBet:0,acted:[],
    seats:[{playerId:"p",folded:false,allIn:false,roundBet:0,totalBet:100}],deck:[],board:[],hole:{},dealerIndex:0,minRaise:20};
  m.active.mockResolvedValue({id:"g",state});
  expect((await post("POKER",{move:"CHECK",gameId:"old",turnKey:turnKey(state)})).status).toBe(400);
  expect((await post("POKER",{move:"CHECK",gameId:"g",turnKey:"old"})).status).toBe(400);
  expect(m.poker).not.toHaveBeenCalled();
  expect((await post("POKER",{move:"CHECK",gameId:"g",turnKey:turnKey(state)})).status).toBe(200);
  expect(m.poker).toHaveBeenCalledWith("g","p","CHECK",undefined);
});
