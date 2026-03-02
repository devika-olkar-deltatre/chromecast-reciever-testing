/*global $, jQuery, cast, Hls */
let DIVA_CHANNEL = 'urn:x-cast:com.deltatre.cast.diva';
let liveTolerance = 35;

let stateInterval;
let convivaSettings;
let videoEnded = false;
let ccAlreadySelected = false;

let hls,
    shakaPlayer,
    state,
    previousState,
    stream,
    conviva,
    currentSenderId,
    audioTrackSelected = '',
    deeplink = -1,
    debug = false,
    videoDebug = false;

let context = cast.framework.CastReceiverContext.getInstance();

let ChromeCastCommands = Object.freeze({
    setup: "SETUP",
    load: "LOAD",
    play: "PLAY",
    pause: "PAUSE",
    seek: "SEEK",
    audio: "AUDIO",
    cc: "CC",
    status: "STATUS",
    close: "CLOSE",
    debug: "DEBUG"
});

let ChromeCastState = Object.freeze({
    buffering: "BUFFERING",
    playing: "PLAYING",
    paused: "PAUSED",
    seeking: "SEEKING",
    error: "ERROR",
    ended: "ENDED"
});

let logger = function (value) {
    if (debug) {
        console.log(value);
    }
};

logger('Diva Chromecast App Receiver ' + '%%GULP_INJECT_VERSION%%');
logger('HLS.js v' + Hls.version);
logger('Shaka Player ' + shaka.Player.version);

let controls = document.getElementById("controls"),
    title = document.getElementById("title"),
    currentTime = document.getElementById("current-time"),
    duration = document.getElementById("duration"),
    live = document.getElementById("live"),
    nolive = document.getElementById("nolive"),
    bar = document.getElementById("bar"),
    loading = document.getElementById("loading"),
    error = document.getElementById("error"),
    errorMessage = document.getElementById("message"),
    pause = document.getElementById("pause"),
    play = document.getElementById("play"),
    video = document.getElementById('video'),
    debugPanel = document.getElementById('debugPanel'),
    pluginVideo = document.getElementById('pluginVideo'),
    bitrate = document.getElementById('bitrate'),
    currentAudioTrack = document.getElementById('audioTrack'),
    videoCurrentTime = document.getElementById('videoCurrentTime'),
    videoDuration = document.getElementById('videoDuration'),
    debugBufferSize = document.getElementById('bufferSize');

let defaultErrorMessage = "The video is not working.\nPlease try again later";
let defaultGoLiveMessage = "GO LIVE";
let defaultLiveNowMessage = "LIVE NOW";

let equalsInsensitive = function (s1, s2) {
    return s1.toLowerCase() === s2.toLowerCase()
};

let checkSession = function(senderId) {
    if (senderId === currentSenderId) return;

    let message = { command: ChromeCastCommands.close, playerState: 'checkSession', senderId: senderId, currentSenderId: currentSenderId };

    if (currentSenderId) {
        context.sendCustomMessage(
            DIVA_CHANNEL, /* namespace */
            currentSenderId, /* senderId */
            message
        );
    }

    logger('checkSession different');
    logger('currentSenderId: ' + currentSenderId);
    logger('senderId: ' + senderId);

    currentSenderId = senderId;
};

let onFragParsed = function(event, data) {
    if (data.type === 'video') {
        if (deeplink >= 0 && deeplink < data.startPTS) {
            setTimeout(function () {
                logger('onFragParsed deeplink: ' + deeplink);
                hls.startLoad(deeplink);
                video.currentTime = deeplink;
            });
        } else {
            setTimeout(function () {
                logger('onFragParsed startPTS: ' + data.startPTS);
                hls.startLoad(data.startPTS);
                video.currentTime = data.startPTS;
            });
        }
        hls.off(Hls.Events.FRAG_PARSING_DATA, onFragParsed);
    }
};

let onTracksUpdatedSubtitles = function() {
    logger("CC track updated");
    let readyInterval = setInterval(function () {
        clearInterval(readyInterval);
        ccTrackSelect(ccTrackSelected);
    }, 1000);
};

