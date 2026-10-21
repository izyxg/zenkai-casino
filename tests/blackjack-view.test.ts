import {expect,it} from "vitest";
import {handTotal,blackjackOutcome} from "../lib/blackjack-view";
it("scores soft aces, hidden hands and busts without guessing a hidden card",()=>{
  expect(handTotal(["AS","AH","9S"])).toBe(21);
  expect(handTotal(["KS","KH","2S"])).toBe(22);
  expect(handTotal(["6S","??"])).toBeNull();
});
it("renders net winnings and returned wagers distinctly",()=>{
  expect(blackjackOutcome({bet:100,net:150,outcome:"BLACKJACK"})).toContain("+150");
  expect(blackjackOutcome({bet:100,outcome:"PUSH"})).toContain("rendue");
});
