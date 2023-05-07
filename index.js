const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Serve the static files in the public folder
app.use(express.static('public'));

// Specify the custom views directory
app.set('views', './views');

// Set the view engine to use EJS
app.set('view engine', 'ejs');

// Define the path to the root image folder
// const imagePath = path.join(__dirname, 'public', 'images');
const imagePath = "./public/images";

// Create an array to store all image paths recursively
let imagePaths = [];

// Function to read image files recursively and populate the imagePaths array
let readImageFiles = (directory) => {
	fs.readdirSync(directory).forEach((file) => {
		const fullPath = path.join(directory, file);

		if (fs.statSync(fullPath).isDirectory()) {
			readImageFiles(fullPath);
		} else {
			// Add the file path to the array only if it is an image file
			const ext = path.extname(fullPath).toLowerCase();
			if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.gif') {
				// imagePaths.push(fullPath.replace(/^public/, ''));
				imagePaths.push(fullPath.replace(/^public/, ''));
			}
		}
	});
};

// Call the readImageFiles function with the root image folder path
readImageFiles(imagePath);

app.get('/refreshDB', (req, res) => {
	try {
		imagePaths = [];
		readImageFiles(imagePath);
		res.sendStatus(200); // send a success response to the client
	} catch (error) {
		console.error(error);
		res.status(500).send('Error refreshing database'); // send an error response to the client
	}
});


// Define a route to handle requests for the main page
app.get('/', (req, res) => {
	// Select a random image from the array of image paths
	const randomIndex = Math.floor(Math.random() * imagePaths.length);
	const randomImagePath = imagePaths[randomIndex];

	const filename = path.basename(randomImagePath);
	const directoryPath = path.dirname(randomImagePath);

	// Create an object to store the data
	const data = {
		imagePath: randomImagePath,
		filename: filename,
		directoryPath: directoryPath,
		index: randomIndex
	};

	// Render the main page with the selected image path as a parameter
	// console.log(randomImagePath);
	res.render('index', data);
});

// Define a route to handle requests for a random image
app.get('/random-image', (req, res) => {
	const randomIndex = Math.floor(Math.random() * imagePaths.length);
	const randomImagePath = imagePaths[randomIndex];

	const filename = path.basename(randomImagePath);
	const directoryPath = path.dirname(randomImagePath);

	const responseData = {
		randomImagePath: randomImagePath,
		filename: filename,
		directoryPath: directoryPath,
		index: randomIndex
	};

	console.log("randomImagePath: " + randomImagePath);
	res.send(responseData);
});

// Define a route to handle requests for the next image
app.get('/next', (req, res) => {
	const currentImagePath = req.query.currentImagePath.replace(/\//g, '\\');
	console.log("currentImagePath:" + currentImagePath);
	const currentIndex = imagePaths.indexOf(currentImagePath);
	const nextIndex = (currentIndex + 1) % imagePaths.length;
	const nextImagePath = imagePaths[nextIndex];

	const filename = path.basename(nextImagePath);
	const directoryPath = path.dirname(nextImagePath);

	const responseData = {
		nextImagePath: nextImagePath,
		filename: filename,
		directoryPath: directoryPath,
		index: nextIndex
	};

	res.send(responseData);
});

// Define a route to handle requests for the previous image
app.get('/previous', (req, res) => {
	const currentImagePath = req.query.currentImagePath.replace(/\//g, '\\');
	console.log("currentImagePath:" + currentImagePath);
	const currentIndex = imagePaths.indexOf(currentImagePath);
	const previousIndex = (currentIndex - 1 + imagePaths.length) % imagePaths.length;
	const previousImagePath = imagePaths[previousIndex];

	const filename = path.basename(previousImagePath);
	const directoryPath = path.dirname(previousImagePath);

	const responseData = {
		previousImagePath: previousImagePath,
		filename: filename,
		directoryPath: directoryPath,
		index: previousIndex
	};

	res.send(responseData);
});

// Define a route to handle file renaming
app.get('/rename', (req, res) => {
	console.log("RENAME");

	const newFileName = req.query.newFileName;
	const currentFilePath = req.query.currentFilePath;
	const currentFilePathRelative = "./public" + currentFilePath;
	const ext = path.extname(currentFilePath).toLowerCase();

	// console.log("newFileName: " + newFileName);
	// console.log("currentFilePath: " + currentFilePath);
	// console.log("ext: " + ext);

	// Get the directory and file name from the current file path
	const pathParts = currentFilePathRelative.split('/');
	const directoryPath = pathParts.slice(0, -1).join('/');
	const currentFileName = pathParts[pathParts.length - 1];

	// console.log("pathParts: " + pathParts);
	// console.log("directoryPath: " + directoryPath);

	// Generate the new file path based on the new file name and the directory path
	const newFilePathRelative = `${directoryPath}/${newFileName}${ext}`;
	// console.log("newFilePath: " + newFilePathRelative);

	// Rename the file using the fs module
	// console.log("currentFilePathRelative: " + currentFilePathRelative);
	console.log("newFilePathRelative: " + newFilePathRelative);
	// Check if a file with the new file name already exists
	fs.access(newFilePathRelative, (err) => {
		if (err) {
			// Rename the file using the fs module
			fs.rename(currentFilePathRelative, newFilePathRelative, (err) => {
				if (err) {
					console.error(err);
					res.status(500).send('Error renaming file');
				} else {
					console.log("File renamed successfully");
					res.status(200).json({
						newFilePath: newFilePathRelative
					});
				}
			});
		} else {
			// If the file already exists, send an error response
			res.status(400).send('A file with the same name already exists.');
		}
	});
});


// // All results in one page
// app.get('/search', (req, res) => {
// 	const searchText = req.query.searchText;
// 	const matchingImagePaths = imagePaths.filter((imagePath) =>
// 		imagePath.toLowerCase().includes(searchText.toLowerCase())
// 	);
// 	res.render('searchResults', { matchingImagePaths });
// });

app.get('/search', (req, res) => {
	const searchText = req.query.searchText;
	const matchingImagePaths = imagePaths.filter((imagePath) =>
		imagePath.toLowerCase().includes(searchText.toLowerCase())
	);

	const totalResultCount = matchingImagePaths.length;

	const page = req.query.page || 1;
	const perPage = 100;
	const startIndex = (page - 1) * perPage;
	const endIndex = startIndex + perPage;

	const pageImagePaths = matchingImagePaths.slice(startIndex, endIndex);
	const totalPages = Math.ceil(matchingImagePaths.length / perPage);

	res.render('searchResults', {
		searchText,
		totalResultCount,
		matchingImagePaths: pageImagePaths,
		page,
		totalPages,
	});
});



// Start the server
app.listen(port, () => console.log(`Server listening on port ${port}`));
