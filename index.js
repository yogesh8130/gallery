const express = require('express');
const app = express();
const port = 30000;

const {
	ROOT_IMAGE_PATH
} = require('./src/constants');

const {
	sortByPath,
	readImageFiles,
	initializeImagesMetadata
} = require('./src/fileUtils');

const {
	initializeMetadataTable,
	loadMetadataMapFromDB
} = require('./src/dbUtils');

const path = require('path');
const fs = require('fs');

// const sharp = require('sharp');
// const ffprobe = require('ffprobe');
// const ffprobeStatic = require('ffprobe-static');

const { log, error, info } = require('console');
const { constants } = require('buffer');


// Middleware to parse JSON data in post requests
app.use(express.json());

// Serve the static files in the public folder
app.use(express.static('public'));

// Specify the custom views directory
app.set('views', './views');

// Set the view engine to use Pug
app.set('view engine', 'pug');



// Create an array to store all image paths recursively
let IMAGE_PATHS = [];
// map of searched queries and matching image paths
let SEARCH_RESULTS = new Map();
// Create map of all image metadata
let METADATA_MAP = new Map();
let FOLDER_PATHS = [];

require('./src/routes')(app, IMAGE_PATHS, METADATA_MAP, SEARCH_RESULTS, FOLDER_PATHS);

// Initialize the Image List and metadata
// THIS IS CURRENTLY DUPLICATED IN ROUTES.JS; Needs refactoring
(async () => {
	try {
		const startTimeTotal = Date.now();
		let startTime = Date.now();
		await initializeMetadataTable();
		await loadMetadataMapFromDB(METADATA_MAP);
		console.log(`Loaded metadata from DB in ${(Date.now() - startTime) / 1000} seconds.`);
		startTime = Date.now();
		console.log(`Files in map: ${METADATA_MAP.size}`);
		console.log('Reading files from disk...');
		await readImageFiles(IMAGE_PATHS, ROOT_IMAGE_PATH, FOLDER_PATHS);
		// console.log(FOLDER_PATHS);
		sortByPath(IMAGE_PATHS);
		console.log(`Read ${IMAGE_PATHS.length} files in ${(Date.now() - startTime) / 1000} seconds.`);
		startTime = Date.now();
		console.log("Initializing Image Metadata (reading metadata from disk for files missing in DB)");
		console.log(`Files in map before initialization: ${METADATA_MAP.size}`);
		console.log(`Loading metadata...`);
		await initializeImagesMetadata(IMAGE_PATHS, METADATA_MAP);
		console.log(`Files in map after initialization: ${METADATA_MAP.size}`);
		console.log(`Loaded metadata in ${(Date.now() - startTime) / 1000} seconds.`);
		console.log(`Total time: ${(Date.now() - startTimeTotal) / 1000} seconds.`);
	} catch (err) {
		console.error('Error initializing metadata table', err);
	}
})();

// Start the server
fs.appendFileSync('./logs/rename.log', `${new Date().toISOString()}|Starting server||\n`);
app.listen(port, () => console.log(`Server listening on port ${port}`));

// Close the database connection when the program exits
process.on('exit', () => {
	db.close();
});