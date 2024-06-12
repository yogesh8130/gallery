const express = require('express');
const app = express();
const port = 3000;
const { initializeImagesMetadata, getImagesMetadata, sortBySize, sortByModifiedTime, sortByDimensions, renameKey, shuffle } = require('./src/utils');

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
	
	
	const pwd = process.cwd();
	
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
let IMAGE_PATHS = [];
let SEARCH_RESULTS = new Map();
// Create map of all image metadata
let METADATA_MAP = new Map();

require('./src/routes')(app, IMAGE_PATHS, METADATA_MAP, SEARCH_RESULTS);

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
		METADATA_MAP.set(imagePath, rowData);
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
	let files;
	try {
		files = await fs.promises.readdir(directory);
	} catch (error) {
		console.error(`Error reading directory: ${directory}`);
		return;
	}
	const subDirectories = [];

	await Promise.all(
		files.map(async (file) => {
			const fullPath = path.join(directory, file);
			try {
				const stat = await fs.promises.stat(fullPath);
				if (stat.isDirectory()) {
					if (depth < maxDepth) {
						subDirectories.push(fullPath);
					}
				} else {
					const ext = path.extname(fullPath).toLowerCase();
					if (allowedExtensions.includes(ext) && !fullPath.includes("###deleted")) {
						IMAGE_PATHS.push(fullPath.replace(/^public/, ''));
					}
				}
			} catch (error) {
				console.error(`Error processing path: ${fullPath}`);
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

	IMAGE_PATHS.sort();

	console.log("Initialize Images Metadata, looking for new files");

	console.log(`Files in map before initialization: ${METADATA_MAP.size}`);
	await initializeImagesMetadata(IMAGE_PATHS, METADATA_MAP);
	console.log(`Files in map after initialization: ${METADATA_MAP.size}`);

	// Capture the end time
	const endTime = Date.now();

	// Log the time it took to load the files in seconds
	console.log(`Loaded ${IMAGE_PATHS.length} files in ${(endTime - startTime) / 1000} seconds.`);
})();



// Start the server
fs.appendFileSync('./logs/rename.log', `Starting server|||\n`);
app.listen(port, () => console.log(`Server listening on port ${port}`));

// Close the database connection when the program exits
process.on('exit', () => {
	db.close();
});