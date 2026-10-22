import {expect,it} from "vitest";
import {pokerAwards} from "../lib/poker-settlement";
import {nextPokerDealer,pokerCallAmount} from "../lib/poker-rules";
import {pokerControls} from "../lib/poker-view";
import type {PokerState} from "../lib/game-types";

const state=():PokerState=>({kind:"POKER",deck:[],board:["2S","3H","7D","9C","JS"],
  hole:{a:["AS","AH"],b:["KS","KH"],c:["QS","QH"],d:["TS","TH"]},
  seats:[50,100,200,200].map((n,i)=>({playerId:"abcd"[i],roundBet:0,totalBet:n,folded:i===3,allIn:true})),
  dealerIndex:0,currentIndex:0,stage:"RIVER",currentBet:0,minRaise:20,bigBlind:20,pot:550,acted:[]});
it("awards three pots to three different hands at the correct contribution caps",()=>{
  const result=pokerAwards(state());
  expect(Object.fromEntries(result.map(w=>[w.playerId,w.amount]))).toEqual({a:200,b:150,c:200});
});
it.each([0,1,2])("gives the odd chip left of dealer index %s, independently in each pot",dealer=>{
  const s=state();s.board=["AS","KS","QS","JS","TS"];
  s.hole={a:["2H","3D"],b:["4H","5D"],c:["6C","7C"]};
  s.seats=s.seats.slice(0,3).map((p,i)=>({...p,totalBet:i===2?1:5,folded:i===2}));
  s.pot=11;s.dealerIndex=dealer;
  const payouts=Object.fromEntries(pokerAwards(s).map(w=>[w.playerId,w.amount]));
  expect(payouts).toEqual(dealer===0?{b:6,a:5}:{a:6,b:5});
});
it("never awards a folded hand, even when its cards would win",()=>{
  const s=state();s.seats[0].folded=true;
  const result=pokerAwards(s);expect(result.some(w=>w.playerId==="a")).toBe(false);
  expect(result.reduce((n,w)=>n+w.amount,0)).toBe(550);
});
it("rejects corrupt pots and duplicated cards before settlement",()=>{
  const s=state();s.pot++;expect(()=>pokerAwards(s)).toThrow("pot");
  s.pot=550;s.hole.a[0]="2S";expect(()=>pokerAwards(s)).toThrow("invalide");
});
it("does not silently discard a pot with no eligible contender",()=>{
  const s=state();s.seats[1].folded=true;s.seats[2].folded=true;
  expect(()=>pokerAwards(s)).toThrow("sans main");
});
it("moves the button past a spectator who used to be the dealer",()=>{
  expect(nextPokerDealer(["a","c","d"],"b",["a","b","c","d"])).toBe(1);
  expect(nextPokerDealer(["a","b","d"],"c",["a","b","c","d"])).toBe(2);
});
it("does not offer raises or an oversized all-in into opponents who are already all-in",()=>{
  const s=state();s.seats[0].allIn=false;s.seats[0].roundBet=10;
  s.seats[1].roundBet=50;s.currentBet=50;
  const view=pokerControls(s,"a",500);
  expect(view.call).toBe(40);expect(view.canRaise).toBe(false);expect(view.canAllIn).toBe(false);
  expect(pokerCallAmount(s,"a")).toBe(40);
});
