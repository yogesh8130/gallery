function refreshDB() {

	const refreshDBButton = document.getElementById('refreshDBButton');
	refreshDBButton.classList.add('processing');
	const refreshDBResponse = document.getElementById('refreshDBResponse');
	refreshDBResponse.innerText = 'Processing...';

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
				return response.text();
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
		.then(data => {
			refreshDBResponse.innerText = data;
		})
		.catch(error => {
			console.error(error);
		});
}

function pruneDB() {
	const pruneDBButton = document.getElementById('pruneDBButton');
	const pruneDBResponse = document.getElementById('pruneDBResponse');
	pruneDBButton.classList.add('processing');
	pruneDBResponse.innerText = 'Processing...';

	fetch('/pruneDB')
		.then(response => {
			if (response.ok) {
				// console.log(`Database pruned successfully: ${response.body}`);
				pruneDBButton.classList.add('success');
				pruneDBButton.classList.remove('processing');
				pruneDBButton.classList.remove('default');
				setTimeout(() => {
					pruneDBButton.classList.remove('success');
					pruneDBButton.classList.add('default');
				}, 3000);
				return response.text();
			} else {
				pruneDBButton.classList.add('error');
				pruneDBButton.classList.remove('default');
				pruneDBButton.classList.remove('processing');
				setTimeout(() => {
					pruneDBButton.classList.remove('error');
					pruneDBButton.classList.add('default');
				}, 3000);
				throw new Error('Error pruning database');
			}
		})
		.then(data => {
			// console.log(data);
			pruneDBResponse.innerText = data;
		})
		.catch(error => {
			console.error(error);
		});
}