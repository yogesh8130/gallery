const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
// Create SQLite database connection
const db = new sqlite3.Database('metadata.db');
// Create a table to store metadata if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS metadata (
        imagePath TEXT PRIMARY KEY,
        baseName TEXT,
        directory TEXT,
        width INTEGER,
        height INTEGER,
        resolution TEXT,
        sizeBytes INTEGER,
        sizeReadable TEXT,
        mime TEXT,
        type TEXT,
        modifiedTime TIMESTAMP
    )
`);

// for reading image and video metadata
// const sharp = require('sharp');
// const ffprobe = require('ffprobe');
// const ffprobeStatic = require('ffprobe-static');
const { readMediaAttributes } = require('leather'); // much smaller
const { log, error, info } = require('console');

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

// Create map of all image metadata
let metadataMap = new Map();
db.all(`SELECT * FROM metadata`, (err, rows) => {
	if (err) {
		console.error('Error getting metadata from DB', err);
		return;
	}
	rows.forEach(row => {
		const { imagePath, baseName, directory, width, height, resolution, sizeBytes, sizeReadable, mime, type, modifiedTime } = row;

		// Create an object with the row values (except imagePath)
		const rowData = {
			baseName,
			directory,
			width,
			height,
			resolution,
			sizeBytes,
			sizeReadable,
			mime,
			type,
			modifiedTime
		};
		// Set the object as a value in the map with imagePath as key
		metadataMap.set(imagePath, rowData);
	});

	// retrieve data like this:
	// console.log(metadataMap.get("\\images\\Misc\\test.png").baseName);
});

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
				if (allowedExtensions.includes(ext) && !fullPath.includes("###deleted")) {
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

	console.log("Initialize Images Metadata, looking for new files");

	console.log(`Files in map before initialization: ${metadataMap.size}`);
	await initializeImagesMetadata(imagePaths);
	console.log(`Files in map after initialization: ${metadataMap.size}`);


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
		if (searchResults.has(searchKey)) {
			imageList = searchResults.get(searchKey);
		} else {
			console.error('searchKey not found in searchResults');
			return res.status(404).json({
				message: 'This has not been searched before'
			});
		}
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
		if (searchResults.has(searchKey)) {
			imageList = searchResults.get(searchKey);
		} else {
			console.error('searchKey not found in searchResults');
			return res.status(404).json({
				message: 'This has not been searched before'
			});
		}
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

app.post('/deleteFile', (req, res) => {
	const currentFilePath = path.resolve(path.join('.', 'public', decodeURIComponent(req.body.currentFilePath)));

	const currentFilePathObj = path.parse(currentFilePath);

	let currentFileFolder = currentFilePathObj.dir;
	let currentFileName = currentFilePathObj.name;
	let currentFileExt = currentFilePathObj.ext;

	let newFilePath = path.join(currentFileFolder, currentFileName + "###deleted" + currentFileExt);

	// Rename the file using the fs module
	fs.renameSync(currentFilePath, newFilePath);

	// to find and replace in "DB"
	const currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');

	// removing from "DB"
	imagePaths.splice(imagePaths.indexOf(currentFilePathRelative), 1);

	const logMessage = `${new Date().toISOString()}|${currentFilePath}|###deleted|Success\n`;
	fs.appendFileSync('./logs/rename.log', logMessage);

	return res.status(200).json({
		message: 'File deleted successfully',
		level: 'info',
	});

});

