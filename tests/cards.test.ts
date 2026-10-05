import { describe,it,expect } from "vitest";
import { blackjackValue,bestPokerHand,compareScore } from "../lib/cards";
import { resolveBlackjackHand } from "../lib/blackjack-rules";

describe("blackjack",()=>{
  it("gère les as",()=>{expect(blackjackValue(["AS","9H","5D"])).toBe(15)});
  it("reconnaît 21",()=>{expect(blackjackValue(["AH","KS"])).toBe(21)});

  it("un joueur bust perd toujours sa mise même si le croupier bust aussi",()=>{
    const result=resolveBlackjackHand(["KH","8S","5D"],1000,"BUST",["QD","7C","6H"]);
    expect(result.playerValue).toBe(23);
    expect(result.dealerValue).toBe(23);
    expect(result.outcome).toBe("BUST");
    expect(result.payout).toBe(0);
    expect(result.net).toBe(-1000);
  });

  it("une égalité rend exactement la mise",()=>{
    const result=resolveBlackjackHand(["KH","8S"],1000,"STAND",["QD","8C"]);
    expect(result.outcome).toBe("PUSH");
    expect(result.payout).toBe(1000);
    expect(result.net).toBe(0);
  });

  it("un blackjack naturel paie 3:2 plus retour de mise",()=>{
    const result=resolveBlackjackHand(["AH","KS"],1000,"BLACKJACK",["QD","9C"]);
    expect(result.outcome).toBe("BLACKJACK");
    expect(result.payout).toBe(2500);
    expect(result.net).toBe(1500);
  });

  it("un joueur non bust gagne si le croupier bust",()=>{
    const result=resolveBlackjackHand(["KH","8S"],1000,"STAND",["QD","7C","6H"]);
    expect(result.outcome).toBe("WIN");
    expect(result.payout).toBe(2000);
    expect(result.net).toBe(1000);
  });
});

describe("poker",()=>{
  it("reconnaît une couleur",()=>{expect(bestPokerHand(["AS","KS","9S","5S","2S","3D","4H"]).label).toBe("Couleur")});
  it("classe le carré devant le full",()=>{
    const a=bestPokerHand(["AS","AH","AD","AC","2S","3D","4H"]);
    const b=bestPokerHand(["KS","KH","KD","2C","2D","3D","4H"]);
    expect(compareScore(a,b)).toBeGreaterThan(0);
  });
});
