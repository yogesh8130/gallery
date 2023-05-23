const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
let queryString; // stores URLs query part, used for lazy loading (getNextResults)
const baseSize = 25;
const videosList = []; // to keep track of all videos on the page, even as they load
const searchResultBatchSize = 50 // should be same as server for correct image id
let imageIndex = 51 // newly loaded images will be assigned id numbers from here on
let multiplier = 1 // zoom slider value
const selectedImages = new Map();
let allFilesSelected = false;
let suggestedTargetFolders = [];

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

	// Creating videos list
	videosList.push(...Array.from(document.querySelectorAll('.videoFile')));
	videosList.forEach(video => {
		// to load the src value from data-src
		observer.observe(video);
	});

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
			console.log('sliderValue not found in local storage');
			localStorage.sliderValue = 1;
		}

		// Setting image size as per stored slider value 'on load' i.e. 1
		changeTileSize(1);

		// add lazy load listener
		window.addEventListener('scroll', loadMore);
	}

	document.addEventListener('keydown', function (event) {
		const focusedElement = document.activeElement;
		if (event.key === 'F2') {
			toggleSidebar();
		}
		if (event.key === 'F3') {
			event.preventDefault();
			const searchText = document.getElementById('searchText');
			searchText.focus();
		}

		if (focusedElement.nodeName === 'INPUT') {
			// console.log('Currently focused element is an input field');
			return
		}

		if (event.ctrlKey && event.key === 'a') {
			event.preventDefault();
			if (allFilesSelected) {
				deselectAllImages();
			} else {
				selectAllImages();
			}
			allFilesSelected = !allFilesSelected;
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
		if (event.ctrlKey && event.key === 'ArrowRight') {
			const slider = document.getElementById('slider');
			slider.value -= -(0.1);
			changeTileSize();
			console.log(slider.value);
		}
		if (event.ctrlKey && event.key === 'ArrowLeft') {
			const slider = document.getElementById('slider');
			slider.value -= 0.1;
			changeTileSize();
			console.log(slider.value);
		}
		if (event.altKey && event.key === 't') {
			document.documentElement.scrollTop = 0;
		}
	});

	// MODAL SINGLE IMAGE VIEWER

	// Get the parent element that contains all the images
	const resultsContainer = document.querySelector('.results');

	let lastSelectedImageIndex;

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

		} else if (clickedElement.classList.contains('resultFile') && event.ctrlKey) {
			// select unselect with ctrl key
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

		} else if (clickedElement.classList.contains('resultFile')) {
			// setting modal image src to the clicked image
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

			fetch(`/next${queryString}&fromResults=true&currentImagePath=${(currentImagePath)}`)
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

			fetch(`/previous${queryString}&fromResults=true&currentImagePath=${(currentImagePath)}`)
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

	});

	// play video on hover
	resultsContainer.addEventListener('mouseover', function (event) {
		const video = event.target;
		if (video.classList.contains('videoFile')) {
			video.play();
		}
	})

	// pause video on mouse leave
	resultsContainer.addEventListener('mouseout', function (event) {
		const video = event.target;
		if (video.classList.contains('videoFile')) {
			video.pause();
		}
	})

	// prevent the page form reloading when these forms are submitted
	const moveForm = document.getElementById('moveForm');
	const renameBulkForm = document.getElementById('renameBulkForm');
	moveForm.onsubmit = (event) => { event.preventDefault(); }
	renameBulkForm.onsubmit = (event) => { event.preventDefault(); }

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

// set page to 1 on every page load
let currentPage = 1;
const results = document.querySelector('.results')
let isLoading = false;
let haveMoreResults = true;

