import {expect,it} from "vitest";
import {roomPollDelay} from "../lib/polling";
it("uses short active polling, slower lobby/hidden polling and bounded error backoff",()=>{
  expect(roomPollDelay(false,true)).toBe(900);
  expect(roomPollDelay(false,false)).toBe(1800);
  expect(roomPollDelay(true,true)).toBe(15000);
  expect(roomPollDelay(false,true,3)).toBe(7200);
  expect(roomPollDelay(false,false,200)).toBe(12000);
});
