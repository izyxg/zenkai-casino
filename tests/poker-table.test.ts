import { beforeEach, expect, it, vi } from "vitest";
import type { PokerState } from "../lib/game-types";
const m=vi.hoisted(()=>({read:vi.fn(),update:vi.fn(),player:vi.fn(),room:vi.fn(),pay:vi.fn(),log:vi.fn()}));
vi.mock("../lib/prisma",()=>({prisma:{game:{findUniqueOrThrow:m.read,update:m.update},player:{findUniqueOrThrow:m.player},room:{update:m.room}}}));
vi.mock("../lib/games/shared",()=>({changeBalance:m.pay,logEvent:m.log}));
import {newPokerState,pokerAction,beginPokerHand} from "../lib/games/poker";
import {publicGameState} from "../lib/game-engine";
import {pokerControls,pokerPositions} from "../lib/poker-view";
let wallets:Record<string,number>,game:any;
beforeEach(()=>{
  vi.resetAllMocks();wallets={};game={id:"g",roomId:"r",status:"ACTIVE"};
  m.pay.mockImplementation(async(_r,id,delta)=>{wallets[id]=(wallets[id]??1000)+delta;});
  m.player.mockImplementation(async({where})=>({id:where.id,name:where.id,balance:wallets[where.id]??1000}));
  m.read.mockImplementation(async()=>structuredClone(game));
  m.update.mockImplementation(async({data})=>{Object.assign(game,structuredClone(data));return game;});
});
const room=(count:number,balance=1000)=>({id:"r",minBet:10,maxBet:1000,
  players:Array.from({length:count},(_,i)=>({id:"p"+i,balance,name:"Joueur "+i}))});
it("deals 13 unique hands and rotates the button without dropping eligible players",async()=>{
  const input={...room(13),previousDealerId:"p3"};
  const s=await newPokerState(input);
  expect(s.seats).toHaveLength(13);expect(s.dealerIndex).toBe(4);
  expect(pokerPositions(s,4)).toEqual(["D"]);expect(pokerPositions(s,5)).toEqual(["SB"]);
  expect(new Set(Object.values(s.hole).flat()).size).toBe(26);
  expect(s.deck).toHaveLength(26);expect(s.currentIndex).toBe(7);
  await expect(newPokerState(room(14))).rejects.toThrow("13");
});
it("never sends the future deck or another player's private cards to a viewer",async()=>{
  const s=await newPokerState(room(13));game.state=s;
  const view=publicGameState(s,"p0") as PokerState;
  expect(view.deck).toEqual([]);expect(view.hole.p0).toEqual(s.hole.p0);
  expect(view.hole.p1).toEqual(["??","??"]);expect(s.deck).toHaveLength(26);
  s.board=s.deck.splice(0,3);
  expect((publicGameState(s,"p0") as PokerState).handLabel).toBeTruthy();
  expect((publicGameState(s,"spectator") as PokerState).handLabel).toBeUndefined();
});
it("automatically runs the board when both initial blinds are all-in",async()=>{
  wallets={p0:10,p1:10};
  const s=await newPokerState(room(2,10));game.state=s;
  await beginPokerHand(game,s);
  expect(game.status).toBe("FINISHED");expect(game.state.board).toHaveLength(5);
  expect(wallets.p0+wallets.p1).toBe(20);
});
it("a short all-in requires the difference but does not reopen raises",async()=>{
  const s=await newPokerState(room(3));s.currentIndex=2;s.currentBet=100;s.minRaise=100;s.pot=250;
  s.seats[0].roundBet=100;s.seats[0].totalBet=100;s.seats[1].roundBet=100;s.seats[1].totalBet=100;
  s.seats[2].roundBet=50;s.seats[2].totalBet=50;s.acted=["p0","p1"];
  wallets.p2=80;game.state=s;
  await pokerAction("g","p2","ALLIN");
  expect(game.state.currentBet).toBe(130);expect(game.state.minRaise).toBe(100);
  const controls=pokerControls(game.state,"p0",900);
  expect(controls.call).toBe(30);expect(controls.canRaise).toBe(false);expect(controls.canAllIn).toBe(false);
  await expect(pokerAction("g","p0","RAISE",230)).rejects.toThrow("rouverte");
});
it.each([NaN,Infinity,150.5,-1])("rejects malformed raises before any wallet write: %s",async amount=>{
  game.state=await newPokerState(room(3));m.pay.mockClear();
  await expect(pokerAction("g","p0","RAISE",amount)).rejects.toThrow();
  expect(m.pay).not.toHaveBeenCalled();
});
it("rejects unknown actions and finished games",async()=>{
  game.state=await newPokerState(room(3));m.pay.mockClear();
  await expect(pokerAction("g","p0","SKIP" as any)).rejects.toThrow("invalide");
  game.status="FINISHED";await expect(pokerAction("g","p0","CHECK")).rejects.toThrow("terminée");
  expect(m.pay).not.toHaveBeenCalled();
});
it("keeps all-in calls affordable and presets within the legal total",async()=>{
  const s=await newPokerState(room(3));
  s.currentBet=100;s.seats[0].roundBet=10;
  const view=pokerControls(s,"p0",40);
  expect(view.callPayment).toBe(40);expect(view.canRaise).toBe(false);
  const rich=pokerControls(s,"p0",1000);
  expect(rich.presets.every(p=>p.amount>=rich.minRaise&&p.amount<=rich.maxRaise)).toBe(true);
});
