import {beforeEach,expect,it,vi} from "vitest";
import type {BlackjackState,PokerState} from "../lib/game-types";
const m=vi.hoisted(()=>({active:vi.fn(),read:vi.fn(),update:vi.fn(),player:vi.fn(),reset:vi.fn(),room:vi.fn(),pay:vi.fn(),log:vi.fn()}));
vi.mock("../lib/prisma",()=>({prisma:{game:{findFirst:m.active,findUniqueOrThrow:m.read,update:m.update},
  player:{findUnique:m.player,findUniqueOrThrow:m.player,updateMany:m.reset},room:{update:m.room},
  $transaction:(work:any)=>typeof work==="function"?work({}):Promise.all(work)}}));
vi.mock("../lib/games/shared",()=>({changeBalance:m.pay,logEvent:m.log}));
import {recoverGame,repairGameTurn} from "../lib/game-recovery";
import {newBlackjackState} from "../lib/games/blackjack";
import {newPokerState} from "../lib/games/poker";
import {blackjackTurnIndex,needsTurnRepair,turnKey,isHandParticipant} from "../lib/turn-progress";
let game:any,wallets:Record<string,number>;
const host={id:"host",name:"Hôte",isHost:true};
const bj=():BlackjackState=>({kind:"BLACKJACK",deck:["2C","3S","4D"],dealer:["TS","7S"],
  hands:{p1:{cards:["8C","8S"],bet:100,status:"PLAYING"},p2:{cards:["9C","8D"],bet:100,status:"PLAYING"}},
  order:["p1","p2"],turnIndex:0,dealerMode:"HOST",dealerPlayerId:"host",dealerPhase:"PLAYERS",dealerRevealed:false});
const poker=():PokerState=>({kind:"POKER",deck:["2C","3S","4D","5H","7D"],board:[],
  hole:{p1:["AS","KS"],p2:["8C","8S"]},seats:[
    {playerId:"p1",folded:false,allIn:false,totalBet:10,roundBet:10},
    {playerId:"p2",folded:false,allIn:false,totalBet:20,roundBet:20}],
  dealerIndex:0,currentIndex:0,stage:"PREFLOP",currentBet:20,minRaise:20,pot:30,acted:[]});
const request=(mode:string,extra:any={})=>recoverGame("room",host,{gameId:game.id,turnKey:turnKey(game.state),mode,...extra});
beforeEach(()=>{
  vi.clearAllMocks();wallets={p1:900,p2:900};game={id:"game",roomId:"room",status:"ACTIVE",state:bj()};
  m.active.mockImplementation(async()=>game.status==="ACTIVE"?structuredClone(game):null);
  m.read.mockImplementation(async()=>structuredClone(game));
  m.update.mockImplementation(async({data})=>{Object.assign(game,structuredClone(data));return game;});
  m.player.mockImplementation(async({where})=>({id:where.id,name:where.id,balance:wallets[where.id]}));
  m.pay.mockImplementation(async(_room,id,delta)=>{wallets[id]=(wallets[id]??0)+delta;});
});