// Define a route to handle file renaming
app.post('/rename', (req, res) => {
	const currentFilePath = path.resolve(path.join('.', 'public', decodeURIComponent(req.body.currentFilePath)));
	const newFileName = req.body.newFileName;

	const currentFilePathObj = path.parse(currentFilePath);
	let newFilePath = path.join(currentFilePathObj.dir, newFileName + currentFilePathObj.ext);
	// this allows having .. in new filename to goback directory levels
	newFilePath = path.normalize(newFilePath);

	try {
		// Check if new file's directory exists or not, and create if necessary
		if (!fs.existsSync(path.dirname(newFilePath))) {
			console.log("new file's directory not found, hence creating");
			fs.mkdirSync(path.dirname(newFilePath), { recursive: true });
		}

		let index = 1;
		let indexWithPadding = index.toString().padStart(3, '0');
		let uniqueFileName = newFileName;

		// Check if a file with the new file name already exists
		while (fs.existsSync(newFilePath)) {
			const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
			fs.appendFileSync('./logs/rename.log', logMessage);

			uniqueFileName = `${newFileName}-${indexWithPadding}`;
			newFilePath = path.join(currentFilePathObj.dir, uniqueFileName + currentFilePathObj.ext);
			newFilePath = path.normalize(newFilePath);
			index++;
			indexWithPadding = index.toString().padStart(3, '0');
		}

		// Rename the file using the fs module
		fs.renameSync(currentFilePath, newFilePath);

		// to find and replace in "DB"
		const currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');
		const newFilePathRelative = newFilePath.replace(pwd + '\\public', '');

		// replacing in "DB"
		imagePaths[imagePaths.indexOf(currentFilePathRelative)] = newFilePathRelative;
		imagePaths.sort();
		renameKey(metadataMap, currentFilePathRelative, newFilePathRelative);

		const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
		fs.appendFileSync('./logs/rename.log', logMessage);

		return res.status(200).json({
			message: 'File renamed successfully',
			level: 'info',
			newSrc: newFilePathRelative
		});
	} catch (err) {
		console.error(err);
		const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
		fs.appendFileSync('./logs/rename.log', logMessage);
		return res.status(500).json({
			message: 'Error renaming file',
			level: 'error'
		});
	}
});

