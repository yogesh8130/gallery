const express = require('express');
const path = require('path');
const fs = require('fs');

// for reading image and video metadata
// const sharp = require('sharp');
// const ffprobe = require('ffprobe');
// const ffprobeStatic = require('ffprobe-static');
const { readMediaAttributes } = require('leather'); // much smaller
const { log, error } = require('console');

const app = express();
const port = 3000;

const pwd = process.cwd();
const searchResultBatchSize = 50;

// Middleware to parse JSON data in post requests
app.use(express.json());

// Serve the static files in the public folder
app.use(express.static('public'));

// Specify the custom views directory
app.set('views', './views');

// Set the view engine to use Pug
app.set('view engine', 'pug');

// Define the path to the root image folder
const imagePath = "./public/images";

// Create an array to store all image paths recursively
let imagePaths = [];

const videoExtensions = ['.mp4', '.webm', '.mkv'];
const imageExtensions = ['.jpeg', '.jpg', '.png', '.webp', '.gif']
const allowedExtensions = [...videoExtensions, ...imageExtensions];

console.log('Loading files...');
// Function to read image files recursively and populate the imagePaths array
const readImageFiles = async (directory, depth = 0, maxDepth = 20) => {
	const files = await fs.promises.readdir(directory);
	const subDirectories = [];

	await Promise.all(
		files.map(async (file) => {
			const fullPath = path.join(directory, file);
			const stat = await fs.promises.stat(fullPath);

			if (stat.isDirectory()) {
				if (depth < maxDepth) {
					subDirectories.push(fullPath);
				}
			} else {
				const ext = path.extname(fullPath).toLowerCase();
				if (allowedExtensions.includes(ext)) {
					imagePaths.push(fullPath.replace(/^public/, ''));
				}
			}
		})
	);

	await Promise.all(
		subDirectories.map(async (subDirectory) => {
			await readImageFiles(subDirectory, depth + 1, maxDepth);
		})
	);
};

// Capture the start time
const startTime = Date.now();

// Wrap the call to readImageFiles in an async function
(async () => {
	await readImageFiles(imagePath);

	imagePaths.sort();

	// Capture the end time
	const endTime = Date.now();

	// Log the time it took to load the files in seconds
	console.log(`Loaded ${imagePaths.length} files in ${(endTime - startTime) / 1000} seconds.`);
})();

function shuffle(array) {
	let currentIndex = array.length, randomIndex;

	// While there remain elements to shuffle.
	while (currentIndex != 0) {

		// Pick a remaining element.
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
	}

	return array;
}

app.get('/refreshDB', (req, res) => {
	try {
		imagePaths = [];

		// Capture the start time
		const startTime = Date.now();

		(async () => {
			await readImageFiles(imagePath);

			imagePaths.sort();

			// Capture the end time
			const endTime = Date.now();

			// Log the time it took to load the files in seconds
			console.log(`Loaded ${imagePaths.length} files in ${(endTime - startTime) / 1000} seconds.`);
			res.sendStatus(200); // send a success response to the client
		})();

	} catch (error) {
		console.error(error);
		res.status(500).send('Error refreshing database'); // send an error response to the client
	}
});

// Define a route to handle requests for the main page
app.get('/', (req, res) => {
	res.redirect('/search?searchText=.&shuffle=true&view=tiles');
})

app.get('/singleView', (req, res) => {
	let requestedIndex = req.query.index;
	let imageBackLink = req.query.imageBackLink;

	let randomIndex;
	let imagePath;

	if (requestedIndex) {
		console.log("requestedIndex: " + requestedIndex);
		randomIndex = requestedIndex;
		imagePath = imagePaths[randomIndex];
	} else if (imageBackLink) {
		console.log("imageBackLink: " + imageBackLink);
		imagePath = imageBackLink;
	} else {
		// Select a random image from the array of image paths
		randomIndex = Math.floor(Math.random() * imagePaths.length);
		imagePath = imagePaths[randomIndex];
	}

	const imageName = path.basename(imagePath);
	const directoryPath = path.dirname(imagePath);

	// Create an object to store the data
	const data = {
		imagePath: imagePath,
		imageName: imageName,
		directoryPath: directoryPath,
		index: randomIndex
	};

	// Detect screen orientation and render the appropriate page
	const isPortrait = req.header('User-Agent').includes('Mobile');

	if (isPortrait) {
		res.render('portrait-index', data);
	} else {
		res.render('landscape-index', data);
	}
});

