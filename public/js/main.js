document.addEventListener("DOMContentLoaded", function () {

	// Add a click event listener to the random image
	const mainContent = document.querySelector('#mainContent');
	let randomImage = document.querySelector('#randomImage');
	const imageTitle = document.querySelector('#imageTitle');
	const subTitle = document.querySelector('#subTitle');
	const searchButton = document.querySelector('#searchButton');
	const searchText = document.querySelector('#searchText');
	const newFileName = document.querySelector('#newFileName');
	const renameButton = document.querySelector('#renameButton');
	const renameStatus = document.querySelector('#renameStatus');
	const refreshButton = document.querySelector('#refreshDB');
	// navigation
	const previousbtn = document.querySelector('#previousbtn');
	const randombtn = document.querySelector('#randombtn');
	const nextbtn = document.querySelector('#nextbtn');

	imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`
	subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

	// when server is sending only one string ie image path in response
	// randomImage.addEventListener('click', () => {
	// 	fetch('/random-image')
	// 		.then(response => response.text())
	// 		.then(imagePath => {
	// 			randomImage.src = imagePath;
	// 			imageTitle.textContent = imagePath.replace('\\images\\', '');
	// 			console.log("randomImage (current):" + randomImage.src);
	// 		});
	// });

	// server is sending an object json with various properties
	mainContent.addEventListener('click', showrandom);
	randombtn.addEventListener('click', showrandom);

	function showrandom() {
		fetch('/random-image')
			.then(response => response.json())
			.then(data => {
				imageTitle.textContent = data.filename;
				imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

				subTitle.textContent = data.directoryPath;
				subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

				let index = data.index;
				history.pushState(null, '', `/?index=${encodeURIComponent(index)}`); // updating the url with index of the file, this doesnt load anything only changes the url

				const filetype = data.filetype;
				console.log(filetype);
				if (filetype === 'video') {
					mainContent.innerHTML = `
				<video id="randomImage" src="${data.randomImagePath}" controls autoplay loop>
				  Your browser does not support the video tag.
				</video>
			  `;
					randomImage = document.querySelector('#randomImage');
				} else {
					mainContent.innerHTML = `
				<img id="randomImage" src="${data.randomImagePath}" alt="">
			  `;
					randomImage = document.querySelector('#randomImage');
				}
				// console.log('randomImage (current): ' + randomImage.src);
			});
	}




	// Create a new Hammer.js instance
	let mc = new Hammer(mainContent);

	// Detect horizontal swipes
	mc.on('swipeleft swiperight', (event) => {
		const currentImagePath = randomImage.src.replace(origin, ''); // this removes "http://localhost:3000" form src
		console.log("currentImagePath:" + currentImagePath);

		if (event.type === 'swipeleft') {
			fetch(`/next?currentImagePath=${currentImagePath}`)
				.then(response => response.json())
				.then(data => {
					imageTitle.textContent = data.filename;
					imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

					subTitle.textContent = data.directoryPath;
					subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

					let index = data.index;
					history.pushState(null, '', `/?index=${encodeURIComponent(index)}`);

					const filetype = data.filetype;
					console.log(filetype);
					if (filetype === 'video') {
						mainContent.innerHTML = `
				<video id="randomImage" src="${data.nextImagePath}" controls autoplay loop>
				  Your browser does not support the video tag.
				</video>
			  `;
						randomImage = document.querySelector('#randomImage');
					} else {
						mainContent.innerHTML = `
				<img id="randomImage" src="${data.nextImagePath}" alt="">
			  `;
						randomImage = document.querySelector('#randomImage');
					}
					// console.log('randomImage (current): ' + randomImage.src);
				});
		} else if (event.type === 'swiperight') {
			fetch(`/previous?currentImagePath=${currentImagePath}`)
				.then(response => response.json())
				.then(data => {
					imageTitle.textContent = data.filename;
					imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

					subTitle.textContent = data.directoryPath;
					subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

					let index = data.index;
					history.pushState(null, '', `/?index=${encodeURIComponent(index)}`);

					const filetype = data.filetype;
					console.log(filetype);
					if (filetype === 'video') {
						mainContent.innerHTML = `
				<video id="randomImage" src="${data.previousImagePath}" controls autoplay loop>
				  Your browser does not support the video tag.
				</video>
			  `;
						randomImage = document.querySelector('#randomImage');
					} else {
						mainContent.innerHTML = `
				<img id="randomImage" src="${data.previousImagePath}" alt="">
			  `;
						randomImage = document.querySelector('#randomImage');
					}
					// console.log('randomImage (current): ' + randomImage.src);
				});
		}
	});

	previousbtn.addEventListener('click', showprevious);
	nextbtn.addEventListener('click', shownext);

	function shownext() {
		const currentImagePath = randomImage.src.replace(origin, ''); // this removes "http://localhost:3000" form src
		fetch(`/next?currentImagePath=${currentImagePath}`)
			.then(response => response.json())
			.then(data => {
				imageTitle.textContent = data.filename;
				imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

				subTitle.textContent = data.directoryPath;
				subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

				let index = data.index;
				history.pushState(null, '', `/?index=${encodeURIComponent(index)}`);

				const filetype = data.filetype;
				console.log(filetype);
				if (filetype === 'video') {
					mainContent.innerHTML = `
				<video id="randomImage" src="${data.nextImagePath}" controls autoplay loop>
				  Your browser does not support the video tag.
				</video>
			  `;
					randomImage = document.querySelector('#randomImage');
				} else {
					mainContent.innerHTML = `
				<img id="randomImage" src="${data.nextImagePath}" alt="">
			  `;
					randomImage = document.querySelector('#randomImage');
				}
				// console.log('randomImage (current): ' + randomImage.src);
			});
	}

	function showprevious() {
		const currentImagePath = randomImage.src.replace(origin, ''); // this removes "http://localhost:3000" form src
		fetch(`/previous?currentImagePath=${currentImagePath}`)
			.then(response => response.json())
			.then(data => {
				imageTitle.textContent = data.filename;
				imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

				subTitle.textContent = data.directoryPath;
				subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

				let index = data.index;
				history.pushState(null, '', `/?index=${encodeURIComponent(index)}`);

				const filetype = data.filetype;
				console.log(filetype);
				if (filetype === 'video') {
					mainContent.innerHTML = `
				<video id="randomImage" src="${data.previousImagePath}" controls autoplay loop>
				  Your browser does not support the video tag.
				</video>
			  `;
					randomImage = document.querySelector('#randomImage');
				} else {
					mainContent.innerHTML = `
				<img id="randomImage" src="${data.previousImagePath}" alt="">
			  `;
					randomImage = document.querySelector('#randomImage');
				}
				// console.log('randomImage (current): ' + randomImage.src);
			});
	}

	function showLastFromHistory() {
		window.history.back();
		setTimeout(function () {
			location.reload();
		}, 50);
	}


	document.addEventListener('keydown', function (event) {
		const focusedElement = document.activeElement;
		if (focusedElement.nodeName === 'INPUT') {
			// console.log('Currently focused element is an input field');
			return
		} else {
			if (event.key === 'ArrowLeft') {
				showprevious();
			} else if (event.key === 'ArrowRight') {
				shownext();
			} else if (event.key === 'ArrowDown') {
				showrandom();
			} else if (event.key === 'ArrowUp') {
				showLastFromHistory();
			}
		}
	});


	// Disable vertical swipes
	// mc.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });

	renameButton.addEventListener('click', () => {
		const currentFilePath = randomImage.src.replace(origin, '');
		const newName = newFileName.value.trim();

		// clears the rename status automatically after 3 sec, this is non blocking code
		setTimeout(() => {
			renameStatus.textContent = '';
		}, 3000);

		if (!newName) {
			renameStatus.textContent = '🤔';
			return;
		}

		const pattern = /^[^<>:"\/\\|?*]+$/g;
		if (!pattern.test(newName)) {
			renameStatus.textContent = '😠';
			return;
		}

		console.log("currentFilePath: " + currentFilePath);
		console.log("newName: " + newName);

		fetch(`/rename?currentFilePath=${currentFilePath}&newFileName=${newName}`)
			.then(response => {
				if (response.ok) {
					return response.json(); // Parse the response as JSON
				} else if (response.status === 404) {
					throw new Error('File not found');
				} else if (response.status === 500) {
					renameStatus.textContent = '🤯';
					throw new Error('Internal server error');
				} else if (response.status === 400) {
					renameStatus.textContent = '😵';
					throw new Error('Bad request');
				} else {
					throw new Error('Error renaming file');
				}
			})
			.then(data => {
				// Update the renameStatus element with the new file name
				// renameStatus.textContent = `✅ ${data.newFilePath}`;
				renameStatus.textContent = '😋';
				console.log("File renamed successfully");
			})
			.catch(error => {
				console.error(error);
			});

	});

	refreshButton.addEventListener('click', () => {
		fetch('/refreshDB')
			.then(response => {
				if (response.ok) {
					console.log('Database refreshed successfully');
					// location.reload(); // reload the page after the database is refreshed
					location = '/';
				} else {
					throw new Error('Error refreshing database');
				}
			})
			.catch(error => {
				console.error(error);
			});
	});

	// SEARCH
	searchButton.addEventListener('click', search);
	searchText.addEventListener('keyup', function (event) {
		if (event.key === 'Enter') {
			search();
		}
	});

	const similarButton = document.getElementById('similarButton');
	similarButton.addEventListener('click', () => {
		var searchText = imageTitle.textContent; // using current image name to search similar images
		searchText = searchText.replace(/\.[^/.]+$/, ""); // remove file extension (e.g. ".jpg")
		searchText = searchText.replace(/\d+$/, ""); // remove any trailing numbers
		searchText = searchText.replace(/\(\d*\)|\d+$/g, "");
		searchText = searchText.trim();

		if (searchText !== '') {
			// window.location.href = `/search?searchText=${searchText}`; // opens in same window

			const searchUrl = `/search?searchText=${encodeURIComponent(searchText)}`;
			window.open(searchUrl, '_blank');
		}
	});

	document.addEventListener('keydown', function (event) {
		if (event.key === 'f') {
			hideNavigation()
		}
	});
});

function hideNavigation() {
	const focusedElement = document.activeElement;
	const bottomContainer = document.getElementById('bottomContainer');
	const mainContent = document.getElementById('mainContent');
	const fullscreenButton = document.getElementById('fullscreenButton');

	if (focusedElement.nodeName === 'INPUT') {
		// console.log('Currently focused element is an input field');
		return
	} else {
		console.log('Currently focused element is not an input field');
		if (document.fullscreenElement) {
			console.log('In fullscreen');
			bottomContainer.style.display = 'flex';
			mainContent.style.height = 'calc(100vh - 110px)';
			fullscreenButton.innerText = '🢅'
			document.exitFullscreen();
		} else {
			console.log('Not in fullscreen');
			bottomContainer.style.display = 'none';
			mainContent.style.height = 'calc(100vh - 10px)';
			fullscreenButton.innerText = '🢇'
			document.documentElement.requestFullscreen();
		}
	}
}

function search() {
	const searchText = document.querySelector('#searchText').value;
	if (searchText.trim() !== '') {
		// window.location.href = `/search?searchText=${searchText}`; // opens in same window
		const searchUrl = `/search?searchText=${encodeURIComponent(searchText)}`;
		window.open(searchUrl, '_blank');
	}
}

function searchShuffled() {
	const searchText = document.querySelector('#searchText').value;
	if (searchText.trim() !== '') {
		// window.location.href = `/search?searchText=${searchText}`; // opens in same window
		const searchUrl = `/search?searchText=${encodeURIComponent(searchText)}&shuffle=true`;
		window.open(searchUrl, '_blank');
	}
}