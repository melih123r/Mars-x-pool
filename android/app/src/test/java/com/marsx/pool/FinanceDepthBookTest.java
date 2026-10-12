package com.marsx.pool;

import static org.junit.Assert.*;
import org.junit.Test;

/** Regression coverage for the bounded, read-only depth-book model. */
public final class FinanceDepthBookTest {
 private static FinanceDepthBook.Level l(double price,double size){
  return new FinanceDepthBook.Level(price,size);
 }

 @Test public void derivesCumulativeDepthSpreadAndMidPrice(){
  FinanceDepthBook book=new FinanceDepthBook(
    new FinanceDepthBook.Level[]{l(100,2),l(99,3),l(98,5)},
    new FinanceDepthBook.Level[]{l(101,4),l(102,6)});
  assertEquals(3,book.bidCount());
  assertEquals(2,book.askCount());
  assertEquals(2,book.bidCumulativeAt(0),0.0);
  assertEquals(5,book.bidCumulativeAt(1),0.0);
  assertEquals(10,book.bidCumulativeAt(2),0.0);
  assertEquals(4,book.askCumulativeAt(0),0.0);
  assertEquals(10,book.askCumulativeAt(1),0.0);
  assertEquals(10,book.maxCumulative(),0.0);
  assertEquals(100,book.bestBid(),0.0);
  assertEquals(101,book.bestAsk(),0.0);
  assertEquals(100.5,book.midPrice(),0.0);
  assertEquals(1,book.spread(),0.0);
  assertEquals(1.0/100.5*10000.0,book.spreadBps(),1e-9);
 }

 @Test public void snapshotsInputArrays(){
  FinanceDepthBook.Level[] bids={l(100,1),l(99,2)};
  FinanceDepthBook.Level[] asks={l(101,3),l(102,4)};
  FinanceDepthBook book=new FinanceDepthBook(bids,asks);
  bids[0]=l(50,50);
  asks[0]=l(150,50);
  assertEquals(100,book.bestBid(),0.0);
  assertEquals(101,book.bestAsk(),0.0);
 }

 @Test public void acceptsConfiguredMaximumLevelCount(){
  FinanceDepthBook.Level[] bids=new FinanceDepthBook.Level[FinanceDepthBook.MAX_LEVELS_PER_SIDE];
  FinanceDepthBook.Level[] asks=new FinanceDepthBook.Level[FinanceDepthBook.MAX_LEVELS_PER_SIDE];
  for(int i=0;i<bids.length;i++){
   bids[i]=l(1000-i,1);
   asks[i]=l(1001+i,1);
  }
  FinanceDepthBook book=new FinanceDepthBook(bids,asks);
  assertEquals(FinanceDepthBook.MAX_LEVELS_PER_SIDE,book.bidCount());
  assertEquals(FinanceDepthBook.MAX_LEVELS_PER_SIDE,book.askCount());
 }

 @Test public void rejectsEmptyUnorderedDuplicateAndCrossedBooks(){
  assertThrows(IllegalArgumentException.class,()->new FinanceDepthBook(
    new FinanceDepthBook.Level[0],new FinanceDepthBook.Level[]{l(101,1)}));
  assertThrows(IllegalArgumentException.class,()->new FinanceDepthBook(
    new FinanceDepthBook.Level[]{l(99,1),l(100,1)},new FinanceDepthBook.Level[]{l(101,1)}));
  assertThrows(IllegalArgumentException.class,()->new FinanceDepthBook(
    new FinanceDepthBook.Level[]{l(100,1),l(100,2)},new FinanceDepthBook.Level[]{l(101,1)}));
  assertThrows(IllegalArgumentException.class,()->new FinanceDepthBook(
    new FinanceDepthBook.Level[]{l(101,1)},new FinanceDepthBook.Level[]{l(101,1)}));
 }

 @Test public void rejectsInvalidLevelsBoundsAndCumulativeOverflow(){
  assertThrows(IllegalArgumentException.class,()->l(Double.NaN,1));
  assertThrows(IllegalArgumentException.class,()->l(1,0));
  FinanceDepthBook.Level[] tooMany=new FinanceDepthBook.Level[FinanceDepthBook.MAX_LEVELS_PER_SIDE+1];
  for(int i=0;i<tooMany.length;i++)tooMany[i]=l(1000-i,1);
  assertThrows(IllegalArgumentException.class,()->new FinanceDepthBook(
    tooMany,new FinanceDepthBook.Level[]{l(2000,1)}));
  assertThrows(IllegalArgumentException.class,()->new FinanceDepthBook(
    new FinanceDepthBook.Level[]{l(100,Double.MAX_VALUE),l(99,Double.MAX_VALUE)},
    new FinanceDepthBook.Level[]{l(101,1)}));
 }
}
