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

	const searchImgElements = document.querySelectorAll('.searchimg');
	const searchVidElements = document.querySelectorAll('.searchvid');
	
	
	if (headingDiv.style.display === 'none') {
		toggleButton.innerText = '🢅'
		headingDiv.style.display = 'block';
		pageButtons.style.display = 'block';
		results.classList.add('scrollbarVisible');
		results.classList.remove('scrollbarHidden');
		
		searchImgElements.forEach(element => {
			element.style.maxHeight = 'calc(99vh - 120px)';
		});
		searchVidElements.forEach(element => {
			element.style.maxHeight = 'calc(99vh - 120px)';
		});
		document.exitFullscreen();
	} else {
		toggleButton.innerText = '🢇'
		headingDiv.style.display = 'none';
		pageButtons.style.display = 'none';
		results.classList.add('scrollbarHidden');
		results.classList.remove('scrollbarVisible');
		
		searchImgElements.forEach(element => {
			element.style.maxHeight = '100vh';
		});
		searchVidElements.forEach(element => {
			element.style.maxHeight = '100vh';
		});
		document.documentElement.requestFullscreen();
		mainHorizontalScrollbar.style.display = 'none';
	}
}