// Define a route to handle requests for a random image
app.get('/random-image', (req, res) => {
	const randomIndex = Math.floor(Math.random() * imagePaths.length);
	const randomImagePath = imagePaths[randomIndex];

	const filename = path.basename(randomImagePath);
	const directoryPath = path.dirname(randomImagePath);
	const extension = path.extname(randomImagePath).toLowerCase();
	let filetype = 'image';

	if (videoExtensions.includes(extension)) {
		filetype = 'video'
	}

	// console.log("extension: " + extension);
	// console.log("filetype: " + filetype);

	const responseData = {
		randomImagePath: randomImagePath,
		filename: filename,
		directoryPath: directoryPath,
		extension: extension,
		filetype: filetype,
		index: randomIndex
	};

	console.log("randomImagePath: " + randomImagePath);
	res.send(responseData);
});

// Define a route to handle requests for the next image
app.get('/next', (req, res) => {
	// client should remove 'origin' from the image url ie "http://localhost:3000"
	const currentImagePath = decodeURIComponent(req.query.currentImagePath
		.replace(/\//g, '\\'));
	const fromResults = req.query.fromResults;

	let imageList;
	if (fromResults && fromResults === 'true') {
		imageList = matchingImagePaths;
	} else {
		imageList = imagePaths;
	}

	// console.log("currentImagePath:" + currentImagePath);
	const currentIndex = imageList.indexOf(currentImagePath);
	// console.log('currentIndex: ' + currentIndex);

	const nextIndex = (currentIndex + 1) % imageList.length;
	const nextImagePath = imageList[nextIndex];

	const filename = path.basename(nextImagePath);
	const directoryPath = path.dirname(nextImagePath);
	const extension = path.extname(nextImagePath).toLowerCase();
	let filetype = 'image';

	if (videoExtensions.includes(extension)) {
		filetype = 'video'
	}

	const responseData = {
		nextImagePath: encodeURIComponent(nextImagePath),
		filename: filename,
		directoryPath: directoryPath,
		extension: extension,
		filetype: filetype,
		index: nextIndex
	};

	res.send(responseData);
});

// Define a route to handle requests for the previous image
app.get('/previous', (req, res) => {
	// client should remove 'origin' from the image url ie "http://localhost:3000"
	const currentImagePath = decodeURIComponent(req.query.currentImagePath
		.replace(/\//g, '\\'));
	const fromResults = req.query.fromResults;

	let imageList;
	if (fromResults && fromResults === 'true') {
		imageList = matchingImagePaths;
	} else {
		imageList = imagePaths;
	}

	const currentIndex = imageList.indexOf(currentImagePath);
	const previousIndex = (currentIndex - 1 + imageList.length) % imageList.length;
	const previousImagePath = imageList[previousIndex];

	const filename = path.basename(previousImagePath);
	const directoryPath = path.dirname(previousImagePath);
	const extension = path.extname(previousImagePath).toLowerCase();
	let filetype = 'image';

	if (videoExtensions.includes(extension)) {
		filetype = 'video'
	}

	const responseData = {
		previousImagePath: encodeURIComponent(previousImagePath),
		filename: filename,
		directoryPath: directoryPath,
		extension: extension,
		filetype: filetype,
		index: previousIndex
	};

	res.send(responseData);
});

// Define a route to handle file renaming
app.post('/rename', (req, res) => {
	const currentFilePath = path.resolve(path.join('.', 'public', decodeURIComponent(req.body.currentFilePath)));
	const newFileName = req.body.newFileName;

	const currentFilePathObj = path.parse(currentFilePath);
	let newFilePath = path.join(currentFilePathObj.dir, newFileName + currentFilePathObj.ext);
	// this allows having .. in new filename to goback directory levels
	newFilePath = path.normalize(newFilePath);

	// Check if new file's directory exists or not, and create if necessary
	fs.promises.access(path.dirname(newFilePath))
		.catch(() => {
			console.log("new file's directory not found, hence creating");
			return fs.promises.mkdir(path.dirname(newFilePath), { recursive: true });
		})
		.then(() => {
			// Check if a file with the new file name already exists
			return fs.promises.access(newFilePath);
		})
		.then(() => {
			// If the file already exists, send an error response
			const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
			fs.appendFile('./logs/rename.log', logMessage, (err) => {
				if (err) {
					console.error('Error writing to rename.log:', err);
				}
			});
			return res.status(400).json({
				message: 'A file with the same name already exists',
				level: 'error'
			});
		})
		.catch(() => {
			// Rename the file using the fs module
			return fs.promises.rename(currentFilePath, newFilePath)
				.then(() => {
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
					fs.appendFile('./logs/rename.log', logMessage, (err) => {
						if (err) {
							console.error('Error writing to rename.log:', err);
						}
					});
					return res.status(200).json({
						message: 'File renamed successfully',
						level: 'info'
					});
				})
				.catch((err) => {
					console.error(err);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail\n`;
					fs.appendFile('./logs/rename.log', logMessage, (err) => {
						if (err) {
							console.error('Error writing to rename.log:', err);
						}
					});
					return res.status(500).json({
						message: 'Error renaming file',
						level: 'error'
					});
				});
		});
});

let searchResults = new Map();

app.get('/search', async (req, res) => {
	let matchingImagePaths = [];
	let imageList = imagePaths;
	const view = req.query.view;
	const searchText = req.query.searchText;
	let shuffleFlag = false;

	if (req.query.shuffle
		&& (req.query.shuffle === 'true'
			|| req.query.shuffle === 'on')) {
		shuffleFlag = true;
	}

	if (searchText.includes('&&')
		|| searchText.includes('||')
		|| searchText.includes('!!')) {

		console.log('Wildcard search started');

		let splitIndexes = [];

		let splitIndex = searchText.indexOf('&&');
		while (splitIndex !== -1) {
			splitIndexes.push(splitIndex);
			splitIndex = searchText.indexOf('&&', splitIndex + 1);
		}
		splitIndex = searchText.indexOf('||');
		while (splitIndex !== -1) {
			splitIndexes.push(splitIndex);
			splitIndex = searchText.indexOf('||', splitIndex + 1);
		}
		splitIndex = searchText.indexOf('!!');
		while (splitIndex !== -1) {
			splitIndexes.push(splitIndex);
			splitIndex = searchText.indexOf('!!', splitIndex + 1);
		}

		splitIndexes = splitIndexes.sort((a, b) => a - b); // sort numerically
		// console.log("splitIndexes: " + splitIndexes);

		let searchTokens = [];
		let lastIndex = 0;
		for (let i = 0; i < splitIndexes.length; i++) {
			searchTokens.push(searchText.substr(lastIndex, splitIndexes[i] - lastIndex));
			lastIndex = splitIndexes[i];
		}
		searchTokens.push(searchText.substr(lastIndex));
		// console.log("searchTokens: " + searchTokens); // apple pie ,|| banana ,&& orange ,!! peach ,&& cherry

		let andTokens = [];
		let orTokens = [];
		let notTokens = [];

		searchTokens.forEach(searchToken => {
			if (searchToken.startsWith('&&')) {
				andTokens.push(searchToken.replace('&&', '').trim());
			} else if (searchToken.startsWith('||')) {
				orTokens.push(searchToken.replace('||', '').trim());
			} else if (searchToken.startsWith('!!')) {
				notTokens.push(searchToken.replace('!!', '').trim());
			} else {
				andTokens.push(searchToken.trim());
			}
		});

		// console.log("Processing AND tokens");
		imageList.forEach(imagePath => {
			let containsAll = andTokens.every(andToken => imagePath.toLowerCase().includes(andToken.toLowerCase()));
			if (containsAll) {
				matchingImagePaths.push(imagePath);
			}
		});

		// console.log("Processing OR tokens");
		imageList.forEach(imagePath => {
			let containsSome = orTokens.some(orToken => imagePath.toLowerCase().includes(orToken.toLowerCase()));
			if (containsSome) {
				matchingImagePaths.push(imagePath);
			}
		});

		// console.log("Processing NOT tokens");
		for (let i = matchingImagePaths.length - 1; i >= 0; i--) {
			let matchingPath = matchingImagePaths[i];
			let containsAny = notTokens.some(notToken => matchingPath.toLowerCase().includes(notToken.toLowerCase()));
			if (containsAny) {
				matchingImagePaths.splice(i, 1);
			}
		}

	} else if (searchText.startsWith('//')) {
		let pattern = searchText.slice(1); // remove the leading forward slash
		console.log("pattern: " + pattern);
		let regex = new RegExp(pattern, 'i'); // create a case-insensitive regular expression
		matchingImagePaths = imageList.filter((imagePath) => regex.test(imagePath));
	} else {
		matchingImagePaths = imageList.filter((imagePath) =>
			imagePath.toLowerCase().includes(searchText.toLowerCase().trim()));
	}

	if (shuffleFlag) {
		shuffle(matchingImagePaths);
	}

	// adding results to Search results map to search faster next time
	// and also preserve the imagelist when lazy loading shuffled results
	const searchKey = searchText + ':::' + shuffleFlag;
	searchResults.set(searchKey, matchingImagePaths);

	const totalResultCount = matchingImagePaths.length;
	const page = req.query.page || 1;
	const perPage = searchResultBatchSize;
	const startIndex = (page - 1) * perPage;
	const endIndex = startIndex + perPage;

	const pageImagePaths = matchingImagePaths.slice(startIndex, endIndex);
	// const pageImageIndexes = matchingImageIndexes.slice(startIndex, endIndex);

	console.log('getting image metadata');
	let images;
	try {
		images = await getImagesMetadata(pageImagePaths);
		// console.log(images);
	} catch (error) {
		console.error(`Error testing getImagesMetadata: ${error}`);
	}

	const totalPages = Math.ceil(matchingImagePaths.length / perPage);

	console.log('rendering search results');

	res.render('searchResults', {
		searchText,
		totalResultCount,
		images,
		// matchingImageIndexes: pageImageIndexes,
		page,
		totalPages,
		shuffle: shuffleFlag,
		view
	});
});

app.get('/getNextResults', async (req, res) => {
	const searchText = req.query.searchText;
	let shuffleFlag = false;
	if (req.query.shuffle
		&& (req.query.shuffle === 'true'
			|| req.query.shuffle === 'on')) {
		shuffleFlag = true;
	}

	const searchKey = searchText + ':::' + shuffleFlag;

	let matchingImagePaths;
	if (searchResults.has(searchKey)) {
		matchingImagePaths = searchResults.get(searchKey);
	} else {
		console.error('searchKey not found in searchResults');
		return res.status(404).json({
			message: 'This has not been searched before'
		});
	}

	const totalResultCount = matchingImagePaths.length;
	if (totalResultCount <= searchResultBatchSize) {
		return res.status(404).json({
			message: 'No more results'
		});
	}

	const page = req.query.page || 1;
	const perPage = searchResultBatchSize;
	const startIndex = (page - 1) * perPage;
	const endIndex = startIndex + perPage;
	const pageImagePaths = matchingImagePaths.slice(startIndex, endIndex);

	console.log('getting image metadata');
	let images;
	try {
		images = await getImagesMetadata(pageImagePaths);
		// console.log(images);
	} catch (error) {
		console.error(`Error testing getImagesMetadata: ${error}`);
	}

	const totalPages = Math.ceil(matchingImagePaths.length / perPage);

	const responseData = {
		totalResultCount,
		images,
		page,
		totalPages,
	};

	res.send(responseData);
})

app.get('/config', async (req, res) => {
	res.render('config');
})

function getImageMetadata(imagePath) {
	// console.log(`Getting metadata for ${imagePath}`);
	// get basename, path, width, height, type (image/video) for an image or video
	const absolutePath = path.join(pwd, "public", imagePath)
	const baseName = path.basename(imagePath);
	const directory = path.dirname(imagePath);
	const extension = path.extname(imagePath);
	const isVideo = videoExtensions.includes(extension.toLowerCase());
	const isImage = imageExtensions.includes(extension.toLowerCase());

	if (!isVideo && !isImage) {
		throw new Error(`Unsupported file format: ${extension}`);
	}

	try {
		// console.log(absolutePath);
		const fileAttrs = readMediaAttributes(absolutePath);
		// console.log(fileAttrs);
		if (!fileAttrs.mime) {
			console.warn('Possible issues reading the file attributes for: ', absolutePath)
		}
		return {
			baseName,
			path: imagePath,
			directory,
			width: fileAttrs.width || 400,
			height: fileAttrs.height || 300,
			size: fileAttrs.size,
			mime: fileAttrs.mime,
			type: isImage ? 'image' : 'video',
		}
	} catch (error) {
		console.error(`Error getting metadata for the file (${imagePath}): ${error}`);
	}

}

async function getImagesMetadata(imagePaths) {
	try {
		// takes an array of image/video paths and returns array of image objects by calling getImageMetadata for each file
		const promises = imagePaths.map(imagePath => getImageMetadata(imagePath));
		return Promise.all(promises);
	} catch (error) {
		console.error(`Error getting metadata: ${error}`);
	}
}

// Start the server
app.listen(port, () => console.log(`Server listening on port ${port}`));