function loadMore() {
	const scrollPosition = window.scrollY;
	const documentHeight = document.documentElement.scrollHeight;
	const viewportHeight = window.innerHeight;
	if (haveMoreResults && !isLoading
		&& window.location.href.includes('view=tiles')
		&& scrollPosition >= documentHeight - (viewportHeight * 2)) {
		isLoading = true;
		currentPage++;
		// queryParams just passes the searchText, shuffle and view ie queryParams
		// from first search to getNextResults queries
		fetch(`/getNextResults${queryString}&page=${currentPage}`)
			.then(response => {
				if (response.ok) {
					return response.json()
				} else {
					haveMoreResults = false;
					throw new Error('Error fetching more results');
				}
			})
			.then(data => {
				if (currentPage > data.totalPages) {
					// console.log('no more results');
					haveMoreResults = false;
					showPopup('Stuff no more', 'warn');
				} else {
					showPopup(`Fetching page ${currentPage}`, 'info', 1000);
					appendResults(data.images);
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
	imageTitleLink.target = '_blank';
	imageTitleLink.textContent = baseName;
	infoDiv.appendChild(imageTitleLink);

	const folderlink = encodeURIComponent(directory);
	const subTitleLink = document.createElement("a");
	subTitleLink.classList.add("subTitle");
	subTitleLink.href = `/search?searchText=${folderlink}&view=${view}`;
	subTitleLink.target = '_blank';
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
		imageElement.id = `image${imageIndex}`;
		imageIndex++;
		contentLink.appendChild(imageElement);
	} else {
		const videoElement = document.createElement("video");
		videoElement.classList.add("searchVid");
		videoElement.classList.add("resultFile");
		videoElement.classList.add("videoFile");
		// videoElement.id = `image${index}`;
		// videoElement.src = imageLinkEscaped; // setting data-src instead
		videoElement.setAttribute('data-src', imageLinkEscaped)
		videoElement.controls = true;
		videoElement.loop = true;
		videoElement.id = `image${imageIndex}`;
		imageIndex++;
		contentLink.appendChild(videoElement);

		// adding new videos to the global video list
		videosList.push(videoElement);
		observer.observe(videoElement);
		// console.log('Videos in videosList: ', videosList);
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
			const renameForm = renameDialog.querySelector('.renameForm');
			// console.log(renameForm.newFileName.value);

			const url = '/rename';
			const formData = {
				currentFilePath: renameForm.currentFilePath.value,
				newFileName: renameForm.newFileName.value
			}

			// console.log(formData);

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
					showPopup(data.message, data.level);
					// console.log(data);
				})
				.catch(error => {
					showPopup(error, 'error');
					// console.log(error);
				});

			renameDialog.close();
		}
	}
}

// this contains a callback that will be called for each video that we observe
const observer = new IntersectionObserver((entries, observer) => {
	entries.forEach(entry => {
		// Check if the video is in view
		if (entry.isIntersecting) {
			const video = entry.target;
			// Set the src attribute from the data-src attribute
			video.src = video.dataset.src;
			if (isMobile) {
				// no need to have this on desktop as videos only play till the
				// cursor is over them
				video.addEventListener('play', pauseOtherVideos)
			}
			// Stop observing the video
			observer.unobserve(video);
		}
	});
});

