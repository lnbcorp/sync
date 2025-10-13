package com.example.sync_mobile

import android.Manifest
import android.app.Activity
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import androidx.annotation.NonNull
import androidx.core.app.ActivityCompat
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry

class AudioCapturePlugin: FlutterPlugin, MethodChannel.MethodCallHandler, EventChannel.StreamHandler, ActivityAware, PluginRegistry.ActivityResultListener {
  private lateinit var context: Context
  private var activity: Activity? = null
  private lateinit var methodChannel: MethodChannel
  private lateinit var eventChannel: EventChannel

  private var eventSink: EventChannel.EventSink? = null
  private var audioRecord: AudioRecord? = null
  private var handlerThread: HandlerThread? = null
  private var handler: Handler? = null
  private var mediaProjection: MediaProjection? = null
  private var mediaProjectionManager: MediaProjectionManager? = null

  companion object {
    private const val METHOD_CHANNEL = "audio_capture"
    private const val EVENT_CHANNEL = "audio_capture_stream"
    private const val REQ_MEDIA_PROJECTION = 9001
  }

  override fun onAttachedToEngine(@NonNull binding: FlutterPlugin.FlutterPluginBinding) {
    context = binding.applicationContext
    methodChannel = MethodChannel(binding.binaryMessenger, METHOD_CHANNEL)
    methodChannel.setMethodCallHandler(this)
    eventChannel = EventChannel(binding.binaryMessenger, EVENT_CHANNEL)
    eventChannel.setStreamHandler(this)
  }

  override fun onDetachedFromEngine(@NonNull binding: FlutterPlugin.FlutterPluginBinding) {
    methodChannel.setMethodCallHandler(null)
    eventChannel.setStreamHandler(null)
  }

  // ActivityAware
  override fun onAttachedToActivity(binding: ActivityPluginBinding) {
    activity = binding.activity
    binding.addActivityResultListener(this)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      mediaProjectionManager = activity!!.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    }
  }
  override fun onDetachedFromActivityForConfigChanges() { activity = null }
  override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) { onAttachedToActivity(binding) }
  override fun onDetachedFromActivity() { activity = null }

  // EventChannel
  override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
    eventSink = events
  }
  override fun onCancel(arguments: Any?) {
    eventSink = null
  }

  // MethodChannel
  override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
    when (call.method) {
      "requestPermission" -> {
        ActivityCompat.requestPermissions(activity!!, arrayOf(Manifest.permission.RECORD_AUDIO), 0)
        result.success(true)
      }
      "start" -> {
        val sampleRate = (call.argument<Int>("sampleRate") ?: 48000)
        val channels = (call.argument<Int>("channelCount") ?: 2)
        val ok = startCapture(sampleRate, channels)
        result.success(ok)
      }
      "stop" -> {
        stopCapture()
        result.success(true)
      }
      else -> result.notImplemented()
    }
  }

  private fun startCapture(sampleRate: Int, channelCount: Int): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      // AudioPlaybackCapture requires Android 10+
      return false
    }
    val act = activity ?: return false
    if (mediaProjection == null) {
      val intent = mediaProjectionManager?.createScreenCaptureIntent()
      act.startActivityForResult(intent, REQ_MEDIA_PROJECTION)
      // Will proceed after onActivityResult
      return true
    }
    return startRecorder(sampleRate, channelCount)
  }

  private fun startRecorder(sampleRate: Int, channelCount: Int): Boolean {
    stopCapture()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false

    val builder = AudioPlaybackCaptureConfiguration.Builder(mediaProjection!!)
      .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
      .addMatchingUsage(AudioAttributes.USAGE_GAME)
      .build()

    val channelConfig = if (channelCount == 1) AudioFormat.CHANNEL_IN_MONO else AudioFormat.CHANNEL_IN_STEREO

    val format = AudioFormat.Builder()
      .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
      .setSampleRate(sampleRate)
      .setChannelMask(channelConfig)
      .build()

    audioRecord = AudioRecord.Builder()
      .setAudioFormat(format)
      .setBufferSizeInBytes(AudioRecord.getMinBufferSize(sampleRate, channelConfig, AudioFormat.ENCODING_PCM_16BIT))
      .setAudioPlaybackCaptureConfig(builder)
      .build()

    handlerThread = HandlerThread("audio-capture-thread").also { it.start() }
    handler = Handler(handlerThread!!.looper)

    audioRecord?.startRecording()

    handler?.post(object : Runnable {
      override fun run() {
        val buf = ByteArray(4096)
        val read = audioRecord?.read(buf, 0, buf.size) ?: -1
        if (read > 0) {
          eventSink?.success(buf.copyOf(read))
        }
        if (audioRecord?.recordingState == AudioRecord.RECORDSTATE_RECORDING) {
          handler?.post(this)
        }
      }
    })

    return true
  }

  private fun stopCapture() {
    audioRecord?.stop()
    audioRecord?.release()
    audioRecord = null
    handlerThread?.quitSafely()
    handlerThread = null
    handler = null
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?): Boolean {
    if (requestCode == REQ_MEDIA_PROJECTION && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      if (resultCode == Activity.RESULT_OK && data != null) {
        mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)
        // Attempt to start recorder with defaults
        startRecorder(48000, 2)
        return true
      } else {
        eventSink?.error("projection_denied", "User denied screen/audio capture permission", null)
        return false
      }
    }
    return false
  }
}
