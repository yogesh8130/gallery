(() => {
	const player = document.querySelector('.player');
	const video = document.getElementById('player');
	const previousButton = document.getElementById('previousButton');
	const nextButton = document.getElementById('nextButton');
	const playButton = document.getElementById('playButton');
	const loopButton = document.getElementById('loopButton');
	const seekBar = document.getElementById('seekBar');
	const timeDisplay = document.getElementById('timeDisplay');
	const progressFill = document.getElementById('progressFill');
	const downloadButton = document.getElementById('downloadButton');
	const fullscreenButton = document.getElementById('fullscreenButton');
	const mxPlayerButton = document.getElementById('mxPlayerButton');
	const vlcButton = document.getElementById('vlcButton');
	const unsupportedPreview = document.getElementById('unsupportedPreview');
	const unsupportedMessage = document.getElementById('unsupportedMessage');
	const videoFilter = document.getElementById('videoFilter');
	const tagsToggle = document.getElementById('tagsToggle');
	const tagsPanel = document.getElementById('tagsPanel');
	const tagsForm = document.getElementById('tagsForm');
	const tagsInput = document.getElementById('tagsInput');
	const tagsApply = document.getElementById('tagsApply');
	const tagsHistory = document.getElementById('tagsHistory');
	const status = document.getElementById('status');
	const videoFolder = document.getElementById('videoFolder');
	const videoName = document.getElementById('videoName');
	const centerHint = document.getElementById('centerHint');
	const centerIcon = document.getElementById('centerIcon');
	const centerText = document.getElementById('centerText');
	const history = [];
	const initialFilter = videoFilter.value;
	const initialPath = player.dataset.videoPath;
	video.loop = true;
	let currentPath = initialPath;
	let currentFilter = initialFilter;
	let pointerStart = null;
	let holdTimer = null;
	let heldForSpeed = false;
	let seeking = false;
	let swipeAxis = null;
	let scrubbing = false;
	let previewTime = null;
	let showRemainingTime = false;
	let controlsTimer = null;
	let hintTimer = null;
	let spaceHoldTimer = null;
	let spaceKeyDown = false;
	let spaceHeldForSpeed = false;

	const setExternalPlayerLinks = path => {
		const mediaUrl = new URL(path, window.location.origin);
		const intentPath = `${mediaUrl.host}${mediaUrl.pathname}${mediaUrl.search}`;
		const makeIntentUrl = packageName =>
			`intent://${intentPath}#Intent;scheme=${mediaUrl.protocol.slice(0, -1)};type=video/*;package=${packageName};end`;
		mxPlayerButton.href = makeIntentUrl('com.mxtech.videoplayer.pro');
		vlcButton.href = makeIntentUrl('org.videolan.vlc');
		unsupportedMessage.href = vlcButton.href;
	};

	const showUnsupportedVideo = () => {
		if (player.classList.contains('unsupported')) return;
		player.classList.add('unsupported');
		unsupportedPreview.classList.remove('loaded');
		unsupportedPreview.src = `/thumbnail?${new URLSearchParams({ videoPath: currentPath })}`;
		status.textContent = '';
	};

	const setVideo = path => {
		const normalizedPath = decodeURIComponent(path).replace(/\\/g, '/').replace(/\/+/g, '/');
		currentPath = normalizedPath;
		player.classList.remove('unsupported');
		unsupportedPreview.classList.remove('loaded');
		unsupportedPreview.removeAttribute('src');
		video.muted = false;
		video.src = normalizedPath;
		downloadButton.href = normalizedPath;
		setExternalPlayerLinks(normalizedPath);
		const filenameStart = normalizedPath.lastIndexOf('/') + 1;
		videoFolder.textContent = normalizedPath.slice(0, filenameStart - 1) || '/';
		videoName.textContent = normalizedPath.slice(filenameStart);
		videoFolder.title = videoFolder.textContent;
		videoName.title = videoName.textContent;
		video.load();
		video.play().catch(error => {
			if (error.name === 'NotSupportedError') {
				showUnsupportedVideo();
				return;
			}
			if (error.name !== 'NotAllowedError') {
				status.textContent = 'Unable to play this video';
				return;
			}
			video.muted = true;
			video.play().catch(() => {
				if (video.error && [3, 4].includes(video.error.code)) showUnsupportedVideo();
				else status.textContent = 'Tap to play';
			});
		});
	};

	unsupportedPreview.addEventListener('load', () => unsupportedPreview.classList.add('loaded'));
	unsupportedPreview.addEventListener('error', () => unsupportedPreview.classList.remove('loaded'));
	video.addEventListener('error', () => {
		if (video.error && [3, 4].includes(video.error.code)) showUnsupportedVideo();
		else status.textContent = 'Unable to play this video';
	});

	const formatTime = seconds => {
		const wholeSeconds = Math.max(0, Math.floor(seconds));
		const hours = Math.floor(wholeSeconds / 3600);
		const minutes = Math.floor((wholeSeconds % 3600) / 60);
		const remainder = wholeSeconds % 60;
		return hours > 0
			? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
			: `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
	};

	const updateTimeDisplay = time => {
		const duration = video.duration;
		const current = showRemainingTime ? `-${formatTime(duration - time)}` : formatTime(time);
		timeDisplay.textContent = `${current} / ${formatTime(duration)}`;
		timeDisplay.title = showRemainingTime ? 'Switch to elapsed time' : 'Switch to remaining time';
	};

	const updateProgress = time => {
		if (!Number.isFinite(video.duration) || video.duration <= 0) return;
		const progress = Math.max(0, Math.min(1, time / video.duration));
		seekBar.value = String(Math.round(progress * Number(seekBar.max)));
		seekBar.style.setProperty('--seek-progress', `${progress * 100}%`);
		progressFill.style.width = `${progress * 100}%`;
		updateTimeDisplay(time);
	};

	const revealControls = () => {
		player.classList.remove('controlsHidden');
		clearTimeout(controlsTimer);
		controlsTimer = setTimeout(() => {
			if (!scrubbing && document.activeElement !== videoFilter && !tagsPanel.contains(document.activeElement)) {
				player.classList.add('controlsHidden');
			}
		}, 2200);
	};

	const toggleControls = () => {
		if (document.activeElement === videoFilter || tagsPanel.contains(document.activeElement)) {
			revealControls();
			return;
		}
		if (player.classList.contains('controlsHidden')) revealControls();
		else {
			clearTimeout(controlsTimer);
			player.classList.add('controlsHidden');
		}
	};

	const showHint = (icon, text) => {
		centerIcon.textContent = icon;
		centerText.textContent = text;
		centerHint.classList.add('visible');
		clearTimeout(hintTimer);
		hintTimer = setTimeout(() => centerHint.classList.remove('visible'), 650);
	};

	const copyText = async (element, description) => {
		const text = element.textContent;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				const temporaryInput = document.createElement('textarea');
				temporaryInput.value = text;
				temporaryInput.style.position = 'fixed';
				temporaryInput.style.opacity = '0';
				document.body.appendChild(temporaryInput);
				temporaryInput.select();
				const copied = document.execCommand('copy');
				temporaryInput.remove();
				if (!copied) throw new Error('Copy failed');
			}
			status.textContent = `${description} copied`;
		} catch (error) {
			status.textContent = 'Unable to copy';
		}
	};

	const makeCopyable = (element, description) => {
		element.addEventListener('click', () => copyText(element, description));
		element.addEventListener('keydown', event => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				copyText(element, description);
			}
		});
	};

	const updatePlaybackControls = () => {
		playButton.textContent = video.paused ? '▶' : 'Ⅱ';
		playButton.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
		status.textContent = video.playbackRate > 1 ? `${video.playbackRate}×` : '';
	};

	const playRandom = async (filterText = currentFilter, includeCurrent = false) => {
		try {
			const params = new URLSearchParams({ filter: filterText });
			if (!includeCurrent) params.set('exclude', currentPath);
			const response = await fetch(`/vid/random?${params}`);
			if (!response.ok) throw new Error(response.status === 404 ? 'No videos match this filter' : 'Unable to find a video');
			const data = await response.json();
			if (filterText !== currentFilter) history.length = 0;
			else if (!includeCurrent) history.push(currentPath);
			currentFilter = filterText;
			setVideo(data.videoPath);
		} catch (error) {
			status.textContent = error.message;
		}
	};

	const applyVideoFilter = () => {
		const nextFilter = videoFilter.value.trim();
		if (nextFilter === currentFilter) return;
		playRandom(nextFilter, true);
	};

	const readTagHistory = () => {
		try {
			return JSON.parse(localStorage.getItem('appendToNameHistory')) || {};
		} catch (error) {
			return {};
		}
	};

	const renderTagHistory = () => {
		const tagHistory = readTagHistory();
		tagsHistory.replaceChildren();
		Object.keys(tagHistory)
			.sort((first, second) => first.localeCompare(second, undefined, { sensitivity: 'base' }))
			.forEach(tag => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'tagHistoryButton';
				button.textContent = tag;
				button.title = tag;
				button.addEventListener('click', () => {
					tagsInput.value = tag;
					applyTags(tag);
				});
				tagsHistory.appendChild(button);
			});
	};

	const rememberTags = tags => {
		const tagHistory = readTagHistory();
		for (const tag of tags) {
			if (!tagHistory[tag]) {
				while (Object.keys(tagHistory).length > 9) {
					const leastUsed = Object.keys(tagHistory).reduce((least, candidate) =>
						tagHistory[candidate].clicks < tagHistory[least].clicks ? candidate : least
					);
					delete tagHistory[leastUsed];
					Object.values(tagHistory).forEach(entry => entry.clicks--);
				}
				tagHistory[tag] = { clicks: 0 };
			} else {
				tagHistory[tag].clicks += 3;
			}
		}
		localStorage.setItem('appendToNameHistory', JSON.stringify(tagHistory));
		renderTagHistory();
	};

	const applyTags = async tag => {
		const value = tag.trim();
		if (!value) {
			status.textContent = 'Enter a tag first';
			return;
		}
		const tags = [...new Set(value.split(/[;,]/).map(part => part.trim()).filter(Boolean))];
		if (!tags.every(part => /^[a-zA-Z0-9 _#@$&*()\-]*$/.test(part))) {
			status.textContent = 'Tag contains disallowed characters';
			return;
		}

		rememberTags(tags);
		tagsApply.disabled = true;
		try {
			const currentUrl = new URL(currentPath, window.location.origin);
			const relativePath = decodeURIComponent(currentUrl.pathname)
				.replace(/\\/g, '/')
				.replace(/^\/+/, '')
				.replace(/\//g, '\\');
			const response = await fetch('/moveRenameFiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					operation: 'appendToName',
					currentFilePaths: { videoPlayer: relativePath },
					argument1: value
				})
			});
			if (!response.ok) throw new Error('Unable to append tag');
			const data = await response.json();
			const updatedVideo = data.newImagesData?.videoPlayer;
			if (updatedVideo && updatedVideo !== 'fail') {
				setVideo(updatedVideo.newFilePathRelative);
				status.textContent = 'Tag appended';
			} else if (data.failCount) {
				status.textContent = 'Unable to append tag';
			} else {
				status.textContent = 'Tag already present';
			}
		} catch (error) {
			status.textContent = error.message;
		} finally {
			tagsApply.disabled = false;
		}
	};

	const playPrevious = () => {
		const previousPath = history.pop();
		if (previousPath) setVideo(previousPath);
	};

	const updateLoopControls = () => {
		loopButton.classList.toggle('active', video.loop);
		loopButton.setAttribute('aria-pressed', String(video.loop));
		loopButton.title = video.loop ? 'Disable loop' : 'Enable loop';
		loopButton.setAttribute('aria-label', loopButton.title);
	};

	const toggleLoop = () => {
		video.loop = !video.loop;
		updateLoopControls();
	};

	const togglePlayback = () => {
		if (video.paused) {
			video.play().catch(() => { });
			showHint('▶', '');
		} else {
			video.pause();
			showHint('Ⅱ', '');
		}
	};

	const toggleFullscreen = async () => {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await player.requestFullscreen();
		} catch (error) {
			status.textContent = 'Fullscreen unavailable';
		}
	};

	const isInteractiveTarget = target => target instanceof Element
		&& target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="button"]');

	const handleKeyDown = event => {
		if (event.key === 'Escape' && document.activeElement instanceof HTMLElement
			&& document.activeElement.matches('input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"], textarea, [contenteditable="true"]')) {
			event.preventDefault();
			document.activeElement.blur();
			revealControls();
			return;
		}
		if (event.key === 'F2') {
			event.preventDefault();
			revealControls();
			tagsPanel.classList.remove('hidden');
			tagsToggle.setAttribute('aria-expanded', 'true');
			renderTagHistory();
			tagsInput.focus();
			return;
		}
		if (isInteractiveTarget(event.target)) return;
		if (event.repeat && ['f', 'F', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

		if (event.key === 'f' || event.key === 'F') {
			event.preventDefault();
			toggleFullscreen();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			playRandom();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			playPrevious();
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			if (Number.isFinite(video.duration)) {
				const direction = event.key === 'ArrowRight' ? 1 : -1;
				video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + direction * 5));
			}
		} else if (event.key === ' ' || event.key === 'Spacebar') {
			event.preventDefault();
			if (spaceKeyDown || event.repeat) return;
			spaceKeyDown = true;
			spaceHeldForSpeed = false;
			spaceHoldTimer = setTimeout(() => {
				if (spaceKeyDown && !video.paused) {
					video.playbackRate = 4;
					spaceHeldForSpeed = true;
					showHint('»', '4× speed');
				}
			}, 350);
		}
	};

	const handleKeyUp = event => {
		if (event.key !== ' ' && event.key !== 'Spacebar') return;
		if (!spaceKeyDown) return;
		event.preventDefault();
		clearTimeout(spaceHoldTimer);
		if (spaceHeldForSpeed) video.playbackRate = 1;
		else togglePlayback();
		spaceKeyDown = false;
		spaceHeldForSpeed = false;
	};

	const cancelSpaceHold = () => {
		clearTimeout(spaceHoldTimer);
		if (spaceHeldForSpeed) video.playbackRate = 1;
		spaceKeyDown = false;
		spaceHeldForSpeed = false;
	};

	const seekBySwipe = deltaX => {
		if (!Number.isFinite(video.duration) || video.duration <= 0) return;
		const seconds = deltaX / window.innerWidth * video.duration;
		previewTime = Math.max(0, Math.min(video.duration, pointerStart.time + seconds));
		updateProgress(previewTime);
	};

	previousButton.addEventListener('click', playPrevious);
	nextButton.addEventListener('click', () => playRandom());
	playButton.addEventListener('click', togglePlayback);
	loopButton.addEventListener('click', toggleLoop);
	timeDisplay.addEventListener('click', () => {
		showRemainingTime = !showRemainingTime;
		if (Number.isFinite(video.duration) && video.duration > 0) updateTimeDisplay(video.currentTime);
	});
	makeCopyable(videoFolder, 'Folder');
	makeCopyable(videoName, 'Filename');
	videoFilter.addEventListener('change', applyVideoFilter);
	tagsToggle.addEventListener('click', () => {
		const isOpening = tagsPanel.classList.contains('hidden');
		tagsPanel.classList.toggle('hidden', !isOpening);
		tagsToggle.setAttribute('aria-expanded', String(isOpening));
		if (isOpening) {
			renderTagHistory();
			tagsInput.focus();
		}
	});
	tagsForm.addEventListener('submit', event => {
		event.preventDefault();
		applyTags(tagsInput.value);
	});
	renderTagHistory();
	videoFilter.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			applyVideoFilter();
			videoFilter.blur();
		}
	});
	video.addEventListener('play', updatePlaybackControls);
	video.addEventListener('pause', updatePlaybackControls);
	video.addEventListener('ratechange', updatePlaybackControls);
	video.addEventListener('timeupdate', () => {
		if (!seeking && !scrubbing) updateProgress(video.currentTime);
	});
	video.addEventListener('loadedmetadata', () => updateProgress(video.currentTime));
	video.addEventListener('ended', () => playRandom());
	video.addEventListener('click', event => event.preventDefault());
	player.addEventListener('contextmenu', event => event.preventDefault());
	document.addEventListener('pointerdown', event => {
		if (event.target !== videoFilter && document.activeElement === videoFilter) videoFilter.blur();
	}, true);
	seekBar.addEventListener('pointerdown', () => {
		scrubbing = true;
		clearTimeout(controlsTimer);
	});
	seekBar.addEventListener('input', () => {
		if (!Number.isFinite(video.duration) || video.duration <= 0) return;
		previewTime = Number(seekBar.value) / Number(seekBar.max) * video.duration;
		updateProgress(previewTime);
	});
	seekBar.addEventListener('change', () => {
		if (previewTime !== null) video.currentTime = previewTime;
		previewTime = null;
		scrubbing = false;
	});
	fullscreenButton.addEventListener('click', toggleFullscreen);
	document.addEventListener('keydown', handleKeyDown);
	document.addEventListener('keyup', handleKeyUp);
	window.addEventListener('blur', cancelSpaceHold);
	document.addEventListener('fullscreenchange', () => {
		const fullscreen = Boolean(document.fullscreenElement);
		fullscreenButton.textContent = fullscreen ? '⛶' : '⛶';
		fullscreenButton.title = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
		fullscreenButton.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
	});

	player.addEventListener('pointerdown', event => {
		if (event.button !== 0) return;
		if (event.target === videoFilter) return;
		pointerStart = {
			x: event.clientX,
			y: event.clientY,
			id: event.pointerId,
			time: video.currentTime,
			target: event.target
		};
		heldForSpeed = false;
		seeking = false;
		if (event.target === video) holdTimer = setTimeout(() => {
			if (!video.paused && pointerStart?.id === event.pointerId) {
				video.playbackRate = 4;
				heldForSpeed = true;
				showHint('»', '4× speed');
			}
		}, 350);
	});

	player.addEventListener('pointermove', event => {
		if (!pointerStart || event.pointerId !== pointerStart.id) return;
		const deltaX = event.clientX - pointerStart.x;
		const deltaY = event.clientY - pointerStart.y;
		if (!swipeAxis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 12) {
			clearTimeout(holdTimer);
			swipeAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
			seeking = swipeAxis === 'horizontal';
		}
		if (swipeAxis === 'horizontal') {
			if (pointerStart.target !== seekBar) seekBySwipe(deltaX);
		}
	});

	const finishPointer = event => {
		if (!pointerStart || event.pointerId !== pointerStart.id) return;
		clearTimeout(holdTimer);
		const deltaX = event.clientX - pointerStart.x;
		const deltaY = event.clientY - pointerStart.y;
		const wasVideoSurfaceTap = (pointerStart.target === video || pointerStart.target === unsupportedPreview)
			&& !heldForSpeed && !swipeAxis && !seeking;
		const wasVideoTap = wasVideoSurfaceTap && pointerStart.target === video;
		if (heldForSpeed) {
			video.playbackRate = 1;
		} else if (swipeAxis === 'vertical') {
			if (deltaY < 0) {
				if (!document.fullscreenElement) toggleFullscreen();
				playRandom();
			}
			else playPrevious();
		} else if (seeking) {
			if (pointerStart.target !== seekBar) {
				seekBySwipe(deltaX);
				if (previewTime !== null) video.currentTime = previewTime;
			}
		} else if (wasVideoTap) {
			togglePlayback();
		}
		pointerStart = null;
		previewTime = null;
		heldForSpeed = false;
		seeking = false;
		swipeAxis = null;
		if (wasVideoSurfaceTap) toggleControls();
	};

	player.addEventListener('pointerup', finishPointer);
	player.addEventListener('pointercancel', finishPointer);

	setVideo(initialPath);
	updateLoopControls();
	revealControls();
})();
