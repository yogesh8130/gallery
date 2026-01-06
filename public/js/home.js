const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let QUERY_STRING; // stores URLs query part, used for lazy loading (getNextResults)
const QUERY_PARAMS = {}; // to store the query parameters in the URL
let MULTIPLIER = 1 // zoom slider value
const SELECTED_IMAGES = new Map(); // imageId => imageLink
let ALL_FILES_SELECTED = false;
let IS_MODAL_ACTIVE = false;
let SELECTION_MODE = false; // whether click opens an image or selects it

const darkColors = ['blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chocolate', 'coral', 'cornflowerblue', 'crimson', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgreen', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darkslateblue', 'darkslategrey', 'darkviolet', 'deeppink', 'dodgerblue', 'firebrick', 'forestgreen', 'fuchsia', 'green', 'hotpink', 'indianred', 'indigo', 'lightcoral', 'magenta', 'maroon', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumvioletred', 'midnightblue', 'navy', 'olive', 'olivedrab', 'orangered', 'orchid', 'palevioletred', 'peru', 'purple', 'rebeccapurple', 'red', 'royalblue', 'saddlebrown', 'salmon', 'seagreen', 'sienna', 'slateblue', 'steelblue', 'teal', 'tomato', 'violet'];
MAX_HISTORY_JUMPLIST = 9;

// media query for coarse pointer devices (touch)
const COARSE_POINTER_MEDIA_QUERY = window.matchMedia('(pointer: coarse)');

// To keep track of the image being viewed in modal
let CURRENT_IMAGE_PATH;
let CURRENT_IMAGE_ID_NUM;
let LAST_SELECTED_IMAGE_INDEX;
let LAST_VIEWED_IMAGE_ID;

let VIEWER;
let IS_VIEWER_ZOOMED = false;
let MODAL;
let MODAL_IMAGE_CONTAINER;
let MODAL_VIDEO_CONTAINER;
let MODAL_VIDEO;
let MODAL_CLOSE_BUTTON;
let MODAL_NEXT_BUTTON;
let MODAL_PREV_BUTTON;
let MODAL_NEXT_FROM_SEARCH_BUTTON;
let MODAL_PREV_FROM_SEARCH_BUTTON;

let HEADER;
let HEADER_HEIGHT;

let RESULTS_CONTAINER;

let SIDEBAR;
let SIDEBAR_TOGGLE_BUTTON;

let LONG_PRESS_TIMEOUT;
const LONG_PRESS_DELAY = 300;
const SWIPE_THRESHOLD = 50;
const SPEEDUP_RATE = 4;

const PRELOAD_CACHE = new Map(); // to keep next images pre-loaded
const MAX_PRELOAD = 5;
function preloadImage(path) {
	if (PRELOAD_CACHE.has(path)) return;

	const img = new Image();
	img.src = path;

	img.onload = () => {
		PRELOAD_CACHE.set(path, img);
		if (PRELOAD_CACHE.size > MAX_PRELOAD) {
			const firstKey = PRELOAD_CACHE.keys().next().value;
			PRELOAD_CACHE.delete(firstKey);
		}
	};
}

function preloadNeighbors() {
	if (!CURRENT_IMAGE_PATH) return;

	const cleanPath = CURRENT_IMAGE_PATH.replace(origin, '').replace(/^\//, '');

	fetch(`/next?currentImagePath=${cleanPath}`)
		.then(r => r.json())
		.then(d => {
			if (d.nextImagePath && isImage(d.nextImagePath)) {
				preloadImage(d.nextImagePath);
			}
		});

	fetch(`/previous?currentImagePath=${cleanPath}`)
		.then(r => r.json())
		.then(d => {
			if (d.previousImagePath && isImage(d.previousImagePath)) {
				preloadImage(d.previousImagePath);
			}
		});
}

function isImage(path) {
	return !path.match(/\.(mp4|mkv|webm)$/i);
}

let SIDEBAR_PINNED;
// load state from local storage and if not found then session storage and if still not found then default to false
if (sessionStorage.getItem('sidebarPinned') != null) {
	// load boolean properly from session storage
	SIDEBAR_PINNED = JSON.parse(sessionStorage.getItem('sidebarPinned'));
} else if (localStorage.getItem('sidebarPinned') != null) {
	SIDEBAR_PINNED = JSON.parse(localStorage.getItem('sidebarPinned'));
} else {
	SIDEBAR_PINNED = false;
}

function pinSidebar() {
	const pinSidebarCheckbox = document.getElementById('pinSidebarCheckbox');
	SIDEBAR_PINNED = pinSidebarCheckbox.checked;
	// save state to local storage and session storage
	localStorage.setItem('sidebarPinned', SIDEBAR_PINNED);
	sessionStorage.setItem('sidebarPinned', SIDEBAR_PINNED);

	const mainDiv = document.querySelector('.mainDiv');
	if (SIDEBAR_PINNED) {
		mainDiv.classList.add('pinned');
	} else {
		mainDiv.classList.remove('pinned');
	}
}

let FOLDER_SUGGEST_TIMEOUT;

function updateSuggestedFolders() {
	const moveFilesInput = document.getElementById('moveFilesInput');
	// replace the '/' in text with '\'
	moveFilesInput.value = moveFilesInput.value.replace(/\//g, '\\');

	clearTimeout(FOLDER_SUGGEST_TIMEOUT);

	FOLDER_SUGGEST_TIMEOUT = setTimeout(() => {
		const folderHint = document
			.getElementById('moveFilesInput')
			.value
			.trim() || '';

		const suggestedFoldersDatalist =
			document.getElementById('suggestedFolders');

		fetch(`/folderPaths?folderHint=${encodeURIComponent(folderHint)}`)
			.then(response => response.json())
			.then(data => {
				suggestedFoldersDatalist.innerHTML = "";

				data.forEach(folder => {
					const option = document.createElement('option');
					option.value = folder;
					suggestedFoldersDatalist.appendChild(option);
				});
			})
			.catch(console.error);
	}, 500);
}

function buildTree(paths) {
	const root = {};

	paths.forEach(path => {
		const parts = path.split("\\");
		let current = root;

		parts.forEach(part => {
			if (!current[part]) {
				current[part] = {};
			}
			current = current[part];
		});
	});

	return root;
}

let ACTIVE_FOLDER_NODE;
let MAX_FOLDER_NAME_LENGTH_MATCHED = 0;
function renderTree(tree, parentPath = "", currentPath = "") {
	const ul = document.createElement("ul");

	Object.keys(tree).sort().forEach(folder => {
		const li = document.createElement("li");

		const fullPath = parentPath ? `${parentPath}\\${folder}` : folder;
		const hasChildren = Object.keys(tree[folder]).length > 0;

		const label = document.createElement("div");
		label.classList.add("folder-label");

		const link = document.createElement("a");
		link.href = `/search?&searchText=\\images\\${encodeURIComponent(fullPath)}\\`;
		link.dataset.folderPath = `\\images\\${fullPath}\\`;
		// link.target = "_blank"; // open in new tab
		link.textContent = folder;
		link.classList.add("folder-link");
		link.classList.add("recursive");
		label.appendChild(link);

		const nonRecursiveLink = document.createElement("a");
		nonRecursiveLink.href = `/search?&searchText=\\images\\${encodeURIComponent(fullPath)}`;
		nonRecursiveLink.dataset.folderPath = `\\images\\${fullPath}`;
		nonRecursiveLink.textContent = '\\';
		nonRecursiveLink.classList.add("folder-link");
		nonRecursiveLink.classList.add("non-recursive");
		label.appendChild(nonRecursiveLink);

		let children;
		if (hasChildren) {
			label.classList.add("collapsible");

			children = renderTree(tree[folder], fullPath, currentPath);

			// expand ONLY if current path is inside this branch
			const shouldExpand =
				currentPath === fullPath ||
				currentPath.startsWith(fullPath + "\\");

			if (!shouldExpand) {
				children.classList.add("collapsed");
			} else {
				label.classList.add("open");
			}

			li.appendChild(label);
			li.appendChild(children);
		} else {
			label.classList.add("leaf");
			li.appendChild(label);
		}

		if (currentPath.startsWith(fullPath) && fullPath.length > MAX_FOLDER_NAME_LENGTH_MATCHED) {
			MAX_FOLDER_NAME_LENGTH_MATCHED = fullPath.length;
			ACTIVE_FOLDER_NODE = label;
		}

		ul.appendChild(li);
	});

	return ul;
}

function refreshDirectoryTree() {
	fetch("/folderPaths")
		.then(res => res.json())
		.then(paths => {
			const treeData = buildTree(paths);
			const container = document.getElementById("folderTree");

			const urlParams = new URLSearchParams(window.location.search);
			const currentFolder = urlParams.get('searchText').trim().replace(/^\\images\\/, '');

			container.innerHTML = "";
			container.appendChild(
				renderTree(treeData, "", currentFolder)
			);
			ACTIVE_FOLDER_NODE?.classList.add("currentPath");
			document.querySelector('.currentPath').scrollIntoView({ block: "center", container: "nearest" });
		});
}

function onZoomChange(viewerData) {
	// console.log(data);
	if (viewerData.zoomValue > 100) {
		IS_VIEWER_ZOOMED = true
	} else {
		IS_VIEWER_ZOOMED = false
	}
	// console.log(IS_VIEWER_ZOOMED);

}

function udpateSelectedFilesCount() {
	const selectedFilesCount = document.getElementById("selectedFilesCount");
	const selectedImagesCount = SELECTED_IMAGES.size;

	selectedFilesCount.textContent = `${selectedImagesCount} ${selectedImagesCount === 1 ? "file" : "files"
		} selected`;
}

let SCROLL_Y_BEFORE_FULLSCREEN = 0;
function openFullscreen(video) {
	SCROLL_Y_BEFORE_FULLSCREEN = window.scrollY;
	if (video.requestFullscreen) {
		video.requestFullscreen();
	} else if (video.webkitEnterFullscreen) {
		video.webkitEnterFullscreen();
	}
}

function updateHistoryButtons(argument, operation) {
	const validOperationsForHistory = [
		'appendToName',
		'prependToName',
		'removeFromName',
		'moveFiles'
	];

	// Utilities

	function normalizeArgument(arg) {
		return arg.replace('000\\00FIN\\', '');
	}

	function getButtonLabel(arg) {
		const clean = normalizeArgument(arg);
		return clean.length > 50
			? `${clean.slice(0, 25)}...${clean.slice(-25)}`
			: clean;
	}

	function getHistoryMap(operation) {
		return JSON.parse(
			localStorage.getItem(`${operation}History`)
		) || {};
	}

	function saveHistoryMap(operation, map) {
		localStorage.setItem(
			`${operation}History`,
			JSON.stringify(map)
		);
	}

	function flashButton(button, className, duration = 1000) {
		button.classList.remove('flash-green', 'flash-red');
		void button.offsetWidth; // force reflow
		button.classList.add(className);
		setTimeout(() => button.classList.remove(className), duration);
	}

	// Storage logic (LFU)

	function incrementClickCount(operation, argument) {
		const map = getHistoryMap(operation);
		if (!map[argument]) map[argument] = { clicks: 0 };
		map[argument].clicks = map[argument].clicks + 3;
		saveHistoryMap(operation, map);
	}

	function evictLeastUsed(operation, map) {
		const entries = Object.entries(map);
		if (!entries.length) return null;

		entries.sort((a, b) => {
			const diff = a[1].clicks - b[1].clicks;
			return diff;
		});

		const [removedArg] = entries[0];

		delete map[removedArg];

		// reduce all by 1, else highly clicked entries are never evicted
		for (const key in map) {
			map[key].clicks = map[key].clicks - 1;
		}

		saveHistoryMap(operation, map);
		return removedArg;
	}

	// DOM helpers

	function createButton(argument, operation) {
		const button = document.createElement('button');
		button.dataset.argumentString = argument;
		button.dataset.operation = operation;
		button.title = argument;
		button.textContent = getButtonLabel(argument);
		button.classList.add(`${operation}Button`, 'historyButton');
		button.style.borderLeft = `3px solid ${getRandom(darkColors)}`;

		button.addEventListener('click', (event) => {
			const btn = event.currentTarget;
			const op = btn.dataset.operation;
			const arg = btn.dataset.argumentString;

			document.getElementById(`${op}Input`).value = arg;
			moveRenameFiles(op);

			incrementClickCount(op, arg);
			flashButton(btn, 'flash-red');
		});

		return button;
	}

	function upsertButton(argument, operation) {
		const container = document.getElementById(`${operation}History`);
		if (!container) return;

		let button = container.querySelector(
			`button[data-argument-string="${CSS.escape(argument)}"]`
		);

		if (!button) {
			button = createButton(argument, operation);
			container.appendChild(button);
			flashButton(button, 'flash-green');
		} else {
			flashButton(button, 'flash-red');
			incrementClickCount(operation, argument);
		}

		// const map = getHistoryMap(operation);

		// Alphabetical visual order
		Array.from(container.children)
			.sort((a, b) =>
				a.dataset.argumentString.localeCompare(
					b.dataset.argumentString,
					undefined,
					{ sensitivity: 'base' }
				)
			)
			.forEach(btn => container.appendChild(btn));


		// Order by click count from the map
		// Array.from(container.children)
		// 	.sort((a, b) => {
		// 		const diff = map[a.dataset.argumentString].clicks - map[b.dataset.argumentString].clicks;
		// 		return -diff;
		// 	})
		// 	.forEach(btn => container.appendChild(btn));
	}

	// INITIAL LOAD

	if (!argument) {
		for (const op of validOperationsForHistory) {
			const map = getHistoryMap(op);

			Object.keys(map)
				.sort((a, b) =>
					a.localeCompare(b, undefined, { sensitivity: 'base' })
				)
				.forEach(arg => upsertButton(arg, op));
		}
		return;
	}

	// UPDATE FLOW

	const map = getHistoryMap(operation);

	const isNew = !map[argument];
	if (isNew) {
		while (Object.keys(map).length > MAX_HISTORY_JUMPLIST) {
			const removed = evictLeastUsed(operation, map);
			document.querySelector(
				`#${operation}History button[data-argument-string="${CSS.escape(removed)}"]`
			)?.remove();
		}

		map[argument] = { clicks: 0 };
	}

	saveHistoryMap(operation, map);
	upsertButton(argument, operation);
}

function clearHistory() {
	localStorage.removeItem('appendToNameHistory');
	localStorage.removeItem('prependToNameHistory');
	localStorage.removeItem('removeFromNameHistory');
	localStorage.removeItem('moveFilesHistory');

	document.querySelectorAll('.historyButtonsContainer').forEach(container => {
		container.innerHTML = '';
	});
}

document.addEventListener('fullscreenchange', restoreScroll);
document.addEventListener('webkitfullscreenchange', restoreScroll);

function restoreScroll() {
	setTimeout(() => {
		const lastViewedImage = document.getElementById(LAST_VIEWED_IMAGE_ID);
		if (lastViewedImage) {
			lastViewedImage.scrollIntoView({
				block: "center",
				inline: "nearest"
			});
		}
	}, 500); // wait to exit fullscreen
}

function updateModalImageDetails(imageId) {
	const imageIdNum = parseInt(imageId.toString().replace('image', ''));
	const modalImageDetails = document.querySelector('.modalImageDetails');
	const imageDetails = document.querySelector(`#result${imageIdNum} .imageSidebar`);

	modalImageDetails.innerHTML = imageDetails.innerHTML;
}

function toggleModalControlsTransparency() {
	const modalButtons = document.querySelectorAll('.modalButton');
	modalButtons.forEach(button => {
		button.classList.toggle('transparent');
	});
	const modalImageDetails = document.querySelector('.modalImageDetails');
	modalImageDetails.classList.toggle('transparent');
}

function resultsContainerLongPressHandler(event) {
	console.log('resultsContainerLongPressHandler(), eventType: ', event.type);

	if (event.target.classList.contains('imageFile')
		|| (event.target.classList.contains('videoFile') && event.target.paused)) {
		// if image already selected then deselect
		if (event.target.classList.contains('selectedImage')) {
			deselectImage(event.target);
		}
		// select the range of images if there is a last selected image
		else if (LAST_SELECTED_IMAGE_INDEX > -1) {
			handleRangeSelection(event.target);
		}
		// if no image selected before then select first image
		else if (!LAST_SELECTED_IMAGE_INDEX) {
			selectImage(event.target)
		}
	}
}

function resultsContainerSwipeHandler(swipeDirection, event) {
	// pointer moved to right
	if (swipeDirection === 'right') {
		// showPopup('pointer moved to right 👉');
		// console.log('pointer moved to right 👉');
		if (document.getElementById('sidebar').classList.contains('open')) closeSidebar();
		else if (event.target && event.target.classList.contains('videoFile')) event.target.requestFullscreen();
		// pointer moved to left
	} else if (swipeDirection === 'left') {
		// showPopup('pointer moved to left 👈');
		// console.log('pointer moved to left 👈');
		openSidebar();
	}
}

function modalSwipeHandler(pointerMovedTo, event) {
	if (IS_VIEWER_ZOOMED) return;
	// pointer moved to right
	if ((pointerMovedTo === 'down' || pointerMovedTo === 'up')) {
		closeModal();
	} else if (pointerMovedTo === 'right') {
		showPreviousImage();
	} else if (pointerMovedTo === 'left') {
		showNextImage();
	}
}

function scrollToCurrentImage() {
	const currentImage = document.getElementById(`image${CURRENT_IMAGE_ID_NUM}`);
	if (currentImage) {
		currentImage.scrollIntoView({
			behavior: "smooth",
			block: "center",
			inline: "nearest"
		});
	}
}

function getRandom(arr) {
	const randomIndex = Math.floor(Math.random() * arr.length);
	return arr[randomIndex];
}

document.addEventListener("DOMContentLoaded", function () {
	RESULTS_CONTAINER = document.querySelector('.results');
	SIDEBAR = document.getElementById('sidebar');
	SIDEBAR_TOGGLE_BUTTON = document.getElementById('sidebarToggleButton');
	MODAL = document.getElementById("modal");
	MODAL_IMAGE_CONTAINER = document.querySelector('.modalImageContainer');
	MODAL_VIDEO_CONTAINER = document.querySelector('.modalVideoContainer');
	MODAL_VIDEO = document.querySelector('.modalVideo');
	MODAL_CLOSE_BUTTON = document.getElementById('modalCloseButton');
	MODAL_NEXT_BUTTON = document.getElementById('modalNextButton');
	MODAL_PREV_BUTTON = document.getElementById('modalPreviousButton');
	MODAL_NEXT_FROM_SEARCH_BUTTON = document.getElementById('modalNextFromResultsButton');
	MODAL_PREV_FROM_SEARCH_BUTTON = document.getElementById('modalPreviousFromResultsButton');
	VIEWER = new ImageViewer(MODAL_IMAGE_CONTAINER, {
		listeners: {
			onZoomChange: onZoomChange
		}
	});

	// read the operation history from local storage and update the history buttons for repective operations forms
	updateHistoryButtons(null);

	if (SIDEBAR_PINNED) {
		const mainDiv = document.querySelector('.mainDiv');
		mainDiv.classList.add('pinned');
		toggleSidebar();
		const pinSidebarCheckbox = document.getElementById('pinSidebarCheckbox');
		pinSidebarCheckbox.checked = true;
	}

	// render directory tree:
	refreshDirectoryTree();

	// convertin URL query params to
	QUERY_STRING = window.location.search;
	const searchParams = new URLSearchParams(QUERY_STRING);
	for (const [key, value] of searchParams) {
		QUERY_PARAMS[key] = value;
	}
	// console.log(queryString, queryParams);

	// setting form fields on load
	const view = document.getElementById('view');
	const searchText = document.getElementById('searchText');
	view.value = QUERY_PARAMS.view || 'tiles';
	searchText.value = QUERY_PARAMS.searchText;

	HEADER = document.querySelector('.header');
	HEADER_HEIGHT = HEADER.offsetHeight;

	// view specific stuff
	if (view.value !== 'tiles') {
		dragToScrollEnable();
	} else {
		// load slider values from storage
		const slider = document.getElementById('slider')
		if (sessionStorage.sliderValue) {
			slider.value = sessionStorage.sliderValue;
		} else if (localStorage.sliderValue) {
			slider.value = localStorage.sliderValue;
		}

		// Setting image size as per stored slider value 'on load' i.e. 1
		changeTileSize();

		// add lazy load listener
		window.addEventListener('scroll', loadMore);
	}

	// MODAL SINGLE IMAGE VIEWER

	MODAL.onclick = function (event) {
		if (event.target.classList.contains('iv-image-view')) {
			closeModal();
		}
	}

	MODAL_CLOSE_BUTTON.onclick = function () {
		closeModal();
	}

	MODAL_NEXT_BUTTON.onclick = function () {
		console.log('modal next button pressed');
		showNextImage();
	}

	MODAL_PREV_BUTTON.onclick = function () {
		console.log('modal next button pressed');
		showPreviousImage();
	}

	MODAL_NEXT_FROM_SEARCH_BUTTON.onclick = function () {
		while (true) {
			const nextImg = RESULTS_CONTAINER.querySelector(`#image${CURRENT_IMAGE_ID_NUM + 1}`);
			if (!nextImg && HAS_MORE_RESULTS) {
				loadMore({ calledFromModal: true });
				break;
			}

			if (nextImg && nextImg.classList.contains('imageFile')) {
				VIEWER.load(nextImg.src);
				updateModalImageDetails(nextImg.id);
				CURRENT_IMAGE_ID_NUM++;
				break;
			} else {
				CURRENT_IMAGE_ID_NUM++;
			}

			if (!HAS_MORE_RESULTS) {
				showPopup('no more stuff to show', 'warn', 1000);
				break;
			}
		}
		scrollToCurrentImage();
	}

	MODAL_PREV_FROM_SEARCH_BUTTON.onclick = function () {
		while (true) {
			if (CURRENT_IMAGE_ID_NUM == 0) {
				showPopup('Already at the beginning', 'warn', 2000);
				break;
			}
			const prevImg = RESULTS_CONTAINER.querySelector(`#image${CURRENT_IMAGE_ID_NUM - 1}`);
			if (prevImg && prevImg.classList.contains('imageFile')) {
				VIEWER.load(prevImg.src);
				updateModalImageDetails(prevImg.id);
				CURRENT_IMAGE_ID_NUM--;
				break;
			} else {
				CURRENT_IMAGE_ID_NUM--;
			}
		}
		scrollToCurrentImage();
	}

	// add click listeners if not in coarse pointer mode(ie using mouse)
	// if (!COARSE_POINTER_MEDIA_QUERY.matches) {
	// Attach a click event listener to the parent element
	RESULTS_CONTAINER.addEventListener('click', function (event) {
		// console.log('clicked');
		if (LAST_SELECTED_IMAGE_INDEX > -1 &&
			event.target.classList.contains('resultFile') && event.shiftKey) {
			handleRangeSelection(event.target);
		} else if (event.target.classList.contains('resultFile') && event.ctrlKey) {
			// select unselect with ctrl key OR single left click (if selection mode is on)
			if (event.target.classList.contains('selectedImage')) {
				deselectImage(event.target);
			} else {
				selectImage(event.target);
			}
			// console.log(selectedImages);

		} else if (event.target.tagName == 'VIDEO') {
			// videos are handled by mousedown and mouseup events this fucks up with those
			event.preventDefault();
		}
		// if (event.target.classList.contains('resultFile')) {
		// 	// to record last interacted image, used to scroll to correct position on zoom change
		// 	LAST_VIEWED_IMAGE_ID = event.target.id;
		// }
		// udpateSelectedFilesCount();
	});

	// }

	// prevent the page form reloading when these forms are submitted
	const moveForm = document.getElementById('moveForm');
	moveForm.onsubmit = (event) => { event.preventDefault(); }
	const renameBulkForm = document.getElementById('renameBulkForm');
	renameBulkForm.onsubmit = (event) => { event.preventDefault(); }
	const appendToNameForm = document.getElementById('appendToNameForm');
	appendToNameForm.onsubmit = (event) => { event.preventDefault(); }
	const prependToNameForm = document.getElementById('prependToNameForm');
	prependToNameForm.onsubmit = (event) => { event.preventDefault(); }
	const removeFromNameForm = document.getElementById('removeFromNameForm');
	removeFromNameForm.onsubmit = (event) => { event.preventDefault(); }
	const replaceInNameForm = document.getElementById('replaceInNameForm');
	replaceInNameForm.onsubmit = (event) => { event.preventDefault(); }

	// Touch listeners for touch devices
	// if (COARSE_POINTER_MEDIA_QUERY.matches) {

	// 	// HAMMERTIME!!

	// disable context menu on touch devices for results container
	RESULTS_CONTAINER.addEventListener('contextmenu', function (event) {
		if (COARSE_POINTER_MEDIA_QUERY.matches && event.target.classList.contains('resultFile'))
			event.preventDefault();
		// resultsContainerLongPressHandler(event);
	});

	let RESULTS_START_X = 0;
	let RESULTS_START_Y = 0;
	let RESULTS_ACTIVE_POINTER_ID = null;
	let RESULTS_LONG_PRESS_ACTIVATED = false;
	let RESULTS_SWIPE_TRIGGERED = false;

	RESULTS_CONTAINER.addEventListener('pointerdown', function (event) {
		if (event.shiftKey || event.ctrlKey) return;

		event.preventDefault();
		// showPopup('pointerdown');
		// console.log(`🔽 pointer down, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${RESULTS_LONG_PRESS_ACTIVATED}`);
		// Ignore secondary buttons (right click, etc.)
		if (event.button !== 0) {
			// console.log('secondary button, ignored');
			return;
		};

		const target = event.target;
		// console.log(target.classList);

		RESULTS_ACTIVE_POINTER_ID = event.pointerId;
		RESULTS_START_X = event.clientX;
		RESULTS_START_Y = event.clientY;

		// speed up video
		if (target && (target.classList.contains('videoFile')) && !target.paused) {
			// console.log('video not paused, setting video speedup timeout');
			LONG_PRESS_TIMEOUT = setTimeout(function () {
				// console.log(`video sped up ⏩`);
				target.playbackRate = SPEEDUP_RATE;
				LONG_PRESS_TIMEOUT = null;
				RESULTS_LONG_PRESS_ACTIVATED = true;
			}, LONG_PRESS_DELAY);
			return;
		}
		// select/deselect file
		if (target && (target.classList.contains('resultFile'))) {
			// console.log('checking for long press for file selection');
			LONG_PRESS_TIMEOUT = setTimeout(function () {
				resultsContainerLongPressHandler(event)
				// console.log('long press activated, file selected');
				LONG_PRESS_TIMEOUT = null;
				RESULTS_LONG_PRESS_ACTIVATED = true;
			}, LONG_PRESS_DELAY);
			// console.log('LONG_PRESS_TIMEOUT');
			// console.log(LONG_PRESS_TIMEOUT);

			return;
		}
		// console.log(`🚫 pointer down, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${RESULTS_LONG_PRESS_ACTIVATED}`);
	});

	RESULTS_CONTAINER.addEventListener('pointermove', function (event) {
		if (event.shiftKey || event.ctrlKey) return;

		// console.log('pointer move');
		if (event.pointerId !== RESULTS_ACTIVE_POINTER_ID) {
			// console.log('pointer changed, ignored');
			return
		};

		if (RESULTS_SWIPE_TRIGGERED) {
			// console.log('swipe triggered, ignored');
			return
		};

		const deltaX = event.clientX - RESULTS_START_X;
		if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
			// showPopup(`🔺deltaX: ${deltaX}`);
			RESULTS_SWIPE_TRIGGERED = true;
			resultsContainerSwipeHandler(deltaX > 0 ? 'right' : 'left', event);
		}

	});

	RESULTS_CONTAINER.addEventListener('pointerup', function (event) {
		if (event.shiftKey || event.ctrlKey) return;

		event.preventDefault();
		// showPopup('pointerup');
		// console.log(`🔼 pointer up, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${RESULTS_LONG_PRESS_ACTIVATED}, targetType: ${event.target.nodeName}`);
		if (event.pointerId !== RESULTS_ACTIVE_POINTER_ID) {
			// console.log('pointer changed, ignored');
			return
		};

		const target = event.target;

		RESULTS_ACTIVE_POINTER_ID = null;

		// pointer up on video
		if (!RESULTS_SWIPE_TRIGGERED && target && (target.classList.contains('videoFile')) && (!RESULTS_LONG_PRESS_ACTIVATED || !target.paused)) {
			event.preventDefault();
			// console.log('pointer up on video file');
			if (target.paused) {
				// console.log(`video is paused hence playing ▶`);
				target.play()
			} else if (target.playbackRate == 1) {
				// console.log(`video is playing at 1x hence pausing ⏸`);
				target.pause();
			}
			if (target.playbackRate != 1) {
				// console.log(`video is playing at ${target.playbackRate}x hence resetting to 1x`);
				target.playbackRate = 1;
			}
			LAST_VIEWED_IMAGE_ID = target.id;
		}

		// pointer up on image
		if (!RESULTS_SWIPE_TRIGGERED && target && (target.classList.contains('imageFile')) && !RESULTS_LONG_PRESS_ACTIVATED) {
			// console.log('pointer up on image file, opening image');
			showModal(target.src, true, target);
			RESULTS_LONG_PRESS_ACTIVATED = false;
		}

		if (LONG_PRESS_TIMEOUT) {
			// console.log('pointer up, clearing long press timeout', LONG_PRESS_TIMEOUT);
			clearTimeout(LONG_PRESS_TIMEOUT);
			LONG_PRESS_TIMEOUT = null;
		}
		RESULTS_LONG_PRESS_ACTIVATED = false;
		RESULTS_SWIPE_TRIGGERED = false;
		// console.log(`🛑 pointer up, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${RESULTS_LONG_PRESS_ACTIVATED}`);
	});

	RESULTS_CONTAINER.addEventListener('pointercancel', function (event) {
		// showPopup('❌ pointer cancel', null, 1000);
		// console.log('❌ pointer cancel');

		if (LONG_PRESS_TIMEOUT) {
			clearTimeout(LONG_PRESS_TIMEOUT);
			LONG_PRESS_TIMEOUT = null;
		}
		RESULTS_ACTIVE_POINTER_ID = null;
	});


	// MODAL EVENTS

	let MODAL_START_X = 0;
	let MODAL_START_Y = 0;
	let MODAL_ACTIVE_POINTER_ID = null;

	MODAL.addEventListener('pointerdown', function (event) {
		// event.preventDefault();
		// showPopup('pointerdown');
		// console.log(`🔽 pointer down, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${MODAL_LONG_PRESS_ACTIVATED}`);
		// Ignore secondary buttons (right click, etc.)
		if (event.button !== 0) {
			// console.log('secondary button, ignored');
			return;
		};

		MODAL_ACTIVE_POINTER_ID = event.pointerId;
		MODAL_START_X = event.clientX;
		MODAL_START_Y = event.clientY;

		// console.log(`🚫 pointer down, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${MODAL_LONG_PRESS_ACTIVATED}`);
	});

	MODAL.addEventListener('pointerup', function (event) {
		// console.log('pointer up');
		if (event.pointerId !== MODAL_ACTIVE_POINTER_ID) {
			// console.log('pointer changed, ignored');
			return
		};

		const deltaY = event.clientY - MODAL_START_Y;
		const deltaX = event.clientX - MODAL_START_X;
		if (Math.abs(deltaY) >= SWIPE_THRESHOLD) {
			// showPopup(`🔺deltaY: ${deltaY}`);
			modalSwipeHandler(deltaY > 0 ? 'down' : 'up', event);
			return;
		}
		if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
			// showPopup(`🔺deltaX: ${deltaX}`);
			modalSwipeHandler(deltaX > 0 ? 'right' : 'left', event);
			return;
		}

		// toggle controls if clicking on image
		if (event.target && event.target.classList.contains('iv-image')) {
			toggleModalControlsTransparency();

			while (IS_VIEWER_ZOOMED) {
				VIEWER.resetZoom();
			}
		}

	});

	// SIDEBAR EVENTS

	let SIDEBAR_START_X = 0;
	let SIDEBAR_ACTIVE_POINTER_ID = null;

	SIDEBAR.addEventListener('pointerdown', function (event) {
		// event.preventDefault();
		// showPopup('pointerdown');
		// console.log(`🔽 pointer down, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${SIDEBAR_LONG_PRESS_ACTIVATED}`);
		// Ignore secondary buttons (right click, etc.)
		if (event.button !== 0) {
			// console.log('secondary button, ignored');
			return;
		};

		SIDEBAR_ACTIVE_POINTER_ID = event.pointerId;
		SIDEBAR_START_X = event.clientX;

		// console.log(`🚫 pointer down, LONG_PRESS_TIMEOUT: ${LONG_PRESS_TIMEOUT}, LONG_PRESS_ACTIVATED: ${SIDEBAR_LONG_PRESS_ACTIVATED}`);
	});

	SIDEBAR.addEventListener('pointerup', function (event) {
		// console.log('pointer up');
		if (event.pointerId !== SIDEBAR_ACTIVE_POINTER_ID) {
			// console.log('pointer changed, ignored');
			return
		};

		const deltaX = event.clientX - SIDEBAR_START_X;
		if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
			// showPopup(`🔺deltaX: ${deltaX}`);
			resultsContainerSwipeHandler(deltaX > 0 ? 'right' : 'left', event);
			return;
		}
	});

	// resize observer on SIDEBAR
	const resizeObserver = new ResizeObserver(entries => {
		// update the css variable --sidebar-width
		document.documentElement.style.setProperty('--sidebar-width', `${entries[0].target.offsetWidth}px`);
	});
	resizeObserver.observe(SIDEBAR);

	// activate the appropriate sort button
	const sortByParam = QUERY_PARAMS.sortBy;
	const sortAscParam = QUERY_PARAMS.sortAsc;

	if (sortByParam === 'path' && sortAscParam === 'true')
		document.getElementById('sortByPathAsc').classList.add('active');
	else if (sortByParam === 'path' && sortAscParam === 'false')
		document.getElementById('sortByPathDesc').classList.add('active');
	else if (sortByParam === 'name' && sortAscParam === 'true')
		document.getElementById('sortByNameAsc').classList.add('active');
	else if (sortByParam === 'name' && sortAscParam === 'false')
		document.getElementById('sortByNameDesc').classList.add('active');
	else if (sortByParam === 'size' && sortAscParam === 'true')
		document.getElementById('sortBySizeAsc').classList.add('active');
	else if (sortByParam === 'size' && sortAscParam === 'false')
		document.getElementById('sortBySizeDesc').classList.add('active');
	else if (sortByParam === 'modifiedTime' && sortAscParam === 'true')
		document.getElementById('sortByModifiedTimeAsc').classList.add('active');
	else if (sortByParam === 'modifiedTime' && sortAscParam === 'false')
		document.getElementById('sortByModifiedTimeDesc').classList.add('active');
	else if (sortByParam === 'dimensions' && sortAscParam === 'true')
		document.getElementById('sortByDimensionsAsc').classList.add('active');
	else if (sortByParam === 'dimensions' && sortAscParam === 'false')
		document.getElementById('sortByDimensionsDesc').classList.add('active');


	// Directory Tree Events
	document.getElementById('folderTree').addEventListener('click', function (event) {
		if (event.target?.classList?.contains('folder-link')) {
			event.preventDefault();
			newSearch(event.target?.dataset?.folderPath);

			document.querySelector('.currentPath')?.classList.remove('currentPath');
			event.target?.closest('.folder-label')?.classList.add('currentPath');
			event.target?.closest('.folder-label')?.classList.add('open');
			event.target?.closest('.folder-label')?.nextElementSibling?.classList.remove('collapsed');

		} else if (event.target?.classList?.contains('folder-label')) {
			// open / close tree
			event.target.classList.toggle('open');
			event.target.nextElementSibling.classList.toggle('collapsed');
		}

		// console.log(event.target?.classList);
		// console.log(event.target?.dataset?.folderPath);

	})
});


