package com.marsx.network.demo

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.ViewGroup
import android.widget.*

/** Offline demonstration only: no INTERNET permission, network routing, SDK, or earnings. */
class MainActivity : Activity() {
 private var consent = false
 private var running = false
 private var points = 0
 private lateinit var status: TextView
 private lateinit var count: TextView
 private lateinit var start: Button
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  val root = LinearLayout(this).apply {
   orientation = LinearLayout.VERTICAL
   setPadding(32, 44, 32, 24)
   setBackgroundColor(Color.rgb(20, 20, 20))
  }
  fun label(value: String, size: Float = 18f) = TextView(this).apply {
   text = value; textSize = size; setTextColor(Color.WHITE); setPadding(0, 8, 0, 16)
  }
  root.addView(label("MARS-X NETWORK", 27f))
  root.addView(label("OFFLINE DEMO • No connection sharing or real rewards", 14f))
  val toggle = CheckBox(this).apply {
   text = "I agree to run local demonstration only"
   setTextColor(Color.WHITE)
   setOnCheckedChangeListener { _, checked ->
    consent = checked
    if (!checked) { running = false; points = 0 }
    refresh()
   }
  }
  root.addView(toggle)
  status = label("Status: OFF")
  count = label("Test points: 0")
  root.addView(status)
  root.addView(count)
  start = Button(this).apply {
   text = "START DEMO"
   setOnClickListener { if (consent) { running = !running; refresh() } }
  }
  root.addView(start)
  root.addView(Button(this).apply {
   text = "SIMULATE VERIFIED TEST RECEIPT"
   setOnClickListener { if (running) { points++; refresh() } }
  })
  root.addView(Button(this).apply {
   text = "STOP & RESET"
   setOnClickListener { running = false; points = 0; refresh() }
  })
  root.addView(label("Points are fictional. This app does not connect to the internet.", 13f))
  setContentView(root, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  refresh()
 }
 private fun refresh() {
  status.text = "Status: " + if (running) "LOCAL TEST RUNNING" else if (consent) "READY" else "OFF"
  count.text = "Test points: $points"
  start.isEnabled = consent
  start.text = if (running) "PAUSE DEMO" else "START DEMO"
 }
}
