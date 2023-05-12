document.addEventListener("DOMContentLoaded", function () {

	dragToScrollEnable();

	const videos = document.querySelectorAll('.searchVid');
	let centerVideo = null

	const observer = new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
				centerVideo = entry.target;
			}
		});
	}, { threshold: 0.5 });

	videos.forEach((video) => {
		observer.observe(video);

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
	});

	window.addEventListener('scroll', () => {
		const windowHeight = window.innerHeight;
		const center = windowHeight / 2;

		videos.forEach(video => {
			const rect = video.getBoundingClientRect();
			const videoTop = rect.top;
			const videoBottom = rect.bottom;
			const videoHeight = rect.height;

			if (videoTop < center && videoBottom > center && videoHeight < windowHeight) {
				centerVideo = video;
			}
		});

		if (centerVideo && centerVideo.paused) {
			centerVideo.play();
		}
	});

	function stopMainScroll() {
		// check if screen layout is landscape
		if (window.matchMedia("(orientation: landscape)").matches) {
			window.addEventListener('wheel', preventDefault, { passive: false });
		}
	}

	function allowMainScroll() {
		window.removeEventListener('wheel', preventDefault);
	}

	function preventDefault(e) {
		e.preventDefault();
	}

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

});

function goFullscreen() {
	const toggleButton = document.getElementById('fullscreenButton');

	const header = document.querySelector('.header');
	const pageButtons = document.querySelector('.pageButtons');

	if (header.style.display === 'none') {
		toggleButton.innerText = '🢅'
		header.style.display = 'flex';

		if (pageButtons) {
			pageButtons.style.display = 'block';
		}

		document.exitFullscreen();

	} else {
		toggleButton.innerText = '🢇'
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