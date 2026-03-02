/*global $, jQuery, cast */
let DIVA_CHANNEL = 'urn:x-cast:com.deltatre.cast.diva';
let EXTERNAL_CHANNEL = 'urn:x-cast:com.deltatre.cast.external';

let liveTolerance = 35;

const DvrType = {
  NONE: 'none',
  FULL: 'full',
  LIMITED: 'limited'
};

let stateInterval;
let videoEnded = false;
let ccAlreadySelected = false;
let audioSelectionMethod = 'title';
let closedCaptionSelectionMethod = 'title';
let videoId = '';
let oldDuration = 0;
let bgImageVisible = false;
let seekRangeStart = 0;
let seekRangeEnd = 0;
let rawProgramDateTime = 0;
let dvrType = DvrType.FULL;
let loadingState = false;
let poly_done = false;
let firstTimePlayerLoaded = false;
let state,
  previousState,
  stream = {},
  currentSenderId,
  audioTrackSelected = '',
  deeplink = -1,
  debug = DEBUG_ENABLED,
  audioTracksUpdated = false,
  buffering = true,
  firstFragParsed = true,
  lastFramerate = 0,
  previousMgs = {},
  previousPlayerState,
  playerId = '';

window.shakaPlayer = null;

let context = cast.framework.CastReceiverContext.getInstance();

const ChromeCastCommands = Object.freeze({
  setup: "SETUP",
  load: "LOAD",
  play: "PLAY",
  pause: "PAUSE",
  seek: "SEEK",
  audio: "AUDIO",
  cc: "CC",
  status: "STATUS",
  close: "CLOSE",
  debug: "DEBUG",
  update: "UPDATE"
});

const ChromeCastState = Object.freeze({
  buffering: "BUFFERING",
  playing: "PLAYING",
  paused: "PAUSED",
  seeking: "SEEKING",
  error: "ERROR",
  ended: "ENDED"
});

const MediaAnalyticsEventType = Object.freeze({
  VIDEO_OPEN: 'videoOpen',
  VIDEO_LOADED: 'videoLoaded',
  VIDEO_READY: 'videoReady',
  VIDEO_DURATION_CHANGED: 'videoDurationChanged',
  VIDEO_ENDED: 'videoEnded',
  VIDEO_CLOSED: 'videoClosed',
  VIDEO_REPLAY: 'videoReplay',
  VIDEO_ERROR: 'videoError',
  SEEK_STARTED: 'seekStarted',
  SEEK_ENDED: 'seekEnded',
  PLAYBACK_STARTED: 'playbackStarted',
  PLAYBACK_PAUSED: 'playbackPaused',
  WAITING_USER_INTERACTION: 'waitingUserInteraction',
  PLAYBACK_BITRATE_CHANGED: 'playbackBitrateChanged',
  BUFFERING_STARTED: 'bufferingStarted',
  BUFFERING_ENDED: 'bufferingEnded',
  PLAYBACK_RATE_CHANGED: 'playbackRateChanged',
  PLAYBACK_FRAMERATE_CHANGED: 'playbackFramerateChanged',
  PREROLL_STARTED: 'prerollStarted',
  PREROLL_ENDED: 'prerollEnded',
  MIDROLL_STARTED: 'midrollStarted',
  MIDROLL_ENDED: 'midrollEnded',
  SSAI_STARTED: 'ssaiStarted',
  SSAI_ENDED: 'ssaiEnded'
});


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
  castVersion = document.getElementById('castVersion'),
  bitrate = document.getElementById('bitrate'),
  currentAudioTrack = document.getElementById('audioTrack'),
  currentCCTrack = document.getElementById('ccTrack'),
  videoCurrentTime = document.getElementById('videoCurrentTime'),
  videoDuration = document.getElementById('videoDuration'),
  debugBufferSize = document.getElementById('bufferSize'),
  bgImageContainer = document.getElementById('bgImageContainer'),
  playrate = document.getElementById('playrate'),
  playerevent = document.getElementById('playerevent'),  
  bgImage = document.getElementById('bgImage');

let defaultErrorMessage = "The video is not working.\nPlease try again later";
let defaultGoLiveMessage = "GO LIVE";
let defaultLiveNowMessage = "LIVE NOW";

let trackingToken = '';
let cslHeaders = {
  trackingToken: 'x-dt-csl-tracking-token',
  renewalInfo: 'x-dt-csl-renewal-info',
};


const isFuchsia = function () {
  return navigator.userAgent.indexOf('(Fuchsia)') !== -1;
}


const start = new Date().getTime();

const logger = (...value) => {

  if (debug) {

    const now = new Date().getTime();
    const diff = (now - start)/1000;

    console.log(diff,...value);
  }
}

logger(navigator.userAgent);