let onLevelSwitched = function(event, data) {
    bitrate.textContent = Math.round(hls.levels[data.level].bitrate/1000) + ' Kbps';
    if ( conviva  ) {
        conviva.reportBitRate( hls.levels[data.level].bitrate/1000 );
        conviva.reportDuration( hls.media.duration );
    }
};

let onSubtitleTrackSwitch = function() {
    logger("CC track switch to track with id: " + hls.subtitleTrack);
};

let onAudioTracksUpdated = function (event, data) {
    logger('Audio Track Updated');
    setAudioTrack(audioTrackSelected);
};

let onAudioTracksSwitching = function (event, data) {
    logger('Audio Track Switching');
    logger(data);
    currentAudioTrack.textContent = 'Selecting Audio...';
};

let onAudioTracksSwitched = function (event, data) {
    logger('Audio Track Switched');
    logger("Audio Track Selected " + hls.audioTracks[data.id].name.toUpperCase() + "(" + data.id + ")");
    currentAudioTrack.textContent = hls.audioTracks[data.id].name.toUpperCase() + "(" + data.id + ")";
};

let initHls = function (
    url,
    time,
    useCredentials,
    audioTrack,
    ccTrack,
    licenseUrl,
    authToken
) {
    "use strict";
    logger('initHls');
    if (Hls.isSupported()) {
        audioTrackSelected = audioTrack;
        ccTrackSelected = ccTrack;
        video.src = '';
        function onParsed() {
            logger('Time to start: ' + time);
            hls.startLoad(time);
            if (time !== undefined && time !== -1) {
                video.currentTime = time;
            }
            video.play();
            if ( conviva  ) {
                conviva.reportDuration( hls.media.duration );
            }
        }

        function onAttached() {
            hls.off(Hls.Events.MEDIA_ATTACHED, onAttached);
            hls.loadSource(url);
        }

        hls = new Hls({
            // Reduce buffersize to avoid memory issues in Chromecast 1 and 2
            manifestLoadingMaxRetry: 0,
            fragLoadingMaxRetry: 3,
            maxBufferSize: 25 * 1000 * 1000,
            startLevel: 3,
            debug: videoDebug,
            enableWebVTT: true,
            enableCEA708Captions: true,
            widevineLicenseUrl: licenseUrl,
            xhrSetup: function (xhr) {
                xhr.withCredentials = useCredentials;
            },
            autoStartLoad: false
        });
        pluginVideo.textContent = 'HLS.js v' + Hls.version;
        clearInterval(stateInterval);
        stateInterval = null;
        stateInterval = setInterval( stateNotifier, 1000);

        hls.on(Hls.Events.MEDIA_ATTACHED, onAttached);
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, onTracksUpdatedSubtitles);
        hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, onSubtitleTrackSwitch);
        hls.once(Hls.Events.MANIFEST_PARSED, onParsed);
        hls.on(Hls.Events.FRAG_PARSING_DATA, onFragParsed);
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, onAudioTracksUpdated);
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTracksSwitched);
        hls.on(Hls.Events.ERROR, onError);
        hls.attachMedia(video);
    }
};

let onShakaError = function (shakaError) {
    if (shakaError.detail.severity !== shaka.util.Error.Severity.CRITICAL) {
        return
    }
    let data = {
        "type": shakaError.detail.code,
        "details": shakaError.detail.category,
        "fatal": true
    };
    onError(shakaError, data);
};

let onShakaAdaptation = function() {
    let tracks = shakaPlayer.getVariantTracks();  // all tracks
    tracks.forEach(function(t) {
        if (t.active) {
            bitrate.textContent = Math.round(t.bandwidth/1000) + ' Kbps';
            currentAudioTrack.textContent = t.label.toUpperCase() + "(" + t.audioId + ")";
            conviva.reportBitRate( t.bandwidth/1000 );
        }
    });
};

