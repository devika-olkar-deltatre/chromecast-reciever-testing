# Diva Chromecast Receiver App - Command and Messaging Reference

This document provides an overview of the commands available in the Chromecast receiver app and details how to send and receive messages between the sender (client) and the receiver (Chromecast device). It includes sample code for handling messages in Android and iOS.

---

## DIVA Channel

The channel used for custom messaging between the sender and receiver is defined as:

```javascript
let EXTERNAL_CHANNEL = 'urn:x-cast:com.deltatre.cast.external';
```

## Receiver Commands

### Commands Received by the Receiver

These commands are received by the receiver app and handled using `addCustomMessageListener`. Each command is used to control various aspects of media playback or the app's behavior.

1. **SETUP**
2. **LOAD**
3. **PLAY**
4. **PAUSE**
5. **SEEK**
6. **AUDIO**
7. **CC**
8. **STATUS**
9. **CLOSE**
10. **DEBUG**
11. **UPDATE**

### Command: SETUP

**Description**: Initializes the receiver with specific settings.

**Parameters**:

- `bg`: (optional) URL for the background image. `"none"` to remove the background.

**Example**:

```json
{
  "action": "SETUP",
  "params": {
    "bg": "https://example.com/background.jpg"
  }
}
```

### Command: LOAD

**Description**: Loads a media stream.

**Parameters**:

- `url`: (required) Media stream URL.
- `format`: (required) Stream format, e.g., `"HLS"` or `"DASH"`.
- `time`: (optional) Start time (in seconds).
- `useCredentials`: (optional) Boolean to include credentials.
- `audioTrackSelection`: (optional) Preselect an audio track.
- `ccTrackSelection`: (optional) Preselect a closed caption track.
- `licenseUrl`: (optional) License URL for DRM content.
- `authToken`: (optional) Authorization token.
- `headers`: (optional) Additional headers.

**Example**:

```json
{
  "action": "LOAD",
  "params": {
    "url": "https://example.com/stream.m3u8",
    "format": "HLS",
    "time": 0,
    "useCredentials": true,
    "audioTrackSelection": "en",
    "ccTrackSelection": "es",
    "licenseUrl": "https://example.com/license",
    "authToken": "Bearer abc123",
    "headers": {
      "Custom-Header": "value"
    }
  }
}
```

### Command: PLAY

**Description**: Starts or resumes playback.

**Parameters**: None

**Example**:

```json
{
  "action": "PLAY"
}
```

### Command: PAUSE

**Description**: Pauses playback.

**Parameters**: None

**Example**:

```json
{
  "action": "PAUSE"
}
```

### Command: SEEK

**Description**: Seeks to a specific time.

**Parameters**:

- `time`: (required) Time to seek to (in seconds) or `"live"` for live content.

**Example**:

```json
{
  "action": "SEEK",
  "params": {
    "time": 120
  }
}
```

### Command: AUDIO

**Description**: Changes the audio track.

**Parameters**:

- `audioTrackSelection`: (required) Audio track selection based on title or language.

**Example**:

```json
{
  "action": "AUDIO",
  "params": {
    "audioTrackSelection": "es"
  }
}
```

### Command: CC

**Description**: Changes the closed caption track.

**Parameters**:

- `ccTrackSelection`: (required) Closed caption track selection.

**Example**:

```json
{
  "action": "CC",
  "params": {
    "ccTrackSelection": "en"
  }
}
```

### Command: STATUS

**Description**: Requests the current playback status.

**Parameters**: None

**Example**:

```json
{
  "action": "STATUS"
}
```

### Command: CLOSE

**Description**: Closes the media session.

**Parameters**:

- `forced`: (optional) Boolean indicating forced closure.
- `senderId`: (optional) Sender's ID.
- `currentSenderId`: (optional) Current active sender ID.

**Example**:

```json
{
  "action": "CLOSE",
  "params": {
    "forced": true,
    "senderId": "abc123",
    "currentSenderId": "def456"
  }
}
```

### Command: DEBUG

**Description**: Toggles debug mode.

**Parameters**:

- `receiverDebug`: (required) Boolean to enable/disable receiver debug.
- `videoDebug`: (optional) Boolean to enable/disable video debug.

**Example**:

```json
{
  "action": "DEBUG",
  "params": {
    "receiverDebug": true,
    "videoDebug": false
  }
}
```

### Command: UPDATE

**Description**: Updates session properties.

**Parameters**:

- `title`: (optional) Update the media title.
- `eop`: (optional) Boolean indicating end of playback.
- `image`: (optional) Image URL for EOP or other purposes.

**Example**:

```json
{
  "action": "UPDATE",
  "params": {
    "title": "New Title",
    "eop": true,
    "image": "https://example.com/eop.jpg"
  }
}
```

---

## Messages Sent by the Receiver

These messages are sent from the receiver to the sender using the `sendCustomMessage` function.

### Sample Usage of `sendCustomMessage`

```javascript
const sendCustomMessage = (channel, sender, message) => {
  if (JSON.stringify(previousMgs) !== JSON.stringify(message)) {
    context.sendCustomMessage(channel, sender, message);
  }
  previousMgs = { ...message };
};
```

### Status Update Example

```javascript
let statusMessage = {
  command: ChromeCastCommands.status,
  currentTime: video.currentTime,
  duration: video.duration,
  playerState: ChromeCastState.playing,
  ccTracks: [
    { id: "1", label: "English", language: "en", mode: "showing" }
  ],
  audioTracks: ["English", "Spanish"]
};

sendCustomMessage(DIVA_CHANNEL, currentSenderId, statusMessage);
```

---

## Implementing Message Handling in Android and iOS

### Android

To handle custom messages in your Android sender app, use the following code:

```kotlin
val castContext = CastContext.getSharedInstance(context)
val sessionManager = castContext.sessionManager

val castSession = sessionManager.currentCastSession

if (castSession != null && castSession.isConnected) {
    val DIVA_CHANNEL = "urn:x-cast:com.deltatre.cast.diva"

    castSession.setMessageReceivedCallbacks(DIVA_CHANNEL) { castDevice, receivedNamespace, message ->
        // Handle the message received from the receiver
    }

    // Send a message to the receiver
    val messageToSend = "{ 'action': 'PLAY' }"
    try {
        castSession.sendMessage(DIVA_CHANNEL, messageToSend)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    // Message sent successfully
                } else {
                    // Message send failed
                }
            }
    } catch (e: Exception) {
        Log.e(TAG, "Exception while sending message", e)
    }
}
```

### iOS

To handle custom messages in your iOS sender app, use the following code:

```swift
if let castSession = CastContext.sharedInstance().sessionManager.currentCastSession {
    let messageChannel = GCKCastChannel(namespace: DIVA_CHANNEL)

    castSession.add(messageChannel)

    // Set up a message received handler
    messageChannel.onMessageReceived = { (namespace, message) in
        // Handle the message received from the receiver
    }

    // Send a message to the receiver
    let messageToSend = "{ \"action\": \"PLAY\" }"
    castSession.sendMessage(messageToSend, toNamespace: DIVA_CHANNEL) { error in
        if let error = error {
            // Handle the error
        } else {
            // Message sent successfully
        }
    }
}
```

