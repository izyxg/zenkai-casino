import { beforeEach, describe, expect, it, vi } from "vitest";
import { freshDeck, type Card } from "../lib/cards";
import { blackjackDealerChoices, chooseBlackjackDealerCard } from "../lib/blackjack-rules";
import type { BlackjackState } from "../lib/game-types";

const mocks=vi.hoisted(()=>({
  game:{findUniqueOrThrow:vi.fn(),updateMany:vi.fn(),update:vi.fn()},
  player:{findUnique:vi.fn(),updateMany:vi.fn()},
  room:{update:vi.fn()},
  transaction:vi.fn(),changeBalance:vi.fn(),logEvent:vi.fn()
}));
vi.mock("../lib/prisma",()=>({prisma:{game:mocks.game,player:mocks.player,room:mocks.room,$transaction:mocks.transaction}}));
vi.mock("../lib/games/shared",()=>({changeBalance:mocks.changeBalance,logEvent:mocks.logEvent}));

import { blackjackDealerAction } from "../lib/games/blackjack";
import { publicGameState } from "../lib/game-engine";

function state():BlackjackState{
  const occupied:Card[]=["6S","8H","TC","9D"];
  return {kind:"BLACKJACK",deck:freshDeck().filter(card=>!occupied.includes(card)),dealer:["6S","8H"],
    hands:{player:{cards:["TC","9D"],bet:100,status:"STAND"}},order:["player"],turnIndex:1,
    dealerMode:"HOST",dealerPlayerId:"host",dealerPhase:"DEALER",dealerRevealed:false};
}
function allCards(s:BlackjackState){return [...s.deck,...s.dealer,...Object.values(s.hands).flatMap(hand=>hand.cards)].sort();}
function loadGame(s=state(),status="ACTIVE"){
  const game={id:"game",roomId:"room",status,state:s};
  mocks.game.findUniqueOrThrow.mockResolvedValue(game);
  return game;
}

beforeEach(()=>{
  vi.resetAllMocks();
  mocks.game.updateMany.mockResolvedValue({count:1});
  mocks.player.findUnique.mockResolvedValue({id:"player",name:"Joueur"});
});

describe("manual dealer cards",()=>{
  it("replaces the hidden card without creating or losing cards",()=>{
    const s=state(),before=allCards(s);
    chooseBlackjackDealerCard(s,"REVEAL","5D");
    expect(s.dealer).toEqual(["6S","5D"]);
    expect(s.dealerRevealed).toBe(true);
    expect(s.deck).toContain("8H");
    expect(s.deck).not.toContain("5D");
    expect(allCards(s)).toEqual(before);
  });
  it("allows revealing the existing hidden card unchanged",()=>{
    const s=state(),deck=[...s.deck];
    chooseBlackjackDealerCard(s,"REVEAL","8H");
    expect(s.dealer).toEqual(["6S","8H"]);
    expect(s.deck).toEqual(deck);
  });
  it("draws exactly the chosen available card",()=>{
    const s=state();s.dealerRevealed=true;
    const before=allCards(s);
    chooseBlackjackDealerCard(s,"DRAW","2C");
    expect(s.dealer).toEqual(["6S","8H","2C"]);
    expect(s.deck).not.toContain("2C");
    expect(allCards(s)).toEqual(before);
  });
  it.each([undefined,null,"??","10S","XS",{},3])("rejects invalid input %j without mutation",card=>{
    const s=state(),before=structuredClone(s);
    expect(()=>chooseBlackjackDealerCard(s,"REVEAL",card)).toThrow("carte valide");
    expect(s).toEqual(before);
  });
  it.each(["TC","9D","6S"])("rejects dealt card %s",card=>{
    const s=state(),before=structuredClone(s);
    expect(()=>chooseBlackjackDealerCard(s,"REVEAL",card)).toThrow("plus disponible");
    expect(s).toEqual(before);
  });
  it("enforces reveal first and the rule of 17",()=>{
    const s=state();
    expect(()=>chooseBlackjackDealerCard(s,"DRAW","2C")).toThrow("Révèle d'abord");
    chooseBlackjackDealerCard(s,"REVEAL","JS");
    chooseBlackjackDealerCard(s,"DRAW","AD");
    expect(()=>chooseBlackjackDealerCard(s,"DRAW","2C")).toThrow("17 ou plus");
    expect(blackjackDealerChoices(s)).toEqual([]);
  });
  it("offers only available cards in canonical, not shuffled order",()=>{
    const s=state();s.deck.reverse();
    const choices=blackjackDealerChoices(s);
    expect(choices).toContain("8H");
    expect(choices).not.toContain("6S");
    expect(choices).not.toContain("TC");
    expect(choices).toEqual(freshDeck().filter(card=>choices.includes(card)));
  });
});

