# iOS Background Audio Sharing (ReplayKit Broadcast Upload Extension)

This guide outlines how to enable background screen/system audio sharing on iOS using a ReplayKit Broadcast Upload Extension.

Note: iOS requires the user to manually start a broadcast from Control Center; apps cannot auto-start capture in the background.

## 1) Create a ReplayKit Broadcast Upload Extension

In Xcode:
- Open the iOS workspace (ios/Runner.xcworkspace).
- File > New > Target... > iOS > Broadcast Upload Extension.
- Name it, e.g., `SyncBroadcastUploadExtension`.
- This creates a new target with a `SampleHandler.swift` file.

## 2) Configure Capabilities and Background Modes

For the **host app (Runner)**:
- Enable Background Modes with **Audio**.
- If using App Groups for IPC, add an App Group and use the same group in the extension.

For the **extension target**:
- Check **App Sandbox** as needed.
- Add the same **App Group** if you use it for IPC.

Info.plist (Runner):
- Add `UIBackgroundModes` with `audio`.

## 3) Broadcast flow and audio forwarding

Users must:
- Open Control Center.
- Long-press Screen Recording.
- Select `SyncBroadcastUploadExtension`.
- Tap **Start Broadcast**.

In `SampleHandler.swift`, you receive audio sample buffers:

```swift
import ReplayKit

class SampleHandler: RPBroadcastSampleHandler {
  override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
    // TODO: Initialize any resources needed to forward audio to the host app
  }

  override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
    switch sampleBufferType {
    case .audioApp:
      // TODO: Forward app audio to host app (e.g., via App Group shared memory or local UDP socket)
      break
    case .audioMic:
      // We don't forward mic for echo-free policy
      break
    default:
      break
    }
  }

  override func broadcastFinished() {
    // Cleanup
  }
}
```

### Forwarding strategies
- **App Group + shared ring buffer**: Host app reads PCM frames and feeds into a `flutter_webrtc` custom track.
- **Local UDP socket**: Extension sends PCM to `localhost`, host app listens and feeds into a track.
- **ReplayKit frameworks**: There is no direct Flutter API; you must bridge at native level then expose to Dart via MethodChannel.

## 4) Flutter MethodChannel integration

`webrtc_service_mobile.dart` defines a MethodChannel `sync_mobile/webrtc` with methods:
- `requestPermissions` (iOS: show guidance on starting broadcast)
- `startBackgroundAudioCapture` (iOS: show instructions/deep link to Control Center)
- `stopBackgroundAudioCapture` (iOS: stop broadcast)

Implement in `AppDelegate.swift`:

```swift
import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let controller : FlutterViewController = window?.rootViewController as! FlutterViewController
    let channel = FlutterMethodChannel(name: "sync_mobile/webrtc", binaryMessenger: controller.binaryMessenger)

    channel.setMethodCallHandler({ (call: FlutterMethodCall, result: FlutterResult) -> Void in
      switch call.method {
      case "requestPermissions":
        // iOS requires manual Control Center start; return true and show guidance in UI
        result(true)
      case "startBackgroundAudioCapture":
        // Optionally present instructions view; cannot auto-open Control Center
        result(true)
      case "stopBackgroundAudioCapture":
        // If you maintain a connection to the extension, signal it to stop
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    })

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

## 5) Attaching to WebRTC in the host app
- Once PCM reaches the host app, create a local `MediaStream` and audio track and attach it to the existing `RTCPeerConnection` senders.
- You can use a custom audio source in native code and expose a handle to Flutter via MethodChannel, or push PCM into a Flutter-side custom track if supported.

## 6) Testing
- Build to an iOS device: `flutter run -d <ios_device>`.
- In the app, call:
  - `await rtc.requestBackgroundCapturePermissions()`.
  - `await rtc.startBackgroundAudioCapture()` (this will display guidance).
- Start the broadcast from Control Center targeting your extension.
- Verify listeners receive audio and source label updates (if you feed label metadata).

## Notes
- iOS policies prevent auto background start; user interaction is required.
- Some media apps can restrict ReplayKit capture.
- Ensure you comply with App Store policies when capturing other apps' audio.

## What you need to do next

1. In Xcode, add a ReplayKit Broadcast Upload Extension target.
2. Configure entitlements and background modes.
3. Implement SampleHandler.swift to forward app/system audio to the host app (via App Group/shared buffer or local UDP).
4. Implement MethodChannel handlers in AppDelegate.
5. Build to device, start broadcast from Control Center, verify streaming