// debugPanel.style.display = debug ? 'block' : 'none';
window.shakaOptions = {
  abr: {
    useNetworkInformation: false,
    bandwidthUpgradeTarget: 0.75,
    bandwidthDowngradeTarget: 0.85,
    defaultBandwidthEstimate: 3500000,
    switchInterval: 8,
    cacheLoadThreshold:5,
    restrictions:{
      maxBandwidth:3500000,
    },
    advanced: {
      minBytes: 50000,
      fastHalfLife:16,
      slowHalfLife:16
    },
  },
  cmcd: {
    enabled: false,
  },
  cmsd: {
    enabled: false,
  },
  lcevc: {
    enabled: false,
  },
  streaming: {
    evictionGoal: 40,
    bufferingGoal: 8,
    bufferBehind: 10,
    rebufferingGoal: 1.6*3,
    allowMediaSourceRecoveries: true,
    dispatchAllEmsgBoxes: false,
    parsePrftBox: false,
    stallSkip: 0.1,
    stallEnabled: true,
    gapDetectionThreshold: 0.2,
    gapJumpTimerTime:3.2,
    startAtSegmentBoundary: false,
    segmentPrefetchLimit: 4,
    updateIntervalSeconds: 0.5,
    observeQualityChanges: true,
    retryParameters: {
      maxAttempts: 3,
    },
    liveSync: true,
    liveSyncMaxLatency: 15,
    liveSyncMinLatency: 25,
    liveSyncMinPlaybackRate: 1,
    liveSyncPlaybackRate: 1.03
  },
  manifest: {
    disableThumbnails: true,
    defaultPresentationDelay: 15,
    dash: {
      initialSegmentLimit:50,
      ignoreSuggestedPresentationDelay: true,
      disableXlinkProcessing: true,
      ignoreMinBufferTime: true,
      updatePeriod:30,
    },
    retryParameters: {
      maxAttempts: 3,
    },
  },
};

if ( isFuchsia() ) {
  window.shakaOptions.streaming.gapPadding = 2;
  window.shakaOptions.streaming.updateIntervalSeconds = 1;
  window.shakaOptions.streaming.retryParameters = {
    maxAttempts: 5,
    timeout:40000,
    stallTimeout: 10000,
    connectionTimeout: 20000,
  };
  window.shakaOptions.mediaSource = {
    codecSwitchingStrategy:shaka.config.CodecSwitchingStrategy.RELOAD
  };
  window.shakaOptions.manifest.retryParameters = {
    maxAttempts: 5,
    timeout:40000,
    stallTimeout: 10000,
    connectionTimeout: 20000,
  };
  window.shakaOptions.manifest.dash.multiTypeVariantsAllowed = false;
}

logger('Shaka player options:', window.shakaOptions);

castVersion.innerText = `v${cast.framework.VERSION}`;
logger('Diva Chromecast App Receiver ' + APP_VERSION);
logger('Is debug enabled? ' + DEBUG_ENABLED);

let equalsInsensitive = function (s1, s2) {
  return s1.toLowerCase() === s2.toLowerCase()
};

let checkSession = function (senderId) {
  if (senderId === currentSenderId) return;

  if (currentSenderId) {

    let message = {
      command: ChromeCastCommands.close,
      forced: true,
      senderId: senderId,
      currentSenderId: currentSenderId
    };

    sendCustomMessage(
      message
    );

    logger('[COMMAND FROM CHROMECAST]', message.command, message);
  } else {
    currentSenderId = senderId;
  }
};

let onShakaError = function (shakaError) {
  if (shakaError.detail.severity !== shaka.util.Error.Severity.CRITICAL) {
    return
  }
  logger('shaka error', shakaError);
  let data = {
    "type": 'videoError',
    "details": JSON.stringify(shakaError),
    "errorCode": shakaError.detail.code,
    "fatal": true
  };
  onError(data);
};

let onShakaAdaptation = function () {
  let tracks = window.shakaPlayer.getVariantTracks();  // all tracks
  tracks.forEach(function (t) {
    if (t.active) {
      bitrate.textContent = Math.round(t.bandwidth / 1000) + ' Kbps';
      currentAudioTrack.textContent = t.label.toUpperCase() + "(" + t.audioId + ")";
      mediaTracking(MediaAnalyticsEventType.PLAYBACK_BITRATE_CHANGED, {
        bitrate: t.bandwidth
      });
      lastFramerate = t.frameRate;
      mediaTracking(MediaAnalyticsEventType.PLAYBACK_FRAMERATE_CHANGED, {
        framerate: t.frameRate
      });
    }
  });
};

