package com.marsx.network.demo

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.ViewGroup
import android.widget.*
import android.os.BatteryManager
import android.content.IntentFilter
import android.content.Intent

/** Offline, foreground-only demonstration. No INTERNET permission, proxy, or rewards. */
class MainActivity : Activity() {
 private val handler = Handler(Looper.getMainLooper())
 private var consent = false
 private var running = false
 private var points = 0
 private var elapsedMs = 0L
 private var startedAt = 0L
 private lateinit var status: TextView
 private lateinit var count: TextView
 private lateinit var timer: TextView
 private lateinit var start: Button
 private val tick = object : Runnable {
  override fun run() {
   if (running) {
    timer.text = "Demo uptime: ${(elapsedMs + SystemClock.elapsedRealtime() - startedAt) / 1000}s"
    handler.postDelayed(this, 1000)
   }
  }
 }
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  // Never restore consent automatically. User opts in again on each launch.
  val root = LinearLayout(this).apply {
   orientation = LinearLayout.VERTICAL
   setPadding(32, 44, 32, 24)
   setBackgroundColor(Color.rgb(20, 20, 20))
  }
  fun label(value: String, size: Float = 18f) = TextView(this).apply {
   text = value; textSize = size; setTextColor(Color.WHITE); setPadding(0, 8, 0, 16)
  }
  root.addView(label("MARS-X NETWORK", 27f))
  root.addView(label("OFFLINE SANDBOX • no IP sharing, traffic, or money", 14f))
  val toggle = CheckBox(this).apply {
   text = "I agree to this local demonstration only"
   setTextColor(Color.WHITE)
   setOnCheckedChangeListener { _, checked ->
    consent = checked
    if (!checked) { pauseDemo(); points = 0; elapsedMs = 0L }
    refresh()
   }
  }
  root.addView(toggle)
  status = label("Status: OFF")
  count = label("Fictional test points: 0")
  timer = label("Demo uptime: 0s")
  root.addView(status)
  root.addView(count)
  root.addView(timer)
  start = Button(this).apply {
   text = "START DEMO"
   setOnClickListener {
    if (!consent) return@setOnClickListener
    val battery = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val percent = if (level >= 0 && scale > 0) level * 100 / scale else -1
    if (!running && percent !in 16..100) {
     Toast.makeText(this@MainActivity, "Battery unavailable or at/below 15%: demo blocked", Toast.LENGTH_LONG).show()
     return@setOnClickListener
    }
    if (running) pauseDemo() else {
     running = true
     startedAt = SystemClock.elapsedRealtime()
     handler.removeCallbacks(tick)
     handler.post(tick)
    }
    refresh()
   }
  }
  root.addView(start)
  root.addView(Button(this).apply {
   text = "ADD FICTIONAL TEST POINT"
   setOnClickListener { if (running) { points++; refresh() } }
  })
  root.addView(Button(this).apply {
   text = "STOP AND RESET"
   setOnClickListener { pauseDemo(); elapsedMs = 0L; points = 0; refresh() }
  })
  root.addView(label("This screen is a UI simulation. No network requests or actual earnings.", 13f))
  setContentView(root, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  refresh()
 }
 private fun pauseDemo() {
  if (running) elapsedMs += SystemClock.elapsedRealtime() - startedAt
  running = false
  handler.removeCallbacks(tick)
 }
 override fun onStop() { pauseDemo(); if (::start.isInitialized) refresh(); super.onStop() }
 override fun onDestroy() { handler.removeCallbacks(tick); super.onDestroy() }
 private fun refresh() {
  status.text = "Status: " + if (running) "LOCAL DEMO RUNNING" else if (consent) "READY / PAUSED" else "OFF"
  count.text = "Fictional test points: $points"
  timer.text = "Demo uptime: ${(elapsedMs + if (running) SystemClock.elapsedRealtime() - startedAt else 0L) / 1000}s"
  start.isEnabled = consent
  start.text = if (running) "PAUSE DEMO" else "START DEMO"
 }
}