// Keyboard shortcuts
document.addEventListener('keydown', function (event) {
	const focusedElement = document.activeElement;

	// Global Hotkeys DONT add keys here that are used for text input
	switch (event.key) {
		case 'F2':
			toggleSidebar();
			document.getElementById('renameBulkInput').focus();
			break;
		case 'F3':
			event.preventDefault();
			document.getElementById('searchText').focus();
			break;
		case 'F4':
			toggleSidebar();
			event.preventDefault();
			document.getElementById('appendToNameInput').focus();
			break;
		case 'Escape':
			if (IS_MODAL_ACTIVE)
				closeModal();
			else
				deselectAllImages();
			break;
		default:
			break;
	}

	// Hotkeys which dont work when a text field is active:
	if (focusedElement.nodeName === 'INPUT') {
		// console.log('Currently focused element is an input field');
		return
	} else switch (event.key) {
		case 'a':
			event.preventDefault();
			if (ALL_FILES_SELECTED) {
				deselectAllImages();
			} else {
				selectAllImages();
			}
			ALL_FILES_SELECTED = !ALL_FILES_SELECTED;
			break;
		case 'i':
			invertSelection();
			break;
		case 'f':
			goFullscreen()
			break;
		case 's':
			shuffleToggle();
			break;
		case 't':
			document.documentElement.scrollTop = 0;
			break;
		case 'm':
			event.preventDefault();
			document.getElementById('moveFilesInput').focus();
			break;
		case 'ArrowRight':
			if (IS_MODAL_ACTIVE && !event.shiftKey) {
				showNextImage();
			} else if (IS_MODAL_ACTIVE && event.shiftKey) {
				MODAL_NEXT_FROM_SEARCH_BUTTON.click();
			} else {
				const slider = document.getElementById('slider');
				slider.stepUp();
				slider.dispatchEvent(new Event('change'));
			}
			break;
		case 'ArrowLeft':
			if (IS_MODAL_ACTIVE && !event.shiftKey) {
				showPreviousImage();
			} else if (IS_MODAL_ACTIVE && event.shiftKey) {
				MODAL_PREV_FROM_SEARCH_BUTTON.click();
			} else {
				const slider = document.getElementById('slider');
				slider.stepDown();
				slider.dispatchEvent(new Event('change'));
			}
			break;
		case 'Delete':
			event.preventDefault();
			if (IS_MODAL_ACTIVE) {
				imageLinkRelative = decodeURIComponent(CURRENT_IMAGE_PATH).replace(origin, '').replace(/^\//, '');
				// console.log("Delete: " + imageLinkRelative + " " + currentImageIdNum);
				deleteFile(imageLinkRelative, CURRENT_IMAGE_ID_NUM);
				MODAL_NEXT_FROM_SEARCH_BUTTON.click();
			} else {
				// bulk deletion (of selected files)
				moveRenameFiles("delete");
			}
			break;
		default:
			break;
	}
});

let PREVIOUS_SCROLL_POSITION = 0;
let SCROLL_TIMEOUT;
// stuff to do on scroll
window.addEventListener('scroll', function (event) {
	const currentScrollPosition = window.scrollY;

	if (SCROLL_TIMEOUT) {
		// to prevent thrashing this function
		PREVIOUS_SCROLL_POSITION = currentScrollPosition;
		return;
	}


	if (currentScrollPosition > PREVIOUS_SCROLL_POSITION) {
		// console.log("scrolling down");
		// Scrolling down - hide header
		HEADER.classList.remove('pinned');
		HEADER.classList.add('unpinned');

		// remove focus from the search bar
		if (HEADER.contains(document.activeElement)) {
			document.activeElement.blur();
		}
	} else {
		// console.log("scrolling up");
		// Scrolling up - show header
		HEADER.classList.remove('unpinned');
		HEADER.classList.add('pinned');
	}
	SCROLL_TIMEOUT = setTimeout(function () {
		// this prevents the header from re-showing instantly
		SCROLL_TIMEOUT = null;
	}, 500)
});

screen.orientation.addEventListener("change", (event) => {
	scrollToCurrentImage();
});

function goFullscreen() {
	const toggleButton = document.getElementById('fullscreenButton');

	if (document.fullscreenElement !== null) {
		toggleButton.innerText = '◹'
		document.exitFullscreen();
	} else {
		toggleButton.innerText = '◺'
		document.documentElement.requestFullscreen();
	}
}

function showAtActualScale(index) {
	// window.alert(index);
	let imageid = 'image' + index;
	let image = document.getElementById(imageid);

	let headingDiv = document.querySelector('.headingDiv');

	if (image.style.maxHeight !== 'fit-content') {
		image.style.maxHeight = 'fit-content'
	} else {
		image.style.maxHeight = '99%'
	}
}

function showAllImagesAtActualSize() {
	let resultFiles = document.querySelectorAll('.resultFile');
	// console.log(resultFiles.length);
	resultFiles.forEach(resultFile => {
		resultFile.style.minHeight = '0';
		resultFile.style.maxHeight = 'fit-content';
	});
}

function showAllImagesStreched() {
	let resultFiles = document.querySelectorAll('.resultFile');
	// console.log(resultFiles.length);
	resultFiles.forEach(resultFile => {
		resultFile.style.minHeight = '99%';
		resultFile.style.maxHeight = '99%';
	});
}

function showAllImagesAtDefaultScale() {
	let resultFiles = document.querySelectorAll('.resultFile');
	// console.log(resultFiles.length);
	resultFiles.forEach(resultFile => {
		resultFile.style.minHeight = '75%';
		resultFile.style.maxHeight = '99%';
	});
}

function shuffleToggle() {
	const queryParams = new URLSearchParams(window.location.search);
	const sortByParam = queryParams.get('sortBy');
	if (sortByParam === 'shuffle') {
		queryParams.set('sortBy', 'path');
	} else {
		queryParams.set('sortBy', 'shuffle');
	}
	const newUrl = `${window.location.pathname}?${queryParams.toString()}`;
	window.history.replaceState({}, '', newUrl);
	window.location.reload();
}

function removeImageLinksAndSave() {
	// Get all the img elements on the page
	const images = document.querySelectorAll('.contentLink');

	// Loop through each img element and store its href attribute value in a data attribute
	for (const image of images) {
		if (image.hasAttribute('href')) {
			image.setAttribute('data-original-href', image.getAttribute('href'));
			image.removeAttribute('href');
		}
	}
}

// Return a function to restore the original href attribute values
function restoreImageLinks() {
	const images = document.querySelectorAll('.contentLink');
	// Loop through each img element and restore its href attribute value from the data attribute
	for (const image of images) {
		const originalHref = image.getAttribute('data-original-href');
		if (originalHref) {
			image.setAttribute('href', originalHref);
			image.removeAttribute('data-original-href');
		}
	}
}

function refreshDB() {

	const refreshDBButton = document.getElementById('refreshDBButton');
	refreshDBButton.classList.add('processing');

	fetch('/refreshDB')
		.then(response => {
			if (response.ok) {
				console.log('Database refreshed successfully');
				refreshDBButton.classList.add('success');
				refreshDBButton.classList.remove('processing');
				refreshDBButton.classList.remove('default');
				setTimeout(() => {
					refreshDBButton.classList.remove('success');
					refreshDBButton.classList.add('default');
				}, 3000);
			} else {
				refreshDBButton.classList.add('error');
				refreshDBButton.classList.remove('default');
				refreshDBButton.classList.remove('processing');
				setTimeout(() => {
					refreshDBButton.classList.remove('error');
					refreshDBButton.classList.add('default');
				}, 3000);
				throw new Error('Error refreshing database');
			}
		})
		.catch(error => {
			console.error(error);
		});
}

function switchToTileView() {
	const currenturl = document.location.href;
	if (!currenturl.includes('view=tiles')) {
		window.location.href += '&view=tiles'
	}
}

function updateMultiplier(slider) {
	// console.log('slider position');
	// console.log(slider.value);
	sessionStorage.sliderValue = parseFloat(slider.value);
	localStorage.sliderValue = parseFloat(slider.value);
	changeTileSize();
}

// let SLIDER_TIMEOUT;
function changeTileSize() {
	const results = document.querySelectorAll('.result');
	const imageSidebars = document.querySelectorAll('.imageSidebar');

	if (sessionStorage.sliderValue) {
		MULTIPLIER = sessionStorage.sliderValue;
	} else if (localStorage.sliderValue) {
		MULTIPLIER = localStorage.sliderValue;
	} else {
		MULTIPLIER = 1;
	}

	// Loop over all the result elements
	results.forEach(result => {
		// Get the current width and flex-grow values
		const defaultWidth = parseFloat(result.getAttribute('data-width'));

		// Calculate the new width and flex-grow values based on the multiplier
		const newWidth = defaultWidth * MULTIPLIER;

		// Set the new values on the element's style
		result.style.width = `${newWidth}rem`;
		result.style.flexGrow = newWidth;

	});
	// Loop over each element in imageSidebar to set display property
	imageSidebars.forEach(imageSidebar => {
		if (MULTIPLIER < 1) {
			imageSidebar.classList.add('minimized');
		} else {
			imageSidebar.classList.remove('minimized');
		}
	});
	// console.log("MULTIPLIER: " + MULTIPLIER);

	// scroll to last viwed image
	const lastViewedImage = document.getElementById(LAST_VIEWED_IMAGE_ID);
	if (lastViewedImage) {
		lastViewedImage.scrollIntoView({
			// behavior: 'smooth',
			block: "center",
			inline: "nearest"
		});
	}
}

// set page to 1 on every page load
let CURRENT_PAGE_NUMBER = 1;
const RESULTS = document.querySelector('.results')
let IS_LOADING = false;
let HAS_MORE_RESULTS = true;

function newSearch(searchText, sortBy, sortAsc, sortButton) {
	// console.log('newSearch');
	IS_LOADING = true;
	CURRENT_PAGE_NUMBER = 1;
	HAS_MORE_RESULTS = true;

	deselectAllImages();
	LAST_VIEWED_IMAGE_ID = null;

	const urlParams = new URLSearchParams(window.location.search);

	if (!searchText) searchText = urlParams.get('searchText');
	if (!sortBy) sortBy = urlParams.get('sortBy') || 'shuffle';
	if (sortAsc === null) sortAsc = urlParams.get('sortAsc') || true;

	// update URL
	const url = new URL(window.location.href);
	url.searchParams.set('searchText', searchText);
	url.searchParams.set('sortBy', sortBy);
	url.searchParams.set('sortAsc', sortAsc);
	url.searchParams.set('view', 'tiles');
	window.history.replaceState({}, '', url);

	// console.log(`searchText: ${encodeURIComponent(searchText)}, sortBy: ${sortBy}, sortAsc: ${sortAsc}`);

	fetch(`/search?searchText=${encodeURIComponent(searchText)}&sortBy=${sortBy}&sortAsc=${sortAsc}&spaMode=true`)
		.then(response => response.text())
		.then(html => {
			showPopup(`Loading...`, 'info', 1000);
			document.documentElement.scrollTop = 0;

			RESULTS.innerHTML = '';

			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;

			const fragment = document.createDocumentFragment();
			fragment.append(...tempDiv.children);

			RESULTS.appendChild(fragment);

			// update counts of images and pages
			document.getElementById('loadedImageCount').textContent = document.querySelectorAll('.result').length;
			document.getElementById('totalResultCount').textContent = document.getElementById('resultsData').dataset.totalResultCount;
			document.getElementById('pageNumber').textContent = '1';
			document.getElementById('totalPages').textContent = document.getElementById('resultsData').dataset.totalPages;
			window.totalPages = parseInt(document.getElementById('resultsData').dataset.totalPages);

			// activate the appropriate sort button
			if (sortButton) {
				document.querySelectorAll('.sortButton.active').forEach(element => {
					element.classList.remove('active');
				});
				sortButton.classList.add('active');
			}

		})
		.catch(error => {
			console.error(`Error loading results: ${error}`);
			// handle the error appropriately
		})
		.finally(() => {
			IS_LOADING = false;
			changeTileSize();
		});
}

function loadMore(params) {
	const scrollPosition = window.scrollY;
	const documentHeight = document.documentElement.scrollHeight;
	const viewportHeight = window.innerHeight;

	const totalPages = window.totalPages;

	if (HAS_MORE_RESULTS && !IS_LOADING
		&& window.location.href.includes('view=tiles')
		&& ((scrollPosition >= documentHeight - (viewportHeight * 2))
			|| params.calledFromModal)) {
		// console.log('loadmore');
		IS_LOADING = true;
		CURRENT_PAGE_NUMBER++;
		// queryParams just passes the searchText, shuffle and view ie queryParams
		// from first search to getNextResults queries

		// console.log(`loading page number: ${CURRENT_PAGE_NUMBER}, query: ${window.location.search}`);

		fetch(`/getNextResults${window.location.search}&page=${CURRENT_PAGE_NUMBER}&multiplier=${MULTIPLIER}`)
			.then(response => response.text())
			.then(html => {
				if (CURRENT_PAGE_NUMBER >= totalPages) {
					// console.log('no more results');
					HAS_MORE_RESULTS = false;
					showPopup('Stuff no more', 'warn');
				} else {
					showPopup(`Fetching page ${CURRENT_PAGE_NUMBER} / ${totalPages}`, 'info', 3000);
				}

				// udpate page number
				const pageNumberSpan = document.getElementById('pageNumber');
				pageNumberSpan.textContent = CURRENT_PAGE_NUMBER;

				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = html;

				const fragment = document.createDocumentFragment();
				fragment.append(...tempDiv.children);

				RESULTS.appendChild(fragment);

				// if SELECTION_MODE then set selectCheckbox(s) to display: block
				if (SELECTION_MODE) {
					document.querySelectorAll('.selectCheckbox').forEach(element => element.style.display = 'block');
				}

				// update image count
				const loadedImageCount = document.getElementById('loadedImageCount');
				loadedImageCount.textContent = document.querySelectorAll('.result').length;
			})
			.catch(error => {
				console.error(`Error loading more results: ${error}`);
				// handle the error appropriately
			})
			.finally(() => {
				IS_LOADING = false;
			});
	}
}

function deleteFile(imageLinkRelative, index) {
	// console.log(imageLinkRelative);
	// console.log(index);
	const imageId = 'image' + index;
	const url = '/moveRenameFiles';
	const formData = {
		operation: "delete",
		currentFilePaths: {
			[imageId]: imageLinkRelative
		},
		argument1: "###deleted"
	}
	// console.log(`formData: ${JSON.stringify(formData)}`);
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(formData)
	};
	fetch(url, options)
		.then(response => response.json())
		.then(data => {
			// console.log(data);
			const newImagesData = new Map(Object.entries(data.newImagesData));
			newImagesData.forEach((newImageData, imageId) => {
				showPopup("File Deleted", "warn");
				elementToRemove = document.getElementById("result" + index);
				// elementToRemove.style.display = "none";
				elementToRemove.style.opacity = "5%";
			});
		})
		.catch(error => {
			showPopup(error, 'error');
			console.error(`Error deleting file: ${error}`);
		});
}

