import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const base=process.env.QA_URL||"http://127.0.0.1:3100";
const out=path.resolve("qa-output");
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"msedge"});
const errors=[],actions=[],report=[];
const players=Array.from({length:13},(_,i)=>({id:"p"+i,name:i===12?"Nom de personnage très long":"Shinobi "+(i+1),
  balance:10000+i*100,currentBet:100,isHost:i===0,lastSeen:new Date().toISOString()}));
const poker={id:"g1",status:"ACTIVE",state:{kind:"POKER",deck:[],board:["AS","KH","QD"],seats:players.map((p,i)=>({
  playerId:p.id,roundBet:i===1?200:0,totalBet:i===1?200:100,folded:i===4,allIn:i===8})),
  hole:Object.fromEntries(players.map((p,i)=>[p.id,i===0?["JS","TS"]:["??","??"]])),
  dealerIndex:2,currentIndex:0,stage:"FLOP",currentBet:200,minRaise:200,bigBlind:20,pot:1500,acted:[],handLabel:"Suite"}};
const root={id:"r",code:"TEST01",gameType:"POKER",status:"ACTIVE",minBet:10,maxBet:10000,maxPlayers:13,
  startingBalance:10000,blackjackDealerMode:"HOST",locked:false,players,events:[],game:poker};
