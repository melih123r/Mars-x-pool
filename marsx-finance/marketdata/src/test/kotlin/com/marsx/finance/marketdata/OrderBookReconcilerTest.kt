package com.marsx.finance.marketdata

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class OrderBookReconcilerTest {
    @Test fun snapshotAndDelta() {
        val book = OrderBookReconciler()
        book.applySnapshot(BookSnapshot(100, listOf(Level(1000, 5)), listOf(Level(1010, 4))))
        book.applyDelta(BookDelta(101, 101, listOf(Level(1000, 3)), listOf(Level(1010, 0))))
        assertEquals(101, book.sequence)
        assertEquals(listOf(Level(1000, 3)), book.bids())
        assertTrue(book.asks().isEmpty())
        assertFalse(book.stale)
    }

    @Test fun gapMarksStale() {
        val book = OrderBookReconciler()
        book.applySnapshot(BookSnapshot(20, emptyList(), emptyList()))
        assertFailsWith<SequenceGapException> {
            book.applyDelta(BookDelta(23, 23, emptyList(), emptyList()))
        }
        assertTrue(book.stale)
    }

    @Test fun replayIsIgnored() {
        val book = OrderBookReconciler()
        book.applySnapshot(BookSnapshot(5, listOf(Level(100, 1)), emptyList()))
        book.applyDelta(BookDelta(4, 5, listOf(Level(100, 9)), emptyList()))
        assertEquals(1, book.bids().single().quantityLots)
    }
}