// rename single image/file
function showRenameDialog(button) {
	if (button.nextSibling.classList.contains('renameDialog')) {
		const renameDialog = button.nextSibling;
		if (renameDialog.open) {
			renameDialog.close();
		} else {
			renameDialog.show();
			const newFileNameInput = renameDialog.querySelector('.newFileName');
			newFileNameInput.select();
		}

		// yes the dialogs can be submitted too
		renameDialog.onsubmit = function (event) {
			event.preventDefault(); // else the form will submit normally and reload the page
			const renameForm = renameDialog.querySelector('.renameForm');
			const idNum = renameForm.idNum.value;
			const imageId = 'image' + idNum;
			let imageLinkRelative = renameForm.currentFilePath.value;
			const newFileName = renameForm.newFileName.value.trim();
			const url = '/moveRenameFiles';
			const formData = {
				operation: 'rename',
				currentFilePaths: {
					[imageId]: imageLinkRelative
				},
				argument1: newFileName
			}
			// console.log(`form data: ${JSON.stringify(formData)}`);
			const options = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			};

			fetch(url, options)
				.then(response => response.json())
				.then(data => {
					// console.log(`response: ${JSON.stringify(data)}`);
					const successCount = data.successCount;
					const failCount = data.failCount;
					const newImagesData = new Map(Object.entries(data.newImagesData));
					newImagesData.forEach((newImageData, imageId) => {
						const image = document.getElementById(imageId);
						if (newImageData === 'fail') {
							image.classList.add('renameFailed')
						} else {
							imageLinkRelative = newImageData.newFilePathRelative;
							image.src = imageLinkRelative
							const resultDiv = document.getElementById("result" + idNum);
							const imageSidebar = resultDiv.querySelector('.imageSidebar');
							imageSidebar.innerHTML = newImageData.newImageDetails;
						}
					})
					showPopup(`Renamed ${successCount} files`, 'info')
					if (failCount !== 0) {
						showPopup(`Failed ${failCount} files`, 'error')
					}
				})
				.catch(error => {
					showPopup(error, 'error');
					// console.log(error);
				});

			renameDialog.close();
		}
	}
}

