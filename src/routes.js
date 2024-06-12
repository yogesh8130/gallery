// routes.js
const PATH = require('path');
const FS = require('fs');
const PWD = process.cwd();

const {
	initializeImagesMetadata,
	getImagesMetadata,
	sortByName,
	sortBySize,
	sortByModifiedTime,
	sortByDimensions,
	renameKey,
	shuffle
} = require('./fileUtils');

const {
	VIDEO_EXTENSIONS,
} = require('./constants');

const searchResultBatchSize = 50;

module.exports = function (router, IMAGE_PATHS, METADATA_MAP, SEARCH_RESULTS) {

	// Define a route to handle requests for the home page
	router.get('/', (req, res) => {
		res.redirect('/search?searchText=.&shuffle=true&view=tiles');
	})

	router.get('/refreshDB', (req, res) => {
		try {
			IMAGE_PATHS = [];

			// Capture the start time
			const startTime = Date.now();

			(async () => {
				await readImageFiles(imagePath);

				IMAGE_PATHS.sort();

				// Capture the end time
				const endTime = Date.now();

				// Log the time it took to load the files in seconds
				console.log(`Loaded ${IMAGE_PATHS.length} files in ${(endTime - startTime) / 1000} seconds.`);
				res.sendStatus(200); // send a success response to the client
			})();

		} catch (error) {
			console.error(error);
			res.status(500).send('Error refreshing database'); // send an error response to the client
		}
	});

	router.get('/singleView', (req, res) => {
		let requestedIndex = req.query.index;
		let imageBackLink = req.query.imageBackLink;

		let randomIndex;
		let imagePath;

		if (requestedIndex) {
			console.log("requestedIndex: " + requestedIndex);
			randomIndex = requestedIndex;
			imagePath = IMAGE_PATHS[randomIndex];
		} else if (imageBackLink) {
			console.log("imageBackLink: " + imageBackLink);
			imagePath = imageBackLink;
		} else {
			// Select a random image from the array of image paths
			randomIndex = Math.floor(Math.random() * IMAGE_PATHS.length);
			imagePath = IMAGE_PATHS[randomIndex];
		}

		const imageName = PATH.basename(imagePath);
		const directoryPath = PATH.dirname(imagePath);

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
	router.get('/random-image', (req, res) => {
		const randomIndex = Math.floor(Math.random() * IMAGE_PATHS.length);
		const randomImagePath = IMAGE_PATHS[randomIndex];

		const filename = PATH.basename(randomImagePath);
		const directoryPath = PATH.dirname(randomImagePath);
		const extension = PATH.extname(randomImagePath).toLowerCase();
		let filetype = 'image';

		if (VIDEO_EXTENSIONS.includes(extension)) {
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
	router.get('/next', (req, res) => {
		// client should remove 'origin' from the image url ie "http://localhost:3000"
		const currentImagePath = decodeURIComponent(req.query.currentImagePath
			.replace(/\//g, '\\'));
		const fromResults = req.query.fromResults;
		const searchText = req.query.searchText;
		let shuffleFlag = false;
		if (req.query.shuffle
			&& (req.query.shuffle === 'true'
				|| req.query.shuffle === 'on')) {
			shuffleFlag = true;
		}
		const searchKey = searchText + ':::' + shuffleFlag;

		let imageList;
		if (fromResults && fromResults === 'true') {
			if (SEARCH_RESULTS.has(searchKey)) {
				imageList = SEARCH_RESULTS.get(searchKey);
			} else {
				console.error('searchKey not found in SEARCH_RESULTS');
				return res.status(404).json({
					message: 'This has not been searched before'
				});
			}
		} else {
			imageList = IMAGE_PATHS;
		}

		// console.log("currentImagePath:" + currentImagePath);
		const currentIndex = imageList.indexOf(currentImagePath);
		// console.log('currentIndex: ' + currentIndex);

		const nextIndex = (currentIndex + 1) % imageList.length;
		const nextImagePath = imageList[nextIndex];

		const filename = PATH.basename(nextImagePath);
		const directoryPath = PATH.dirname(nextImagePath);
		const extension = PATH.extname(nextImagePath).toLowerCase();
		let filetype = 'image';

		if (VIDEO_EXTENSIONS.includes(extension)) {
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
	router.get('/previous', (req, res) => {
		// client should remove 'origin' from the image url ie "http://localhost:3000"
		const currentImagePath = decodeURIComponent(req.query.currentImagePath
			.replace(/\//g, '\\'));
		const fromResults = req.query.fromResults;
		const searchText = req.query.searchText;
		let shuffleFlag = false;
		if (req.query.shuffle
			&& (req.query.shuffle === 'true'
				|| req.query.shuffle === 'on')) {
			shuffleFlag = true;
		}
		const searchKey = searchText + ':::' + shuffleFlag;

		let imageList;
		if (fromResults && fromResults === 'true') {
			if (SEARCH_RESULTS.has(searchKey)) {
				imageList = SEARCH_RESULTS.get(searchKey);
			} else {
				console.error('searchKey not found in SEARCH_RESULTS');
				return res.status(404).json({
					message: 'This has not been searched before'
				});
			}
		} else {
			imageList = IMAGE_PATHS;
		}

		const currentIndex = imageList.indexOf(currentImagePath);
		const previousIndex = (currentIndex - 1 + imageList.length) % imageList.length;
		const previousImagePath = imageList[previousIndex];

		const filename = PATH.basename(previousImagePath);
		const directoryPath = PATH.dirname(previousImagePath);
		const extension = PATH.extname(previousImagePath).toLowerCase();
		let filetype = 'image';

		if (VIDEO_EXTENSIONS.includes(extension)) {
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

	router.post('/deleteFile', (req, res) => {
		const currentFilePath = PATH.resolve(PATH.join('.', 'public', decodeURIComponent(req.body.currentFilePath)));

		const currentFilePathObj = PATH.parse(currentFilePath);

		let currentFileFolder = currentFilePathObj.dir;
		let currentFileName = currentFilePathObj.name;
		let currentFileExt = currentFilePathObj.ext;

		let newFilePath = PATH.join(currentFileFolder, currentFileName + "###deleted" + currentFileExt);

		// Rename the file using the fs module
		FS.renameSync(currentFilePath, newFilePath);

		// to find and replace in "DB"
		const currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');

		// removing from "DB"
		IMAGE_PATHS.splice(IMAGE_PATHS.indexOf(currentFilePathRelative), 1);

		const logMessage = `${new Date().toISOString()}|${currentFilePath}|###deleted|Success\n`;
		FS.appendFileSync('./logs/rename.log', logMessage);

		return res.status(200).json({
			message: 'File deleted successfully',
			level: 'info',
		});

	});

	// Define a route to handle file renaming
	router.post('/rename', (req, res) => {
		const currentFilePath = PATH.resolve(PATH.join('.', 'public', decodeURIComponent(req.body.currentFilePath)));
		const newFileName = req.body.newFileName;

		const currentFilePathObj = PATH.parse(currentFilePath);
		let newFilePath = PATH.join(currentFilePathObj.dir, newFileName + currentFilePathObj.ext);
		// this allows having .. in new filename to goback directory levels
		newFilePath = PATH.normalize(newFilePath);

		try {
			// Check if new file's directory exists or not, and create if necessary
			if (!FS.existsSync(PATH.dirname(newFilePath))) {
				console.log("new file's directory not found, hence creating");
				FS.mkdirSync(PATH.dirname(newFilePath), { recursive: true });
			}

			let index = 1;
			let indexWithPadding = index.toString().padStart(3, '0');
			let uniqueFileName = newFileName;

			// Check if a file with the new file name already exists
			while (FS.existsSync(newFilePath)) {
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				FS.appendFileSync('./logs/rename.log', logMessage);

				uniqueFileName = `${newFileName}-${indexWithPadding}`;
				newFilePath = PATH.join(currentFilePathObj.dir, uniqueFileName + currentFilePathObj.ext);
				newFilePath = PATH.normalize(newFilePath);
				index++;
				indexWithPadding = index.toString().padStart(3, '0');
			}

			// Rename the file using the fs module
			FS.renameSync(currentFilePath, newFilePath);

			// to find and replace in "DB"
			const currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
			const newFilePathRelative = newFilePath.replace(PWD + '\\public', '');

			// replacing in "DB"
			IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
			IMAGE_PATHS.sort();
			renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
			METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
			METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);

			const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
			FS.appendFileSync('./logs/rename.log', logMessage);

			newImageTitle = METADATA_MAP.get(newFilePathRelative).baseName;
			newSubTitle = METADATA_MAP.get(newFilePathRelative).directory;
			newImageTitleLink = '/search?searchText=' + encodeURIComponent(newImageTitle.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim()) + '&view=tiles';
			newSubTitleLink = '/search?searchText=' + encodeURIComponent(newSubTitle) + '&view=tiles';

			return res.status(200).json({
				message: 'File renamed successfully',
				level: 'info',
				newSrc: newFilePathRelative,
				newImageTitle,
				newSubTitle,
				newImageTitleLink,
				newSubTitleLink
			});
		} catch (err) {
			console.error(err);
			const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
			FS.appendFileSync('./logs/rename.log', logMessage);
			return res.status(500).json({
				message: 'Error renaming file',
				level: 'error'
			});
		}
	});

	router.post('/renameBulk', (req, res) => {
		const newFileName = req.body.newFileName;
		// converting object to a map
		const currentFilePaths = new Map(Object.entries(req.body.currentFilePaths));

		// Array to store the results for renaming files
		const results = new Map();

		let success = 0;
		let fail = 0;

		let index = 1;

		currentFilePaths.forEach((currentFilePath, imageId) => {
			currentFilePath = PATH.resolve(PATH.join('.', 'public', currentFilePath));
			let indexWithPadding = index.toString().padStart(3, '0');
			let newFileNameWithIndex = newFileName + '-' + indexWithPadding;

			const currentFilePathObj = PATH.parse(currentFilePath);
			let newFilePath = PATH.join(currentFilePathObj.dir, newFileNameWithIndex + currentFilePathObj.ext);
			newFilePath = PATH.normalize(newFilePath);

			// just for replacing in the DB
			let currentFilePathRelative;
			let newFilePathRelative;

			// checking if folder exists
			try {
				FS.accessSync(PATH.dirname(newFilePath));
			} catch (err) {
				console.log("new file's directory not found, hence creating");
				try {
					FS.mkdirSync(PATH.dirname(newFilePath), { recursive: true });
				} catch (err) {
					console.error('Error creating directory:', err);
				}
			}

			// checking if file already exists
			try {
				while (true) {
					// try to access the new file name and keep generating new names by incrementing index
					// unless we can not access, i.e. name is not used by existing file and error is raised.
					FS.accessSync(newFilePath);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					index++
					// generating a new file name for collision
					indexWithPadding = index.toString().padStart(3, '0');
					newFileNameWithIndex = newFileName + '-' + indexWithPadding;
					newFilePath = PATH.join(currentFilePathObj.dir, newFileNameWithIndex + currentFilePathObj.ext);
					newFilePath = PATH.normalize(newFilePath);
				}
			} catch (err) {
				try {
					currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
					newFilePathRelative = newFilePath.replace(PWD + '\\public', '');
					// file not found so we can rename now
					FS.renameSync(currentFilePath, newFilePath);
					IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
					IMAGE_PATHS.sort();
					renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					success++;
					index++;
					newImageTitle = METADATA_MAP.get(newFilePathRelative).baseName;
					newSubTitle = METADATA_MAP.get(newFilePathRelative).directory;
					newImageTitleLink = '/search?searchText=' + encodeURIComponent(newImageTitle.replace(/\.[^/.]+$/, "").replace(/\d+$/, "").replace(/\(\d*\)|\d+$/g, "").trim()) + '&view=tiles';
					newSubTitleLink = '/search?searchText=' + encodeURIComponent(newSubTitle) + '&view=tiles';
					results.set(imageId, {
						newFilePathRelative: newFilePathRelative,
						newImageTitle: newImageTitle,
						newSubTitle: newSubTitle,
						newImageTitleLink: newImageTitleLink,
						newSubTitleLink: newSubTitleLink
					});
				} catch (err) {
					console.error('Error renaming file:', err);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					fail++;
					results.set(imageId, 'fail');
				}
			}
		});

		return res.status(200).json({
			// have to convert map to an Object so it can be serialized into a JSON
			results: Object.fromEntries(results)
		});
	});

	router.post('/appendToName', (req, res) => {
		const textToAppend = req.body.textToAppend;
		var parts = textToAppend.split(/[;,]/);
		var trimmedParts = parts.map(function (part) {
			return part.trim();
		});
		// converting object to a map
		const currentFilePaths = new Map(Object.entries(req.body.currentFilePaths));

		// Array to store the results for renaming files
		const results = new Map();

		let success = 0;
		let fail = 0;

		let index = 0;

		console.log("textToAppend: " + textToAppend);

		currentFilePaths.forEach((currentFilePath, imageId) => {
			currentFilePath = PATH.resolve(PATH.join('.', 'public', currentFilePath));
			const currentFilePathObj = PATH.parse(currentFilePath);

			let currentFileFolder = currentFilePathObj.dir;
			let currentFileName = currentFilePathObj.name;
			let currentFileExt = currentFilePathObj.ext;

			let newFileName = currentFileName;
			trimmedParts.forEach(function (part) {
				if (newFileName.toLocaleLowerCase().indexOf(part.toLowerCase()) === -1) {
					newFileName += " " + part;
				}
			});

			if (newFileName == currentFileName) {
				console.log("Not appending as text is already in current name");
				return;
			}

			let newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
			newFilePath = PATH.normalize(newFilePath);

			// just for replacing in the DB
			let currentFilePathRelative;
			let newFilePathRelative;

			// checking if file already exists
			try {
				while (true) {
					// try to access the new file name and keep generating new names by incrementing index
					// unless we can not access, i.e. name is not used by existing file and error is raised.
					FS.accessSync(newFilePath);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					index++
					// generating a new file name for collision
					indexWithPadding = index.toString().padStart(3, '0');
					newFileName = newFileName + '-' + indexWithPadding;
					newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
					newFilePath = PATH.normalize(newFilePath);
				}
			} catch (err) {
				try {
					currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
					newFilePathRelative = newFilePath.replace(PWD + '\\public', '');
					// file not found so we can rename now
					FS.renameSync(currentFilePath, newFilePath);
					IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
					IMAGE_PATHS.sort();
					renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					success++;
					index++;
					results.set(imageId, newFilePathRelative);
				} catch (err) {
					console.error('Error renaming file:', err);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					fail++;
					results.set(imageId, 'fail');
				}
			}
		});

		return res.status(200).json({
			// have to convert map to an Object so it can be serialized into a JSON
			results: Object.fromEntries(results)
		});
	});

	router.post('/prependToName', (req, res) => {
		const textToPrepend = req.body.textToPrepend;
		// converting object to a map
		const currentFilePaths = new Map(Object.entries(req.body.currentFilePaths));

		// Array to store the results for renaming files
		const results = new Map();

		let success = 0;
		let fail = 0;

		let index = 0;

		console.log("textToPrepend: " + textToPrepend);

		currentFilePaths.forEach((currentFilePath, imageId) => {
			currentFilePath = PATH.resolve(PATH.join('.', 'public', currentFilePath));
			const currentFilePathObj = PATH.parse(currentFilePath);

			let currentFileFolder = currentFilePathObj.dir;
			let currentFileName = currentFilePathObj.name;
			let currentFileExt = currentFilePathObj.ext;

			let newFileName;
			if (!currentFileName.startsWith(textToPrepend)) {
				newFileName = textToPrepend + ' ' + currentFileName;
			} else {
				console.log("Not prepending as name already starts with the prefix");
				return;
			}

			let newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
			newFilePath = PATH.normalize(newFilePath);

			// just for replacing in the DB
			let currentFilePathRelative;
			let newFilePathRelative;

			// checking if file already exists
			try {
				while (true) {
					// try to access the new file name and keep generating new names by incrementing index
					// unless we can not access, i.e. name is not used by existing file and error is raised.
					FS.accessSync(newFilePath);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					index++
					// generating a new file name for collision
					indexWithPadding = index.toString().padStart(3, '0');
					newFileName = newFileName + '-' + indexWithPadding;
					newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
					newFilePath = PATH.normalize(newFilePath);
				}
			} catch (err) {
				try {
					currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
					newFilePathRelative = newFilePath.replace(PWD + '\\public', '');
					// file not found so we can rename now
					FS.renameSync(currentFilePath, newFilePath);
					IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
					IMAGE_PATHS.sort();
					renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					success++;
					index++;
					results.set(imageId, newFilePathRelative);
				} catch (err) {
					console.error('Error renaming file:', err);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					fail++;
					results.set(imageId, 'fail');
				}
			}
		});

		return res.status(200).json({
			// have to convert map to an Object so it can be serialized into a JSON
			results: Object.fromEntries(results)
		});
	});

	router.post('/removeFromName', (req, res) => {
		const textToRemove = req.body.textToRemove;
		// converting object to a map
		const currentFilePaths = new Map(Object.entries(req.body.currentFilePaths));

		// Array to store the results for renaming files
		const results = new Map();

		let success = 0;
		let fail = 0;

		let index = 0;

		console.log("textToRemove: " + textToRemove);

		currentFilePaths.forEach((currentFilePath, imageId) => {
			currentFilePath = PATH.resolve(PATH.join('.', 'public', currentFilePath));
			const currentFilePathObj = PATH.parse(currentFilePath);

			let currentFileFolder = currentFilePathObj.dir;
			let currentFileName = currentFilePathObj.name;
			let currentFileExt = currentFilePathObj.ext;

			let newFileName = currentFileName;
			if (currentFileName.includes(textToRemove)) {
				newFileName = currentFileName.replace(textToRemove, "").trim();
			} else {
				console.log("Nothing to remove");
				return;
			}

			let newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
			newFilePath = PATH.normalize(newFilePath);

			// just for replacing in the DB
			let currentFilePathRelative;
			let newFilePathRelative;

			// checking if file already exists
			try {
				while (true) {
					// try to access the new file name and keep generating new names by incrementing index
					// unless we can not access, i.e. name is not used by existing file and error is raised.
					FS.accessSync(newFilePath);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					index++
					// generating a new file name for collision
					indexWithPadding = index.toString().padStart(3, '0');
					newFileName = newFileName + '-' + indexWithPadding;
					newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
					newFilePath = PATH.normalize(newFilePath);
				}
			} catch (err) {
				try {
					currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
					newFilePathRelative = newFilePath.replace(PWD + '\\public', '');
					// file not found so we can rename now
					FS.renameSync(currentFilePath, newFilePath);
					IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
					IMAGE_PATHS.sort();
					renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					success++;
					index++;
					results.set(imageId, newFilePathRelative);
				} catch (err) {
					console.error('Error renaming file:', err);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					fail++;
					results.set(imageId, 'fail');
				}
			}
		});

		return res.status(200).json({
			// have to convert map to an Object so it can be serialized into a JSON
			results: Object.fromEntries(results)
		});
	});

	router.post('/replaceInName', (req, res) => {
		const textToFind = req.body.textToFind;
		const textToSubstitute = req.body.textToSubstitute;
		// converting object to a map
		const currentFilePaths = new Map(Object.entries(req.body.currentFilePaths));

		// Array to store the results for renaming files
		const results = new Map();

		let success = 0;
		let fail = 0;

		let index = 0;

		currentFilePaths.forEach((currentFilePath, imageId) => {
			currentFilePath = PATH.resolve(PATH.join('.', 'public', currentFilePath));
			const currentFilePathObj = PATH.parse(currentFilePath);

			let currentFileFolder = currentFilePathObj.dir;
			let currentFileName = currentFilePathObj.name;
			let currentFileExt = currentFilePathObj.ext;

			newFileName = currentFileName.replace(textToFind, textToSubstitute);
			if (newFileName == currentFileName) {
				console.log("Skipping as names are same");
				return;
			}

			let newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
			newFilePath = PATH.normalize(newFilePath);

			// just for replacing in the DB
			let currentFilePathRelative;
			let newFilePathRelative;

			// checking if file already exists
			try {
				while (true) {
					// try to access the new file name and keep generating new names by incrementing index
					// unless we can not access, i.e. name is not used by existing file and error is raised.
					FS.accessSync(newFilePath);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					index++
					// generating a new file name for collision
					indexWithPadding = index.toString().padStart(3, '0');
					newFileName = newFileName + '-' + indexWithPadding;
					newFilePath = PATH.join(currentFileFolder, newFileName + currentFileExt);
					newFilePath = PATH.normalize(newFilePath);
				}
			} catch (err) {
				try {
					currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
					newFilePathRelative = newFilePath.replace(PWD + '\\public', '');
					// file not found so we can rename now
					FS.renameSync(currentFilePath, newFilePath);
					IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
					IMAGE_PATHS.sort();
					renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					success++;
					index++;
					results.set(imageId, newFilePathRelative);
				} catch (err) {
					console.error('Error renaming file:', err);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
					FS.appendFileSync('./logs/rename.log', logMessage);
					fail++;
					results.set(imageId, 'fail');
				}
			}
		});

		return res.status(200).json({
			// have to convert map to an Object so it can be serialized into a JSON
			results: Object.fromEntries(results)
		});
	});

	router.post('/moveFiles', (req, res) => {
		const targetFolder = req.body.targetFolder;
		// converting object to a map
		const selectedImages = new Map(Object.entries(req.body.selectedImages));

		// console.log(targetFolder);
		// console.log(selectedImages);

		const targetFolderPath = PATH.resolve(PATH.join('.', 'public', 'images', targetFolder));

		// checking if folder exists
		try {
			FS.accessSync(targetFolderPath);
		} catch (err) {
			console.log("new file's directory not found, hence creating");
			try {
				FS.mkdirSync(targetFolderPath, { recursive: true });
			} catch (err) {
				console.error('Error creating directory:', err);
			}
		}

		// to store the results for renaming files
		// contains fileId: newFilePath
		// sent to client to update the IMG tags having fileIds with new src
		const results = new Map();

		let success = 0;
		let fail = 0;


		selectedImages.forEach((currentFilePath, imageId) => {
			currentFilePath = PATH.resolve(PATH.join('.', 'public', currentFilePath));
			const currentFilePathObj = PATH.parse(currentFilePath);
			let newFilePath = PATH.join(targetFolderPath, currentFilePathObj.base);
			// just for replacing in the DB
			let currentFilePathRelative;
			let newFilePathRelative;

			// checking if file already exists
			try {
				let index = 0;
				while (true) {
					FS.accessSync(newFilePath);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
					FS.appendFileSync('./logs/move.log', logMessage);
					index++
					// generating a new file name for collision
					indexWithPadding = index.toString().padStart(3, '0');
					newFileNameWithIndex = currentFilePathObj.name + '-' + indexWithPadding;
					newFilePath = PATH.join(targetFolderPath, newFileNameWithIndex + currentFilePathObj.ext);
				}
			} catch (err) {
				try {
					currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
					newFilePathRelative = newFilePath.replace(PWD + '\\public', '');
					// file not found so we can rename now
					FS.renameSync(currentFilePath, newFilePath);
					IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
					IMAGE_PATHS.sort();
					renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
					FS.appendFileSync('./logs/move.log', logMessage);
					success++;
					results.set(imageId, newFilePathRelative);
				} catch (err) {
					console.error('Error renaming file:', err);
					const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
					FS.appendFileSync('./logs/move.log', logMessage);
					fail++;
					results.set(imageId, 'fail');
				}
			}
		});

		return res.status(200).json({
			// have to convert map to an Object so it can be serialized into a JSON
			results: Object.fromEntries(results)
		});
	});

	router.get('/search', async (req, res) => {
		const searchText = req.query.searchText;
		if (!searchText) {
			return res.status(400).send('Invalid search term');
		}

		let matchingImagePaths = [];
		let imageList = IMAGE_PATHS;
		const view = req.query.view;
		let sortBy = req.query.sortBy;
		let sortAsc;
		if (req.query.sortAsc === 'true') {
			sortAsc = true;
		} else {
			sortAsc = false;
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

		} else if (searchText.startsWith('\\\\')) {
			console.log('regex search started');
			let pattern = new RegExp(searchText.slice(2), "i") // remove the leading forward slashes
			console.log("pattern: " + pattern);
			let regex = new RegExp(pattern, 'i'); // create a case-insensitive regular expression
			matchingImagePaths = imageList.filter((imagePath) => regex.test(imagePath));
		} else if (searchText.endsWith('\\')) {
			log('show directory in non recursive mode');
			let pattern = new RegExp(searchText.replaceAll('\\', '\\\\') + '[^\\\\]*$', "i")
			console.log("pattern: " + pattern);
			let regex = new RegExp(pattern, 'i');
			matchingImagePaths = imageList.filter((imagePath) => regex.test(imagePath));
		} else {
			matchingImagePaths = imageList.filter((imagePath) =>
				imagePath.toLowerCase().includes(searchText.toLowerCase().trim()));
		}

		// SORTS
		if (sortBy === "shuffle") {
			shuffle(matchingImagePaths);
		} else if (sortBy === "path") {
			if (sortAsc) {
				matchingImagePaths.sort();
			} else {
				matchingImagePaths.sort((a, b) => b.localeCompare(a));
			}
		} else if (sortBy === "name") {
			matchingImagePaths = sortByName(matchingImagePaths, METADATA_MAP, sortAsc);
		} else if (sortBy === "size") {
			matchingImagePaths = sortBySize(matchingImagePaths, METADATA_MAP, sortAsc);
		} else if (sortBy === "modifiedTime") {
			matchingImagePaths = sortByModifiedTime(matchingImagePaths, METADATA_MAP, sortAsc);
		} else if (sortBy === "dimensions") {
			matchingImagePaths = sortByDimensions(matchingImagePaths, METADATA_MAP, sortAsc);
		}

		// adding results to Search results map to search faster next time
		// and also preserve the imagelist when lazy loading shuffled results
		const searchKey = searchText + ':::' + sortBy + ':::' + sortAsc;
		// console.log(searchKey);
		SEARCH_RESULTS.set(searchKey, matchingImagePaths);

		const totalResultCount = matchingImagePaths.length;
		const page = req.query.page || 1;
		const perPage = searchResultBatchSize;
		const startIndex = (page - 1) * perPage;
		const endIndex = startIndex + perPage;

		const pageImagePaths = matchingImagePaths.slice(startIndex, endIndex);
		// const pageImageIndexes = matchingImageIndexes.slice(startIndex, endIndex);

		// console.log('getting image metadata');
		let images;
		try {
			images = await getImagesMetadata(pageImagePaths, METADATA_MAP);
			// console.log(images);
		} catch (error) {
			console.error(`Error in getImagesMetadata: ${error}`);
		}

		const totalPages = Math.ceil(matchingImagePaths.length / perPage);

		// console.log('rendering search results');
		const multiplier = 1;

		res.render('home', {
			searchText,
			totalResultCount,
			images,
			// matchingImageIndexes: pageImageIndexes,
			page,
			totalPages,
			sortBy: sortBy,
			sortAsc: sortAsc,
			view,
			multiplier
		});
	});

	router.get('/getNextResults', async (req, res) => {
		const searchText = req.query.searchText;
		const multiplier = req.query.multiplier;
		let sortBy = req.query.sortBy;
		let sortAsc;
		if (req.query.sortAsc === 'true') {
			sortAsc = true;
		} else {
			sortAsc = false;
		}

		const searchKey = searchText + ':::' + sortBy + ':::' + sortAsc;

		let matchingImagePaths;
		if (SEARCH_RESULTS.has(searchKey)) {
			matchingImagePaths = SEARCH_RESULTS.get(searchKey);
		} else {
			console.error('searchKey not found in SEARCH_RESULTS');
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
			images = await getImagesMetadata(pageImagePaths, METADATA_MAP);
		} catch (error) {
			console.error(`Error testing getImagesMetadata: ${error}`);
		}

		const totalPages = Math.ceil(matchingImagePaths.length / perPage);
		const view = req.query.view;

		res.render('results', {
			totalResultCount,
			images,
			page,
			totalPages,
			view,
			multiplier
		});
	})

	router.get('/config', async (req, res) => {
		res.render('config');
	})

};