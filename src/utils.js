const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
// Create SQLite database connection

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





function getImageMetadata(imagePath, metadataMap) {
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

async function getImagesMetadata(imagePaths, metadataMap) {
	try {
		// takes an array of image/video paths and returns array of image objects by calling getImageMetadata for each file
		const promises = imagePaths.map(imagePath => getImageMetadata(imagePath, metadataMap));
		return Promise.all(promises);
	} catch (error) {
		console.error(`Error getting metadata: ${error}`);
	}
}

function initializeImageMetadata(imagePath, metadataMap) {
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

async function initializeImagesMetadata(imagePaths, metadataMap) {
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

function sortByName(imagePaths,metadataMap, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = metadataMap.get(a).baseName.localeCompare(metadataMap.get(b).baseName);
		return ascending ? diff : -diff;
	});
}

function sortBySize(imagePaths,metadataMap, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = metadataMap.get(a).sizeBytes - metadataMap.get(b).sizeBytes;
		return ascending ? diff : -diff;
	});
}

function sortByModifiedTime(imagePaths,metadataMap, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = new Date(metadataMap.get(a).modifiedTime) - new Date(metadataMap.get(b).modifiedTime);
		return ascending ? diff : -diff;
	});
}

function sortByDimensions(imagePaths,metadataMap, ascending = true) {
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

module.exports = {
	initializeImagesMetadata,
	insertMetadataToDB,
	shuffle,
	sortByName,
	sortBySize,
	sortByModifiedTime,
	sortByDimensions,
	renameKey,
	getImagesMetadata
}