describe("dealer server action",()=>{
  it("saves and logs the selected reveal using the unchanged previous state as a lease",async()=>{
    const game=loadGame(),before=structuredClone(game.state);
    await blackjackDealerAction("game","host","REVEAL","5D");
    const query=mocks.game.updateMany.mock.calls[0][0];
    expect(query.where.state.equals).toEqual(before);
    expect(query.data.state.dealer).toEqual(["6S","5D"]);
    expect(game.state).toEqual(before);
    expect(mocks.logEvent).toHaveBeenCalledWith("room","BLACKJACK_DEALER","Le croupier révèle sa main : 11.","game");
  });
  it("saves a selected draw rather than popping the top card",async()=>{
    const s=state();s.dealerRevealed=true;loadGame(s);
    await blackjackDealerAction("game","host","DRAW","2C");
    expect(mocks.game.updateMany.mock.calls[0][0].data.state.dealer).toEqual(["6S","8H","2C"]);
    expect(mocks.logEvent).toHaveBeenCalledWith("room","BLACKJACK_DEALER","Le croupier tire une carte et passe à 16.","game");
  });
  it.each(["other-player", "player"])("refuses non-dealer %s",async playerId=>{
    loadGame();
    await expect(blackjackDealerAction("game",playerId,"REVEAL","5D")).rejects.toThrow("réservée");
    expect(mocks.game.updateMany).not.toHaveBeenCalled();
  });
  it.each(["auto","players","settled","finished"])("refuses an invalid phase or mode: %s",async variant=>{
    const s=state();
    if(variant==="auto") s.dealerMode="AUTO";
    if(variant==="players") s.dealerPhase="PLAYERS";
    if(variant==="settled") s.settled=true;
    loadGame(s,variant==="finished"?"FINISHED":"ACTIVE");
    await expect(blackjackDealerAction("game","host","REVEAL","5D")).rejects.toThrow();
    expect(mocks.game.updateMany).not.toHaveBeenCalled();
    expect(mocks.logEvent).not.toHaveBeenCalled();
  });
  it("rejects a stale concurrent selection without logging success",async()=>{
    loadGame();mocks.game.updateMany.mockResolvedValue({count:0});
    await expect(blackjackDealerAction("game","host","REVEAL","5D")).rejects.toThrow("main a changé");
    expect(mocks.logEvent).not.toHaveBeenCalled();
  });
  it("still settles payouts using the chosen dealer hand",async()=>{
    const s=state();s.dealer=["6S","5D","8C"];s.dealerRevealed=true;loadGame(s);
    await blackjackDealerAction("game","host","SETTLE");
    expect(mocks.changeBalance).toHaveBeenCalledWith("room","player",100,"REFUND","Égalité Blackjack");
    expect(mocks.game.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"FINISHED"})}));
  });
});

describe("public blackjack state",()=>{
  it("only gives the dealer selection choices, without the ordered deck",()=>{
    const s=state(),before=structuredClone(s);
    const host=publicGameState(s,"host") as BlackjackState&{dealerAvailableCards?:Card[]};
    expect(host.deck).toEqual([]);
    expect(host.dealer).toEqual(["6S","??"]);
    expect(host.dealerAvailableCards).toContain("8H");
    expect(s).toEqual(before);
    const player=publicGameState(s,"player") as typeof host;
    expect(player.deck).toEqual([]);
    expect(player.dealerAvailableCards).toBeUndefined();
    expect(player.dealer).toEqual(["6S","??"]);
  });
  it.each(["players","auto","settled"])("does not expose choices in %s state",variant=>{
    const s=state();
    if(variant==="players") s.dealerPhase="PLAYERS";
    if(variant==="auto") s.dealerMode="AUTO";
    if(variant==="settled") s.settled=true;
    const view=publicGameState(s,"host") as BlackjackState&{dealerAvailableCards?:Card[]};
    expect(view.dealerAvailableCards).toBeUndefined();
    expect(view.deck).toEqual([]);
  });
});
