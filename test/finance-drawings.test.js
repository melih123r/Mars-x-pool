import test from "node:test";
import assert from "node:assert/strict";
import {point,trendLine,fibonacciRetracement,riskReward,priceToY,timeToX} from "../global-engine/finance-drawings.js";
test("trend line interpolates correctly",()=>assert.equal(trendLine(point(1000,100),point(2000,120)).priceAt(1500),110));
test("trend line rejects duplicate timestamps",()=>assert.throws(()=>trendLine(point(1000,100),point(1000,120))));
test("Fibonacci levels preserve anchors",()=>{const x=fibonacciRetracement(point(1000,100),point(2000,200));assert.equal(x.levels.length,7);assert.equal(x.levels[0].price,100);assert.equal(x.levels[6].price,200);});
test("risk/reward supports long and short",()=>{assert.equal(riskReward({entry:100,stop:90,target:130}).ratio,3);assert.equal(riskReward({entry:100,stop:110,target:80,side:"short"}).ratio,2);});
test("risk/reward rejects invalid direction",()=>assert.throws(()=>riskReward({entry:100,stop:110,target:130})));
test("viewport transforms",()=>{assert.equal(priceToY(150,{min:100,max:200,height:400}),200);assert.equal(timeToX(150,{start:100,end:200,width:400}),200);});