let initShaka = async function  (url, time, autoplay, useCredentials, audioTrack, ccTrack, licenseUrl, authToken, headers) {
  logger('Shaka Player ' + shaka.Player.version);
  logger('initShaka');
  firstTimePlayerLoaded = true;
  loadingState = true;
  if (!window.shakaPlayer){
    window.shakaPlayer = new shaka.Player();
    window.shakaPlayer.configure(window.shakaOptions);
    await window.shakaPlayer.attach(video);
  }

  if (shaka.Player.isBrowserSupported()) {
    ccTrackSelected = ccTrack;
    audioTrackSelected = audioTrack;
    
    pluginVideo.textContent = 'Shaka Player ' + shaka.Player.version;

    window.shakaPlayer.addEventListener('error', onShakaError);

    window.shakaPlayer
      .getNetworkingEngine()
      .registerRequestFilter(function (type, request) {
        if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
          let requestParams = {};
          if (headers && headers.length > 0) {
            const mappedObject = headers.reduce((result, item) => {
              result[item.key] = item.value;
              return result;
            }, {});
            requestParams = {
              headers: mappedObject,
            };
          } else if (authToken) {
            // AZURE Header
            requestParams = {
              headers: {
                Authorization: authToken,
              },
            };
          }
          if (trackingToken !== '') {
            requestParams.headers[cslHeaders.trackingToken] = trackingToken;
          }

          request.allowCrossSiteCredentials = false;

          // Appending headers
          for (let key in requestParams.headers) {
            request.headers[key] = requestParams.headers[key];
          }
        }
      });

    window.shakaPlayer
      .getNetworkingEngine()
      .registerResponseFilter(function (type, response) {
       if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
          const licenseHeaders = response.headers;
          if (cslHeaders.trackingToken in licenseHeaders) {
            trackingToken = licenseHeaders[cslHeaders.trackingToken];
          } else {
            trackingToken = "";
          }
          if (cslHeaders.renewalInfo in licenseHeaders) {
            const renewalInfo = JSON.parse(
              window.atob(licenseHeaders[cslHeaders.renewalInfo])
            );
            logger("CSL renewal timer start", {
              renewalInfo,
            });
            setTimeout(() => {
              logger("CSL renewal done");
            }, renewalInfo.renewalPeriod * 1000);
          }
        }
      });

      if (licenseUrl) {
        const licenseOptions = {
          drm: {
            delayLicenseRequestUntilPlayed: false,
            parseInbandPsshEnabled: false,
            ignoreDuplicateInitData:true,
            preferredKeySystems:["com.widevine.alpha"],
            servers: {
              "com.widevine.alpha": licenseUrl
            },
            advanced: {
              "com.widevine.alpha": {
                videoRobustness: "SW_SECURE_CRYPTO",
                audioRobustness: "SW_SECURE_CRYPTO",
              },
            }
          }
        };
        const configuration = {
          ...window.shakaOptions,
          ...licenseOptions
        };
        window.shakaPlayer.configure(configuration);
      } else {
        window.shakaPlayer.configure(window.shakaOptions);
      }

    logger('Time to start: ' + time);

    mediaTracking(MediaAnalyticsEventType.VIDEO_READY, {
      HTMLVideoElementId: video.id,
      streamUrl: stream.url,
      mediaPlayerType: stream.format.toUpperCase(),
    });

    if (dvrType === DvrType.LIMITED) {
      time = - liveTolerance / 2;
    }else{
      time = time < 0 ? undefined : time;
    }

    logger("LOAD MODE: ", window.shakaPlayer.getLoadMode());
    await window.shakaPlayer.load(url, time, 'application/dash+xml').then(function () {
      setAudioTrack(audioTrackSelected);
      if (autoplay) {
        logger("Auto play")
        video.play();
        bgImageContainer.style.display = 'none';
        bgImageContainer.style.opacity = '0';
      }
    }).catch(function (shakaError) {
      let data = {
        "type": 'videoError',
        "details": JSON.stringify(shakaError),
        "errorCode": shakaError.code,
        "fatal": true
      };
      console.error(shakaError);
      onError(data);
    });

    window.shakaPlayer.addEventListener('adaptation', onShakaAdaptation);

    clearInterval(stateInterval);
    stateInterval = null;
    stateInterval = setInterval(stateNotifier, 1000);
  }
};

let shakaDuration = function () {
  return window.shakaPlayer.seekRange().end
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
  loading.style.opacity = '0.2';
};

let hideLoading = function () {
  loading.style.opacity = '0';
};

let showError = function () {
  hideControls();
  hideLoading();
  error.style.opacity = '0.2';
  removeListeners();
};


let hideError = function () {
  error.style.opacity = '0';
};

let setThemeColor = function (color) {
  bar.style.backgroundColor = color;
};

let setBackground = function (url) {
  if (url === "none") {
    document.body.style.backgroundImage = url;
  } else {
    document.body.style.backgroundImage = "url('" + url + "')";
  }

};
let lastSeek = 0;
let seekTo = function (time) {
  if (!window.shakaPlayer) return;

  if (window.shakaPlayer && stream.type !== "LIVE") {
    // we need to limit the destination time to a save point otherwise
    // shaka player gets stuck into "playing" state, never detecting
    // the video end
    const max = shakaDuration() - 2.0;
    time = Math.min(time, max)
  }
  let dateNow = Date.now()
  if (lastSeek == 0 || (dateNow - lastSeek) > 1000){
    logger("seeking .... ");
  video.currentTime = time + seekRangeStart;
    lastSeek = dateNow;
  } else {
    logger("need to skip too much seek for CC");
  }

  mediaTracking(MediaAnalyticsEventType.SEEK_STARTED, {
    time: time
  });
};

let seekToLive = function () {

  if (!window.shakaPlayer) return;

  let dur;
  if (seekRangeStart || seekRangeEnd) {
    dur = seekRangeEnd - seekRangeStart;
  } else if (window.shakaPlayer) {
    dur = shakaDuration();
  } else {
    dur = video.duration;
  }
  

  if (stream.type === "LIVE") {
    logger("Checking if we need to Skip Live seek");
    let time = dur - (liveTolerance / 2);
    if (loadingState) {
      // we are in starting mode
      // don't seek to live
      logger("Player still loading - Skipping seek", video.currentTime, seekRangeStart, time, dur);
    }else{
      logger("Player loaded - seeking to live edge applying tolerance", video.currentTime, seekRangeStart, time, dur);
      seekTo(time); 
    }
  } else if (stream.type === "LIVE24x7") {
    seekTo(dur);
    video.play();
  }

};

const getShakaAudioTracks = function () {
  let tracks = [];
  if (window.shakaPlayer) {
    const currentVariantTrack = window.shakaPlayer?.getVariantTracks().find((item) => item.active);
    if (currentVariantTrack) {
      tracks = window.shakaPlayer?.getVariantTracks()
        .filter(item => item.videoBandwidth === currentVariantTrack.videoBandwidth)
        .map(item => {
          return {
            id: item.id,
            label: item.label,
            lang: item.language,
            active: item.active
          }
        })
    }
  }
  return tracks;
}

