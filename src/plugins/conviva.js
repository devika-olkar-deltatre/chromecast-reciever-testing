// INIT CONVIVA PLUGIN
window.convivaPlugin = null;
window.initConvivaPlugin = (debug) => {
	const logger = (...value) => {
		if (debug) {
			console.log(...value);
		}
	}

	/**
	* 
	* @param videoMetadata 
	* @returns fully customisable key/value object 
	*/
	const customTag = (videoMetadata) => {
        const generatedTags = {
			assetState: videoMetadata.assetState,
			eventId: videoMetadata.eventId,
			is24_7: `${videoMetadata.assetState === 'live' && videoMetadata.dvrType === 'none'}`,
			is360: `${!!videoMetadata.stereoMode && videoMetadata.stereoMode !== 'none'}`,
			livelikeProgramId: videoMetadata.livelikeProgramId,
			platform: 'Chromecast',
			spoilerMode: videoMetadata.behaviour?.spoilerMode,
			videoId: videoMetadata.videoId,
			videoTitle: videoMetadata.title,
			itemId: videoMetadata.customAttributes.itemId,
			'Conviva.viewerId': videoMetadata.customAttributes.viewerId,
			'Conviva.assetName': `[${videoMetadata.customAttributes.itemId || videoMetadata.videoId}] ${videoMetadata.title || ""}`, 
		}

        console.log(">>> customTags", generatedTags);
        return generatedTags;
	}

	/**
	* Conviva configuration properties
	*/
	window.convivaConfig = {
		playerVersion: APP_VERSION,
		"c3.app.version": APP_VERSION,
		customerKey: CONVIVA_CUSTOMER_KEY,
		playerName: 'CHROMECAST',
		viewerId: '',
		cdnName: 'AKAMAI',
		customTagGenerator: customTag,
		gatewayUrl: CONVIVA_GATEWAY_URL || undefined,
		log: debug ? logger : undefined,
	};

	console.log(">>> convivaConfig", debug, window.convivaConfig);

	window.convivaPlugin = new divaConvivaPlugin.ConvivaPlugin();
	window.convivaPlugin.init(convivaConfig);
};
