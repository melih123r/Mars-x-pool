plugins {
 id("com.android.application")
 id("org.jetbrains.kotlin.android")
}
android {
 namespace = "com.marsx.network.demo"
 compileSdk = 35
 defaultConfig {
  applicationId = "com.marsx.network.demo"
  minSdk = 26
  targetSdk = 35
  versionCode = 1
  versionName = "0.1.0-sandbox"
 }
 compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
 kotlinOptions { jvmTarget = "17" }
}
