package com.marsx.pool;
import android.graphics.Color;
/** Immutable palette definitions for the five Finance visual modes. */
public final class FinancePalettes {
 private FinancePalettes(){}
 public static final String[] NAMES={"MARS-X Dark","Midnight Pro","Emerald Trading","Crimson Terminal","Arctic Professional"};
 public static final int[] BACKGROUNDS={Color.rgb(4,7,12),Color.rgb(7,9,23),Color.rgb(5,15,13),Color.rgb(18,7,12),Color.rgb(247,249,253)};
 public static final int[] SURFACES={Color.rgb(12,17,26),Color.rgb(16,19,42),Color.rgb(13,31,25),Color.rgb(33,13,20),Color.WHITE};
 public static final int[] ACCENTS={Color.rgb(255,117,32),Color.rgb(105,119,255),Color.rgb(38,207,133),Color.rgb(237,67,89),Color.rgb(36,99,221)};
 public static final int[] TEXT={Color.WHITE,Color.WHITE,Color.WHITE,Color.WHITE,Color.rgb(23,33,48)};
 public static int safeIndex(int index){return index>=0&&index<NAMES.length?index:0;}
}