app.post('/renameBulk', (req, res) => {
	const newFileName = req.body.newFileName;
	// converting object to a map
	const currentFilePaths = new Map(Object.entries(req.body.currentFilePaths));

	// Array to store the results for renaming files
	const results = new Map();

	let success = 0;
	let fail = 0;

	let index = 1;

	currentFilePaths.forEach((currentFilePath, imageId) => {
		currentFilePath = path.resolve(path.join('.', 'public', currentFilePath));
		let indexWithPadding = index.toString().padStart(3, '0');
		let newFileNameWithIndex = newFileName + '-' + indexWithPadding;

		const currentFilePathObj = path.parse(currentFilePath);
		let newFilePath = path.join(currentFilePathObj.dir, newFileNameWithIndex + currentFilePathObj.ext);
		newFilePath = path.normalize(newFilePath);

		// just for replacing in the DB
		let currentFilePathRelative;
		let newFilePathRelative;

		// checking if folder exists
		try {
			fs.accessSync(path.dirname(newFilePath));
		} catch (err) {
			console.log("new file's directory not found, hence creating");
			try {
				fs.mkdirSync(path.dirname(newFilePath), { recursive: true });
			} catch (err) {
				console.error('Error creating directory:', err);
			}
		}

		// checking if file already exists
		try {
			while (true) {
				// try to access the new file name and keep generating new names by incrementing index
				// unless we can not access, i.e. name is not used by existing file and error is raised.
				fs.accessSync(newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				index++
				// generating a new file name for collision
				indexWithPadding = index.toString().padStart(3, '0');
				newFileNameWithIndex = newFileName + '-' + indexWithPadding;
				newFilePath = path.join(currentFilePathObj.dir, newFileNameWithIndex + currentFilePathObj.ext);
				newFilePath = path.normalize(newFilePath);
			}
		} catch (err) {
			try {
				currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');
				newFilePathRelative = newFilePath.replace(pwd + '\\public', '');
				// file not found so we can rename now
				fs.renameSync(currentFilePath, newFilePath);
				imagePaths[imagePaths.indexOf(currentFilePathRelative)] = newFilePathRelative;
				imagePaths.sort();
				renameKey(metadataMap, currentFilePathRelative, newFilePathRelative);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				success++;
				index++;
				results.set(imageId, newFilePathRelative);
			} catch (err) {
				console.error('Error renaming file:', err);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
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

app.post('/appendToName', (req, res) => {
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
		currentFilePath = path.resolve(path.join('.', 'public', currentFilePath));
		const currentFilePathObj = path.parse(currentFilePath);

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

		let newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
		newFilePath = path.normalize(newFilePath);

		// just for replacing in the DB
		let currentFilePathRelative;
		let newFilePathRelative;

		// checking if file already exists
		try {
			while (true) {
				// try to access the new file name and keep generating new names by incrementing index
				// unless we can not access, i.e. name is not used by existing file and error is raised.
				fs.accessSync(newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				index++
				// generating a new file name for collision
				indexWithPadding = index.toString().padStart(3, '0');
				newFileName = newFileName + '-' + indexWithPadding;
				newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
				newFilePath = path.normalize(newFilePath);
			}
		} catch (err) {
			try {
				currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');
				newFilePathRelative = newFilePath.replace(pwd + '\\public', '');
				// file not found so we can rename now
				fs.renameSync(currentFilePath, newFilePath);
				imagePaths[imagePaths.indexOf(currentFilePathRelative)] = newFilePathRelative;
				imagePaths.sort();
				renameKey(metadataMap, currentFilePathRelative, newFilePathRelative);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				success++;
				index++;
				results.set(imageId, newFilePathRelative);
			} catch (err) {
				console.error('Error renaming file:', err);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
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

app.post('/prependToName', (req, res) => {
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
		currentFilePath = path.resolve(path.join('.', 'public', currentFilePath));
		const currentFilePathObj = path.parse(currentFilePath);

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

		let newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
		newFilePath = path.normalize(newFilePath);

		// just for replacing in the DB
		let currentFilePathRelative;
		let newFilePathRelative;

		// checking if file already exists
		try {
			while (true) {
				// try to access the new file name and keep generating new names by incrementing index
				// unless we can not access, i.e. name is not used by existing file and error is raised.
				fs.accessSync(newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				index++
				// generating a new file name for collision
				indexWithPadding = index.toString().padStart(3, '0');
				newFileName = newFileName + '-' + indexWithPadding;
				newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
				newFilePath = path.normalize(newFilePath);
			}
		} catch (err) {
			try {
				currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');
				newFilePathRelative = newFilePath.replace(pwd + '\\public', '');
				// file not found so we can rename now
				fs.renameSync(currentFilePath, newFilePath);
				imagePaths[imagePaths.indexOf(currentFilePathRelative)] = newFilePathRelative;
				imagePaths.sort();
				renameKey(metadataMap, currentFilePathRelative, newFilePathRelative);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				success++;
				index++;
				results.set(imageId, newFilePathRelative);
			} catch (err) {
				console.error('Error renaming file:', err);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
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

app.post('/removeFromName', (req, res) => {
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
		currentFilePath = path.resolve(path.join('.', 'public', currentFilePath));
		const currentFilePathObj = path.parse(currentFilePath);

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

		let newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
		newFilePath = path.normalize(newFilePath);

		// just for replacing in the DB
		let currentFilePathRelative;
		let newFilePathRelative;

		// checking if file already exists
		try {
			while (true) {
				// try to access the new file name and keep generating new names by incrementing index
				// unless we can not access, i.e. name is not used by existing file and error is raised.
				fs.accessSync(newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				index++
				// generating a new file name for collision
				indexWithPadding = index.toString().padStart(3, '0');
				newFileName = newFileName + '-' + indexWithPadding;
				newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
				newFilePath = path.normalize(newFilePath);
			}
		} catch (err) {
			try {
				currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');
				newFilePathRelative = newFilePath.replace(pwd + '\\public', '');
				// file not found so we can rename now
				fs.renameSync(currentFilePath, newFilePath);
				imagePaths[imagePaths.indexOf(currentFilePathRelative)] = newFilePathRelative;
				imagePaths.sort();
				renameKey(metadataMap, currentFilePathRelative, newFilePathRelative);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				success++;
				index++;
				results.set(imageId, newFilePathRelative);
			} catch (err) {
				console.error('Error renaming file:', err);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
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

app.post('/replaceInName', (req, res) => {
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
		currentFilePath = path.resolve(path.join('.', 'public', currentFilePath));
		const currentFilePathObj = path.parse(currentFilePath);

		let currentFileFolder = currentFilePathObj.dir;
		let currentFileName = currentFilePathObj.name;
		let currentFileExt = currentFilePathObj.ext;

		newFileName = currentFileName.replace(textToFind, textToSubstitute);
		if (newFileName == currentFileName) {
			console.log("Skipping as names are same");
			return;
		}

		let newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
		newFilePath = path.normalize(newFilePath);

		// just for replacing in the DB
		let currentFilePathRelative;
		let newFilePathRelative;

		// checking if file already exists
		try {
			while (true) {
				// try to access the new file name and keep generating new names by incrementing index
				// unless we can not access, i.e. name is not used by existing file and error is raised.
				fs.accessSync(newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				index++
				// generating a new file name for collision
				indexWithPadding = index.toString().padStart(3, '0');
				newFileName = newFileName + '-' + indexWithPadding;
				newFilePath = path.join(currentFileFolder, newFileName + currentFileExt);
				newFilePath = path.normalize(newFilePath);
			}
		} catch (err) {
			try {
				currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');
				newFilePathRelative = newFilePath.replace(pwd + '\\public', '');
				// file not found so we can rename now
				fs.renameSync(currentFilePath, newFilePath);
				imagePaths[imagePaths.indexOf(currentFilePathRelative)] = newFilePathRelative;
				imagePaths.sort();
				renameKey(metadataMap, currentFilePathRelative, newFilePathRelative);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
				success++;
				index++;
				results.set(imageId, newFilePathRelative);
			} catch (err) {
				console.error('Error renaming file:', err);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
				fs.appendFileSync('./logs/rename.log', logMessage);
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

app.post('/moveFiles', (req, res) => {
	const targetFolder = req.body.targetFolder;
	// converting object to a map
	const selectedImages = new Map(Object.entries(req.body.selectedImages));

	// console.log(targetFolder);
	// console.log(selectedImages);

	const targetFolderPath = path.resolve(path.join('.', 'public', 'images', targetFolder));

	// checking if folder exists
	try {
		fs.accessSync(targetFolderPath);
	} catch (err) {
		console.log("new file's directory not found, hence creating");
		try {
			fs.mkdirSync(targetFolderPath, { recursive: true });
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
		currentFilePath = path.resolve(path.join('.', 'public', currentFilePath));
		const currentFilePathObj = path.parse(currentFilePath);
		let newFilePath = path.join(targetFolderPath, currentFilePathObj.base);
		// just for replacing in the DB
		let currentFilePathRelative;
		let newFilePathRelative;

		// checking if file already exists
		try {
			let index = 0;
			while (true) {
				fs.accessSync(newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				fs.appendFileSync('./logs/move.log', logMessage);
				index++
				// generating a new file name for collision
				indexWithPadding = index.toString().padStart(3, '0');
				newFileNameWithIndex = currentFilePathObj.name + '-' + indexWithPadding;
				newFilePath = path.join(targetFolderPath, newFileNameWithIndex + currentFilePathObj.ext);
			}
		} catch (err) {
			try {
				currentFilePathRelative = currentFilePath.replace(pwd + '\\public', '');
				newFilePathRelative = newFilePath.replace(pwd + '\\public', '');
				// file not found so we can rename now
				fs.renameSync(currentFilePath, newFilePath);
				imagePaths[imagePaths.indexOf(currentFilePathRelative)] = newFilePathRelative;
				imagePaths.sort();
				renameKey(metadataMap, currentFilePathRelative, newFilePathRelative);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
				fs.appendFileSync('./logs/move.log', logMessage);
				success++;
				results.set(imageId, newFilePathRelative);
			} catch (err) {
				console.error('Error renaming file:', err);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
				fs.appendFileSync('./logs/move.log', logMessage);
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

let searchResults = new Map();

app.get('/search', async (req, res) => {
	const searchText = req.query.searchText;
	if (!searchText) {
		return res.status(400).send('Invalid search term');
	}

	let matchingImagePaths = [];
	let imageList = imagePaths;
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
		matchingImagePaths = sortByName(matchingImagePaths, sortAsc);
	} else if (sortBy === "size") {
		matchingImagePaths = sortBySize(matchingImagePaths, sortAsc);
	} else if (sortBy === "modifiedTime") {
		matchingImagePaths = sortByModifiedTime(matchingImagePaths, sortAsc);
	} else if (sortBy === "dimensions") {
		matchingImagePaths = sortByDimensions(matchingImagePaths, sortAsc);
	}

	// adding results to Search results map to search faster next time
	// and also preserve the imagelist when lazy loading shuffled results
	const searchKey = searchText + ':::' + sortBy + ':::' + sortAsc;
	console.log(searchKey);
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

app.get('/getNextResults', async (req, res) => {
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

app.get('/config', async (req, res) => {
	res.render('config');
})


function getImageMetadata(imagePath) {
	imageObject = metadataMap.get(imagePath);
	return ({
		imagePath,
		baseName: imageObject.baseName,
		directory: imageObject.directory,
		width: imageObject.width,
		height: imageObject.height,
		resolution: imageObject.resolution,
		sizeBytes: imageObject.sizeBytes,
		sizeReadable: imageObject.sizeReadable,
		mime: imageObject.mime,
		type: imageObject.type,
		modifiedTime: imageObject.modifiedTime
	});
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

function initializeImageMetadata(imagePath) {
	// console.log(`Metadata NOT found in metadataMap, reading from file: ${imagePath}`);
	const absolutePath = path.join(pwd, "public", imagePath);
	const extension = path.extname(imagePath);
	const isVideo = videoExtensions.includes(extension.toLowerCase());
	const isImage = imageExtensions.includes(extension.toLowerCase());

	if (!isVideo && !isImage) {
		reject(new Error(`Unsupported file format: ${extension}`));
		return;
	}

	const fileAttrs = readMediaAttributes(absolutePath);
	const stats = fs.statSync(absolutePath);
	const modifiedTime = stats.mtime.toISOString();
	const sizeBytes = stats.size;
	let sizeReadable;
	const sizeKB = (sizeBytes / 1024).toFixed(2);
	const sizeMB = (sizeBytes / 1048576).toFixed(2);
	if (sizeMB >= 1) {
		sizeReadable = `${sizeMB} MB`;
	} else if (sizeKB >= 1) {
		sizeReadable = `${sizeKB} KB`;
	} else {
		sizeReadable = `${sizeBytes} B`;
	}
	const baseName = path.basename(imagePath);
	const directory = path.dirname(imagePath);
	const width = fileAttrs.width || 400;
	const height = fileAttrs.height || 300;
	const resolution = fileAttrs.width + ' x ' + fileAttrs.height || "0 x 0";
	const mime = fileAttrs.mime;
	const type = isVideo ? 'video' : 'image';

	// adding this to the loaded map (so we dont need to read from DB again)
	metadataMap.set(imagePath, { baseName, directory, width, height, resolution, sizeBytes, sizeReadable, mime, type, modifiedTime });

	// adding to DB for future runs
	insertMetadataToDB(imagePath, baseName, directory, width, height, resolution, sizeBytes, sizeReadable, mime, type, modifiedTime);
	return;
}

async function initializeImagesMetadata(imagePaths) {
	try {
		const promises = imagePaths.map(async imagePath => {
			if (!metadataMap.has(imagePath)) {
				initializeImageMetadata(imagePath);
				return;
			}
		});
		return Promise.all(promises);
	} catch (error) {
		console.error(`Error initializing metadata for images: ${error}`);
	}
}

function insertMetadataToDB(imagePath, baseName, directory, width, height, resolution, sizeBytes, sizeReadable, mime, type, modifiedTime) {
	return new Promise((resolve, reject) => {
		db.run(`
			INSERT INTO metadata (
				imagePath,
				baseName,
				directory,
				width,
				height,
				resolution,
				sizeBytes,
				sizeReadable,
				mime,
				type,
				modifiedTime
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, [
			imagePath,
			baseName,
			directory,
			width,
			height,
			resolution,
			sizeBytes,
			sizeReadable,
			mime,
			type,
			modifiedTime
		], function (err) {
			if (err) {
				console.error('Error inserting metadata into db:', err);
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

function sortByName(imagePaths, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = metadataMap.get(a).baseName.localeCompare(metadataMap.get(b).baseName);
		return ascending ? diff : -diff;
	});
}

function sortBySize(imagePaths, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = metadataMap.get(a).sizeBytes - metadataMap.get(b).sizeBytes;
		return ascending ? diff : -diff;
	});
}

function sortByModifiedTime(imagePaths, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = new Date(metadataMap.get(a).modifiedTime) - new Date(metadataMap.get(b).modifiedTime);
		return ascending ? diff : -diff;
	});
}

function sortByDimensions(imagePaths, ascending = true) {
	return imagePaths.sort((a, b) => {
		const metadataA = metadataMap.get(a);
		const metadataB = metadataMap.get(b);
		// Compare width
		let diff = metadataA.width - metadataB.width;
		// If width is the same, compare height
		if (diff === 0) {
			diff = metadataA.height - metadataB.height;
		}
		return ascending ? diff : -diff;
	});
}

function renameKey(map, oldKey, newKey) {
	if (map.has(oldKey)) {
		map.set(newKey, map.get(oldKey));
		map.delete(oldKey);
	}
}

// Start the server
fs.appendFileSync('./logs/rename.log', `Starting server|||\n`);
app.listen(port, () => console.log(`Server listening on port ${port}`));

// Close the database connection when the program exits
process.on('exit', () => {
	db.close();
});