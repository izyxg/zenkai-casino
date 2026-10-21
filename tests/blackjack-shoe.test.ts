import {expect,it,vi} from "vitest";
vi.mock("../lib/prisma",()=>({prisma:{}}));
vi.mock("../lib/games/shared",()=>({changeBalance:vi.fn(),logEvent:vi.fn()}));
import {newBlackjackState} from "../lib/games/blackjack";
it("deals thirteen full hands from a six-deck shoe",async()=>{
  const players=Array.from({length:13},(_,i)=>({id:"p"+i,balance:1000,currentBet:100,isHost:i===0}));
  const s=await newBlackjackState({id:"r",players,minBet:10,maxBet:1000,blackjackDealerMode:"AUTO"});
  expect(s.order).toHaveLength(13);
  expect(s.deck).toHaveLength(312-28);
  const cards=[...s.deck,...s.dealer,...Object.values(s.hands).flatMap(h=>h.cards)];
  expect(cards).toHaveLength(312);
  expect(new Set(cards).size).toBe(52);
});