let initShaka = function(url, time, useCredentials, audioTrack, ccTrack, licenseUrl, authToken) {
    logger('initShaka');
    shaka.polyfill.installAll();

    if (shaka.Player.isBrowserSupported()) {
        audioTrackSelected = audioTrack;
        shakaPlayer = new shaka.Player(video);
        pluginVideo.textContent = 'Shaka Player ' + shaka.Player.version;
        shakaPlayer.getNetworkingEngine().registerResponseFilter(function (type, response) {
            if (type === shaka.net.NetworkingEngine.RequestType.MANIFEST && response.data.byteLength > 0) {

                if (licenseUrl === "") {
                    let StringUtils = shaka.util.StringUtils;
                    let Uint8ArrayUtils = shaka.util.Uint8ArrayUtils;
                    let manifest = StringUtils.fromUTF8(response.data);
                    let parser = new DOMParser();
                    let xmlDoc = parser.parseFromString(manifest, "text/xml");

                    if (xmlDoc.getElementsByTagName("ms:laurl").length > 0) {
                        licenseUrl = xmlDoc.getElementsByTagName("ms:laurl")[0].attributes['licenseUrl'] ? xmlDoc.getElementsByTagName("ms:laurl")[0].attributes['licenseUrl'].value : '';
                    }
                }

                if (licenseUrl) {
                    shakaPlayer.configure({
                        drm: {
                            servers: {'com.widevine.alpha': licenseUrl},
                            advanced: {
                                'com.widevine.alpha': {
                                    'videoRobustness': 'SW_SECURE_CRYPTO',
                                    'audioRobustness': 'SW_SECURE_CRYPTO'
                                }
                            }
                        }
                    });
                }
            }
        });

        shakaPlayer.getNetworkingEngine().registerRequestFilter(function (type, request) {

            if (authToken && type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
                // This is the specific header name and value the server wants:
                request.allowCrossSiteCredentials = false;
                request.headers['Authorization'] = authToken;
                request.headers['Content-Type'] = 'application/octet-stream';
            }

        });

        shakaPlayer.addEventListener(onShakaError);

        logger('Time to start: ' + time);
        shakaPlayer.load(url, time < 0 ? -1 : time, shaka.dash.DashParser).then(function () {
            setAudioTrack(audioTrackSelected);
            video.play();
            if (conviva) {
                conviva.reportDuration(shakaDuration());
            }
        }).catch(function (shakaError) {
            let data = {
                "type": shakaError.code,
                "details": shakaError.category,
                "fatal": true
            };
            onError(error, data);
        });

        shakaPlayer.addEventListener('adaptation', onShakaAdaptation);

        clearInterval(stateInterval);
        stateInterval = null;
        stateInterval = setInterval(stateNotifier, 1000);
    }
};

let shakaDuration = function () {
    return shakaPlayer.seekRange().end
};

const convert = function (time) {
    "use strict";

    if (!isFinite(time)) {
        return "";
    }

    let hours = Math.floor(time / 3600).toString().padStart(2, "0");
    let minutes = Math.floor(time / 60 % 60).toString().padStart(2, "0");
    let seconds = Math.floor(time % 60).toString().padStart(2, "0");
    return hours + ":" + minutes + ":" + seconds;
};

let resetControls = function () {
    "use strict";
    duration.style.opacity = '0';
    currentTime.style.opacity = '0';
    live.style.opacity = '0';
    nolive.style.opacity = '0';
    bar.style.width = '0';
    error.style.opacity = '0';
};

let hideControls = function () {
    "use strict";
    controls.style.opacity = '0';
    title.style.opacity = '0';
};

let showControls = function () {
    "use strict";
    controls.style.opacity = '1';
    title.style.opacity = '1';
};

let showLoading = function () {
    loading.style.opacity = '1';
};

let hideLoading = function () {
    loading.style.opacity = '0';
};

let showError = function () {
    hideControls();
    hideLoading();
    error.style.opacity = '1';
};

let setThemeColor = function(color) {
    bar.style.backgroundColor = color;
};

let setBackground = function(url) {
    if ( url === "none" ) {
        document.body.style.backgroundImage = url;
    } else {
        document.body.style.backgroundImage = "url('"+url+"')";
    }
    
};