function pauseOtherVideos(videoElement) {
	// console.log('pause other videos 2');
	// console.log(videoElement);
	const videosList = document.querySelectorAll('video');
	if (videoElement) {
		videosList.forEach(video => {
			if (!video.paused && video !== videoElement) {
				video.pause();
			}
		});
	}
}

function showPopup(message, level, timeout) {
	const popupContainer = document.getElementById('popupContainer');
	popupContainer.style.visibility = 'visible';

	if (!timeout) {
		timeout = 5000;
	}
	// Create the popup element
	const popup = document.createElement('div');

	popup.textContent = message;

	popup.classList.add('popup');
	popup.classList.add(level);

	popupContainer.appendChild(popup);

	setTimeout(function () {
		popup.remove();
		if (popupContainer.children.length === 0) {
			popupContainer.style.visibility = 'hidden';
		}
	}, timeout);
}

function showModal(fileLink, firstLoad = false, target = null) {
	// firstLoad indicates that the function was called froml clicking an image in the vertical scrolling list, so preloading should not be applied

	CURRENT_IMAGE_PATH = fileLink;
	if (target) {
		// used to scroll to correct position after changing tile size
		LAST_VIEWED_IMAGE_ID = target.id;
		CURRENT_IMAGE_ID_NUM = parseInt(target.id.replace('image', ''));
	}

	// remove the localhost url part
	const relativeFilePath = fileLink.replace(origin, '').replace(/^\//, '');
	if (firstLoad) {
		updateModalImageDetails(CURRENT_IMAGE_ID_NUM);
	} else {
		const modalImageDetails = document.querySelector('.modalImageDetails');
		modalImageDetails.innerHTML = '';
		fetch(`/getFileDetails?relativeFilePath=${relativeFilePath}`)
			.then(response => response.text())
			.then(html => {
				// console.log(html);
				modalImageDetails.innerHTML = html;
			})
			.catch(error => {
				console.error(`Error getting file details: ${error}`);
			});
	}

	MODAL.style.display = 'block';
	if (fileLink.toLowerCase().endsWith('.mp4') || fileLink.toLowerCase().endsWith('.mkv') || fileLink.toLowerCase().endsWith('.webm')) {
		MODAL_VIDEO_CONTAINER.style.display = 'block';
		MODAL_IMAGE_CONTAINER.style.display = 'none';
		MODAL_VIDEO.src = fileLink;
		MODAL_VIDEO.play();
	} else {
		MODAL_VIDEO_CONTAINER.style.display = 'none';
		MODAL_VIDEO.pause();
		MODAL_IMAGE_CONTAINER.style.display = 'block';
		const img = new Image();
		img.src = fileLink;
		if (firstLoad) {
			VIEWER.load(fileLink);
			preloadNeighbors();
		} else {
			img.onload = () => {
				VIEWER.load(fileLink);
				preloadNeighbors();
			};
		}
	}
	IS_MODAL_ACTIVE = true;
}

function closeModal() {
	MODAL.style.display = 'none';
	// VIEWER.destroy();
	MODAL_VIDEO.pause();
	IS_MODAL_ACTIVE = false;

	scrollToCurrentImage()
}

function toggleSidebar(event) {
	const sidebar = document.getElementById('sidebar');
	const sidebarToggleButton = document.getElementById('sidebarToggleButton');
	let clickedElement;

	// if toggling with F2 key, this will be undefined.
	try {
		clickedElement = event.target;
	} catch (error) {

	}

	// without this the sidebar closes even if any child element is clicked
	if (clickedElement != undefined && clickedElement.id !== "sidebar" && clickedElement.id !== 'sidebarToggleButton') {
		return;
	}

	if (sidebar.classList.contains('open')) {
		closeSidebar();
	} else {
		openSidebar();
	}
}

function closeSidebar() {
	if (SIDEBAR_PINNED) {
		showPopup('Sidebar is pinned', 'info', 1000);
		return
	};
	SIDEBAR.classList.remove('open');
	SIDEBAR_TOGGLE_BUTTON.classList.remove('open');
	SIDEBAR.classList.add('close');
	SIDEBAR_TOGGLE_BUTTON.classList.add('close');

	// remove focus from sidebar
	if (SIDEBAR.contains(document.activeElement)) {
		document.activeElement.blur();
	}
}

function openSidebar() {
	SIDEBAR.classList.remove('close');
	SIDEBAR_TOGGLE_BUTTON.classList.remove('close');
	SIDEBAR.classList.add('open');
	SIDEBAR_TOGGLE_BUTTON.classList.add('open');
}

function handleSelectionCheckboxInput(selectionCheckbox) {
	if (selectionCheckbox.checked) {
		selectImage(selectionCheckbox.parentElement.querySelector('.resultFile'));
	} else {
		deselectImage(selectionCheckbox.parentElement.querySelector('.resultFile'));
	}
}

function selectImage(resultFileElement) {
	// if no selected items yet then set selectCheckbox to display: block
	if (SELECTED_IMAGES.size == 0) {
		SELECTION_MODE = true;
		document.querySelectorAll('.selectCheckbox').forEach(element => element.style.display = 'block');
	}

	// console.log('selecting image');
	SELECTED_IMAGES.set(resultFileElement.id,
		decodeURIComponent(resultFileElement.src.replace(origin, '').replace(/^\//, '')));
	resultFileElement.classList.add('selectedImage');
	LAST_SELECTED_IMAGE_INDEX = parseInt(resultFileElement.id.replace('image', ''));
	document.getElementById(`selectCheckbox${resultFileElement.id.replace('image', '')}`).checked = true;
	udpateSelectedFilesCount();
}

function deselectImage(resultFileElement) {
	// console.log('deselecting image');
	SELECTED_IMAGES.delete(resultFileElement.id);
	resultFileElement.classList.remove('selectedImage');
	LAST_SELECTED_IMAGE_INDEX = undefined;
	document.getElementById(`selectCheckbox${resultFileElement.id.replace('image', '')}`).checked = false;
	udpateSelectedFilesCount();

	// if no more selected files then set selectCheckbox to display: none
	if (SELECTED_IMAGES.size == 0) {
		SELECTION_MODE = false;
		document.querySelectorAll('.selectCheckbox').forEach(element => element.style.display = 'none');
	}
}

function handleRangeSelection(resultFileElement) {
	// console.log('range selection handler');

	let currentImageIndex = parseInt(resultFileElement.id.replace('image', ''));

	if (LAST_SELECTED_IMAGE_INDEX < currentImageIndex) {
		let startingIndex = LAST_SELECTED_IMAGE_INDEX;
		let endingIndex = currentImageIndex;

		for (let index = startingIndex + 1; index <= endingIndex; index++) {
			let image = document.getElementById(`image${index}`);
			if (image.classList.contains('selectedImage')) {
				deselectImage(image);
			} else {
				selectImage(image);
			}
		}
	} else if (LAST_SELECTED_IMAGE_INDEX > currentImageIndex) {
		let startingIndex = LAST_SELECTED_IMAGE_INDEX;
		let endingIndex = currentImageIndex;

		for (let index = startingIndex - 1; index >= endingIndex; index--) {
			let image = document.getElementById(`image${index}`);
			// remove localhost:3000 from the starting of image
			if (image.classList.contains('selectedImage')) {
				deselectImage(image);
			} else {
				selectImage(image);
			}
		}
	}

	// behave like no image has been selected yet
	LAST_SELECTED_IMAGE_INDEX = undefined;
	// console.log(selectedImages);
}

function selectAllImages() {
	const images = document.querySelectorAll('.resultFile');
	images.forEach(image => {
		selectImage(image);
	});
	udpateSelectedFilesCount()
}

function deselectAllImages() {
	SELECTED_IMAGES.clear()
	const images = document.querySelectorAll('.resultFile.selectedImage');
	images.forEach(image => {
		deselectImage(image);
	});
	udpateSelectedFilesCount()
}

function invertSelection() {
	const images = document.querySelectorAll('.resultFile');
	images.forEach(image => {
		const imageId = image.id;
		if (SELECTED_IMAGES.has(imageId)) {
			deselectImage(image);
		} else {
			selectImage(image);
		}
	});
	udpateSelectedFilesCount()
}

function showNextImage() {
	// remove localhost and leading slash
	CURRENT_IMAGE_PATH = CURRENT_IMAGE_PATH.replace(origin, '').replace(/^\//, '');

	fetch(`/next?currentImagePath=${(CURRENT_IMAGE_PATH)}`)
		.then(response => response.json())
		.then(data => {
			showModal(data.nextImagePath);
		})
		.catch(error => console.error(error));
}

function showPreviousImage() {
	// remove localhost and leading slash
	CURRENT_IMAGE_PATH = CURRENT_IMAGE_PATH.replace(origin, '').replace(/^\//, '');

	fetch(`/previous?currentImagePath=${(CURRENT_IMAGE_PATH)}`)
		.then(response => response.json())
		.then(data => {
			showModal(data.previousImagePath);
		})
		.catch(error => console.error(error));
}

function moveRenameFiles(operation) {
	let argument1;
	let argument2;
	let pattern;
	let isValid;
	// console.log(selectedImages);
	// console.log(renameBulkInput.value);

	if (SELECTED_IMAGES.size == 0) {
		showPopup('No files selected', 'warn');
		return;
	}
	switch (operation) {
		case "delete":
			break;
		case "renameBulk":
			argument1 = document.getElementById('renameBulkInput').value;
			if (!argument1) {
				showPopup('Provide a value first', 'warn');
				return;
			}
			break;
		case "appendToName":
			argument1 = document.getElementById('appendToNameInput').value;
			updateHistoryButtons(argument1, operation);
			pattern = /^[a-zA-Z0-9 _\-,;#@$&*\(\)]*$/;
			isValid = pattern.test(argument1);
			if (!isValid) {
				showPopup('text contains disallowed characters', 'warn');
				return;
			}
			if (!argument1) {
				showPopup('Provide a value first', 'warn');
				return;
			}
			break;
		case "prependToName":
			argument1 = document.getElementById('prependToNameInput').value;
			updateHistoryButtons(argument1, operation);
			pattern = /^[a-zA-Z0-9\-_ ]*$/;
			isValid = pattern.test(argument1);
			if (!isValid) {
				showPopup('text contains disallowed characters', 'warn');
				return;
			}
			if (!argument1) {
				showPopup('Provide a value first', 'warn');
				return;
			}
			break
		case "removeFromName":
			argument1 = document.getElementById('removeFromNameInput').value;
			updateHistoryButtons(argument1, operation);
			if (!argument1) {
				showPopup('Provide a value first', 'warn');
				return;
			}
			break;
		case "replaceInName":
			argument1 = document.getElementById('textToFindInput').value;
			argument2 = document.getElementById('textToSubstituteInput').value;
			pattern = /^[a-zA-Z0-9\-_ ]*$/;
			isValid = pattern.test(argument2);
			if (!isValid) {
				showPopup('"Text to substitute" contains disallowed characters', 'warn');
				return;
			}
			if (!argument1 || !argument2) {
				showPopup('Provide a value for "Text to find" and "Text to substitute"', 'warn');
				return;
			}
			if (argument1 == argument2) {
				showPopup('"Text to find" and "Text to substitute" should be different', 'warn');
				return;
			}
			break;
		case "moveFiles":
			argument1 = document.getElementById('moveFilesInput').value;
			updateHistoryButtons(argument1, operation);
			pattern = /^[a-zA-Z0-9-_\\ ]*$/;
			isValid = pattern.test(argument1);
			if (!isValid) {
				showPopup('Folder name contains disallowed characters', 'warn');
				return;
			}
			if (!argument1) {
				showPopup('Provide a target folder', 'warn');
				return;
			}
			break;
		default:
			showPopup('Unsupported operation', 'warn');
			break;
	}

	const url = '/moveRenameFiles';
	const formData = {
		operation: operation,
		// have to convert map to an Object so it can be serialized into a JSON
		currentFilePaths: Object.fromEntries(SELECTED_IMAGES),
		argument1: argument1,
		argument2: argument2
	}
	// console.log(Object.fromEntries(selectedImages));
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(formData)
	};

	// console.log(options.body);
	fetch(url, options)
		.then(response => response.json())
		.then(data => {
			// console.log(data);
			const successCount = data.successCount;
			const failCount = data.failCount;
			const newFoldersCreated = data.newFoldersCreated;
			const newImagesData = new Map(Object.entries(data.newImagesData));
			newImagesData.forEach((value, imageId) => {
				const image = document.getElementById(imageId);
				if (value === 'fail') {
					image.classList.add('renameFailed')
				} else if (operation != "delete") {
					const imageLinkRelative = value.newFilePathRelative;
					image.src = imageLinkRelative
					SELECTED_IMAGES.set(imageId, imageLinkRelative)
					// console.log(selectedImages);
					// update image title and subtitle
					idNum = imageId.replace('image', '');
					const resultDiv = document.getElementById("result" + idNum);
					const imageSidebar = resultDiv.querySelector('.imageSidebar');
					imageSidebar.innerHTML = value.newImageDetails;
				} else {
					idNum = imageId.replace('image', '');
					elementToRemove = document.getElementById("result" + idNum);
					elementToRemove.style.opacity = "5%";
					// clear selected images
					SELECTED_IMAGES.delete(imageId);
					image.classList.remove('selectedImage');
				}
			})

			if (newFoldersCreated) {
				refreshDirectoryTree();
			}

			showPopup(`Renamed ${successCount} files`, 'info')
			if (failCount !== 0) {
				showPopup(`Failed ${failCount} files`, 'error')
			}
		})
		.catch(error => {
			showPopup(error, 'error');
			console.error(error);
		});
}

function toggleContextMenu(contextMenuButton) {
	const additionalButtons = contextMenuButton.parentNode.querySelector('.additionalButtons');
	additionalButtons.classList.toggle('show');
}

function shareExternally(imagePath) {
	navigator.share({
		url: imagePath
	});
}

function updateProgressBar(video) {
	const progressBar = video.parentNode.querySelector('.progressBar');
	const progress = (video.currentTime / video.duration) * 100;
	progressBar.style.width = `${progress}%`;
}