// routes.js
const PATH = require('path');
const FS = require('fs');
const PWD = process.cwd();
const ffmpeg = require('fluent-ffmpeg');

const {
	readImageFiles,
	initializeImagesMetadata,
	getImagesMetadata,
	sortByName,
	sortBySize,
	sortByModifiedTime,
	sortByDimensions,
	renameKey,
	shuffle,
	moveRenameFiles
} = require('./fileUtils');

const {
	ROOT_IMAGE_PATH,
	VIDEO_EXTENSIONS
} = require('./constants');

const {
	initializeMetadataTable,
	loadMetadataMapFromDB,
	pruneDB
} = require('./dbUtils');
const { log } = require('console');

const searchResultBatchSize = 50;

module.exports = function (router, IMAGE_PATHS, METADATA_MAP, SEARCH_RESULTS) {

	// Define a route to handle requests for the home page
	router.get('/', (req, res) => {
		res.redirect('/search?searchText=.&view=tiles&sortBy=shuffle');
	})

	router.get('/refreshDB', (req, res) => {
		(async () => {
			try {
				IMAGE_PATHS = [];
				const metadataSizeBefore = METADATA_MAP.size;

				// This block is same from index.js
				const startTimeTotal = Date.now();
				let startTime = Date.now();
				await initializeMetadataTable();
				await loadMetadataMapFromDB(METADATA_MAP);
				console.log(`Loaded metadata from DB in ${(Date.now() - startTime) / 1000} seconds.`);
				startTime = Date.now();
				console.log(`Files in map: ${METADATA_MAP.size}`);
				console.log('Reading files from disk...');
				await readImageFiles(IMAGE_PATHS, ROOT_IMAGE_PATH);
				IMAGE_PATHS.sort();
				console.log(`Read ${IMAGE_PATHS.length} files in ${(Date.now() - startTime) / 1000} seconds.`);
				startTime = Date.now();
				console.log("Initializing Image Metadata (reading metadata from disk for files missing in DB)");
				console.log(`Files in map before initialization: ${METADATA_MAP.size}`);
				console.log(`Loading metadata...`);
				await initializeImagesMetadata(IMAGE_PATHS, METADATA_MAP);
				console.log(`Files in map after initialization: ${METADATA_MAP.size}`);
				console.log(`Loaded metadata in ${(Date.now() - startTime) / 1000} seconds.`);
				console.log(`Total time: ${(Date.now() - startTimeTotal) / 1000} seconds.`);
				// Till here

				const metadataSizeAfter = METADATA_MAP.size;

				res.status(200).send(`Refreshed database; refreshed in ${(Date.now() - startTimeTotal) / 1000} seconds; New Files added: ${metadataSizeAfter - metadataSizeBefore}`);
			} catch (err) {
				console.error('Error initializing metadata table', err);
				res.status(500).send('Error refreshing database');
			}
		})();
	});

	router.get('/pruneDB', (req, res) => {
		let startTime = Date.now();
		pruneDB(IMAGE_PATHS).then((entriesPruned) => {
			console.log(`Pruned ${entriesPruned} stale entries from the database`);
			res.status(200).send(`Pruned ${entriesPruned} stale entries from the database; pruned in ${(Date.now() - startTime) / 1000} seconds`);
		}).catch((err) => {
			console.error('Error pruning metadata table', err);
			res.status(500).send('Error pruning database'); // send an error response to the client
		});
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
		let sortBy = req.query.sortBy;
		let sortAsc;
		if (req.query.sortAsc === 'true') {
			sortAsc = true;
		} else {
			sortAsc = false;
		}
		const searchKey = searchText + ':::' + sortBy + ':::' + sortAsc;

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
		let sortBy = req.query.sortBy;
		let sortAsc;
		if (req.query.sortAsc === 'true') {
			sortAsc = true;
		} else {
			sortAsc = false;
		}

		const searchKey = searchText + ':::' + sortBy + ':::' + sortAsc;

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

	router.post('/moveRenameFiles', (req, res) => {
		// converting object to a map
		const operation = req.body.operation;
		const currentFilePaths = new Map(Object.entries(req.body.currentFilePaths));
		const argument1 = req.body.argument1;
		const argument2 = req.body.argument2 || null;

		// Array to store the results for renaming files

		const fileOperationOutput = moveRenameFiles(IMAGE_PATHS, METADATA_MAP,
			operation, currentFilePaths, argument1, argument2);

		const newImagesData = fileOperationOutput.newImagesData;
		const successCount = fileOperationOutput.successCount;
		const failCount = fileOperationOutput.failCount;

		return res.status(200).json({
			// have to convert map to an Object so it can be serialized into a JSON
			newImagesData: Object.fromEntries(newImagesData),
			successCount: successCount,
			failCount: failCount
		});
	});

	router.get('/search', async (req, res) => {
		const searchText = req.query.searchText;
		if (!searchText) {
			return res.status(400).send('Invalid search term');
		}

		let matchingImagePaths = [];
		let imageList = IMAGE_PATHS;
		let view = req.query.view;
		let sortBy = req.query.sortBy;
		if (!sortBy) {
			sortBy = 'shuffle';
		}
		let sortAsc;
		if (req.query.sortAsc === 'true') {
			sortAsc = true;
		} else if (req.query.sortAsc === 'false') {
			sortAsc = false;
		} else {
			sortAsc = true;
		}

		if (!view) {
			view = 'tiles';
		}

		if (searchText.includes('&&')
			|| searchText.includes('||')
			|| searchText.includes('??')
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
			splitIndex = searchText.indexOf('??');
			while (splitIndex !== -1) {
				splitIndexes.push(splitIndex);
				splitIndex = searchText.indexOf('??', splitIndex + 1);
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
			let regexTokens = [];

			searchTokens.forEach(searchToken => {
				if (searchToken.startsWith('&&')) {
					andTokens.push(searchToken.replace('&&', '').trim());
				} else if (searchToken.startsWith('||')) {
					orTokens.push(searchToken.replace('||', '').trim());
				} else if (searchToken.startsWith('!!')) {
					notTokens.push(searchToken.replace('!!', '').trim());
				} else if (searchToken.startsWith('??')) {
					regexTokens.push(searchToken.slice(2).trim());
				} else {
					andTokens.push(searchToken.trim());
				}
			});

			// console.log("Processing Regex tokens");
			// console.log(`regexTokens: ${regexTokens}`);
			regexTokens.forEach(regexToken => {
				let pattern;
				try {
					pattern = new RegExp(regexToken, "i");
					// console.log(`pattern: ${pattern}`);
				} catch (error) {
					return res.status(400).send('Invalid search term (unable to parse as regex)');
				}
				let regexMatchingImages = imageList.filter(imagePath => pattern.test(imagePath));
				matchingImagePaths = matchingImagePaths.concat(regexMatchingImages);
			})

			if (andTokens.length !== 0) {
				// console.log("Processing AND tokens");
				// search all images if matchingImagePaths is empty i.e. regex returned nothing or no regex search
				if (matchingImagePaths.length === 0) {
					imageList.forEach(imagePath => {
						let containsAll = andTokens.every(andToken => imagePath.toLowerCase().includes(andToken.toLowerCase()));
						if (containsAll) {
							matchingImagePaths.push(imagePath);
						}
					});
				} else {
					// apply the and filter to matchingImagePaths
					for (let i = matchingImagePaths.length - 1; i >= 0; i--) {
						let matchingPath = matchingImagePaths[i];
						let containsAll = andTokens.every(andToken => matchingPath.toLowerCase().includes(andToken.toLowerCase()));
						if (!containsAll) {
							// remove imagePath from matchingImagePaths if it doesn't contain all andTokens
							matchingImagePaths.splice(i, 1);
						}
					}
				}
			}

			if (orTokens.length !== 0) {
				// console.log("Processing OR tokens");
				imageList.forEach(imagePath => {
					let containsSome = orTokens.some(orToken => imagePath.toLowerCase().includes(orToken.toLowerCase()));
					if (containsSome) {
						matchingImagePaths.push(imagePath);
					}
				});
			}

			// if matchingImagePaths is still empty then add all images from imageList
			if (!matchingImagePaths) {
				matchingImagePaths = matchingImagePaths.concat(imageList);
			}

			if (notTokens.length !== 0) {
				// console.log("Processing NOT tokens");
				for (let i = matchingImagePaths.length - 1; i >= 0; i--) {
					let matchingPath = matchingImagePaths[i];
					let containsAny = notTokens.some(notToken => matchingPath.toLowerCase().includes(notToken.toLowerCase()));
					if (containsAny) {
						matchingImagePaths.splice(i, 1);
					}
				}
			}

		} else if (searchText.startsWith('??')) {
			// console.log('regex search started');
			let pattern
			try {
				pattern = new RegExp(searchText.slice(2), "i") // remove the leading forward slashes
			} catch (error) {
				return res.status(400).send('Invalid search term (unable to parse as regex)');
			}
			// console.log("pattern: " + pattern);
			let regex = new RegExp(pattern, 'i'); // create a case-insensitive regular expression
			matchingImagePaths = imageList.filter((imagePath) => regex.test(imagePath));
		} else if (searchText.endsWith('\\')) {
			// console.log('show directory in non recursive mode');
			let pattern = new RegExp(searchText.replaceAll('\\', '\\\\') + '[^\\\\]*$', "i")
			// console.log("pattern: " + pattern);
			let regex = new RegExp(pattern, 'i');
			matchingImagePaths = imageList.filter((imagePath) => regex.test(imagePath));
		} else if (searchText.endsWith('>')) {
			// return all images starting from this image
			const startIndex = imageList.findIndex((imagePath) =>
				imagePath.toLowerCase().includes(searchText.toLowerCase().slice(0, -1)));
			if (startIndex !== -1) {
				matchingImagePaths = imageList.slice(startIndex);
			} else {
				console.log("Image not found: " + searchText);
			}
			sortBy = "path";
			sortAsc = true;
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
		// console.log("searchKey: " + searchKey);
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
		if (!sortBy) {
			sortBy = 'shuffle';
		}
		let sortAsc;
		if (req.query.sortAsc === 'true') {
			sortAsc = true;
		} else if (req.query.sortAsc === 'false') {
			sortAsc = false;
		} else {
			sortAsc = true;
		}

		const searchKey = searchText + ':::' + sortBy + ':::' + sortAsc;

		let matchingImagePaths;
		if (SEARCH_RESULTS.has(searchKey)) {
			matchingImagePaths = SEARCH_RESULTS.get(searchKey);
		} else {
			// console.error('searchKey not found in SEARCH_RESULTS' + searchKey);
			return res.status(404).json({
				message: 'searchKey not found in SEARCH_RESULTS'
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

		// console.log('getting image metadata');
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

	router.get('/thumbnail', (req, res) => {
		const relativeVideoFilePath = decodeURIComponent(req.query.videoPath);
		// console.log("relativeVideoFilePath: " + relativeVideoFilePath);
		const absoluteVideoFilePath = PATH.join(PWD, "public", relativeVideoFilePath);
		// console.log("absoluteVideoFilePath: " + absoluteVideoFilePath);


		if (!absoluteVideoFilePath) {
			return res.status(400).send('Missing videoPath query parameter');
		}

		// Sanitize filename to avoid file system issues
		const sanitizedFileName = relativeVideoFilePath.replace(/[/\\?%*:|"<>\.]/g, '_') + '.jpg';
		// console.log("sanitizedFileName: " + sanitizedFileName);
		const thumbFolder = PATH.join(PWD, '/public/thumbs');
		const relativeThumbFilePath = PATH.join('/thumbs', sanitizedFileName);
		const absoluteThumbFilePath = PATH.join(thumbFolder, sanitizedFileName);
		// console.log("outputFilePath: " + relativeThumbFilePath);


		// Check if thumbnail already exists
		if (FS.existsSync(relativeThumbFilePath)) {
			// console.log('Thumbnail already exists' + relativeThumbFilePath);
			return res.sendFile(absoluteThumbFilePath);
		}

		// Retrieve video duration and generate thumbnail
		ffmpeg.ffprobe(absoluteVideoFilePath, (err, metadata) => {
			if (err) {
				console.error('Error retrieving video metadata:', err);
				return res.status(500).send('Error retrieving video metadata');
			}

			const videoDuration = metadata.format.duration;
			const timestamp = videoDuration * 0.1; // 10% of video length
			const formattedTimestamp = `00:00:${timestamp.toFixed(3)}`; // Format timestamp to HH:MM:SS.sss

			ffmpeg(absoluteVideoFilePath)
				.screenshots({
					count: 1,
					timestamps: [formattedTimestamp],
					filename: sanitizedFileName,
					folder: thumbFolder
				})
				.on('end', () => {
					res.sendFile(absoluteThumbFilePath);
					res.status(200);
				})
				.on('error', (err) => {
					console.error('Error generating thumbnail:', err);
					res.status(500).send('Error generating thumbnail');
				});
		});
	});

	router.get('/getFileDetails', async (req, res) => {
		const relativeFilePath = decodeURIComponent(req.query.relativeFilePath);
		// console.log("relativeFilePath: " + relativeFilePath);

		let imagePath, imageName, folderName, imageResolution, imageSizeReadable;

		if (relativeFilePath) {
			imagePath = relativeFilePath;
			imageName = METADATA_MAP.get(imagePath).baseName;
			folderName = METADATA_MAP.get(imagePath).directory;
			imageResolution = METADATA_MAP.get(imagePath).resolution;
			imageSizeReadable = METADATA_MAP.get(imagePath).sizeReadable;
		}

		res.render('image-details', {
			imagePath,
			imageLinkEscaped: encodeURIComponent(imagePath),
			imageName,
			folderName,
			imageResolution,
			imageSizeReadable
		});
	});

	router.get('/config', async (req, res) => {
		res.render('config');
	})

};