it("does not deal poker or blackjack hands to spectators, even with a wallet and a pending bet",async()=>{
  const room={id:"room",minBet:10,maxBet:1000,blackjackDealerMode:"AUTO",players:[
    {id:"p1",balance:1000,currentBet:100},{id:"p2",balance:1000,currentBet:100},
    {id:"viewer",balance:50000,currentBet:500,isSpectator:true}]};
  const cards=await newBlackjackState(room);
  expect(cards.order).toEqual(["p1","p2"]);expect(cards.hands.viewer).toBeUndefined();
  const s=await newPokerState(room);expect(s.seats.map(p=>p.playerId)).toEqual(["p1","p2"]);
  expect(s.hole.viewer).toBeUndefined();expect(isHandParticipant(s,"viewer")).toBe(false);
  expect(m.pay.mock.calls.every(call=>call[1]!=="viewer")).toBe(true);
});
it("automatically skips a spectator without a blackjack hand in a legacy turn order",async()=>{
  game.state.order=["viewer","p1","viewer2","p2"];
  expect(blackjackTurnIndex(game.state)).toBe(1);expect(needsTurnRepair(game.state)).toBe(true);
  await repairGameTurn(game);
  expect(game.state.turnIndex).toBe(1);expect(game.state.dealerPhase).toBe("PLAYERS");expect(m.pay).not.toHaveBeenCalled();
});
it("skips finished hands and enters the dealer phase without waiting on a viewer",async()=>{
  game.state.hands.p1.status="STAND";game.state.hands.p2.status="BLACKJACK";
  game.state.order.push("viewer");await repairGameTurn(game);
  expect(game.state.dealerPhase).toBe("DEALER");expect(game.state.turnIndex).toBe(3);
});
it("never repairs away a valid playing hand",async()=>{
  expect(needsTurnRepair(game.state)).toBe(false);await request("REPAIR");
  expect(game.state.turnIndex).toBe(0);expect(m.pay).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();
});
it("allows the host to make a blocked blackjack player stand without extra cards or spending",async()=>{
  await request("SKIP");expect(game.state.hands.p1.status).toBe("STAND");
  expect(game.state.hands.p1.cards).toHaveLength(2);expect(game.state.turnIndex).toBe(1);
  expect(m.pay).not.toHaveBeenCalled();expect(m.log.mock.calls.some(c=>c[1]==="HOST_SKIP")).toBe(true);
});
it("folds a blocked poker hand using the normal pot settlement",async()=>{
  game.state=poker();await request("SKIP");
  expect(game.state.seats[0].folded).toBe(true);expect(game.status).toBe("FINISHED");
  expect(m.pay).toHaveBeenCalledWith("room","p2",10,"REFUND",expect.any(String));
  expect(m.pay).toHaveBeenCalledWith("room","p2",20,"WIN",expect.any(String));
});
it("repairs a poker spectator with no cards and preserves contributed chips",async()=>{
  game.state=poker();game.state.hole.p1=undefined;
  await repairGameTurn(game);expect(game.status).toBe("FINISHED");
  expect(game.state.winners[0].amount).toBe(20);expect(wallets.p2).toBe(930);
});
it("refunds all blackjack stakes including doubled bets exactly once",async()=>{
  game.state.hands.p1.bet=200;game.state.hands.p1.doubled=true;
  await request("CANCEL");expect(wallets).toEqual({p1:1100,p2:1000});expect(game.state.cancelled).toBe(true);
  expect(game.status).toBe("FINISHED");expect(m.reset).toHaveBeenCalledWith({where:{roomId:"room"},data:{currentBet:0}});
  await expect(request("CANCEL")).rejects.toThrow("changé");expect(m.pay).toHaveBeenCalledTimes(2);
});
it("refunds total poker contributions, including folded players, not just the current street",async()=>{
  game.state=poker();game.state.seats[0].folded=true;game.state.seats[0].totalBet=70;game.state.pot=90;
  await request("CANCEL");expect(wallets).toEqual({p1:970,p2:920});
});
it("cancels a completely invalid poker table with refunds instead of waiting forever",async()=>{
  game.state=poker();game.state.hole={};await repairGameTurn(game);
  expect(game.state.cancelled).toBe(true);expect(wallets).toEqual({p1:910,p2:920});
});
it("does not refund coinflip commitments that were never debited",async()=>{
  game.state={kind:"COINFLIP",commits:{p1:{bet:100,choice:"PILE"}}};await request("CANCEL");
  expect(m.pay).not.toHaveBeenCalled();expect(game.status).toBe("FINISHED");
});
it("rejects non-hosts, stale hands and stale turns before any write",async()=>{
  await expect(recoverGame("room",{...host,isHost:false},{})).rejects.toThrow("hôte");
  await expect(request("CANCEL",{gameId:"old"})).rejects.toThrow("changé");
  await expect(request("SKIP",{turnKey:"old"})).rejects.toThrow("changé");
  expect(m.update).not.toHaveBeenCalled();expect(m.pay).not.toHaveBeenCalled();
});
it("cannot skip the dealer phase or use an unknown recovery mode",async()=>{
  game.state.dealerPhase="DEALER";
  await expect(request("SKIP")).rejects.toThrow("croupier");
  await expect(request("RANDOM")).rejects.toThrow("inconnu");expect(m.pay).not.toHaveBeenCalled();
});
