document.addEventListener("DOMContentLoaded", function () {

	// check if already in shuffle mode

	const shuffleCheckbox = document.getElementById("shuffle");
	const currentUrl = window.location.href;
	const pagination = document.querySelector('.pagination');

	if (currentUrl.includes("&shuffle=true")) {
		shuffleCheckbox.checked = true;
		pagination.style.display = 'none';
	}

	// if (!document.querySelector('div.pagination')) {
	// 	document.querySelectorAll('img, video').forEach((el) => {
	// 		el.style.maxHeight = '99vh';
	// 	});
	// }

	// const imageTitle = document.querySelector('#imageTitle');
	// const subTitle = document.querySelector('#subTitle');

	// imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`
	// subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

	const videos = document.querySelectorAll('.searchVid');
	let centerVideo = null;

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
	if (event.altKey && event.code === 'Enter') {
		goFullscreen()
	}
});

document.addEventListener('keydown', function (event) {
	if (event.key === 'f') {
		goFullscreen()
	}
});

document.addEventListener('keydown', function (event) {
	if (event.key === '1') {
		showAllImagesAtActualSize();
	}
});
document.addEventListener('keydown', function (event) {
	if (event.key === '2') {
		showAllImagesStreched();
	}
});
document.addEventListener('keydown', function (event) {
	if (event.key === '3') {
		showAllImagesAtDefaultScale();
	}
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
		image.style.maxHeight = '100%'
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
		resultFile.style.minHeight = '100%';
		resultFile.style.maxHeight = '100%';
	});
}
function showAllImagesAtDefaultScale() {
	let resultFiles = document.querySelectorAll('.resultFile');
	// console.log(resultFiles.length);
	resultFiles.forEach(resultFile => {
		resultFile.style.minHeight = '75%';
		resultFile.style.maxHeight = '100%';
	});
}

function shuffle() {
	let shuffleCheckbox = document.getElementById('shuffle');
	const currentUrl = window.location.href;

	if (shuffleCheckbox.checked) {
		const newUrl = `${currentUrl}&shuffle=true`;
		window.location.href = newUrl;
	} else {
		const newUrl = currentUrl.replace("&shuffle=true", "");
		window.location.href = newUrl;
	}
}