let setAudioTrack = function (audioTrack, forceSeek = false) {
  if (audioTrack) {
    if (window.shakaPlayer) {
      // DASH
      logger("Dash Audio Track attempt selecting " + audioTrack);
      let tracks = getShakaAudioTracks();
      if (tracks.length <= 1) {
        logger("only 1 audio track skip");
        audioTracksUpdated = true;
        return;
      }
      const track = tracks.find(item => (audioSelectionMethod === 'title' && item.label && audioTrack && item.label.toLowerCase() === audioTrack.toLowerCase()) || audioSelectionMethod === 'lang' && item.lang && item.lang.toLowerCase() === audioTrack.toLowerCase())
      if (track) {
        if (typeof window.shakaPlayer.selectVariantsByLabel === 'function' && track.label) {
          window.shakaPlayer.selectVariantsByLabel(track.label, true, shakaPlayer.getConfiguration().streaming.rebufferingGoal)
        } else {
          logger("window.shakaPlayer?.selectAudioLanguage(track.lang)", track.lang);
          window.shakaPlayer?.selectAudioLanguage(track.lang, undefined, 0, shakaPlayer.getConfiguration().streaming.rebufferingGoal);
        }
        audioTracksUpdated = true;
      }
    }
  }
};


let onError = function (data) {
  "use strict";
  logger('onError');
  logger('data', data);
  let errorType = data.type;
  let errorDetails = data.details;
  let errorCode = data.errorCode;
  let errorFatal = data.fatal;

  if (errorFatal) {

    clearInterval(stateInterval);

    state = ChromeCastState.error;

    let status = {
      command: ChromeCastCommands.status,
      playerState: state,
      message: errorType + ": " + errorCode,
    };

    sendCustomMessage(
      status
    );

    stateNotifier();

    showError();
  }

  if (errorFatal && errorDetails !== 'bufferFullError') {
    mediaTracking(MediaAnalyticsEventType.VIDEO_ERROR, {
      error: errorType,
      message: `${errorCode} - ${errorDetails}`,
      fatal: errorFatal
    });
  }

  if (errorFatal) {
    destroyMediaPlayer();
  }
};

let setVideoErrorMessage = function (message) {
  if (message) {
    errorMessage.innerText = message;
  } else {
    errorMessage.innerText = defaultErrorMessage;
  }
};

let setLiveMessages = function (liveNow, goLive) {

  let liveIcon = '<i class="circle"></i>';

  if (liveNow) {
    live.innerHTML = liveIcon + liveNow;
  } else {
    live.innerHTML = liveIcon + defaultLiveNowMessage;
  }

  let goLiveIcon = '<i class="triangle"></i>';

  if (goLive) {
    nolive.innerHTML = goLiveIcon + goLive;
  } else {
    nolive.innerHTML = goLiveIcon + defaultGoLiveMessage;
  }
};


const loadSource = async function(
  autoplay,
  url,
  format,
  time,
  useCredentials,
  audioTrack,
  ccTrack,
  licenseUrl,
  authToken,
  headers
) {
  "use strict";
  audioTracksUpdated = true;
  logger('loadSource', currentSenderId);

  if (firstTimePlayerLoaded){
    await destroyMediaPlayer();
  }

  if (time !== undefined && time !== -1) {
    deeplink = time;
  } else {
    deeplink = -1;
  }

  logger('deeplink: ' + deeplink);
  currentAudioTrack.textContent = 'Default Audio';
  ccAlreadySelected = false;
  video.volume = 1;
  video.muted = false;

  await initShaka(url, time, autoplay, useCredentials, audioTrack, ccTrack, licenseUrl, authToken, headers);
};

context.addEventListener(cast.framework.system.EventType.READY, function (event) {
  logger('- READY -');
  if (!poly_done) {
    poly_done = true;
    logger("Poly loaded")
    shaka.polyfill.installAll();
  }
  logger("Shaka instance created")
  if (shaka.Player.isBrowserSupported()) {
    window.shakaPlayer = new shaka.Player();
    window.shakaPlayer.configure(window.shakaOptions);
    window.shakaPlayer.attach(video);
  }
});

context.addEventListener(cast.framework.system.EventType.SHUTDOWN, function (event) {
  mediaTracking(MediaAnalyticsEventType.VIDEO_CLOSED);
  playerId = '';
  logger('- SHUTDOWN -');
});

context.addEventListener(cast.framework.system.EventType.SENDER_DISCONNECTED, function (event) {
  mediaTracking(MediaAnalyticsEventType.VIDEO_CLOSED);
  playerId = '';
  logger('- SENDER_DISCONNECTED -');
  logger(event);
  logger(event.userAgent);
});

context.addEventListener(cast.framework.system.EventType.ERROR, function (event) {
  logger('- ERROR -');
});

context.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED, function (event) {
  logger('- SENDER_CONNECTED -');
  logger(event);
  logger(event.userAgent);
});

context.addCustomMessageListener(DIVA_CHANNEL, function (message) {
  "use strict";

  checkSession(message.senderId);
  logger('[COMMAND FROM DIVA]', message.data.action, message.data);

  receiveMessage(message);

});