let seekTo = function(time) {

    if (!hls && !shakaPlayer) return;

    if (shakaPlayer) {
        // we keed to limit the destination time to a save point otherwise
        // shaka player gets stuck into "playing" state, never detecting
        // the video end
        const max = shakaDuration() - 2.0;
        // logger("seeking to " + time
        //     + " of " + duration
        //     + ", actual seek value " + Math.min(time, max)
        // )
        time = Math.min(time, max)
    }
    video.currentTime = time;
    // video.play();
    
    if ( conviva  ) {
        conviva.seekStart(time);
    }
};

let seekToLive = function() {

    if (!hls && !shakaPlayer) return;

    let dur;
    if (shakaPlayer) {
        dur = shakaDuration()
    } else {
        dur = video.duration
    }
    if (stream.type === "LIVE") {
        seekTo(dur - (liveTolerance / 2));
    } else if (stream.type === "LIVE24x7") {
        seekTo(dur);
		video.play();
    }

};

let setAudioTrack = function(audioTrack) {
    if (shakaPlayer) {
        // DASH
        if (typeof shakaPlayer.selectVariantsByLabel === 'function') {
            logger("Audio Track attempt selecting " + audioTrack);
            shakaPlayer.selectVariantsByLabel(audioTrack);
        }
    } else {
        // HLS
        const track = hls.audioTracks.find(function (item) {
            return item.name.toLowerCase() === audioTrack.toLowerCase();
        });
        if (track) {
            hls.once(Hls.Events.AUDIO_TRACK_SWITCHING, onAudioTracksSwitching);
            logger("Audio Track attempt selecting " + track.name.toUpperCase() + "(" + track.id + ")");
            hls.audioTrack = track.id;
            seekTo(hls.media.currentTime);
        }
    }
};


let onError = function (event, data) {

    "use strict";
    logger('onError');
    logger(event);
    logger(data);
    let errorType = data.type;
    let errorDetails = data.details;
    let errorFatal = data.fatal;

    if (errorFatal) {

        clearInterval(stateInterval);

        state = ChromeCastState.error;

        let status = {
            playerState: state,
            message: errorType + ": " + errorDetails,
            // by not-updating current time on error
            // we allow receiver to keep the last known(valid) position
            // currentTime: hls.media.currentTime,
            // same goes for duration
            // duration: hls.media.duration
        };

        context.sendCustomMessage(
            DIVA_CHANNEL, /* namespace */
            currentSenderId, /* senderId */
            status
        );

        showError();

        removeListeners();

    }

    if ( conviva  ) {
        logger(errorType + ": " + errorDetails + ' ' + errorFatal);
        conviva.reportError( errorType + ": " + errorDetails, errorFatal );
    }
};

let setVideoErrorMessage = function (message) {
    if ( message ) {
        errorMessage.innerText = message;
    } else {
        errorMessage.innerText = defaultErrorMessage;
    }
};

let setLiveMessages = function (liveNow, goLive) {
    
    let liveIcon = '<i class="circle"></i>';

    if ( liveNow ) {
        live.innerHTML = liveIcon + liveNow;
    } else {
        live.innerHTML = liveIcon + defaultLiveNowMessage;
    }

    let goLiveIcon = '<i class="triangle"></i>';

    if ( goLive ) {
        nolive.innerHTML = goLiveIcon + goLive;
    } else {
        nolive.innerHTML = goLiveIcon + defaultGoLiveMessage;
    }
};



