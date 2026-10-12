package com.marsx.pool;

import static org.junit.Assert.*;
import org.junit.Test;

public final class FinanceDepthChartGeometryTest {
 private static FinanceDepthBook.Level level(double price,double size){
  return new FinanceDepthBook.Level(price,size);
 }

 @Test public void mapsBothSidesIntoFiniteUnitCoordinates(){
  FinanceDepthBook book=new FinanceDepthBook(
    new FinanceDepthBook.Level[]{level(100,2),level(99,3)},
    new FinanceDepthBook.Level[]{level(101,4),level(102,6)});
  FinanceDepthChartGeometry.Snapshot g=FinanceDepthChartGeometry.from(book);

  assertEquals(2,g.bidCount());
  assertEquals(2,g.askCount());
  assertEquals(1.0/3.0,g.bidX(0),1e-12);
  assertEquals(0.0,g.bidX(1),1e-12);
  assertEquals(2.0/3.0,g.askX(0),1e-12);
  assertEquals(1.0,g.askX(1),1e-12);
  assertEquals(0.8,g.bidY(0),1e-12);
  assertEquals(0.5,g.bidY(1),1e-12);
  assertEquals(0.6,g.askY(0),1e-12);
  assertEquals(0.0,g.askY(1),1e-12);

  for(int i=0;i<g.bidCount();i++)assertUnit(g.bidX(i),g.bidY(i));
  for(int i=0;i<g.askCount();i++)assertUnit(g.askX(i),g.askY(i));
 }

 @Test public void snapshotDoesNotExposeMutableArrays(){
  FinanceDepthBook book=new FinanceDepthBook(
    new FinanceDepthBook.Level[]{level(10,1)},
    new FinanceDepthBook.Level[]{level(11,1)});
  FinanceDepthChartGeometry.Snapshot g=FinanceDepthChartGeometry.from(book);
  double x=g.bidX(0),y=g.bidY(0);
  assertEquals(x,g.bidX(0),0.0);
  assertEquals(y,g.bidY(0),0.0);
 }

 @Test(expected=IllegalArgumentException.class)
 public void rejectsMissingBook(){
  FinanceDepthChartGeometry.from(null);
 }

 private static void assertUnit(double x,double y){
  assertTrue(Double.isFinite(x));assertTrue(Double.isFinite(y));
  assertTrue(x>=0&&x<=1);assertTrue(y>=0&&y<=1);
 }
}