context.addCustomMessageListener(EXTERNAL_CHANNEL, function (message) {
  "use strict";
  logger('[COMMAND FROM EXTERNAL]', message.data.action, message.data);

  receiveMessage(message);
});

let receiveMessage = function (message) {
  logger("receiveMessage", message.data.action,message.data);

  switch (message.data.action) {
    case ChromeCastCommands.setup: {
      let bgURL = message.data.params.bg || "none";
      setBackground(bgURL);
      break;
    }
    case ChromeCastCommands.load: {

      stream = message.data.params;
      debug = stream.receiverDebug === true || debug;
      bgImageContainer.style.display = 'none';
      bgImageContainer.style.opacity = '0';
      dvrType = stream.dvrType || DvrType.FULL;

      logger('-- ChromeCastCommands.load --');
      logger(stream);

      const videoIdChanged = !!message.data.params.videoMetadata && videoId !== message.data.params.videoMetadata.videoId;

      if (videoId !== '' && videoIdChanged) {
        mediaTracking(MediaAnalyticsEventType.VIDEO_CLOSED);
      }

      if (videoIdChanged) {
        logger('initMediaAnalyticsPlugin: ' + videoId);
        initMediaAnalyticsPlugin(debug);

        playerId = guid();

        mediaTracking(MediaAnalyticsEventType.VIDEO_OPEN, {
          videoId: message.data.params.videoMetadata.videoId
        });
      }

      resetControls();

      let autoplay = true;
      video.autoplay = true;
      // If changing manifest and the video was previously paused
      if (firstTimePlayerLoaded && (video.paused || video.ended)) {
        autoplay = false;
      }

      if (firstTimePlayerLoaded) {
      // replace video element to prevent cc track leakage from one video to another
        logger("replace Element");
      let videoNew = document.createElement('video');
      videoNew.id = 'video';
      if (autoplay) {
        videoNew.setAttribute('autoplay', 'true');
      }
      let parent = video.parentNode;
      parent.replaceChild(videoNew, video);
      video = videoNew;
      }

      registerListeners();

      if (stream.type !== "LIVE" && stream.type !== "LIVE24x7") stream.type = "VOD";

      if (typeof stream.audioSelectionMethod === 'string') {
        stream.audioSelectionMethod = stream.audioSelectionMethod.toLowerCase();
        if (['title', 'lang'].indexOf(stream.audioSelectionMethod) !== -1) {
          audioSelectionMethod = stream.audioSelectionMethod.toLowerCase()
        }
      }

      if (typeof stream.closedCaptionSelectionMethod === 'string') {
        stream.closedCaptionSelectionMethod = stream.closedCaptionSelectionMethod.toLowerCase();
        if (['title', 'lang'].indexOf(stream.closedCaptionSelectionMethod) !== -1) {
          closedCaptionSelectionMethod = stream.closedCaptionSelectionMethod.toLowerCase()
        }
      }

      mediaTracking(MediaAnalyticsEventType.VIDEO_LOADED, {
        videoMetadata: message.data.params.videoMetadata
      });

      videoId = message.data.params.videoMetadata.videoId;

      setVideoErrorMessage(stream.videoErrorMessage);
      setLiveMessages(stream.liveNowMessage, stream.goLiveMessage);

      if (debug) {
        debugPanel.style.display = 'block';
      }

      loadSource(
        autoplay,
        stream.url,
        stream.format || "HLS",
        typeof stream.time === 'number' ? stream.time : (stream.type.toLowerCase() === 'vod' ? 0 : -1),
        stream.useCredentials,
        stream.audioTrackSelection,
        stream.ccTrackSelection,
        stream.licenseUrl,
        stream.authToken,
        stream.headers
      );

      if (stream.title && stream.title.trim() !== '') {
        title.innerText = stream.title;
      } else {
        title.innerText = stream.videoMetadata.title || "";
      }
      controls.className = stream.type || "VOD";
      bgImage.src = stream.videoMetadata.image || "";

      setThemeColor(stream.color || "#fff");
      break;
    }

    case "seek":
    case ChromeCastCommands.seek: {
      let position = message.data.params.time;
      logger('seek ' + position);
      if (position === "live") {
        seekToLive();
      } else {
        if (position < 6 && dvrType === DvrType.LIMITED) {
          position = 6;
        }
        seekTo(position);
      }
      break;
    }
    case ChromeCastCommands.play: {
      if (videoEnded) {
        playerId = guid();
        mediaTracking(MediaAnalyticsEventType.VIDEO_REPLAY, {
          videoMetadata: stream.videoMetadata,
          HTMLVideoElementId: video.id,
          streamUrl: stream.url
        });
        mediaTracking(MediaAnalyticsEventType.VIDEO_DURATION_CHANGED, {
          duration: window.shakaPlayer ? Math.floor(shakaDuration() * 1000) : Math.floor(video.duration * 1000)
        });
        mediaTracking(MediaAnalyticsEventType.PLAYBACK_FRAMERATE_CHANGED, {
          framerate: lastFramerate
        });
      }
      if (!loadingState || video.autoplay == false) {
        logger("Play command sent");
      video.play();
      } else {
        logger("Play command skip already playing");
      }
      bgImageContainer.style.display = 'none';
      bgImageContainer.style.opacity = '0';
      break;
    }
    case ChromeCastCommands.audio: {
      if (audioTracksUpdated) {
        setAudioTrack(message.data.params.audioTrackSelection, true);
      } else {
        audioTrackSelected = message.data.params.audioTrackSelection;
      }
      break;
    }
    case ChromeCastCommands.cc: {
      ccTrackSelect(message.data.params.ccTrackSelection);
      break;
    }
    case ChromeCastCommands.pause: {
      video.pause();
      break;
    }
    case ChromeCastCommands.close: {
      mediaTracking(MediaAnalyticsEventType.VIDEO_CLOSED);
      playerId = '';
      videoEnded = true;
      context.stop();
      break;
    }
    case ChromeCastCommands.debug: {
      debug = message.data.params.receiverDebug === true || debug;

      debugPanel.style.display = debug ? 'block' : 'none';
      break;
    }
    case ChromeCastCommands.update: {
      let params = message.data.params;
      if (params.title && params.title.trim() !== '') {
        title.innerText = params.title;
        stream.title = params.title;
      }
      if (params.eop) {
        if (params.image && params.image.trim() !== '' && params.image !== bgImage.src) {
          bgImage.src = params.image;
        }
        bgImageContainer.style.display = 'block';
        bgImageContainer.style.opacity = '1';

        mediaTracking(MediaAnalyticsEventType.VIDEO_ENDED);
        playerId = '';
        videoEnded = true;
      }
      break;
    }
  }

};

