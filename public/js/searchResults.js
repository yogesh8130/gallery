const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const baseSize = 25;
let videos; // to keep track of all videos on the page, even as they load
let multiplier = 1 // zoom slider value

document.addEventListener("DOMContentLoaded", function () {
	// convertin URL query params to
	const queryString = window.location.search;
	const searchParams = new URLSearchParams(queryString);
	const queryParams = {};
	for (const [key, value] of searchParams) {
		queryParams[key] = value;
	}
	// console.log(queryParams);

	// setting form fields on load
	const view = document.getElementById('view');
	const searchText = document.getElementById('searchText');
	view.value = queryParams.view;
	searchText.value = queryParams.searchText;

	if (view.value !== 'tiles') {
		dragToScrollEnable();
	} else {
		// load slider values from localStorage
		const slider = document.getElementById('slider')
		if (localStorage.sliderValue) {
			multiplier = localStorage.sliderValue;
			slider.value = localStorage.sliderValue;
		} else {
			console.log('sliderValue not found in local storage');
			localStorage.sliderValue = 1;
		}

		// Setting image size as per stored slider value 'on load' i.e. 1
		changeTileSize(1);

		// add lazy load listener
		window.addEventListener('scroll', loadMore);
	}

	updateVideoListeners();

	document.addEventListener('keydown', function (event) {
		const focusedElement = document.activeElement;
		if (focusedElement.nodeName === 'INPUT') {
			// console.log('Currently focused element is an input field');
			return
		}

		if (event.key === 'f') {
			goFullscreen()
		}
		if (event.key === '1') {
			showAllImagesAtActualSize();
		}
		if (event.key === '2') {
			showAllImagesStreched();
		}
		if (event.key === '3') {
			showAllImagesAtDefaultScale();
		}
		if (event.key === 's') {
			const shuffleCheckbox = document.getElementById("shuffle");
			shuffleCheckbox.checked = !shuffleCheckbox.checked;
			shuffleToggle();
		}
	});

	// MODAL SINGLE IMAGE VIEWER

	// Get the parent element that contains all the images
	const resultsContainer = document.querySelector('.results');

	// Attach a click event listener to the parent element
	resultsContainer.addEventListener('click', function (event) {

		const modal = document.getElementById("modal");
		const modalImageContainer = document.querySelector('.modalImageContainer');
		const modalVideoContainer = document.querySelector('.modalVideoContainer');
		const modalVideo = document.querySelector('.modalVideo');
		const modalCloseButton = document.getElementById('modalCloseButton');
		const modalNextButton = document.getElementById('modalNextButton');
		const modalPreviousButton = document.getElementById('modalPreviousButton');
		const modalNextFromResultsButton = document.getElementById('modalNextFromResultsButton');
		const modalPreviousFromResultsButton = document.getElementById('modalPreviousFromResultsButton');

		let clickedElement = event.target;
		let currentImagePath;

		let viewer;

		// setting modal image src to the clicked image
		if (clickedElement.classList.contains('resultFile')) {
			viewer = new ImageViewer(modalImageContainer);
			showModal(clickedElement.src);
			currentImagePath = clickedElement.src;
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

			fetch(`/next?fromResults=true&currentImagePath=${(currentImagePath)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.nextImagePath);
					currentImagePath = data.nextImagePath;
				})
				.catch(error => console.error(error));
		}

		modalPreviousFromResultsButton.onclick = function () {
			// remove localhost and leading slash
			currentImagePath = currentImagePath.replace(origin, '').replace(/^\//, '');

			fetch(`/previous?fromResults=true&currentImagePath=${(currentImagePath)}`)
				.then(response => response.json())
				.then(data => {
					showModal(data.previousImagePath);
					currentImagePath = data.previousImagePath;
				})
				.catch(error => console.error(error));
		}

		document.addEventListener('keydown', function (event) {
			const focusedElement = document.activeElement;
			if (focusedElement.nodeName === 'INPUT') {
				// console.log('Currently focused element is an input field');
				return
			} else {
				if (event.shiftKey && event.key === 'ArrowRight') {
					modalNextButton.click();
				} else if (event.shiftKey && event.key === 'ArrowLeft') {
					modalPreviousButton.click();
				} else if (event.key === 'ArrowRight') {
					modalNextFromResultsButton.click();
				} else if (event.key === 'ArrowLeft') {
					modalPreviousFromResultsButton.click();
				} else if (event.key === 'Escape') {
					closeModal();
				}
			}
		});

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
			}
		}

		function closeModal() {
			modal.style.display = 'none';
			viewer.destroy();
			modalVideo.pause();
		}

		// drag scrolling for modal image
		// TODO

	});

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
		if (isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
			document.documentElement.style.fontSize = "6.15%";
		}
		document.exitFullscreen();

	} else {
		toggleButton.innerText = '◺'
		header.style.display = 'none';

		if (pageButtons) {
			pageButtons.style.display = 'none';
		}
		if (isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
			document.documentElement.style.fontSize = "2.5%";
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
	let shuffleCheckbox = document.getElementById('shuffle');
	const currentUrl = window.location.href;

	if (shuffleCheckbox.checked) {
		const newUrl = `${currentUrl}&shuffle=true`;
		window.location.href = newUrl;
	} else {
		const newUrl = currentUrl.replace("&shuffle=true", "").replace("&shuffle=on", "");
		window.location.href = newUrl;
	}
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

function changeTileSize(initialPageLoad) {
	const slider = document.getElementById('slider');
	const results = document.querySelectorAll('.result');

	if (!initialPageLoad) {
		// Get the current slider value
		multiplier = parseFloat(slider.value);
	} else {
		multiplier = localStorage.sliderValue;
	}

	// Loop over all the result elements
	results.forEach(result => {
		// Get the current width and flex-grow values
		const defaultWidth = parseFloat(result.getAttribute('data-width'));

		// Calculate the new width and flex-grow values based on the multiplier
		const newWidth = defaultWidth * multiplier;

		// Set the new values on the element's style
		result.style.width = `${newWidth}rem`;
		result.style.flexGrow = newWidth;
	});

	// storing current slider value to localStorage
	localStorage.sliderValue = multiplier;
}

// Create a global IntersectionObserver instance
const observer = new IntersectionObserver((entries) => {
	let centerVideo = null;
	entries.forEach((entry) => {
		if (entry.isIntersecting && entry.intersectionRatio >= 1) {
			centerVideo = entry.target;
		}
	});

	if (centerVideo && centerVideo.paused) {
		centerVideo.play();
	}
}, { threshold: 1 });

function updateVideoListeners() {
	const videos = document.querySelectorAll('.videoFile');

	videos.forEach((video) => {
		// Check if the video already has a listener and observer
		if (!video.hasListener && !video.hasObserver) {
			video.addEventListener('play', () => {
				// Stop other videos from playing
				videos.forEach((v) => {
					if (v !== video) {
						v.pause();
					}
				});
			});

			// Pause video if clicked while playing
			video.addEventListener('click', () => {
				if (!video.paused) {
					video.pause();
				}
			});

			// Maximize video on double click
			video.addEventListener('dblclick', () => {
				if (video.requestFullscreen) {
					video.requestFullscreen();
				}
			});

			// Add the observer to the video
			observer.observe(video);

			// Set the flags indicating the video has a listener and observer
			video.hasListener = true;
			video.hasObserver = true;
		} else {
			console.log('video already has obeserver and listener: ', video);
		}
	});

	window.addEventListener('scroll', () => {
		const windowHeight = window.innerHeight;
		const center = windowHeight / 2;

		videos.forEach((video) => {
			const rect = video.getBoundingClientRect();
			const videoTop = rect.top;
			const videoBottom = rect.bottom;
			const videoHeight = rect.height;

			if (videoTop < center && videoBottom > center && videoHeight < windowHeight) {
				observer.centerVideo = video;
			}
		});

		if (observer.centerVideo && observer.centerVideo.paused) {
			observer.centerVideo.play();
		}
	});
}


// set page to 1 on every page load
let currentPage = 1;
const results = document.querySelector('.results')
let isLoading = false;

function loadMore() {
	const scrollPosition = window.scrollY;
	const documentHeight = document.documentElement.scrollHeight;
	const viewportHeight = window.innerHeight;
	if (!isLoading && window.location.href.includes('view=tiles') && scrollPosition >= documentHeight - (viewportHeight * 2)) {
		isLoading = true;
		currentPage++;
		// console.log('getting next results, page: ' + currentPage);
		fetch(`/getNextResults?page=${currentPage}`)
			.then(response => response.json())
			.then(data => {
				if (currentPage > data.totalPages) {
					// console.log('no more results');
				} else {
					appendResults(data.images);
					// rebuild video list and listeners on those videos
					updateVideoListeners();
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

// function to append image data to the result container
function appendResults(images) {
	for (const image of images) {
		const resultElement = createResultElement(image);
		// console.log(image);
		results.appendChild(resultElement);
	}
}

// function to create an image element from the image data
function createResultElement(image) {
	const baseName = image.baseName;
	const path = image.path;
	const directory = image.directory;
	const trueWidth = parseFloat(image.width);
	const trueHeight = parseFloat(image.height);
	const type = image.type;

	const width = trueWidth * (baseSize * multiplier) / trueHeight;

	const imageLinkEscaped = encodeURIComponent(path);
	const view = 'tiles';

	const containerDiv = document.createElement("div");
	containerDiv.classList.add("result");
	containerDiv.title = `${baseName}\n${directory}`;
	containerDiv.setAttribute("data-width", width);
	containerDiv.style.width = `${width}rem`;
	containerDiv.style.flexGrow = width;

	const padding = trueHeight / trueWidth * 100;

	const imageDiv = document.createElement("i");
	imageDiv.setAttribute("data-padding", padding);
	imageDiv.style.paddingBottom = `${padding}%`;
	containerDiv.appendChild(imageDiv);

	const imageSidebarDiv = document.createElement("div");
	imageSidebarDiv.classList.add("imageSidebar");
	containerDiv.appendChild(imageSidebarDiv);

	const infoDiv = document.createElement("div");
	infoDiv.classList.add("infoDiv");
	imageSidebarDiv.appendChild(infoDiv);

	const similarImageLink = encodeURIComponent(
		baseName
			.replace(/\.[^/.]+$/, "")
			.replace(/\d+$/, "")
			.replace(/\(\d*\)|\d+$/g, "")
			.trim()
	);
	const imageTitleLink = document.createElement("a");
	imageTitleLink.classList.add("imageTitle");
	imageTitleLink.href = `/search?searchText=${similarImageLink}&view=${view}`;
	imageTitleLink.textContent = baseName;
	infoDiv.appendChild(imageTitleLink);

	const folderlink = encodeURIComponent(directory);
	const subTitleLink = document.createElement("a");
	subTitleLink.classList.add("subTitle");
	subTitleLink.href = `/search?searchText=${folderlink}&view=${view}`;
	subTitleLink.textContent = directory;
	infoDiv.appendChild(subTitleLink);

	// creating rename div
	const renameDiv = document.createElement('div');
	renameDiv.classList.add('rename');
	const renameButton = document.createElement('button');
	renameButton.classList.add('renameButton');
	renameButton.setAttribute('onclick', 'showRenameDialog(this)');
	renameButton.innerHTML = '&#9998;';
	const renameDialog = document.createElement('dialog');
	renameDialog.classList.add('renameDialog');
	const renameForm = document.createElement('form');
	renameForm.setAttribute('action', '/rename');
	renameForm.setAttribute('method', 'post');
	renameDialog.appendChild(renameForm);
	const currentFilePathInput = document.createElement('input');
	currentFilePathInput.setAttribute('type', 'text');
	currentFilePathInput.setAttribute('name', 'currentFilePath');
	currentFilePathInput.setAttribute('id', 'currentFilePath');
	currentFilePathInput.setAttribute('placeholder', 'Current File Path');
	currentFilePathInput.setAttribute('value', imageLinkEscaped);
	currentFilePathInput.setAttribute('readonly', 'readonly');
	currentFilePathInput.setAttribute('hidden', 'hidden');
	renameForm.appendChild(currentFilePathInput);
	const newFileNameInput = document.createElement('input');
	newFileNameInput.setAttribute('type', 'text');
	newFileNameInput.setAttribute('name', 'newFileName');
	newFileNameInput.setAttribute('id', 'newFileName');
	newFileNameInput.setAttribute('placeholder', 'New File Name');
	renameForm.appendChild(newFileNameInput);
	const submitInput = document.createElement('input');
	submitInput.setAttribute('type', 'submit');
	submitInput.setAttribute('hidden', 'hidden');
	renameForm.appendChild(submitInput);
	renameDiv.appendChild(renameButton);
	renameDiv.appendChild(renameDialog);
	imageSidebarDiv.appendChild(renameDiv);

	const mainContentDiv = document.createElement("div");
	mainContentDiv.classList.add("mainContent");
	containerDiv.appendChild(mainContentDiv);

	const contentLink = document.createElement("a");
	contentLink.setAttribute("data-href", `/?imageBackLink=${imageLinkEscaped}`);
	contentLink.ondblclick = function () {
		location.href = `/singleView?imageBackLink=${imageLinkEscaped}`;
	};
	mainContentDiv.appendChild(contentLink);

	if (type === "image") {
		const imageElement = document.createElement("img");
		imageElement.classList.add("searchImg");
		imageElement.classList.add("resultFile");
		// imageElement.id = `image${index}`;  not getting index from API
		imageElement.src = imageLinkEscaped;
		contentLink.appendChild(imageElement);
	} else {
		const videoElement = document.createElement("video");
		videoElement.classList.add("searchVid");
		videoElement.classList.add("resultFile");
		videoElement.classList.add("videoFile");
		// videoElement.id = `image${index}`;
		videoElement.src = imageLinkEscaped;
		videoElement.controls = true;
		videoElement.loop = true;
		contentLink.appendChild(videoElement);
	}

	return containerDiv;
}

function showRenameDialog(button) {
	if (button.nextSibling.classList.contains('renameDialog')) {
		const renameDialog = button.nextSibling;
		if (renameDialog.open) {
			renameDialog.close();
		} else {
			renameDialog.show();
		}

		// yes the dialogs can be submitted too
		renameDialog.onsubmit = function (event) {
			event.preventDefault(); // else the form will submit normally and reload the page
			console.log('submitting with fetch');
			//TODO

			renameDialog.close();
		}
	}
}