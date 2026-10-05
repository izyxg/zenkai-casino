import { describe,it,expect } from "vitest";
import { blackjackValue,bestPokerHand,compareScore } from "../lib/cards";

describe("blackjack",()=>{it("gère les as",()=>{expect(blackjackValue(["AS","9H","5D"])).toBe(15)});it("reconnaît 21",()=>{expect(blackjackValue(["AH","KS"])).toBe(21)})});
describe("poker",()=>{it("reconnaît une couleur",()=>{expect(bestPokerHand(["AS","KS","9S","5S","2S","3D","4H"]).label).toBe("Couleur")});it("classe le carré devant le full",()=>{const a=bestPokerHand(["AS","AH","AD","AC","2S","3D","4H"]);const b=bestPokerHand(["KS","KH","KD","2C","2D","3D","4H"]);expect(compareScore(a,b)).toBeGreaterThan(0)})});