let stateNotifier = function () {
  "use strict";

  let value_current_time = 0,
      value_duration = 0;
  
  if (window.shakaPlayer) {
    const programDateTime = new Date((window.shakaPlayer.getPresentationStartTimeAsDate()?.getTime() ?? 0) + (window.shakaPlayer.seekRange()?.end ?? 0) * 1000);

    seekRangeStart = window.shakaPlayer.seekRange()?.start;
    seekRangeEnd = window.shakaPlayer.seekRange()?.end;

    let message = {
      command: ChromeCastCommands.status,
      title: title.innerText,
      currentTime: video.currentTime,
      playerState: state,
      duration: shakaDuration(),
      programDateTime: programDateTime.toISOString(),
      seekRange: window.shakaPlayer.seekRange(),
      ccTracks: ccTracks().map((cc) => {
        return {
          id: closedCaptionSelectionMethod === 'title' ? cc.label : cc.lang,
          label: cc.label,
          language: cc.lang,
          mode: cc.mode
        }
      }),
      audioTracks: getShakaAudioTracks().map(function (track) {
        return track.label;
      })
    };

    value_current_time = video.currentTime - seekRangeStart;
    value_duration = seekRangeEnd - seekRangeStart;

    logger('State Notifier message:', message);

    if (oldDuration !== shakaDuration()) {
      mediaTracking(MediaAnalyticsEventType.VIDEO_DURATION_CHANGED, {
        duration: Math.floor(shakaDuration() * 1000),
      });
      oldDuration = shakaDuration();
    }
    playrate.innerHTML = video.playbackRate;

    videoCurrentTime.textContent = Math.round(value_current_time * 100) / 100 + ' s';
    if (typeof value_duration === "number" && !isNaN(value_duration)) {
      videoDuration.textContent = Math.round(value_duration * 100) / 100 + ' s';
    } else {
      videoDuration.textContent = '';
    }
    if (video.buffered.length > 0) {
      let buflen = video.buffered.end(video.buffered.length - 1) - video.currentTime;
      if (typeof buflen === "number" && !isNaN(buflen)) {
        debugBufferSize.textContent = Math.round(buflen * 100) / 100 + ' s';
      } else {
        debugBufferSize.textContent = '';
      }
    } else {
      debugBufferSize.textContent = '';
    }

    sendCustomMessage(
      message
    );

    resetControls();

    bar.style.width = value_current_time * 100 / value_duration + "%";

    if (stream.type === "VOD") {
      currentTime.style.opacity = '1';
      duration.style.opacity = '1';
      currentTime.innerText = convert(Math.max(value_current_time, 0));
      duration.innerText = convert(value_duration);
    } else if (stream.type === "LIVE") {
      let isLive = video.currentTime > (value_duration - liveTolerance);
      live.style.opacity = isLive ? '1' : '0';
      nolive.style.opacity = !isLive ? '1' : '0';
    } else if (stream.type === "LIVE24x7") {
      let isPlaying = state === ChromeCastState.playing;
      live.style.opacity = isPlaying ? '1' : '0';
    }
  }

};



let mediaTracking = (eventType, payload = {}) => {
  
  if (window.convivaPlugin && playerId !== '') {
    logger(`[MEDIA-ANALYTICS][CONVIVA] ${eventType}`, payload);
    window.convivaPlugin.handleEvent({
      type: eventType,
      playerId: playerId,
      ...payload
    })
  }
}

let initMediaAnalyticsPlugin = (debug) => {
  if (initConvivaPlugin) {
    logger("conviva Activated")
    initConvivaPlugin(debug);
  } else {
    logger("conviva not Activated")
  }
}



