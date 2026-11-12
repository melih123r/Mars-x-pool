package com.marsx.finance.marketdata

/** Read-only, deterministic L2 order book. Prices/quantities are integer ticks/lots. */
data class Level(val priceTicks: Long, val quantityLots: Long)
data class BookSnapshot(val sequence: Long, val bids: List<Level>, val asks: List<Level>)
data class BookDelta(val firstSequence: Long, val lastSequence: Long, val bids: List<Level>, val asks: List<Level>)

class SequenceGapException(message: String) : IllegalStateException(message)

class OrderBookReconciler {
    private val bids = sortedMapOf<Long, Long>(compareByDescending { it })
    private val asks = sortedMapOf<Long, Long>()
    var sequence: Long? = null
        private set
    var stale: Boolean = true
        private set

    fun reset() {
        bids.clear(); asks.clear(); sequence = null; stale = true
    }

    fun applySnapshot(snapshot: BookSnapshot) {
        require(snapshot.sequence >= 0)
        reset()
        update(bids, snapshot.bids)
        update(asks, snapshot.asks)
        sequence = snapshot.sequence
        stale = false
    }

    /** Feed-specific adapters must normalize update IDs before calling this. */
    fun applyDelta(delta: BookDelta) {
        val previous = sequence ?: throw SequenceGapException("Snapshot required")
        if (delta.lastSequence <= previous) return // replayed update
        if (delta.firstSequence > previous + 1 || delta.lastSequence < previous + 1) {
            stale = true
            throw SequenceGapException("Sequence gap after $previous")
        }
        update(bids, delta.bids)
        update(asks, delta.asks)
        sequence = delta.lastSequence
    }

    fun bids(): List<Level> = bids.map { Level(it.key, it.value) }
    fun asks(): List<Level> = asks.map { Level(it.key, it.value) }

    private fun update(book: MutableMap<Long, Long>, levels: List<Level>) {
        for (level in levels) {
            require(level.priceTicks > 0 && level.quantityLots >= 0)
            if (level.quantityLots == 0L) book.remove(level.priceTicks)
            else book[level.priceTicks] = level.quantityLots
        }
    }
}