let loadSource = function (
    url,
    format,
    time,
    useCredentials,
    audioTrack,
    ccTrack,
    licenseUrl,
    authToken
) {
    "use strict";

    logger('loadSource');

    if (hls) {
        hls.off(Hls.Events.SUBTITLE_TRACKS_UPDATED, onTracksUpdatedSubtitles);
        hls.off(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
        hls.off(Hls.Events.SUBTITLE_TRACK_SWITCH, onSubtitleTrackSwitch);
        hls.off(Hls.Events.ERROR, onError);
        hls.off(Hls.Events.AUDIO_TRACKS_UPDATED, onAudioTracksUpdated);
        hls.off(Hls.Events.AUDIO_TRACK_SWITCHING, onAudioTracksSwitching);
        hls.off(Hls.Events.AUDIO_TRACK_SWITCHED, onAudioTracksSwitched);
        hls.off(Hls.Events.FRAG_PARSING_DATA, onFragParsed);
        hls.detachMedia();
        hls.destroy();
        hls = undefined;
    }

    if (shakaPlayer) {
        shakaPlayer.removeEventListener(onShakaError);
        shakaPlayer.removeEventListener(onShakaAdaptation);
        shakaPlayer.destroy();
        shakaPlayer = undefined;
    }

    if (time !== undefined && time !== -1) {
        deeplink = time;
    } else {
        deeplink = -1;
    }

    logger('deeplink: ' + deeplink);

    if (format.startsWith("DASH")) {
        initShaka(url, time, useCredentials, audioTrack, ccTrack, licenseUrl, authToken);
    } else {
        initHls(url, time, useCredentials, audioTrack, ccTrack, licenseUrl, authToken);
    }

};

context.addEventListener( cast.framework.system.EventType.READY, function(event) {
    logger('- READY -');
});

context.addEventListener( cast.framework.system.EventType.SENDER_DISCONNECTED, function(event) {
    logger('- SENDER_DISCONNECTED -');
    logger(event);
    logger(event.userAgent);
});

context.addEventListener( cast.framework.system.EventType.ERROR, function(event) {
    logger('- ERROR -');
});

context.addEventListener( cast.framework.system.EventType.SENDER_CONNECTED, function(event) {
    logger('- SENDER_CONNECTED -');
    logger(event);
    logger(event.userAgent);
    if (event.userAgent.toLowerCase() !== 'pychromecast') {
        checkSession(event.senderId);
    }
});

context.addCustomMessageListener(DIVA_CHANNEL, function (message) {
    "use strict";

    checkSession(message.senderId);
    logger('-- Message from Diva --');
    logger(message.data);

    switch (message.data.action) {
    case ChromeCastCommands.setup:
        let bgURL = message.data.params.bg || "none";
        setBackground(bgURL);
        break;
    case ChromeCastCommands.load:

        resetControls();

        // End previous conviva session
        if ( conviva ) {
            conviva.close();
        }
         
        // replace video element to prevent cctrack leakage from one video to another
        let videoNew = document.createElement('video');
        videoNew.id = 'video';
        videoNew.setAttribute('autoplay', 'true');
        let parent = video.parentNode;
        parent.replaceChild(videoNew, video);
        video = videoNew;

        registerListeners();

        stream = message.data.params;
        if ( stream.type !== "LIVE" && stream.type !== "LIVE24x7" ) stream.type = "VOD";

        setVideoErrorMessage(stream.videoErrorMessage);
        setLiveMessages(stream.liveNowMessage,stream.goLiveMessage);

        debug = stream.receiverDebug === true;
        videoDebug = stream.videoDebug === true;

        if (debug) {
            debugPanel.style.display = 'block';
        }

        logger(stream);

        loadSource(
            stream.url,
            stream.format || "HLS",
            typeof stream.time === 'number' ? stream.time : -1,
            stream.useCredentials,
            stream.audioTrackSelection,
            stream.ccTrackSelection,
            stream.licenseUrl,
            stream.authToken
        );

        title.innerText = stream.name || "";
        controls.className = stream.type || "VOD";
        
        setThemeColor(stream.color || "#fff");

        startBufferCheck();

        if ( stream.convivaSettings ) {
            convivaSettings = stream.convivaSettings;
            convivaSettings.type = stream.type;
            convivaSettings.url = stream.url;
        }

        startConvivaSession();
        break;
    case "seek":
    case ChromeCastCommands.seek:
        let position = message.data.params.time;
        logger('seek ' + position);
        if (position === "live") {
            seekToLive();
        } else {
            seekTo(position);
        }
        break;
    case ChromeCastCommands.play:
        video.play();
        break;
    case ChromeCastCommands.audio:
        setAudioTrack(message.data.params.audioTrackSelection);
        break;
    case ChromeCastCommands.cc:
        ccTrackSelect(message.data.params.ccTrackSelection);
        break;
    case ChromeCastCommands.pause:
        video.pause();
        break;
    case ChromeCastCommands.close:
            if (conviva) {
                conviva.close();
            }
            videoEnded = true;
            context.stop();
            break;
    case ChromeCastCommands.debug:
        debug = message.data.params.receiverDebug === true;
        videoDebug = message.data.params.videoDebug === true;

        debugPanel.style.display = debug ? 'block' : 'none';
        if (hls) {
            hls.config.debug = videoDebug;
        }

        break;
    }
});

let startConvivaSession = function () {
// Conviva Integration
    if ( convivaSettings ) {
        // End previous conviva session
        if ( conviva ) {
            conviva.close();
        }
        const chromecastConvivaSettings = JSON.parse(JSON.stringify(convivaSettings));
        chromecastConvivaSettings.playerVersion = chromecastConvivaSettings.playerVersion || "%%GULP_INJECT_VERSION%%";
        chromecastConvivaSettings.playerName = "CHROMECAST - " + chromecastConvivaSettings.playerName;
        chromecastConvivaSettings.applicationName = "CHROMECAST - " + chromecastConvivaSettings.applicationName;
        logger('convivaSettings');
        logger(chromecastConvivaSettings);
        conviva = new ChomecastConvivaIntegration(chromecastConvivaSettings, video, chromecastConvivaSettings.type === "LIVE", chromecastConvivaSettings.url);
    }
};

let stateNotifier = function () {
    "use strict";
    if (hls && hls.media) {
        window.hls = hls;

        let message = {
            command: ChromeCastCommands.status,
            currentTime: hls.media.currentTime,
            playerState: state,
            duration: hls.media.duration,
            ccTracks: ccTracks(video),
            audioTracks: hls.audioTracks.map(function(track) {
                return track.name;
            })
        };

        logger(message);

        videoCurrentTime.textContent = Math.round(hls.media.currentTime * 100) / 100 + ' s';
        if (typeof hls.media.duration === "number" && !isNaN(hls.media.duration)) {
            videoDuration.textContent = Math.round(hls.media.duration * 100) / 100 + ' s';
        } else {
            videoDuration.textContent = '';
        }

        context.sendCustomMessage(
            DIVA_CHANNEL, /* namespace */
            currentSenderId, /* senderId */
            message
        );

        resetControls();

        bar.style.width = Math.max(hls.media.currentTime, 0) * 100 / hls.media.duration + "%";

        if (stream.type === "VOD") {
            currentTime.style.opacity = '1';
            duration.style.opacity = '1';
            currentTime.innerText = convert(Math.max(hls.media.currentTime, 0));
            duration.innerText = convert(hls.media.duration);
        } else if (stream.type === "LIVE") {
            let isLive = hls.media.currentTime > (hls.media.duration - liveTolerance);
            live.style.opacity = isLive ? '1' : '0';
            nolive.style.opacity = !isLive ? '1' : '0';
        } else if (stream.type === "LIVE24x7"){
            let isPlaying = state === ChromeCastState.playing;
            live.style.opacity = isPlaying ? '1' : '0';
        }

    } else if ( shakaPlayer ) {

        // this should be the same no matter what the palyer (hls/shaka) is
        // however it has been tested only on hls.js

        let message = {
            command: ChromeCastCommands.status,
            currentTime: video.currentTime,
            playerState: state,
            duration: shakaDuration(),
            ccTracks: [],
            audioTracks: [] // <-- TODO: 
        };

        logger(message);

        videoCurrentTime.textContent = Math.round(video.currentTime * 100) / 100 + ' s';
        let tempDuration = shakaDuration();
        if (typeof tempDuration === "number" && !isNaN(tempDuration)) {
            videoDuration.textContent = Math.round(tempDuration * 100) / 100 + ' s';
        } else {
            videoDuration.textContent = '';
        }

        context.sendCustomMessage(
            DIVA_CHANNEL, /* namespace */
            currentSenderId, /* senderId */
            message
        );

        resetControls();

        bar.style.width = video.currentTime * 100 / shakaDuration() + "%";

        if (stream.type === "VOD") {
            currentTime.style.opacity = '1';
            duration.style.opacity = '1';
            currentTime.innerText = convert(Math.max(video.currentTime, 0));
            duration.innerText = convert(shakaDuration());
        } else if (stream.type === "LIVE") {
            let isLive = video.currentTime > (shakaDuration() - liveTolerance);
            live.style.opacity = isLive ? '1' : '0';
            nolive.style.opacity = !isLive ? '1' : '0';
        } else if (stream.type === "LIVE24x7"){
            let isPlaying = state === ChromeCastState.playing;
            live.style.opacity = isPlaying ? '1' : '0';
        }
    }

};


/**
* Bug 171731: [iOS] chromecast - randomically video freezes
*/
let bufferCurrentTime;
let bufferSize;
let bufferTimer;

let bufferSizeForPosition = function (position) {
    try {
      if (hls && hls.media) {
        let buffered = hls.media.buffered;
        for (let i = 0; i < buffered.length; i++) {
          if (position >= buffered.start(i) && position <= buffered.end(i)) {
            return buffered.end(i) - position;
          }
        }
      }
    } catch (error) {
      // this is to catch
      // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer':
      // This SourceBuffer has been removed from the parent media source
    }
    return 0;
};

let checkBufferSize = function() {

    if ( hls && hls.media && hls.media.currentTime < hls.media.duration - 2 && hls.media.currentTime > 0 ) {

        let currentBufferSize = bufferSizeForPosition(hls.media.currentTime);

        if (bufferCurrentTime === hls.media.currentTime && bufferSize >= currentBufferSize && currentBufferSize < 1) {
            seekTo(hls.media.currentTime + 1);
        }

        bufferCurrentTime = hls.media.currentTime;
        bufferSize = currentBufferSize;
        debugBufferSize.textContent = Math.round(bufferSize * 100) / 100 + ' s';
    } else {
        debugBufferSize.innerHTML = '<i>Not monitored</i>';
    }

};


let startBufferCheck = function() {

    if (typeof bufferTimer === "number") {
        clearInterval(bufferTimer);
        bufferTimer = null;
    }

    bufferTimer = setInterval(checkBufferSize, 2000);
};


function handleVideoEvent(evt) {

    "use strict";
    logger('handleVideoEvent: ' + evt.type);
    switch (evt.type) {
    case 'waiting':
        state = ChromeCastState.buffering;
        showLoading();
        showControls();
        break;
    case 'seeking':
        if (previousState !== ChromeCastState.ended && state !== ChromeCastState.seeking) {
            previousState = state;
        } else {
            previousState = ChromeCastState.paused;
        }
        state = ChromeCastState.seeking;
        showLoading();
        showControls();
        break;
    case 'seeked':
        /* try to send a status here to fire the seek callback */
        state = previousState;
        hideLoading();
        hideControls();
        break;
    case 'pause':
        state = ChromeCastState.paused;
        previousState = state;
        pause.style.opacity = '1';
        play.style.opacity = '0';
        showControls();
        break;
    case 'play':
    case 'playing':
        if (typeof video.duration === "number" && !isNaN(video.duration)) {
            state = ChromeCastState.playing;
            if (!ccAlreadySelected) {
                ccTrackSelect(ccTrackSelected);
                ccAlreadySelected = true
            }
        }
        hideLoading();
        hideControls();
        pause.style.opacity = '0';
        play.style.opacity = '1';
        if (videoEnded && !conviva) {
            logger('Restart Conviva session with Watch Again');
            startConvivaSession();
        }
        videoEnded = false;
        break;
    case 'ended':
        state = ChromeCastState.ended;

        let message = { command: ChromeCastCommands.close, playerState: ChromeCastState.ended };
        if (currentSenderId) {
            context.sendCustomMessage(
                DIVA_CHANNEL, /* namespace */
                currentSenderId, /* senderId */
                message
            );
        }
        if (conviva) {
            conviva.close();
            conviva = undefined;
        }
        videoEnded = true;
        break;
    case 'loadedmetadata':
        let duration = 0;
        if (shakaPlayer) {
            duration = shakaDuration();
        } else {
            duration = video.duration;
        }
        logger('loadedmetadata duration: ' + duration)
        // Starting position
        if (deeplink >= 0 && deeplink < duration) {
            logger('loadedmetadata deeplink: ' + deeplink)
            video.currentTime = deeplink;
        }
    }

    stateNotifier();
}

let registerListeners = function () {
    video.addEventListener('seeking', handleVideoEvent);
    video.addEventListener('seeked', handleVideoEvent);
    video.addEventListener('waiting', handleVideoEvent);
    video.addEventListener('pause', handleVideoEvent);
    video.addEventListener('play', handleVideoEvent);
    video.addEventListener('playing', handleVideoEvent);
    video.addEventListener('ended', handleVideoEvent);
    video.addEventListener('error', handleVideoEvent);
    video.addEventListener('loadedmetadata', handleVideoEvent);
};

let removeListeners = function () {
    video.removeEventListener('seeking', handleVideoEvent);
    video.removeEventListener('seeked', handleVideoEvent);
    video.removeEventListener('waiting', handleVideoEvent);
    video.removeEventListener('pause', handleVideoEvent);
    video.removeEventListener('play', handleVideoEvent);
    video.removeEventListener('playing', handleVideoEvent);
    video.removeEventListener('ended', handleVideoEvent);
    video.removeEventListener('error', handleVideoEvent);
    video.removeEventListener('loadedmetadata', handleVideoEvent);
};


let options = new cast.framework.CastReceiverOptions();
options.maxInactivity = 9999;
context.start(options);

let castConsoleBG = location.search.split("=")[1];

if (castConsoleBG) {
    setBackground(decodeURIComponent(castConsoleBG));
}

// CC tracks

let ccTracks = function (video) {
    let textTracks = [];
    for (let i = 0; i < (video.textTracks || []).length; i++) {
        textTracks.push(video.textTracks[i])
    }
    return textTracks.map(function (it) {
        if (it.kind === 'captions') {
            return {
                id: "d3608",
                language: "d3608",
                kind: it.kind || "", // subtitles | captions
                mode: it.mode || "" // showing | hidden
            }
        }
        return {
            id: it.label || "",
            language: it.language || "",
            kind: it.kind || "", // subtitles | captions
            mode: it.mode || "" // showing | hidden
        }
    })
};

let ccTrackSelected = "";

let ccTrackSelect = function (trackId) {
    trackId = trackId || "";
    ccTrackSelected = trackId;
    if (typeof video.duration !== "number" || isNaN(video.duration)) {
        // video player is not ready
        return;
    }
    logger("CC track attempt selecting " + trackId);
    let textTracks = [];
    for (let i = 0; i < (video.textTracks || []).length; i++) {
        textTracks.push(video.textTracks[i])
    }
    let match = function (it, trackId) {
        if (!trackId) { return false }
        if (equalsInsensitive(trackId, 'd3608')) {
            return equalsInsensitive(it.kind, 'captions')
        } else {
            return equalsInsensitive(it.label, trackId)
        }
    };
    logger("CC tracks:");
    logger(textTracks);
    let once = false;
    textTracks.forEach(function (it) {
        if (match(it, trackId) && !once) {
            once = true;
            it.mode = 'showing';
            logger("CC track selected " + it.label)
        } else {
            it.mode = 'disabled';
            logger("CC track deselected " + it.label)
        }
    });

    if (!hls) { return }
    if (!once) {
        // avoid hls.js selecting a random track automatically (even if its 'hidden')
        hls.subtitleTrack = -1
    }
};