function handleVideoEvent(evt) {

  if (evt.type !== 'timeupdate') {
    logger('handleVideoEvent: ' + evt.type);
    playerevent.innerHTML = evt.type;
  }

  switch (evt.type) {
    case 'waiting':
      state = ChromeCastState.buffering;
      buffering = true;
      showLoading();
      showControls();
      mediaTracking(MediaAnalyticsEventType.BUFFERING_STARTED);
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
      loadingState = false;
      hideLoading();
      hideControls();
      mediaTracking(MediaAnalyticsEventType.SEEK_ENDED, {
        time: video.currentTime
      });
      break;
    case 'play':
    case 'playing':
      if (evt.type === 'playing') {
        loadingState = false;
        mediaTracking(MediaAnalyticsEventType.PLAYBACK_STARTED);
        if (getDuration()) {
          state = ChromeCastState.playing;
        }
        videoEnded = false;
        shakaPlayer.configure("manifest.dash.updatePeriod", 5);
        if ( !isFuchsia() ) {
          shakaPlayer.configure("abr.restrictions.maxBandwidth", Infinity);
        }
        if(shakaPlayer.getConfiguration().streaming.bufferingGoal < 10){
          setTimeout(function(){
            let goal = stream.type == "VOD" ? 30 : 20;
            let slow = stream.type == "VOD" ? 16 : 8;
            let fast = stream.type == "VOD" ? 16 : 8;
            shakaPlayer.configure("abr.advanced.slowHalfLife", slow);
            shakaPlayer.configure("abr.advanced.fastHalfLife", fast);
            shakaPlayer.configure("streaming.bufferingGoal", goal);
          }, 1000);
        }
      }
      if (getDuration()) {
        if (!ccAlreadySelected && ccTrackSelected && ccTrackSelected.length) {
          ccTrackSelect(ccTrackSelected);
          ccAlreadySelected = true
        }
      }
      hideLoading();
      hideControls();
      pause.style.opacity = '0';
      play.style.opacity = '1';
      break;
    case 'ended':
      loadingState = false;
      if (!videoEnded && getDuration()) {
        state = ChromeCastState.ended;

        let message = {
          command: ChromeCastCommands.close,
          playerState: ChromeCastState.ended,
          forced: false
        };
        if (currentSenderId) {
          sendCustomMessage(
            message
          );
        }
        mediaTracking(MediaAnalyticsEventType.VIDEO_ENDED);
        playerId = '';
        videoEnded = true;
      }
      break;
    case 'pause':
        state = ChromeCastState.paused;
        previousState = state;
        pause.style.opacity = '1';
        play.style.opacity = '0';
        showControls();
        mediaTracking(MediaAnalyticsEventType.PLAYBACK_PAUSED);
        break;
    case 'loadedmetadata':
      // if player is type of shaka
      if (window.shakaPlayer) {
        // window.shakaPlayer.getPresentationStartTimeAsDate()
      }
      // Starting position
      if (deeplink >= 0 && deeplink < getDuration() && dvrType !== DvrType.LIMITED) {
        logger('loadedmetadata deeplink: ' + deeplink)
        video.currentTime = deeplink;
      }
      break;
    case 'durationchange':
      mediaTracking(MediaAnalyticsEventType.VIDEO_DURATION_CHANGED, {
        duration: Math.floor(getDuration() * 1000)
      });
      break;

    case 'timeupdate':
      hideError();
      hideLoading();
      // Do not report the status if it was already playing
      if ( state === ChromeCastState.playing ) {
        return
      }

      if (!video.paused && getDuration()) {
        state = ChromeCastState.playing;
      }
  }

  if (buffering && state !== ChromeCastState.buffering) {
    buffering = false;
    hideLoading();
    mediaTracking(MediaAnalyticsEventType.BUFFERING_ENDED);
  }

  stateNotifier();
}

const getDuration = () => {
  let duration = 0;
  if (window.shakaPlayer) {
    duration = shakaDuration();
  } else {
    duration = video.duration;
  }
  return typeof duration === "number" && !isNaN(duration) ? duration : 0;
}

let registerListeners = function () {
  video.addEventListener('seeking', handleVideoEvent);
  video.addEventListener('seeked', handleVideoEvent);
  video.addEventListener('waiting', handleVideoEvent);
  video.addEventListener('pause', handleVideoEvent);
  video.addEventListener('play', handleVideoEvent);
  video.addEventListener('playing', handleVideoEvent);
  video.addEventListener('error', handleVideoEvent);
  video.addEventListener('loadedmetadata', handleVideoEvent);
  video.addEventListener('durationchange', handleVideoEvent);
  video.addEventListener('timeupdate', handleVideoEvent);
};

let removeListeners = function () {
  video.removeEventListener('seeking', handleVideoEvent);
  video.removeEventListener('seeked', handleVideoEvent);
  video.removeEventListener('waiting', handleVideoEvent);
  video.removeEventListener('pause', handleVideoEvent);
  video.removeEventListener('play', handleVideoEvent);
  video.removeEventListener('playing', handleVideoEvent);
  video.removeEventListener('error', handleVideoEvent);
  video.removeEventListener('loadedmetadata', handleVideoEvent);
  video.removeEventListener('durationchange', handleVideoEvent);
  video.removeEventListener('timeupdate', handleVideoEvent);
};


let options = new cast.framework.CastReceiverOptions();
options.maxInactivity = 9999;
options.disableIdleTimeout = true;
options.skipShakaLoad = true
//options.shakaVersion= "4.9.29";
options.skipMplLoad = true;
context.start(options);

let castConsoleBG = location.search.split("=")[1];

if (castConsoleBG) {
  setBackground(decodeURIComponent(castConsoleBG));
}

// CC tracks

