window.addEventListener('load', () => {
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
		} else if (video.webkitRequestFullscreen) { /* Safari */
		  video.webkitRequestFullscreen();
		} else if (video.msRequestFullscreen) { /* IE11 */
		  video.msRequestFullscreen();
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
  