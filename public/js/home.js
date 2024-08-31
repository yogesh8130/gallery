const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let queryString; // stores URLs query part, used for lazy loading (getNextResults)
const baseSize = 25;
const searchResultBatchSize = 50 // should be same as server for correct image id
let imageIndex = 51 // newly loaded images will be assigned id numbers from here on
let multiplier = 1 // zoom slider value
const selectedImages = new Map(); // imageId => imageLink
let allFilesSelected = false;
let suggestedTargetFolders = [];
let modalActive = false;
let selectionMode = 0 // whether click opens an image or selects it

// To keep track of the image being viewed in modal
let currentImagePath;
let currentImageIdNum;

let viewer;
let modal;
let modalImageContainer;
let modalVideoContainer;
let modalVideo;
let modalCloseButton;
let modalNextButton;
let modalPreviousButton;
let modalNextFromResultsButton;
let modalPreviousFromResultsButton;

let header;
let headerHeight;

let videoSpeedUpTimeout;
const speedupDelay = 500;
const spedUpRate = 4;

document.addEventListener("DOMContentLoaded", function () {
	// convertin URL query params to
	queryString = window.location.search;
	const searchParams = new URLSearchParams(queryString);
	const queryParams = {};
	for (const [key, value] of searchParams) {
		queryParams[key] = value;
	}
	// console.log(queryString, queryParams);

	// setting form fields on load
	const view = document.getElementById('view');
	const searchText = document.getElementById('searchText');
	view.value = queryParams.view;
	searchText.value = queryParams.searchText;

	const storedSuggestedTargetFolders = localStorage.getItem('suggestedTargetFolders');
	if (storedSuggestedTargetFolders) {
		suggestedTargetFolders = JSON.parse(storedSuggestedTargetFolders);
		const datalist = document.getElementById('suggestedFolders');
		suggestedTargetFolders.forEach((folder) => {
			const option = document.createElement('option');
			option.value = folder;
			datalist.appendChild(option);
		})
	}

	header = document.querySelector('.header');
	headerHeight = header.offsetHeight;

	// view specific stuff
	if (view.value !== 'tiles') {
		dragToScrollEnable();
	} else {
		// load slider values from localStorage
		const slider = document.getElementById('slider')
		if (localStorage.sliderValue) {
			multiplier = localStorage.sliderValue;
			slider.value = localStorage.sliderValue;
		} else {
			// console.log('sliderValue not found in local storage');
			localStorage.sliderValue = 1;
		}

		// Setting image size as per stored slider value 'on load' i.e. 1
		changeTileSize(1);

		// add lazy load listener
		window.addEventListener('scroll', loadMore);
	}

	// MODAL SINGLE IMAGE VIEWER

	// Get the parent element that contains all the images
	const resultsContainer = document.querySelector('.results');

	let lastSelectedImageIndex;

	// Attach a click event listener to the parent element
	resultsContainer.addEventListener('click', function (event) {

		modal = document.getElementById("modal");
		modalImageContainer = document.querySelector('.modalImageContainer');
		modalVideoContainer = document.querySelector('.modalVideoContainer');
		modalVideo = document.querySelector('.modalVideo');
		modalCloseButton = document.getElementById('modalCloseButton');
		modalNextButton = document.getElementById('modalNextButton');
		modalPreviousButton = document.getElementById('modalPreviousButton');
		modalNextFromResultsButton = document.getElementById('modalNextFromResultsButton');
		modalPreviousFromResultsButton = document.getElementById('modalPreviousFromResultsButton');

		let clickedElement = event.target;

		if (lastSelectedImageIndex > -1 &&
			clickedElement.classList.contains('resultFile') && event.shiftKey) {
			let currentImageIndex = parseInt(clickedElement.id.replace('image', ''));

			// let startingIndex = Math.min(lastSelectedImageIndex, currentImageIndex);
			// let endingIndex = Math.max(lastSelectedImageIndex, currentImageIndex);

			if (lastSelectedImageIndex < currentImageIndex) {
				startingIndex = lastSelectedImageIndex;
				endingIndex = currentImageIndex;

				for (let index = startingIndex + 1; index <= endingIndex; index++) {
					let image = document.getElementById(`image${index}`);
					// remove localhost:3000 from the starting of image
					const imageLinkRelative = decodeURIComponent(image.src.replace(origin, '').replace(/^\//, ''));
					const imageId = image.id;

					if (image.classList.contains('selectedImage')) {
						selectedImages.delete(imageId);
						image.classList.remove('selectedImage');
					} else {
						selectedImages.set(imageId, imageLinkRelative)
						image.classList.add('selectedImage');
						lastSelectedImageIndex = parseInt(image.id.replace('image', ''));
					}
				}
			} else if (lastSelectedImageIndex > currentImageIndex) {
				startingIndex = lastSelectedImageIndex;
				endingIndex = currentImageIndex;

				for (let index = startingIndex - 1; index >= endingIndex; index--) {
					let image = document.getElementById(`image${index}`);
					// remove localhost:3000 from the starting of image
					const imageLinkRelative = decodeURIComponent(image.src.replace(origin, '').replace(/^\//, ''));
					const imageId = image.id;

					if (image.classList.contains('selectedImage')) {
						selectedImages.delete(imageId);
						image.classList.remove('selectedImage');
					} else {
						selectedImages.set(imageId, imageLinkRelative)
						image.classList.add('selectedImage');
						lastSelectedImageIndex = parseInt(image.id.replace('image', ''));
					}
				}
			}

			lastSelectedImageIndex = undefined;
			// console.log(selectedImages);

		} else if ((clickedElement.classList.contains('resultFile') && event.ctrlKey)
			|| clickedElement.classList.contains('resultFile') && selectionMode == 1) {
			// select unselect with ctrl key OR single left click (if selection mode is on)
			if (clickedElement.classList.contains('selectedImage')) {
				selectedImages.delete(clickedElement.id);
				clickedElement.classList.remove('selectedImage');
				lastSelectedImageIndex = parseInt(clickedElement.id.replace('image', ''));
			} else {
				selectedImages.set(clickedElement.id,
					decodeURIComponent(clickedElement.src.replace(origin, '').replace(/^\//, '')));
				clickedElement.classList.add('selectedImage');
				lastSelectedImageIndex = parseInt(clickedElement.id.replace('image', ''));
				// console.log('lastSelectedImageIndex:', lastSelectedImageIndex);
			}
			// console.log(selectedImages);

		} else if (clickedElement.classList.contains('resultFile')
			&& clickedElement.tagName == 'IMG') {
			// View Clicked image
			// setting modal image src to the clicked image
			viewer = new ImageViewer(modalImageContainer);
			showModal(clickedElement.src);
			currentImagePath = clickedElement.src;
			currentImageIdNum = clickedElement.id.replace('image', '');
			event.preventDefault(); // this makes the videos play on click and keeps info links working
		}

		modal.onclick = function (event) {
			if (event.target.classList.contains('iv-image-view')) {
				closeModal();
				// } else if (event.target.classList.contains('modalVideo')) {
				// 	if (modalVideo.paused) {
				// 		console.log('vide is pause');
				// 		modalVideo.play();
				// 	} else {
				// 		console.log('vide is play');
				// 		modalVideo.pause();
				// 	}
			}
		}

		modalCloseButton.onclick = function () {
			closeModal();
		}

		modalNextButton.onclick = function () {
			// remove localhost and leading slash
			currentImagePath = currentImagePath.replace(origin, '').replace(/^\//, '');

			fetch(`/next?currentImagePath=${(currentImagePath)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.nextImagePath);
					currentImagePath = data.nextImagePath;
				})
				.catch(error => console.error(error));
		}

		modalPreviousButton.onclick = function () {
			// remove localhost and leading slash
			currentImagePath = currentImagePath.replace(origin, '').replace(/^\//, '');

			fetch(`/previous?currentImagePath=${(currentImagePath)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.previousImagePath);
					currentImagePath = data.previousImagePath;
				})
				.catch(error => console.error(error));
		}

		modalNextFromResultsButton.onclick = function () {
			// remove localhost and leading slash
			currentImagePath = currentImagePath.replace(origin, '').replace(/^\//, '');

			fetch(`/next${queryString}&fromResults=true&currentImagePath=${(currentImagePath)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.nextImagePath);
					currentImagePath = data.nextImagePath;
				})
				.catch(error => console.error(error));
			currentImageIdNum++;
		}

		modalPreviousFromResultsButton.onclick = function () {
			// remove localhost and leading slash
			currentImagePath = currentImagePath.replace(origin, '').replace(/^\//, '');

			fetch(`/previous${queryString}&fromResults=true&currentImagePath=${(currentImagePath)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.previousImagePath);
					currentImagePath = data.previousImagePath;
				})
				.catch(error => console.error(error));
			currentImageIdNum--;
		}

	});

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

});

// Keyboard shortcuts
document.addEventListener('keydown', function (event) {
	const focusedElement = document.activeElement;

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
		case 'Delete':
			if (modalActive === false) {
				// delete selected files
				event.preventDefault();
				moveRenameFiles("delete");
			}
			break;
		case 'Escape':
			closeModal();
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
			if (allFilesSelected) {
				deselectAllImages();
			} else {
				selectAllImages();
			}
			allFilesSelected = !allFilesSelected;
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
			if (modalActive && !event.shiftKey) {
				modalNextFromResultsButton.click();
			} else if (modalActive && event.shiftKey) {
				modalNextButton.click();
			} else {
				const slider = document.getElementById('slider');
				slider.value -= -(0.1);
				changeTileSize();
			}
			break;
		case 'ArrowLeft':
			if (modalActive && !event.shiftKey) {
				modalPreviousFromResultsButton.click();
			} else if (modalActive && event.shiftKey) {
				modalPreviousButton.click();
			} else {
				const slider = document.getElementById('slider');
				slider.value -= 0.1;
				changeTileSize();
			}
			break;
		case 'Delete':
			event.preventDefault();
			// console.log(clickedElement);
			imageLinkRelative = decodeURIComponent(currentImagePath).replace(origin, '').replace(/^\//, '');
			// console.log("Delete: " + imageLinkRelative + " " + currentImageIdNum);
			deleteFile(imageLinkRelative, currentImageIdNum);
			modalNextFromResultsButton.click();
			break;
		default:
			break;
	}
});

// Mouse click shotcuts
document.addEventListener('click', function (event) {
	const target = event.target;
	// console.log(target);
	if (target && (target.classList.contains('thumbnail') || target.classList.contains('thumbnailOverlay'))) {
		target.style.display = 'none';
		// get nearest video element
		const videoFile = target.parentNode.nextSibling;
		if (videoFile) {
			// populate src from data-src
			videoFile.src = videoFile.getAttribute('data-src');
			videoFile.style.display = 'block';
			videoFile.play();
			pauseOtherVideos(videoFile);
			// hide header if visible
			header.style.top = `-${headerHeight}px`;
		}
	}

	if (target && target.tagName === 'VIDEO') {
		// if playback speed is 2x then prevent the click
		if (target.playbackRate != 1) {
			target.playbackRate = 1;
			event.preventDefault();
		}
	}
})

document.addEventListener('mousedown', function (event) {
	const target = event.target;
	// console.log(target);
	if (target && (target.tagName === 'VIDEO')) {
		videoSpeedUpTimeout = setTimeout(function () {
			target.playbackRate = spedUpRate;
		}, speedupDelay);
	}
})

document.addEventListener('mouseup', function (event) {
	const target = event.target;
	// console.log(target);
	if (target && (target.tagName === 'VIDEO')) {
		// if timeout is still set
		if (videoSpeedUpTimeout) {
			clearTimeout(videoSpeedUpTimeout);
		}
	}
})


let touchStartX = 0;
let touchStartY = 0;
let touchCount;
let scrollingUp = false;
document.addEventListener('touchstart', function (event) {
	const target = event.target;
	// console.log(target);
	const touch = event.touches[0];
	touchStartX = touch.clientX;
	touchStartY = touch.clientY;

	touchCount = event.touches.length;

	if (target && (target.tagName === 'VIDEO')) {
		target.controls = false;
		videoSpeedUpTimeout = setTimeout(function () {
			target.playbackRate = spedUpRate;
			target.controls = false;
		}, speedupDelay);
	}
})

document.addEventListener('touchmove', function (event) {
	const touch = event.touches[0];
	const touchMoveY = touch.clientY;
	// cancel speed up if touch is moved
	if (touchMoveY && videoSpeedUpTimeout) {
		clearTimeout(videoSpeedUpTimeout);
	}

	if (touch.clientY < touchStartY) {
		// console.log("scrolling up");
		scrollingUp = true;
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

	const touchDeltaX = touchEndX - touchStartX;
	const touchDeltaY = touchEndY - touchStartY;

	// console.log(touchDeltaX, touchDeltaY);

	setTimeout(() => {
		scrollingUp = false;
	}, 1500);

	if (target && (target.tagName === 'VIDEO') && Math.abs(touchDeltaY) < 10) {
		// if timeout is still set
		if (videoSpeedUpTimeout) {
			clearTimeout(videoSpeedUpTimeout);
			event.preventDefault();
		}
		if (target.playbackRate == spedUpRate) {
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

	const ivZoomHandle = document.querySelector('.iv-zoom-handle');
	let zoomValue;
	if (ivZoomHandle) {
		zoomValue = parseInt(ivZoomHandle.style.left);
	}

	// swipe left or right for next or previous
	if (touchCount === 1 && zoomValue === 0) {
		if (target && modalActive) {
			if (touchDeltaX < -100) {
				modalNextButton.click();
			} else if (touchDeltaX > 100) {
				modalPreviousButton.click();
			}
		}

		// swipe up to close modal
		if (target && modalActive) {
			if (touchDeltaY < -100) {
				closeModal();
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

let previousScrollPosition = 0;
let scrollTimeout;
// stuff to do on scroll
window.addEventListener('scroll', function (event) {
	const currentScrollPosition = window.scrollY;

	if (currentScrollPosition > previousScrollPosition) {
		// Scrolling down - hide header
		header.style.top = `-${headerHeight}px`;
		scrollTimeout = setTimeout(function () {
			// this prevents the header from re-showing instantly
			clearTimeout(scrollTimeout);
			scrollTimeout = null;
		}, 1000)
	} else if (!scrollingUp) {
		// Scrolling up - show header
		if (!scrollTimeout) {
			header.style.top = '0';
		}
		// for letting the header scroll in gradually
		// if (parseInt(header.style.top) < 0) {
		// 	header.style.top = `${parseInt(header.style.top) + (previousScrollPosition - currentScrollPosition)}px`;
		// } else {
		// 	header.style.top = '0';
		// }
	}
	previousScrollPosition = currentScrollPosition;
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

function changeTileSize(isFirstPageLoad) {
	const slider = document.getElementById('slider');
	const results = document.querySelectorAll('.result');
	const imageSidebar = document.querySelectorAll('.imageSidebar');
	const thumbnailOverlays = document.querySelectorAll('.thumbnailOverlay');

	if (!isFirstPageLoad) {
		// Get the current slider value
		multiplier = parseFloat(slider.value);
	} else {
		multiplier = localStorage.sliderValue;
	}
	console.log(`multiplier: ${multiplier}`);

	// Loop over all the result elements
	results.forEach(result => {
		// Get the current width and flex-grow values
		const defaultWidth = parseFloat(result.getAttribute('data-width'));

		// Calculate the new width and flex-grow values based on the multiplier
		const newWidth = defaultWidth * multiplier;

		// Set the new values on the element's style
		result.style.width = `${newWidth}rem`;
		result.style.flexGrow = newWidth;

		// Loop over each element in imageSidebar to set display property
		imageSidebar.forEach(subtitle => {
			if (multiplier < 1) {
				subtitle.style.display = "none";
			} else {
				subtitle.style.display = null;
			}
		});

		thumbnailOverlays.forEach(thumbnailOverlay => {
			if (multiplier < 1) {
				thumbnailOverlay.classList.add('imageSidebarHidden');
			} else {
				thumbnailOverlay.classList.remove('imageSidebarHidden');
			}
		});
	});

	// storing current slider value to localStorage
	localStorage.sliderValue = multiplier;
}

// set page to 1 on every page load
let currentPage = 1;
const results = document.querySelector('.results')
let isLoading = false;
let haveMoreResults = true;

function loadMore() {
	const scrollPosition = window.scrollY;
	const documentHeight = document.documentElement.scrollHeight;
	const viewportHeight = window.innerHeight;

	const totalPages = window.totalPages;

	if (haveMoreResults && !isLoading
		&& window.location.href.includes('view=tiles')
		&& scrollPosition >= documentHeight - (viewportHeight * 2)) {
		isLoading = true;
		currentPage++;
		// queryParams just passes the searchText, shuffle and view ie queryParams
		// from first search to getNextResults queries
		fetch(`/getNextResults${queryString}&page=${currentPage}&multiplier=${multiplier}`)
			.then(response => response.text())
			.then(html => {
				if (currentPage > totalPages) {
					// console.log('no more results');
					haveMoreResults = false;
					showPopup('Stuff no more', 'warn');
				} else {
					showPopup(`Fetching page ${currentPage} / ${totalPages}`, 'info', 3000);
				}

				const tempDiv = document.createElement('div');
				tempDiv.innerHTML = html;
				while (tempDiv.firstChild) {
					// remove each child from temp div and add to results div
					results.appendChild(tempDiv.firstChild);
				}
			})
			.catch(error => {
				console.error(`Error loading more results: ${error}`);
				// handle the error appropriately
			})
			.finally(() => {
				isLoading = false;
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

function showModal(fileLink) {
	modal.style.display = 'block';
	if (fileLink.toLowerCase().endsWith('.mp4') || fileLink.toLowerCase().endsWith('.mkv') || fileLink.toLowerCase().endsWith('.webm')) {
		modalVideoContainer.style.display = 'block';
		modalImageContainer.style.display = 'none';
		modalVideo.src = fileLink;
		modalVideo.play();
	} else {
		modalVideoContainer.style.display = 'none';
		modalVideo.pause();
		modalImageContainer.style.display = 'block';
		viewer.load(fileLink);
		const modalButtons = document.querySelectorAll('.modalButton');
		modalButtons.forEach(button => {
			button.style.opacity = 0;
		});
	}
	modalActive = true;
}

function closeModal() {
	modal.style.display = 'none';
	viewer.destroy();
	modalVideo.pause();
	modalActive = false;
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

	if (sidebar.style.right === '0px') {
		// close sidebar
		sidebar.style.right = '-300px';
		sidebarToggleButton.style.right = '0px';
	} else {
		// open sidebar
		sidebar.style.right = '0px';
		sidebarToggleButton.style.right = '300px';
		const renameBulkInput = document.getElementById('renameBulkInput');
		// renameBulkInput.focus();
	}
}

function selectionModeToggle() {
	let selectionModeCheckbox = document.getElementById('selectionModeCheckbox');
	selectionMode = selectionModeCheckbox.checked ? "1" : "0";
}

function selectAllImages() {
	const images = document.querySelectorAll('.resultFile');
	images.forEach(image => {
		const imageLinkRelative = decodeURIComponent(image
			.getAttribute('data-src').replace(origin, '').replace(/^\//, ''));
		const imageId = image.id;

		selectedImages.set(imageId, imageLinkRelative)
		image.classList.add('selectedImage');

		if (image.tagName == 'VIDEO') {
			image.parentElement
				.querySelector('.thumbnailContainer')
				.querySelector('.thumbnail').classList.add('selectedImage');
		}
	});
}

function deselectAllImages() {
	selectedImages.clear()
	const images = document.querySelectorAll('.selectedImage');
	images.forEach(image => {
		image.classList.remove('selectedImage');
	});
}

function invertSelection() {
	const images = document.querySelectorAll('.resultFile');
	images.forEach(image => {
		const imageId = image.id;
		if (selectedImages.has(imageId)) {
			selectedImages.delete(imageId);
			image.classList.remove('selectedImage');
			if (image.tagName == 'VIDEO') {
				image.parentElement
					.querySelector('.thumbnailContainer')
					.querySelector('.thumbnail').classList.remove('selectedImage');
			}
		} else {
			const imageLinkRelative = decodeURIComponent(image
				.getAttribute('data-src').replace(origin, '').replace(/^\//, ''));
			selectedImages.set(imageId, imageLinkRelative);
			image.classList.add('selectedImage');
			if (image.tagName == 'VIDEO') {
				image.parentElement
					.querySelector('.thumbnailContainer')
					.querySelector('.thumbnail').classList.add('selectedImage');
			}
		}
	});
}

function moveRenameFiles(operation) {
	let argument1;
	let argument2;
	let pattern;
	let isValid;
	// console.log(selectedImages);
	// console.log(renameBulkInput.value);

	if (selectedImages.size == 0) {
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
			argument1 = document.getElementById('targetFolderNameInput').value;
			pattern = /^[a-zA-Z0-9\\ ]*$/;
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
		currentFilePaths: Object.fromEntries(selectedImages),
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
					selectedImages.set(imageId, imageLinkRelative)
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
					selectedImages.delete(imageId);
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