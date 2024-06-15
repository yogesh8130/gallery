const express = require('express');
const app = express();
const port = 3000;

const {
	ROOT_IMAGE_PATH
} = require('./src/constants');

const {
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

require('./src/routes')(app, IMAGE_PATHS, METADATA_MAP, SEARCH_RESULTS);

// Initialize the database
initializeMetadataTable().then(
	() => {
		console.log('Initialized metadata table')
		loadMetadataMapFromDB(METADATA_MAP);
	}
).catch(
	(err) => console.error('Error initializing metadata table', err)
)

console.log('Loading files...');

// Capture the start time
let startTime = Date.now();

// Wrap the call to readImageFiles in an async function
(async () => {
	await readImageFiles(IMAGE_PATHS, ROOT_IMAGE_PATH);
	IMAGE_PATHS.sort();
	console.log(`Read ${IMAGE_PATHS.length} files in ${(Date.now() - startTime) / 1000} seconds.`);

	startTime = Date.now();
	console.log("Initialize Images Metadata, looking for new files");
	console.log(`Files in map before initialization: ${METADATA_MAP.size}`);
	await initializeImagesMetadata(IMAGE_PATHS, METADATA_MAP);
	console.log(`Files in map after initialization: ${METADATA_MAP.size}`);
	console.log(`Loaded metadata in ${(Date.now() - startTime) / 1000} seconds.`);
})();

// Start the server
fs.appendFileSync('./logs/rename.log', `Starting server|||\n`);
app.listen(port, () => console.log(`Server listening on port ${port}`));

// Close the database connection when the program exits
process.on('exit', () => {
	db.close();
});