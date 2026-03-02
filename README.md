# Diva ChromeCast Receiver App

This document describes how to use the Diva ChromeCast Receiver App

## Installation

Upload all the contents of the **dist** folder in a public server location. The receiver app must be under https location.

Go to the [Google Cast SDK Developer Console](https://cast.google.com/publish) and register your receiver app. Clicking in **ADD NEW APPLICATION** will present a selection screen "New Receiver Application". Select **Custom Receiver** and complete all the information about the app receiver.

More information can be found in the [Google Cast Receiver documentation](https://developers.google.com/cast/docs/caf_receiver_basic)

## Background image configuration

The background image can be configured in the CAST Console passing a get parameter in the receiver app URL. The background parameter is "bg" (the backgound image URL must be url encoded). For instance:

`http://domain.tld/appreceiver_path/index.html?bg=http://lorempixel.com/1920/1080/sports/`


## Note for Diva Developer

There is a modification to the Cast Receiver Library to extend the session to more than 5 minutes. There is a setTimeout in the library for session "Timer expired". There is no way (for now) to extend this time if Shaka player is not used, so we are manualy modifying this value to long value (9x10E9).

## Dependencies
* [Cast Application Framework (CAF) Receiver 2.0.0.0060 ](https://developers.google.com/cast/docs/reference/caf_receiver/)

* [HLS.js 0.12.4](https://github.com/video-dev/hls.js)

* [Shaka Player 2.4.7](https://github.com/google/shaka-player)

* [Diva Chomecast.Conviva integration 1.0.3](https://alm.deltatre.it/tfs/D3Alm/Diva/_git/Chromecast.Conviva)

## Changelog

### [2.1.5]
#### Fixed
* Conviva - No session monitored if video ends in Chromecast mode and is restarted from recommendation view

### [2.1.4]
#### Fixed
* CC not shown if enabled when you aren't in Chromecast mode
* Conviva - Session with status 'Exit before video start' wrongly created when a recommended video is opened

### [2.1.3]
#### Added
* Compatibility with Diva Player Html5

#### Changed
* HLS.js updated to v0.12.4
* Shaka Player updated to 2.4.7

### [2.1.2]
#### Changed
* Fix #205169 live video starts from 0 if user is live when entering chromecast mode

### [2.1.1] - 2019-04-11
#### Changed 
* Fix #189526 seek to live too far from true live offset

### [2.1.0] - 2018-11-16
#### Changed
* Add support for DASH and DRM DASH  by using ShakaPlayer

### [2.0.8] - 2018-07-27
#### Changed
* Conviva: add "CHROMECAST - " prefix to aplicationName and playerName params

### [2.0.7] - 2018-07-23
#### Changed
* Changed "go live" icon to yellow triangle 

### [2.0.6] - 2018-07-17
#### Fixed
* Fixed stream freezing when fragments are empty 

#### Added
* Added chromecast seek to live feature 
* Added support for 24x7 live streams

### [2.0.5] - 2018-07-03
#### Fixed
* Updated conviva integration to 1.0.2
* Fixed Conviva error reporting

### [2.0.4] - 2018-06-29
#### Fixed
* Added conviva integration

### [2.0.3] - 2018-06-06
#### Fixed
* Fixed switching audiotrack delay

### [2.0.2] - 2018-06-01
#### Fixed
* Fixed max inactivity timer
* Fixed iOS background disconnection

### [2.0.1] - 2018-05-29
#### Added
* Audio track selection
* Background configurable in the receiver app URL
* Device session control


### [2.0.0] - 2018-05-02
#### Added
* Player layout: basic player controls, seek bar, video data title
* Support URL Token authentication
* Support seekable video LIVE and VOD
* Support video HLS v3 and v4
* Management video error with a message displayed on player