function pauseOtherVideos() {
	videosList.forEach(video => {
		if (!video.paused && video !== this) {
			video.pause();
		}
	});
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

function toggleSidebar(event) {
	const sidebar = document.getElementById('sidebar');
	const sidebarToggleButton = document.getElementById('sidebarToggleButton');

	if (sidebar.style.right === '0px') {
		// close sidebar
		sidebar.style.right = '-300px';
		sidebarToggleButton.style.right = '0px';
	} else {
		// open sidebar
		sidebar.style.right = '0px';
		sidebarToggleButton.style.right = '300px';
		const renameBulkText = document.getElementById('renameBulkText');
		renameBulkText.focus();
	}
}

function renameBulk() {
	const renameBulkText = document.getElementById('renameBulkText');
	// console.log(selectedImages);
	// console.log(renameBulkText.value);

	if (!renameBulkText.value) {
		showPopup('Provide a value first', 'warn');
		return;
	}

	if (selectedImages.size == 0) {
		showPopup('No files selected', 'warn');
		return;
	}

	const url = '/renameBulk';
	const formData = {
		// have to convert map to an Object so it can be serialized into a JSON
		currentFilePaths: Object.fromEntries(selectedImages),
		newFileName: renameBulkText.value
	}

	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(formData)
	};

	console.log(options.body);

	fetch(url, options)
		.then(response => response.json())
		.then(data => {
			// console.log(data);
			let success = 0;
			let fail = 0;
			const results = new Map(Object.entries(data.results));
			results.forEach((value, imageId) => {
				const image = document.getElementById(imageId);
				if (value === 'fail') {
					image.classList.add('renameFailed')
					fail++;
				} else {
					image.src = value;
					selectedImages.set(imageId, value)
					success++;
				}

			})

			if (success !== 0) {
				showPopup(`Renamed ${success} files`, 'info')
			}
			if (fail !== 0) {
				showPopup(`Failed ${fail} files`, 'error')
			}

			// TODO udpate image title and subtitle after rename
		})
		.catch(error => {
			showPopup(error, 'error');
			console.error(error);
		});
}

function selectAllImages() {
	const images = document.querySelectorAll('.resultFile');
	images.forEach(image => {
		const imageLinkRelative = decodeURIComponent(image.src.replace(origin, '').replace(/^\//, ''));
		const imageId = image.id;

		selectedImages.set(imageId, imageLinkRelative)
		image.classList.add('selectedImage');
	});
}

function deselectAllImages() {
	selectedImages.clear()
	const images = document.querySelectorAll('.selectedImage');
	images.forEach(image => {
		image.classList.remove('selectedImage');
	});
}

function moveFiles() {
	const targetFolder = document.getElementById('targetFolderName').value;
	// console.log(selectedImages);
	// console.log(targetFolderName.value);
	const pattern = /^[a-zA-Z0-9\\ ]*$/;
	const isValid = pattern.test(targetFolder);

	if (!isValid) {
		showPopup('Folder name contains disallowed characters', 'warn');
		return;
	}

	if (!targetFolder) {
		showPopup('Provide a target folder', 'warn');
		return;
	}

	if (selectedImages.size == 0) {
		showPopup('No files selected', 'warn');
		return;
	}

	if (!suggestedTargetFolders.includes(targetFolder)) {
		addSuggestedTargetFolder(targetFolder);
	}

	const url = '/moveFiles';
	const formData = {
		// have to convert map to an Object so it can be serialized into a JSON
		selectedImages: Object.fromEntries(selectedImages),
		targetFolder: targetFolder
	}

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
			let success = 0;
			let fail = 0;
			const results = new Map(Object.entries(data.results));
			results.forEach((value, imageId) => {
				const image = document.getElementById(imageId);
				if (value === 'fail') {
					// just adding red border so renameFailed is fine even tho we are moving not renaming
					image.classList.add('renameFailed')
					fail++;
				} else {
					image.src = value;
					selectedImages.set(imageId, value)
					success++;
				}
			})

			if (success !== 0) {
				showPopup(`Moved ${success} files`, 'info')
			}
			if (fail !== 0) {
				showPopup(`Failed to move ${fail} files`, 'error')
			}

			// TODO udpate image title and subtitle after rename
		})
		.catch(error => {
			showPopup(error, 'error');
			console.error(error);
		});
}

function addSuggestedTargetFolder(folder) {
	suggestedTargetFolders.push(folder);

	if (suggestedTargetFolders.length > 100) {
		suggestedTargetFolders.splice(0, suggestedTargetFolders.length - 100);
	}

	const datalist = document.getElementById('suggestedFolders');
	const option = document.createElement('option');
	option.value = folder;
	datalist.appendChild(option);

	localStorage.setItem('suggestedTargetFolders', JSON.stringify(suggestedTargetFolders));
}