window.addEventListener('load', () => {

	// Add a click event listener to the random image
	const randomImage = document.querySelector('#randomImage');
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
	randomImage.addEventListener('click', showrandom);
	randombtn.addEventListener('click', showrandom);
	function showrandom() {
		fetch('/random-image')
			.then(response => response.json()) // Expect JSON response
			.then(data => {
				imageTitle.textContent = data.filename; // Access filename from the JSON object
				subTitle.textContent = data.directoryPath; // Access directoryName from the JSON object
				randomImage.src = data.randomImagePath; // Access randomImagePath from the JSON object
				console.log("randomImage (current):" + randomImage.src);
			});
	}


	// Create a new Hammer.js instance
	const mc = new Hammer(randomImage);

	// Detect horizontal swipes
	mc.on('swipeleft swiperight', (event) => {
		const currentImagePath = randomImage.src.replace(origin, ''); // this removes "http://localhost:3000" form src
		console.log("currentImagePath:" + currentImagePath);

		if (event.type === 'swipeleft') {
			fetch(`/next?currentImagePath=${currentImagePath}`)
				.then(response => response.json())
				.then(data => {
					imageTitle.textContent = data.filename; // Access filename from the JSON object
					subTitle.textContent = data.directoryPath; // Access directoryName from the JSON object
					randomImage.src = data.nextImagePath;
				});
		} else if (event.type === 'swiperight') {
			fetch(`/previous?currentImagePath=${currentImagePath}`)
				.then(response => response.json())
				.then(data => {
					imageTitle.textContent = data.filename; // Access filename from the JSON object
					subTitle.textContent = data.directoryPath; // Access directoryName from the JSON object
					randomImage.src = data.previousImagePath;
				});
		}
	});

	previousbtn.addEventListener('click', showprevious);
	nextbtn.addEventListener('click', shownext);

	function showprevious() {
		const currentImagePath = randomImage.src.replace(origin, ''); // this removes "http://localhost:3000" form src
		fetch(`/next?currentImagePath=${currentImagePath}`)
			.then(response => response.json())
			.then(data => {
				imageTitle.textContent = data.filename; // Access filename from the JSON object
				subTitle.textContent = data.directoryPath; // Access directoryName from the JSON object
				randomImage.src = data.nextImagePath;
			});
	}

	function shownext() {
		const currentImagePath = randomImage.src.replace(origin, ''); // this removes "http://localhost:3000" form src
		fetch(`/previous?currentImagePath=${currentImagePath}`)
			.then(response => response.json())
			.then(data => {
				imageTitle.textContent = data.filename; // Access filename from the JSON object
				subTitle.textContent = data.directoryPath; // Access directoryName from the JSON object
				randomImage.src = data.previousImagePath;
			});
	}

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
					location.reload(); // reload the page after the database is refreshed
				} else {
					throw new Error('Error refreshing database');
				}
			})
			.catch(error => {
				console.error(error);
			});
	});

	// SEARCH
	searchButton.addEventListener('click', () => {
		const searchText = document.querySelector('#searchText').value;
		if (searchText.trim() !== '') {
			// window.location.href = `/search?searchText=${searchText}`; // opens in same window

			const searchUrl = `/search?searchText=${encodeURIComponent(searchText)}`;
			window.open(searchUrl, '_blank');
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

			const searchUrl = `/search?searchText=${searchText}`;
			window.open(searchUrl, '_blank');
		}
	});


});