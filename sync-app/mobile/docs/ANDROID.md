# Android Background Audio Capture (MediaProjection + Foreground Service)

This guide wires native Android scaffolding to enable background audio capture of other apps (Android 10+), controlled from Flutter via a MethodChannel.

- Package names below use `<your.package>`. Replace with your actual appId (applicationId) in `android/app/build.gradle` and AndroidManifest.

## 1) Add permissions and service to AndroidManifest

File: `android/app/src/main/AndroidManifest.xml`

```xml
<manifest ...>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <!-- Required on Android 14+ to run mediaProjection in foreground service -->
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
  <!-- Optional: Needed to show foreground notification on Android 13+ -->
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

  <application ...>
    <service
      android:name=".<your.package>.webrtc.CaptureForegroundService"
      android:exported="false"
      android:foregroundServiceType="mediaProjection" />
  </application>
</manifest>
```

Notes:
- `FOREGROUND_SERVICE_MEDIA_PROJECTION` is required on API 34+.
- On Android 13+, request `POST_NOTIFICATIONS` at runtime to display the service notification.

## 2) MethodChannel in MainActivity

File: `android/app/src/main/kotlin/<your/package>/MainActivity.kt`

```kotlin
package <your.package>

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
  private val CHANNEL = "sync_mobile/webrtc"
  private val REQ_MEDIA_PROJECTION = 10110
  private var pendingResult: MethodChannel.Result? = null

  override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
    super.configureFlutterEngine(flutterEngine)
    MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
      .setMethodCallHandler { call, result ->
        when (call.method) {
          "requestPermissions" -> {
            // Optionally request POST_NOTIFICATIONS on Android 13+ (omitted for brevity)
            result.success(true)
          }
          "startBackgroundAudioCapture" -> {
            pendingResult = result
            val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val intent = mpm.createScreenCaptureIntent()
            startActivityForResult(intent, REQ_MEDIA_PROJECTION)
          }
          "stopBackgroundAudioCapture" -> {
            stopService(Intent(this, Class.forName("<your.package>.webrtc.CaptureForegroundService")))
            result.success(null)
          }
          else -> result.notImplemented()
        }
      }
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode == REQ_MEDIA_PROJECTION) {
      val res = pendingResult
      pendingResult = null
      if (resultCode == Activity.RESULT_OK && data != null) {
        val svc = Intent(this, Class.forName("<your.package>.webrtc.CaptureForegroundService"))
        svc.putExtra("resultCode", resultCode)
        svc.putExtra("data", data)
        startForegroundService(svc)
        res?.success(true)
      } else {
        res?.success(false)
      }
    }
  }
}
```

## 3) Foreground Service with AudioPlaybackCapture

File: `android/app/src/main/java/<your/package>/webrtc/CaptureForegroundService.kt`

```kotlin
package <your.package>.webrtc

import android.app.*
import android.content.Intent
import android.media.*
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder

class CaptureForegroundService : Service() {
  private var projection: MediaProjection? = null
  private var recorder: AudioRecord? = null

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    val notification = Notification.Builder(this, "sync_foreground")
      .setContentTitle("Sync audio capture")
      .setContentText("Sharing system audio")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .build()
    startForeground(1001, notification)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val resultCode = intent?.getIntExtra("resultCode", Activity.RESULT_CANCELED) ?: Activity.RESULT_CANCELED
    val data = intent?.getParcelableExtra<Intent>("data")
    val mpm = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    projection = mpm.getMediaProjection(resultCode, data!!)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val config = AudioPlaybackCaptureConfiguration.Builder(projection!!)
        .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
        .build()
      val format = AudioFormat.Builder()
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setSampleRate(48000)
        .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
        .build()
      val minBuf = AudioRecord.getMinBufferSize(48000, AudioFormat.CHANNEL_IN_STEREO, AudioFormat.ENCODING_PCM_16BIT)
      recorder = AudioRecord.Builder()
        .setAudioFormat(format)
        .setBufferSizeInBytes(minBuf * 2)
        .setAudioPlaybackCaptureConfig(config)
        .build()
      recorder?.startRecording()
      // TODO: pipe PCM frames to Flutter/FlutterWebRTC as a track (e.g., via local UDP or JNI)
    }
    return START_STICKY
  }

  override fun onDestroy() {
    recorder?.stop()
    recorder?.release()
    projection?.stop()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel("sync_foreground", "Sync", NotificationManager.IMPORTANCE_LOW)
      val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
      nm.createNotificationChannel(channel)
    }
  }
}
```

### Attaching to WebRTC
- The above captures PCM. To attach to `flutter_webrtc`, you can:
  - Use a local socket to send PCM to Flutter and create a custom `MediaStreamTrack` (advanced), or
  - Prefer using source APIs provided by `flutter_webrtc` if available on your Android version to create an audio track backed by `AudioRecord`.

For MVP, verify permissions/service flow first (that `startBackgroundAudioCapture()` returns true and service runs), then add the audio pipe.

## 4) Flutter usage

```dart
final rtc = WebRTCService(...);
await rtc.init();
final okPerms = await rtc.requestBackgroundCapturePermissions();
if (!okPerms) return;
final okStart = await rtc.startBackgroundAudioCapture();
if (!okStart) {
  // show guidance to user
}
```

---

## Troubleshooting
- Android 10+ required for AudioPlaybackCapture.
- Some apps opt-out from capture; audio may not be available.
- On Android 13+, request notifications permission for foreground service.
- On Android 14+, include `FOREGROUND_SERVICE_MEDIA_PROJECTION` or service will crash.

## What you need to do next

1. Apply manifest updates in android/app/src/main/AndroidManifest.xml.
2. Create:
a) android/app/src/main/kotlin/<your/package>/MainActivity.kt MethodChannel handlers.
b) android/app/src/main/java/<your/package>/webrtc/CaptureForegroundService.kt foreground service.
3. Build and test on device:
a) Call requestBackgroundCapturePermissions() then startBackgroundAudioCapture() from UI.
b) Verify service runs and, after capture wiring, listeners receive system audio.