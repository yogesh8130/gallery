document.addEventListener("DOMContentLoaded", function () {

	// if (!document.querySelector('div.pagination')) {
	// 	document.querySelectorAll('img, video').forEach((el) => {
	// 		el.style.maxHeight = '99vh';
	// 	});
	// }

	// const imageTitle = document.querySelector('#imageTitle');
	// const subTitle = document.querySelector('#subTitle');

	// imageTitle.href = `/search?searchText=${encodeURIComponent(imageTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`
	// subTitle.href = `/search?searchText=${encodeURIComponent(subTitle.textContent.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim())}`

	const videos = document.querySelectorAll('.searchvid');
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
		showHideHeadingDiv()
	}
});

document.addEventListener('keydown', function (event) {
	if (event.key === 'f' || event.key === 'F') {
		showHideHeadingDiv()
	}
});


function showHideHeadingDiv() {
	const toggleButton = document.getElementById('showHideHeadingBtn');

	const headingDiv = document.querySelector('.headingDiv');
	const pageButtons = document.querySelector('.pageButtons');
	const results = document.querySelector('.results');

	// const resultfiles = document.querySelectorAll('.resultfile');


	if (headingDiv.style.display === 'none') {
		toggleButton.innerText = '🢅'
		headingDiv.style.display = 'block';

		if (pageButtons) {
			pageButtons.style.display = 'block';
		}

		// resultfiles.forEach(element => {
		// 	element.style.maxHeight = 'calc(99vh - 125px)';
		// });
		document.exitFullscreen();

		results.classList.add('scrollbarVisible');
		results.classList.remove('scrollbarHidden');
	} else {
		toggleButton.innerText = '🢇'
		headingDiv.style.display = 'none';

		if (pageButtons) {
			pageButtons.style.display = 'none';
		}

		// resultfiles.forEach(element => {
		// 	element.style.maxHeight = 'calc(100vh - 15px)';
		// });
		document.documentElement.requestFullscreen();

		results.classList.add('scrollbarHidden');
		results.classList.remove('scrollbarVisible');
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
		// if (headingDiv.style.display === 'none') {
		// 	image.style.maxHeight = 'calc(100vh - 4px)'
		// } else {
		// 	image.style.maxHeight = 'calc(99vh - 120px)'
		// }
	}
}