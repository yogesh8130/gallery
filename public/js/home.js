const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let QUERY_STRING; // stores URLs query part, used for lazy loading (getNextResults)
let MULTIPLIER = 1 // zoom slider value
const SELECTED_IMAGES = new Map(); // imageId => imageLink
let ALL_FILES_SELECTED = false;
let IS_MODAL_ACTIVE = false;
let SELECTION_MODE = 0 // whether click opens an image or selects it

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

let VIDEO_SPEEDUP_TIMEOUT;
const SPEEDUP_DELAY = 500;
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

function renderTree(tree, parentPath = "", currentPath = "") {
	const ul = document.createElement("ul");

	Object.keys(tree).sort().forEach(folder => {
		const li = document.createElement("li");

		const fullPath = parentPath ? `${parentPath}\\${folder}` : folder;
		const hasChildren = Object.keys(tree[folder]).length > 0;

		const label = document.createElement("div");
		label.classList.add("folder-label");

		const link = document.createElement("a");
		link.href = `/search?&searchText=\\images\\${encodeURIComponent(fullPath)}`;
		link.target = "_blank";
		link.textContent = folder;
		link.classList.add("folder-link");

		label.appendChild(link);

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

			label.addEventListener("click", (e) => {
				if (e.target.tagName === "A") return;
				children.classList.toggle("collapsed");
				label.classList.toggle("open");
			});

			li.appendChild(label);
			li.appendChild(children);
		} else {
			label.classList.add("leaf");
			li.appendChild(label);
		}

		ul.appendChild(li);
	});

	return ul;
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
	const validOperationsForHistory = ['appendToName', 'prependToName', 'removeFromName', 'moveFiles'];

	// helper function to create buttons
	function createButton(argument, operation) {
		const button = document.createElement('button');
		button.dataset.argumentString = argument;
		button.title = argument;
		button.dataset.operation = operation;
		// make button text limited to 50 char with ellipsis in between the startting 25 and last 25 chars
		button.textContent = argument.replace('000\\00', '').length > 40 ? `${argument.replace('000\\00', '').slice(0, 20)}...${argument.replace('000\\00', '').slice(-20)}` : argument.replace('000\\00', '');
		button.classList.add(`${operation}Button`);
		button.classList.add('historyButton');
		// console.log(`${operation}History`);
		document.getElementById(`${operation}History`)?.prepend(button);
		// add an event listener on the button to call moveRenameFiles() with the buttons data argumentString
		button.addEventListener('click', (event) => {
			// cuz somehow the button's dataset is not reliable
			const operation = event.target.parentElement.dataset.operation;
			document.getElementById(`${operation}Input`).value = event.target.dataset.argumentString;
			moveRenameFiles(operation);
			// destroy self as new button will be created anyways, but not immediately to avoid double click on a wrong button
			event.target.remove();
		});
		return button
	}

	// if argument is null then read the values from session storage and add the buttons to the respective historyDivs
	if (!argument) {
		for (const operation of validOperationsForHistory) {
			const operationHistory = JSON.parse(localStorage.getItem(operation + 'History'));
			if (operationHistory) {
				operationHistory.forEach(appendString => {
					const button = createButton(appendString, operation);
					document.getElementById(operation + 'History').prepend(button);
				});
			}
		}
		return;
	}

	// add the argument string to the an array in session storage appropriate <operation>History , create one if not found
	let operationHistory = JSON.parse(localStorage.getItem(`${operation}History`));
	if (!operationHistory) {
		operationHistory = [];
	}

	// remove first if argument already exists and then add it to the array
	operationHistory = operationHistory.filter(item => item !== argument);
	operationHistory.push(argument);
	localStorage.setItem(`${operation}History`, JSON.stringify(operationHistory));

	// remove the last element if the array has more than 10 elements
	if (operationHistory.length > 10) {
		operationHistory.shift();
		localStorage.setItem(`${operation}History`, JSON.stringify(operationHistory));
	}

	// remove the last item from HistoryDiv if it has more than 10 items
	const operationHistoryDiv = document.getElementById(`${operation}History`);
	while (operationHistoryDiv.children.length > 10) {
		operationHistoryDiv.removeChild(operationHistoryDiv.lastChild);
	}

	const button = createButton(argument);
	operationHistoryDiv.prepend(button);
}

