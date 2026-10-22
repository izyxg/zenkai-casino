import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({
  authenticate:vi.fn(),snapshot:vi.fn(),active:vi.fn(),transaction:vi.fn(),
  room:vi.fn(),roomUpdate:vi.fn(),running:vi.fn(),target:vi.fn(),update:vi.fn(),ledger:vi.fn(),event:vi.fn()
}));
vi.mock("../lib/room",()=>({authenticatePlayer:mocks.authenticate,roomSnapshot:mocks.snapshot}));
vi.mock("../lib/prisma",()=>({withRoomMutation:(_id:string,work:()=>unknown)=>work(),prisma:{game:{findFirst:mocks.active},$transaction:mocks.transaction}}));
vi.mock("../lib/game-engine",()=>({
  blackjackAction:vi.fn(),blackjackDealerAction:vi.fn(),coinCommit:vi.fn(),logEvent:vi.fn(),
  pokerAction:vi.fn(),setBet:vi.fn(),startGame:vi.fn()
}));
import { POST } from "../app/api/rooms/[code]/action/route";

beforeEach(()=>{
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue({room:{id:"room",status:"LOBBY"},player:{id:"host",name:"Chef",isHost:true}});
  mocks.snapshot.mockResolvedValue({code:"ROOM"});
  mocks.active.mockResolvedValue(null);
  mocks.room.mockResolvedValue({status:"LOBBY",maxBet:1000});
  mocks.roomUpdate.mockResolvedValue({});
  mocks.running.mockResolvedValue(null);
  mocks.target.mockResolvedValue({id:"target",name:"Genin",balance:500,currentBet:200});
  mocks.update.mockResolvedValue({});
  mocks.ledger.mockResolvedValue({});
  mocks.event.mockResolvedValue({});
  mocks.transaction.mockImplementation(async(fn:any)=>fn({
    room:{findUnique:mocks.room,update:mocks.roomUpdate},game:{findFirst:mocks.running},
    player:{findFirst:mocks.target,update:mocks.update},
    transaction:{create:mocks.ledger},gameEvent:{create:mocks.event}
  }));
});
const post=(payload:unknown)=>POST(new Request("http://localhost/api/rooms/ROOM/action",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({playerId:"host",sessionToken:"test-token",action:"SET_PLAYER_BALANCE",payload})
}),{params:Promise.resolve({code:"ROOM"})});

describe("host wallet adjustments",()=>{
  it("updates only the selected player, resets pending bet and journals the delta",async()=>{
    const response=await post({playerId:"target",balance:2200});
    expect(response.status).toBe(200);
    expect(mocks.target).toHaveBeenCalledWith({where:{id:"target",roomId:"room"}});
    expect(mocks.update).toHaveBeenCalledWith({where:{id:"target"},data:{balance:2200,currentBet:0}});
    expect(mocks.ledger).toHaveBeenCalledWith({data:{
      roomId:"room",playerId:"target",amount:1700,balanceAfter:2200,
      type:"HOST_ADJUST",reason:"Ajustement du solde par Chef"
    }});
    expect(mocks.roomUpdate).toHaveBeenCalledWith({where:{id:"room"},data:{maxBet:2200}});
    expect(mocks.event.mock.calls[0][0].data.message).toContain("2\u202f200");
    expect(mocks.snapshot).toHaveBeenCalledWith("ROOM","host");
  });
  it("refuses non-hosts even with a forged payload",async()=>{
    mocks.authenticate.mockResolvedValue({room:{id:"room",status:"LOBBY"},player:{id:"member",name:"Joueur",isHost:false}});
    expect((await post({playerId:"target",balance:3000})).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("refuses any adjustment during a game",async()=>{
    mocks.active.mockResolvedValue({id:"active"});
    expect((await post({playerId:"target",balance:3000})).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([-1,1.5,1_000_000_001,"900",null])("rejects invalid values: %s",async balance=>{
    expect((await post({playerId:"target",balance})).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects players outside the current room",async()=>{
    mocks.target.mockResolvedValue(null);
    expect((await post({playerId:"other-room",balance:1000})).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects closed tables or a late-started game",async()=>{
    mocks.room.mockResolvedValueOnce({status:"CLOSED"});
    expect((await post({playerId:"target",balance:3000})).status).toBe(400);
    mocks.running.mockResolvedValueOnce({id:"started-late"});
    expect((await post({playerId:"target",balance:3000})).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("raises an old ceiling when resaving an already-increased balance",async()=>{
    mocks.target.mockResolvedValue({id:"target",name:"Genin",balance:3000,currentBet:0});
    expect((await post({playerId:"target",balance:3000})).status).toBe(200);
    expect(mocks.roomUpdate).toHaveBeenCalledWith({where:{id:"room"},data:{maxBet:3000}});
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.ledger).not.toHaveBeenCalled();
    expect(mocks.event.mock.calls[0][0].data.type).toBe("BET_LIMIT_ADJUST");
  });
  it("does not change the table limit when the new wallet is below the maximum",async()=>{
    expect((await post({playerId:"target",balance:750})).status).toBe(200);
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({where:{id:"target"},data:{balance:750,currentBet:0}});
  });
  it("does not journal an unchanged balance",async()=>{
    expect((await post({playerId:"target",balance:500})).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.ledger).not.toHaveBeenCalled();
    expect(mocks.roomUpdate).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });
});