const snap=structuredClone(root);
let getDelay=0,inFlight=0,maxInFlight=0;
const page=await browser.newPage();
page.on("pageerror",e=>errors.push(e.message));
try {
  await page.addInitScript(()=>{if(!localStorage.getItem("zenkai-casino:TEST01"))localStorage.setItem("zenkai-casino:TEST01",JSON.stringify({playerId:"p0",sessionToken:"fixture-only"}));});
  await page.route("**/api/rooms/TEST01**",async route=>{
    if(route.request().method()==="POST") {
      const body=route.request().postDataJSON();actions.push(body);
      if(body.action==="SET_CAPACITY")snap.maxPlayers=body.payload.maxPlayers;
      await route.fulfill({json:{ok:true,snapshot:snap}});
    } else {
      inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
      try{if(getDelay)await new Promise(resolve=>setTimeout(resolve,getDelay));await route.fulfill({json:snap});}
      finally{inFlight--;}
    }
  });
  await page.goto(base+"/room/TEST01",{timeout:180000});
  await page.locator(".pokerExperience").waitFor();
  await page.getByRole("button",{name:"Pot",exact:true}).click();
  assert.equal(await page.getByLabel("Total de relance",{exact:true}).inputValue(),"1900");
  await page.getByRole("button",{name:"Relancer",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.amount,1900);
  await page.getByRole("button",{name:"Tapis",exact:true}).click();
  assert.equal(actions.filter(a=>a.payload?.move==="ALLIN").length,0);
  await page.getByRole("button",{name:"Confirmer",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.move,"ALLIN");
  for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]) {
    await page.setViewportSize(size);
    const issues=await page.evaluate(()=>{
      const out=[];
      if(document.documentElement.scrollWidth>innerWidth+1)out.push("horizontal page overflow");
      const seats=[...document.querySelectorAll(".pokerSeat")].map(e=>e.getBoundingClientRect());
      for(let i=0;i<seats.length;i++)for(let j=i+1;j<seats.length;j++){
        const a=seats[i],b=seats[j];
        if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)out.push("overlapping seats");
      }
      for(const b of document.querySelectorAll(".pokerExperience button"))if(b.scrollWidth>b.clientWidth+2)out.push("button text overflow");
      const consoleRect=document.querySelector(".pokerConsole").getBoundingClientRect();
      const arena=document.querySelector(".pokerArena").getBoundingClientRect();
      if(consoleRect.top<arena.bottom-1)out.push("controls obscure table");
      return out;
    });
    assert.deepEqual(issues,[]);
    assert.equal(await page.locator(".pokerSeat").count(),13);
    await page.screenshot({path:path.join(out,`poker-${size.width}.png`),fullPage:true});
    report.push({game:"POKER",viewport:size,seats:13,issues});
  }
  snap.gameType="BLACKJACK";
  snap.game={id:"bj1",status:"ACTIVE",state:{kind:"BLACKJACK",deck:[],dealer:["6S","??"],
    hands:Object.fromEntries(players.slice(1).map(p=>[p.id,{cards:["8S","8H"],bet:100,status:"PLAYING"}])),
    order:players.slice(1).map(p=>p.id),turnIndex:0,dealerMode:"HOST",dealerPlayerId:"p0",dealerPhase:"PLAYERS",dealerRevealed:false}};
  await page.evaluate(()=>localStorage.setItem("zenkai-casino:TEST01",JSON.stringify({playerId:"p1",sessionToken:"fixture-only"})));
  await page.reload();
  await page.locator(".bjHandsGrid").waitFor();
  await page.waitForFunction(()=>{const e=document.querySelector(".bjDealerArt");return e?.complete&&e.naturalWidth>0;});
  await page.getByRole("button",{name:"Tirer",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.move,"HIT");
  for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]) {
    await page.setViewportSize(size);
    const issues=await page.evaluate(()=>{
      const result=[];
      if(document.documentElement.scrollWidth>innerWidth+1)result.push("horizontal overflow");
      for(const el of document.querySelectorAll(".bjHandsGrid .seatCards")){
        const a=el.getBoundingClientRect(),b=el.closest(".playerSeat").getBoundingClientRect();
        if(a.bottom>b.bottom+1||a.right>b.right+1)result.push("cards outside seat");
      }
      for(const el of document.querySelectorAll(".bjPlayerActions button"))if(el.scrollWidth>el.clientWidth+2)result.push("action text overflow");
      if(document.querySelector(".bjPlayerConsole").getBoundingClientRect().bottom>document.querySelector(".bjHandsGrid").getBoundingClientRect().top+1)result.push("controls obscure hands");
      return result;
    });
    assert.deepEqual(issues,[]);
    assert.equal(await page.locator(".bjHandsGrid .playerSeat").count(),12);
    assert(await page.locator(".bjDealerArt").evaluate(e=>e.complete&&e.naturalWidth>0));
    await page.screenshot({path:path.join(out,`blackjack-${size.width}.png`),fullPage:true});
    report.push({game:"BLACKJACK",viewport:size,seats:12,issues});
  }
  snap.game=null;snap.status="LOBBY";
  await page.reload();await page.locator(".bjBetForm").waitFor();
  await page.getByLabel("Votre mise",{exact:false}).fill("777");
  await page.getByRole("button",{name:"Confirmer",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.bet,777);
  await page.screenshot({path:path.join(out,"blackjack-lobby-mobile.png"),fullPage:true});
  report.push({game:"BLACKJACK",state:"lobby",exactBet:777});
  snap.game={id:"bj2",status:"ACTIVE",state:{kind:"BLACKJACK",deck:[],dealer:["6S","??"],
    hands:{p1:{cards:["8S","8H"],bet:100,status:"STAND"}},order:["p1"],turnIndex:1,dealerMode:"HOST",
    dealerPlayerId:"p0",dealerPhase:"DEALER",dealerRevealed:false,dealerAvailableCards:["2C","4H"]}};
  snap.status="ACTIVE";
  await page.evaluate(()=>localStorage.setItem("zenkai-casino:TEST01",JSON.stringify({playerId:"p0",sessionToken:"fixture-only"})));
  await page.reload();await page.getByRole("button",{name:"Révéler",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"2C",exact:true}).click();
  await dialog.getByRole("button",{name:"Révéler",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.card,"2C");
  await dialog.getByRole("button",{name:"Annuler",exact:true}).click();
  delete snap.game.state.dealerAvailableCards;
  await page.reload();await page.getByRole("button",{name:"Révéler",exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector(".busyPill"));
  assert.equal(actions.at(-1).payload.card,undefined);
  assert.equal(await page.getByRole("dialog").count(),0);
  report.push({scenario:"host dealer",privatePicker:true,randomModeNoPicker:true});
  snap.game=null;snap.status="LOBBY";
  await page.evaluate(()=>localStorage.setItem("zenkai-casino:TEST01",JSON.stringify({playerId:"p1",sessionToken:"fixture-only"})));
  getDelay=1200;maxInFlight=0;
  await page.reload();await page.locator(".bjBetForm").waitFor();
  await page.waitForTimeout(4000);
  assert.equal(maxInFlight,1);
  report.push({scenario:"slow connection",delay:1200,maxConcurrentPolls:maxInFlight});
  getDelay=0;
  snap.game=structuredClone(root.game);snap.gameType="POKER";
  snap.game.status="ACTIVE";snap.status="ACTIVE";snap.game.state.currentIndex=1;
  snap.game.state.acted=["p1"];snap.game.state.seats[1].roundBet=100;snap.game.state.currentBet=150;
  snap.game.state.minRaise=100;
  await page.reload();await page.locator(".pokerExperience").waitFor();
  assert(await page.getByRole("button",{name:"Relancer",exact:true}).isDisabled());
  assert(await page.getByRole("button",{name:"Tapis",exact:true}).isDisabled());
  report.push({scenario:"short all-in",raiseDisabled:true,allInDisabled:true});
  await page.goto(base,{timeout:180000});
  for(const size of [{width:1440,height:1000},{width:390,height:844}]) {
    await page.setViewportSize(size);
    await page.locator(".homeSubmit").waitFor();
    assert.equal(await page.getByLabel("Nombre de places").getAttribute("max"),"13");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(out,`home-${size.width}.png`),fullPage:true});
    report.push({scenario:"home",viewport:size});
  }
  await page.getByRole("button",{name:"Rejoindre",exact:true}).click();
  assert(await page.getByLabel("Code du salon").isVisible());
  await page.screenshot({path:path.join(out,"join-mobile.png"),fullPage:true});
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,"report.json"),JSON.stringify({report,actions:actions.map(a=>({action:a.action,payload:a.payload})),errors},null,2));
  console.log(JSON.stringify({screenshots:out,report,errors},null,2));
} finally {await browser.close();}