document.addEventListener('fullscreenchange', restoreScroll);
document.addEventListener('webkitfullscreenchange', restoreScroll);

function restoreScroll() {
	if (!document.fullscreenElement && !document.webkitFullscreenElement) {
		console.log("retruning");
		setTimeout(() => {
			window.scrollTo({
				top: SCROLL_Y_BEFORE_FULLSCREEN,
				behavior: 'auto'
			});
		}, 1000);
	}
}

document.addEventListener("DOMContentLoaded", function () {
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
	fetch("/folderPaths")
		.then(res => res.json())
		.then(paths => {
			const treeData = buildTree(paths);
			const container = document.getElementById("folderTree");

			const currentFolder =
				document.getElementById("searchText")?.value?.trim().replace(/^\\images\\/, '') || "";

			container.innerHTML = "";
			container.appendChild(
				renderTree(treeData, "", currentFolder)
			);
		});

	// convertin URL query params to
	QUERY_STRING = window.location.search;
	const searchParams = new URLSearchParams(QUERY_STRING);
	const queryParams = {};
	for (const [key, value] of searchParams) {
		queryParams[key] = value;
	}
	// console.log(queryString, queryParams);

	// setting form fields on load
	const view = document.getElementById('view');
	const searchText = document.getElementById('searchText');
	view.value = queryParams.view || 'tiles';
	searchText.value = queryParams.searchText;

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

	// Get the parent element that contains all the images
	RESULTS_CONTAINER = document.querySelector('.results');

	// add click listeners if not in coarse pointer mode (ie using mouse)
	if (!COARSE_POINTER_MEDIA_QUERY.matches) {
		// Attach a click event listener to the parent element
		RESULTS_CONTAINER.addEventListener('click', function (event) {
			// console.log('clicked');
			// event.target is the element that was clicked
			if (LAST_SELECTED_IMAGE_INDEX > -1 &&
				event.target.classList.contains('resultFile') && event.shiftKey) {
				handleRangeSelection(event.target);
			} else if ((event.target.classList.contains('resultFile') && event.ctrlKey)
				|| event.target.classList.contains('resultFile') && SELECTION_MODE == 1) {
				// select unselect with ctrl key OR single left click (if selection mode is on)
				if (event.target.classList.contains('selectedImage')) {
					deselectImage(event.target);
				} else {
					selectImage(event.target);
				}
				// console.log(selectedImages);

			} else if (event.target.classList.contains('resultFile')
				&& event.target.tagName == 'IMG') {
				event.preventDefault();
				showModal(event.target.src, true, event.target);
				CURRENT_IMAGE_ID_NUM = event.target.id.replace('image', '');
			} else if (event.target.tagName == 'VIDEO') {
				// videos are handled by mousedown and mouseup events
				event.preventDefault();
			}
			if (event.target.classList.contains('resultFile')) {
				// to record last interacted image, used to scroll to correct position on zoom change
				LAST_VIEWED_IMAGE_ID = event.target.id;
			}
			// else if (event.target.classList.contains('resultFile')
			// 	&& event.target.tagName == 'VIDEO') {
			// 	event.preventDefault();
			// 	console.log(event.target.playbackRate);
			// 	console.log(event.target.paused);
			// 	console.log(VIDEO_SPEEDUP_TIMEOUT);

			// 	if (event.target.paused) {
			// 		event.target.play();
			// 	} else if (!VIDEO_SPEEDUP_TIMEOUT) {
			// 		console.log('pausing video');
			// 		event.target.pause();
			// 	}

			// }
			udpateSelectedFilesCount();
		});

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
			// remove localhost and leading slash
			CURRENT_IMAGE_PATH = CURRENT_IMAGE_PATH.replace(origin, '').replace(/^\//, '');

			fetch(`/next${QUERY_STRING}&fromResults=true&currentImagePath=${(CURRENT_IMAGE_PATH)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.nextImagePath);
				})
				.catch(error => console.error(error));
			CURRENT_IMAGE_ID_NUM++;
		}

		MODAL_PREV_FROM_SEARCH_BUTTON.onclick = function () {
			// remove localhost and leading slash
			CURRENT_IMAGE_PATH = CURRENT_IMAGE_PATH.replace(origin, '').replace(/^\//, '');

			fetch(`/previous${QUERY_STRING}&fromResults=true&currentImagePath=${(CURRENT_IMAGE_PATH)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.previousImagePath);
				})
				.catch(error => console.error(error));
			CURRENT_IMAGE_ID_NUM--;
		}
	}

	// play video on hover
	// resultsContainer.addEventListener('mouseover', function (event) {
	// 	const target = event.target;
	// 	if (target.classList.contains('videoFile')) {
	// 		target.play();
	// 	} else if (target.classList.contains('thumbnail')) {
	// 		target.click();
	// 	}
	// })

	// // pause video on mouse leave
	// resultsContainer.addEventListener('mouseout', function (event) {
	// 	const video = event.target;
	// 	if (video.classList.contains('videoFile')) {
	// 		video.pause();
	// 	}
	// })

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
	if (COARSE_POINTER_MEDIA_QUERY.matches) {

		// HAMMERTIME!!

		// adding touch gestures to #modal using hammer
		const modalHammer = new Hammer(MODAL);
		modalHammer.get('swipe').set({ direction: Hammer.DIRECTION_ALL });
		modalHammer.on('swipeleft', function (event) {
			// console.log('modal swipeleft');
			if (!IS_VIEWER_ZOOMED)
				showNextImage();
		});
		modalHammer.on('swiperight', function (event) {
			// console.log('modal swiperight');
			if (!IS_VIEWER_ZOOMED)
				showPreviousImage();
		});
		modalHammer.on('swipedown', function (event) {
			// console.log('modal swipedown');
			if (!IS_VIEWER_ZOOMED)
				closeModal();
		});
		modalHammer.on('swipeup', function (event) {
			// console.log('modal swipeup');
			if (!IS_VIEWER_ZOOMED)
				closeModal();
		});

		// disable context menu on touch devices for results container
		RESULTS_CONTAINER.addEventListener('contextmenu', function (event) {
			// console.log('suppressed contextmenu');
			event.preventDefault();
			resultsContainerLongPressHandler(event);
		});

		function resultsContainerLongPressHandler(event) {
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

		// adding touch gestures to #results using hammer
		const resultsContainerHammer = new Hammer(RESULTS_CONTAINER);
		resultsContainerHammer.get('swipe').set({
			direction: Hammer.DIRECTION_HORIZONTAL
		});
		resultsContainerHammer.on('swiperight', (event) => {
			// console.log('swiperight');
			// if sidebar is open then close it else fullscreen the video which got swiped on
			if (document.querySelector('#sidebar.open')) {
				closeSidebar();
			} else {
				// Swipe right on video to make it fullscreen
				const video = event.target.closest('video');
				if (!video) return;
				openFullscreen(video);
			}
		});
		resultsContainerHammer.on('swipeleft', (event) => {
			// console.log('swiperight');
			openSidebar();
		});

		// tap to preview image
		resultsContainerHammer.on('tap', (event) => {
			console.log('singleTap');
			if (event.target.classList.contains('imageFile')) {
				event.preventDefault();
				showModal(event.target.src, true, event.target);
			}
		});

		// click to preview image (sometimes it's registered as click and not tap WTF)
		RESULTS_CONTAINER.addEventListener('click', (event) => {
			// console.log('click');
			if (event.target.classList.contains('imageFile')) {
				event.preventDefault();
				showModal(event.target.src, true, event.target);
			}
		});

		const sidebarHammer = new Hammer(SIDEBAR);
		sidebarHammer.get('swipe').set({
			direction: Hammer.DIRECTION_HORIZONTAL
		});
		sidebarHammer.on('swiperight', (ev) => {
			// console.log('swiperight sidebar');
			closeSidebar();
		});
	}
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

document.addEventListener('mousedown', function (event) {
	const target = event.target;
	if (target && (target.tagName === 'VIDEO')) {
		event.preventDefault();
		if (!target.paused) {
			VIDEO_SPEEDUP_TIMEOUT = setTimeout(function () {
				target.playbackRate = SPEEDUP_RATE;
				VIDEO_SPEEDUP_TIMEOUT = null;
			}, SPEEDUP_DELAY);
		}
	}
})

document.addEventListener('mouseup', function (event) {
	const target = event.target;
	if (target && (target.tagName === 'VIDEO')) {
		event.preventDefault();
		if (target.paused) {
			target.play()
		} else if (target.playbackRate == 1) {
			target.pause();
		}
		if (target.playbackRate != 1) {
			target.playbackRate = 1;
		}
	}
})


let TOUCH_START_X = 0;
let TOUCH_START_Y = 0;
let TOUCH_COUNT;
document.addEventListener('touchstart', function (event) {
	const target = event.target;
	// console.log(target);
	const touch = event.touches[0];
	TOUCH_START_X = touch.clientX;
	TOUCH_START_Y = touch.clientY;

	TOUCH_COUNT = event.touches.length;

	if (target && (target.tagName === 'VIDEO')) {
		target.controls = false;
		VIDEO_SPEEDUP_TIMEOUT = setTimeout(function () {
			target.playbackRate = SPEEDUP_RATE;
			target.controls = false;
		}, SPEEDUP_DELAY);
	}
})

document.addEventListener('touchmove', function (event) {
	const touch = event.touches[0];
	const touchMoveY = touch.clientY;
	// cancel speed up if touch is moved
	if (touchMoveY && VIDEO_SPEEDUP_TIMEOUT) {
		clearTimeout(VIDEO_SPEEDUP_TIMEOUT);
	}
})

document.addEventListener('touchend', function (event) {
	const target = event.target;
	// console.log(target);

	const touch = event.changedTouches[0];
	const touchEndX = touch.clientX;
	const touchEndY = touch.clientY;

	// console.log("touchCount: " + touchCount);
	// console.log(event.touches.length);

	const touchDeltaX = touchEndX - TOUCH_START_X;
	const touchDeltaY = touchEndY - TOUCH_START_Y;

	// console.log(touchDeltaX, touchDeltaY);

	if (target && (target.tagName === 'VIDEO') && Math.abs(touchDeltaY) < 10) {
		// if timeout is still set
		if (VIDEO_SPEEDUP_TIMEOUT) {
			clearTimeout(VIDEO_SPEEDUP_TIMEOUT);
			event.preventDefault();
		}
		if (target.playbackRate == SPEEDUP_RATE) {
			target.playbackRate = 1;
		} else {
			// toggle play/pause
			if (target.paused) {
				target.play();
			} else {
				target.pause();
				target.controls = true;
			}
		}
	}
})

document.addEventListener('contextmenu', function (event) {
	const target = event.target;
	if (target && (target.tagName === 'VIDEO')) {
		event.preventDefault();
	}
})

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

function goFullscreen() {
	const toggleButton = document.getElementById('fullscreenButton');

	const header = document.querySelector('.header');
	const pageButtons = document.querySelector('.pageButtons');

	if (header.style.display === 'none') {
		toggleButton.innerText = '◹'
		header.style.display = 'flex';

		if (pageButtons) {
			pageButtons.style.display = 'block';
		}
		document.exitFullscreen();

	} else {
		toggleButton.innerText = '◺'
		header.style.display = 'none';

		if (pageButtons) {
			pageButtons.style.display = 'none';
		}
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


function dragToScrollEnable() {
	// console.log('enabling drag to scroll');

	let scrollable = document.querySelector('.results');
	let isDown = false;
	let startX;
	let startY;
	let scrollLeft;
	let scrollTop;

	scrollable.addEventListener('mousedown', function (e) {
		isDown = true;
		startX = e.pageX - scrollable.offsetLeft;
		startY = e.pageY - scrollable.offsetTop;
		scrollLeft = scrollable.scrollLeft;
		scrollTop = scrollable.scrollTop;
	});

	scrollable.addEventListener('mouseleave', function () {
		isDown = false;
	});

	scrollable.addEventListener('mouseup', function () {
		isDown = false;
	});

	scrollable.addEventListener('mousemove', function (e) {
		if (!isDown) return;
		e.preventDefault();
		let x = e.pageX - scrollable.offsetLeft;
		let y = e.pageY - scrollable.offsetTop;
		let walkX = (x - startX) * 2;
		let walkY = (y - startY) * 2;
		scrollable.scrollLeft = scrollLeft - walkX;
		scrollable.scrollTop = scrollTop - walkY;
	});
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
	// this code used to preserve the set of random images that were being viewed
	// now it will reload a new set from server because this was slow due to client js processing

	// const switchToTileViewButton = document.getElementById('switchToTileViewButton');
	// switchToTileViewButton.classList.add('processing')

	// const stylesheet = document.getElementById("stylesheet");
	// stylesheet.href = "/css/search-results-tiles.css";

	// const ielements = document.querySelectorAll('i');
	// const resultDivs = document.querySelectorAll('.result');

	// resultDivs.forEach(result => {
	// 	const width = parseFloat(result.getAttribute('data-width'));

	// 	result.style.width = `${width}rem`;
	// 	result.style.flexGrow = width;
	// });

	// ielements.forEach(ielement => {
	// 	const padding = parseFloat(ielement.getAttribute('data-padding'));
	// 	ielement.style.paddingBottom = `${padding}%`;
	// });

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

	// get the imageID at the top of viewport
	// const elementsAtTop = document.elementsFromPoint(50, 0 + document.querySelector('.header').offsetHeight)
	// let imageIdAtTop;;
	// for (element of elementsAtTop) {
	// 	if (element.classList.contains('resultFile')) {
	// 		imageIdAtTop = element.id;
	// 		console.log(imageIdAtTop);
	// 		console.log(element.src);
	// 	}
	// }

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
	console.log("MULTIPLIER: " + MULTIPLIER);

	// scroll back to correct position
	// if (imageIdAtTop) {
	// 	const imageElement = document.getElementById(imageIdAtTop);
	// 	if (imageElement) {
	// 		imageElement.scrollIntoView({
	// 			// behavior: 'smooth',
	// 			block: "start",
	// 			inline: "nearest"
	// 		});
	// 	}
	// }

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
let CURRENT_PAGE_SIZE = 1;
const RESULTS = document.querySelector('.results')
let IS_LOADING = false;
let HAS_MORE_RESULTS = true;

function loadMore() {
	const scrollPosition = window.scrollY;
	const documentHeight = document.documentElement.scrollHeight;
	const viewportHeight = window.innerHeight;

	const totalPages = window.totalPages;

	if (HAS_MORE_RESULTS && !IS_LOADING
		&& window.location.href.includes('view=tiles')
		&& scrollPosition >= documentHeight - (viewportHeight * 2)) {
		// console.log('loadmore');
		IS_LOADING = true;
		CURRENT_PAGE_SIZE++;
		// queryParams just passes the searchText, shuffle and view ie queryParams
		// from first search to getNextResults queries
		fetch(`/getNextResults${QUERY_STRING}&page=${CURRENT_PAGE_SIZE}&multiplier=${MULTIPLIER}`)
			.then(response => response.text())
			.then(html => {
				if (CURRENT_PAGE_SIZE > totalPages) {
					// console.log('no more results');
					HAS_MORE_RESULTS = false;
					showPopup('Stuff no more', 'warn');
				} else {
					showPopup(`Fetching page ${CURRENT_PAGE_SIZE} / ${totalPages}`, 'info', 3000);
				}

				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = html;
				while (tempDiv.firstChild) {
					// remove each child from temp div and add to results div
					RESULTS.appendChild(tempDiv.firstChild);
				}
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
	if (!timeout) {
		timeout = 5000;
	}
	// Create the popup element
	const popup = document.createElement('div');

	popup.textContent = message;

	// Add the 'popup' class to the popup element
	popup.classList.add('popup');
	popup.classList.add(level);

	// Get the number of active popups
	const activePopups = document.getElementsByClassName('popup').length;

	// Calculate the vertical position of the popup
	const verticalPosition = 20 + (activePopups * 45); // Adjust the value (60) as needed

	// Set the bottom CSS property
	popup.style.bottom = verticalPosition + 'px';

	// Append the popup element to the body
	document.body.appendChild(popup);

	// Show the popup
	setTimeout(function () {
		popup.style.opacity = '1';
	}, 100);

	// Hide and remove the popup after 3 seconds
	setTimeout(function () {
		popup.style.opacity = '0';
		setTimeout(function () {
			document.body.removeChild(popup);
		}, 300);
	}, timeout);
}

function showModal(fileLink, firstLoad = false, target = null) {
	// firstLoad indicates that the function was called froml clicking an image in the vertical scrolling list, so preloading should not be applied

	CURRENT_IMAGE_PATH = fileLink;
	if (target) {
		// used to scroll to correct position after changing tile size
		LAST_VIEWED_IMAGE_ID = target.id;
	}

	// remove the localhost url part
	const relativeFilePath = fileLink.replace(origin, '').replace(/^\//, '');
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
		const modalButtons = document.querySelectorAll('.modalButton');
		modalButtons.forEach(button => {
			button.style.opacity = 0;
		});
	}
	IS_MODAL_ACTIVE = true;
}

function closeModal() {
	MODAL.style.display = 'none';
	// VIEWER.destroy();
	MODAL_VIDEO.pause();
	IS_MODAL_ACTIVE = false;
	const modalButtons = document.querySelectorAll('.modalButton');
	modalButtons.forEach(button => {
		button.style.opacity = 1;
	});
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
}

function openSidebar() {
	SIDEBAR.classList.remove('close');
	SIDEBAR_TOGGLE_BUTTON.classList.remove('close');
	SIDEBAR.classList.add('open');
	SIDEBAR_TOGGLE_BUTTON.classList.add('open');
}

function selectionModeToggle() {
	let selectionModeCheckbox = document.getElementById('selectionModeCheckbox');
	SELECTION_MODE = selectionModeCheckbox.checked ? "1" : "0";
}

function selectImage(resultFileElement) {
	// console.log('selecting image');
	SELECTED_IMAGES.set(resultFileElement.id,
		decodeURIComponent(resultFileElement.src.replace(origin, '').replace(/^\//, '')));
	resultFileElement.classList.add('selectedImage');
	LAST_SELECTED_IMAGE_INDEX = parseInt(resultFileElement.id.replace('image', ''));
	udpateSelectedFilesCount();
}

function deselectImage(resultFileElement) {
	// console.log('deselecting image');
	SELECTED_IMAGES.delete(resultFileElement.id);
	resultFileElement.classList.remove('selectedImage');
	LAST_SELECTED_IMAGE_INDEX = undefined;
	udpateSelectedFilesCount();
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
		const imageLinkRelative = decodeURIComponent(image
			.getAttribute('data-src').replace(origin, '').replace(/^\//, ''));
		const imageId = image.id;

		SELECTED_IMAGES.set(imageId, imageLinkRelative)
		image.classList.add('selectedImage');

		if (image.tagName == 'VIDEO') {
			image.parentElement
				.querySelector('.thumbnailContainer')
				.querySelector('.thumbnail').classList.add('selectedImage');
		}
	});
	udpateSelectedFilesCount()
}

function deselectAllImages() {
	SELECTED_IMAGES.clear()
	const images = document.querySelectorAll('.selectedImage');
	images.forEach(image => {
		image.classList.remove('selectedImage');
	});
	udpateSelectedFilesCount()
}

function invertSelection() {
	const images = document.querySelectorAll('.resultFile');
	images.forEach(image => {
		const imageId = image.id;
		if (SELECTED_IMAGES.has(imageId)) {
			SELECTED_IMAGES.delete(imageId);
			image.classList.remove('selectedImage');
			if (image.tagName == 'VIDEO') {
				image.parentElement
					.querySelector('.thumbnailContainer')
					.querySelector('.thumbnail').classList.remove('selectedImage');
			}
		} else {
			const imageLinkRelative = decodeURIComponent(image
				.getAttribute('data-src').replace(origin, '').replace(/^\//, ''));
			SELECTED_IMAGES.set(imageId, imageLinkRelative);
			image.classList.add('selectedImage');
			if (image.tagName == 'VIDEO') {
				image.parentElement
					.querySelector('.thumbnailContainer')
					.querySelector('.thumbnail').classList.add('selectedImage');
			}
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
			pattern = /^[a-zA-Z0-9\- ]*$/;
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
			pattern = /^[a-zA-Z0-9\- ]*$/;
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