let ccTracks = () => {
  let tracks = [];
  if (window.shakaPlayer) {
    tracks = window.shakaPlayer.getTextTracks()
      .map(track => {
        return {
          id: `${track.id}`,
          kind: track.kind,
          label: track.label ? track.label : track.language,
          lang: track.language,
          mimeType: track.mimeType,
          active: window.shakaPlayer.isTextTrackVisible() && track.active
        }
      })
  }

  const closedCaptions = [];
  for (let track of tracks) {

    let outLabel = track.label;

    // If selection method is lang, use track language as label.
    if (closedCaptionSelectionMethod === 'lang') {
      outLabel = track.lang;
    }

    let is608 = false;

    // If empty string or dash and 608 use fixed label d3608
    if (isEmptyString(outLabel) || track.mimeType === 'application/cea-608') {
      is608 = true;
      outLabel = 'd3608';
    }

    closedCaptions.push({
      id: `${track.id}`,
      label: is608 ? 'd3608' : outLabel,
      lang: is608 ? 'd3608' : track.lang,
      mode: track.active ? 'showing' : 'disabled'
    });
  }

  let newArray = [];
  let uniqueObject = {};

  for (let i in closedCaptions) {
    if (!uniqueObject[closedCaptions[i]['label']]) {
      uniqueObject[closedCaptions[i]['label']] = closedCaptions[i];
    }
  }

  // Loop to push unique object into array
  for (const i in uniqueObject) {
    newArray.push(uniqueObject[i]);
  }

  return newArray;
};

let ccTrackSelected = "";

let disableCC = function () {
  window.shakaPlayer.setTextTrackVisibility(false);
}

let ccTrackSelect = (value) => {
  logger(`CC track attempt selecting '${value}' with selection method '${closedCaptionSelectionMethod}'`);
  value = value || "";
  ccTrackSelected = value;

  if (value && value.length > 0) {
    let tracks = ccTracks();
    let item = null;
    const only1 = tracks.length == 1
    if (only1){
      item = tracks[0];
    }else{
      item = tracks.find(item => (closedCaptionSelectionMethod === 'title' && `${item.label}`.toLowerCase() === value.toLowerCase()) || (closedCaptionSelectionMethod === 'lang' && `${item.lang}`.toLowerCase() === value.toLowerCase()))
    }
    if (item) {
      if (window.shakaPlayer) {
        let track = null;
        if (only1){
          track = window.shakaPlayer.getTextTracks()[0];
        }else{
          track = window.shakaPlayer.getTextTracks().find((t) => {
          if (value.toLowerCase() === 'd3608' && t.mimeType === 'application/cea-608') {
            return true;
          }
          if (closedCaptionSelectionMethod === 'title' && t.label) {
            return `${t.label}`.toLowerCase() === `${item.label}`.toLowerCase();
          } else {
            return `${t.language}`.toLowerCase() === `${item.lang}`.toLowerCase();
          }
        });
        }
        if (track) {
          currentCCTrack.textContent = track.label ? `${track.label}/${track.language}` : `${track.language}`;
          window.shakaPlayer.selectTextTrack(track);
          window.shakaPlayer.setTextTrackVisibility(true);
        } else {
          currentCCTrack.textContent = `disabled`
          window.shakaPlayer.setTextTrackVisibility(false);
        }
      }
    } else {
      logger("set wrong text track", value);
      currentCCTrack.textContent = `disabled`
      disableCC();
    }
  } else {
    logger("disable text track");
    currentCCTrack.textContent = `disabled`
    disableCC()
  }
};

async function destroyMediaPlayer() {
  if (window.shakaPlayer) {
    window.shakaPlayer.removeEventListener('error', onShakaError);
    window.shakaPlayer.removeEventListener('adaptation', onShakaAdaptation);
    try {
      await window.shakaPlayer.detach();
      await window.shakaPlayer.destroy();
      window.shakaPlayer = null;
    } catch (error) {
      logger("Error destroying media player: ", error);
    }
  }
}

const guid = function () {
  function s4() {
    return Math.floor((Math.random() + 1) * 0x10000)
      .toString(16)
      .substring(1);
  }

  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

const isEmptyString = (item) => {
  return !item || `${item}`.trim() === '';
}


const sendCustomMessage = (message) => {
  if (JSON.stringify(previousMgs) !== JSON.stringify(message)) {
    context.sendCustomMessage(DIVA_CHANNEL, currentSenderId, message);
    context.sendCustomMessage(EXTERNAL_CHANNEL, currentSenderId, message);  
  }
  previousMgs = { ...message };
}

document.addEventListener('keydown', function(event) {
  logger('receive key:', event.key);
  switch (event.key) {
      case 'MediaPlayPause':
          state === ChromeCastState.playing ? video.pause() : video.play();
          break;
      case 'MediaPlay':
          video.play();
          break;
      case 'MediaPause':
          video.pause();
          break;
      case 'ArrowUp':
          showControls();
          break;
      case 'ArrowDown':
          hideControls();
          break;
      case 'ArrowLeft':
          seekTo(video.currentTime - 10);
          break;
      case 'ArrowRight':
          seekTo(video.currentTime + 10);
          break;
      case 'Enter':
          state === ChromeCastState.playing ? video.pause() : video.play();
          break;
      case 'VolumeUp':
          // Handle volume up
          break;
      case 'VolumeDown':
          // Handle volume down
          break;
      case 'Backspace':
          cast.framework.CastReceiverContext.getInstance().stop();
          break;
      default:
        logger('Unhandled key:', event.key);
  }
});