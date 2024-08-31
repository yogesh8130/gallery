const PATH = require('path');
const FS = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const PWD = process.cwd();
const { readMediaAttributes } = require('leather'); // much smaller and faster than ffmpeg
const { insertMetadataToDB } = require('./dbUtils');
const pug = require('pug');

const compileImageDetailsTemplate = pug.compileFile('views/image-details.pug');

const {
	VIDEO_EXTENSIONS,
	IMAGE_EXTENSIONS,
	ALLOWED_EXTENSIONS,
	RENAME_LOG_FILE
} = require('./constants');

const readImageFiles = async (IMAGE_PATHS, directory, depth = 0, maxDepth = 20) => {
	let files;
	try {
		files = await FS.promises.readdir(directory);
	} catch (error) {
		console.error(`Error reading directory '${directory}': ${error.message}`);
		return;
	}
	const subDirectories = [];

	await Promise.all(
		files.map(async (file) => {
			const fullPath = PATH.join(directory, file);
			try {
				const stat = await FS.promises.stat(fullPath);
				if (stat.isDirectory()) {
					if (depth < maxDepth) {
						subDirectories.push(fullPath);
					}
				} else {
					const ext = PATH.extname(fullPath).toLowerCase();
					if (ALLOWED_EXTENSIONS.includes(ext) && !fullPath.includes("###deleted")) {
						IMAGE_PATHS.push(fullPath.replace(/^public/, ''));
					}
				}
			} catch (error) {
				console.error(`Error processing path: ${fullPath}: ${error.message}`);
			}
		})
	);

	await Promise.all(
		subDirectories.map(async (subDirectory) => {
			await readImageFiles(IMAGE_PATHS, subDirectory, depth + 1, maxDepth);
		})
	);
};

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
	const absolutePath = PATH.join(PWD, "public", imagePath);
	const extension = PATH.extname(imagePath);
	const isVideo = VIDEO_EXTENSIONS.includes(extension.toLowerCase());
	const isImage = IMAGE_EXTENSIONS.includes(extension.toLowerCase());

	if (!isVideo && !isImage) {
		reject(new Error(`Unsupported file format: ${extension}`));
		return;
	}

	const fileAttrs = readMediaAttributes(absolutePath);
	const stats = FS.statSync(absolutePath);
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
	const baseName = PATH.basename(imagePath);
	const directory = PATH.dirname(imagePath);
	const mime = fileAttrs.mime;
	const type = isVideo ? 'video' : 'image';

	if (!fileAttrs.width) {
		console.log(`Unable to read resolution metadata with leather so trying with ffmpeg: ${imagePath}`);
		// Use ffmpeg to get the resolution
		ffmpeg.ffprobe(absolutePath, function (err, metadata) {
			if (err) {
				console.error(`Error retrieving metadata with ffmpeg for ${imagePath}`);
				// console.error(`Error retrieving metadata with ffmpeg for ${imagePath}: ${err.message}`);
				return;
			}

			const stream = metadata.streams.find(s => s.width && s.height);
			const width = stream.width;
			const height = stream.height;
			const resolution = `${width} x ${height}`;

			// adding this to the loaded map (so we don't need to read from DB again)
			metadataMap.set(imagePath, {
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
			});

			// adding to DB for future runs
			insertMetadataToDB(
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
			);
		});
	} else {
		const width = fileAttrs.width || 400;
		const height = fileAttrs.height || 300;
		const resolution = fileAttrs.width + ' x ' + fileAttrs.height || "0 x 0";
		// adding this to the loaded map (so we dont need to read from DB again)
		metadataMap.set(imagePath, {
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
		});

		// adding to DB for future runs
		insertMetadataToDB(
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
		);
	}
}

async function initializeImagesMetadata(imagePaths, metadataMap) {
	try {
		const promises = imagePaths.map(async imagePath => {
			if (!metadataMap.has(imagePath)) {
				initializeImageMetadata(imagePath, metadataMap);
				return;
			}
		});
		return Promise.all(promises);
	} catch (error) {
		console.error(`Error initializing metadata for images: ${error}`);
	}
}

function sortByName(imagePaths, metadataMap, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = metadataMap.get(a).baseName.localeCompare(metadataMap.get(b).baseName);
		return ascending ? diff : -diff;
	});
}

function sortBySize(imagePaths, metadataMap, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = metadataMap.get(a).sizeBytes - metadataMap.get(b).sizeBytes;
		return ascending ? diff : -diff;
	});
}

function sortByModifiedTime(imagePaths, metadataMap, ascending = true) {
	return imagePaths.sort((a, b) => {
		const diff = new Date(metadataMap.get(a).modifiedTime) - new Date(metadataMap.get(b).modifiedTime);
		return ascending ? diff : -diff;
	});
}

function sortByDimensions(imagePaths, metadataMap, ascending = true) {
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

function moveRenameFiles(IMAGE_PATHS, METADATA_MAP,
	operation, currentFilePaths, argument1, argument2) {

	let successCount = 0;
	let failCount = 0;
	let newImagesData = new Map();

	let index = 0;

	currentFilePaths.forEach((currentFilePath, imageId) => {

		currentFilePath = PATH.resolve(PATH.join('.', 'public', currentFilePath));
		const currentFilePathObj = PATH.parse(currentFilePath);
		const currentFileDir = currentFilePathObj.dir;
		const currentFileName = currentFilePathObj.name;
		const currentFileExt = currentFilePathObj.ext;
		let newFileName;
		let newFilePath;
		// For udpating IMAGE_PATHS and METADATA_MAP
		let currentFilePathRelative = currentFilePath.replace(PWD + '\\public', '');
		let newFilePathRelative;

		switch (operation) {
			case 'delete':
				newFileName = currentFileName + "###deleted";
				newFilePath = PATH.join(currentFileDir, (newFileName + currentFileExt));
				break;
			case 'rename':
				newFileName = argument1;
				newFilePath = PATH.join(currentFileDir, (newFileName + currentFileExt));
				break;
			case 'renameBulk':
				newFileName = argument1;
				index++;
				let indexWithPadding = index.toString().padStart(3, '0');
				// index is ALWAYS appended during bulkrename
				newFileName = newFileName + '-' + indexWithPadding;
				newFilePath = PATH.join(currentFileDir, (newFileName + currentFileExt));
				break;
			case 'appendToName':
				const textToAppend = argument1;
				const parts = textToAppend.split(/[;,]/);
				const trimmedParts = parts.map(function (part) {
					return part.trim();
				});
				newFileName = currentFileName;
				trimmedParts.forEach(function (part) {
					if (newFileName.toLocaleLowerCase().indexOf(part.toLowerCase()) === -1) {
						newFileName += " " + part;
					}
				});
				if (newFileName == currentFileName) {
					console.log("Not appending as text is already in current name");
					return;
				}
				// because we dont want to keep incrementing index
				index = 0;
				newFilePath = PATH.join(currentFileDir, (newFileName + currentFileExt));
				break;
			case 'prependToName':
				const textToPrepend = argument1;
				if (!currentFileName.startsWith(textToPrepend)) {
					newFileName = textToPrepend + ' ' + currentFileName;
				} else {
					console.log("Not prepending as name already starts with the prefix");
					return;
				}
				index = 0;
				newFilePath = PATH.join(currentFileDir, (newFileName + currentFileExt));
				break;
			case "removeFromName":
				const textToRemove = argument1;
				const removeregex = new RegExp(textToRemove, 'gi'); // case insensitive
				newFileName = currentFileName;
				if (currentFileName.toLowerCase().includes(textToRemove.toLowerCase())) {
					newFileName = currentFileName.replace(removeregex, "").trim();
				} else {
					console.log("Nothing to remove");
					return;
				}
				index = 0;
				newFilePath = PATH.join(currentFileDir, (newFileName + currentFileExt));
				break;
			case 'replaceInName':
				const textToFind = argument1;
				const textToSubstitute = argument2;
				const replaceregex = new RegExp(textToFind, 'gi'); // case insensitive
				newFileName = currentFileName.replace(replaceregex, textToSubstitute);
				if (newFileName == currentFileName) {
					console.log("Skipping as names are same");
					return;
				}
				index = 0;
				newFilePath = PATH.join(currentFileDir, (newFileName + currentFileExt));
				break;
			case 'moveFiles':
				const targetFolder = argument1;
				const targetFolderPath = PATH.resolve(PATH.join('.', 'public', 'images', targetFolder));
				newFilePath = PATH.join(targetFolderPath, (currentFileName + currentFileExt));
				break;
			default:
				throw new Error(`Invalid operation: ${operation}`);
		}

		newFilePath = PATH.normalize(newFilePath);

		// checking if folder exists as per the new file name
		try {
			FS.accessSync(PATH.dirname(newFilePath));
		} catch (err) {
			console.log(`new file's directory not found, hence creating directory: ${PATH.dirname(newFilePath)}`);
			try {
				FS.mkdirSync(PATH.dirname(newFilePath), { recursive: true });
			} catch (err) {
				console.error(`Error creating directory: ${PATH.dirname(newFilePath)}: ${err.message}`);
				failCount++;
				newImagesData.set(imageId, 'fail');
				// not ending the loop, just returning for current callback function
				// will continue with the next callback function i.e. remaining files
				return;
			}
		}

		// checking if file already exists, we MUST prevent collisions beforehand
		// FS.renameSync otherwise will overwrite existing file with the new file on collision
		try {
			while (true) {
				// try to access the new file name and keep generating new names by incrementing index
				// unless we can not access, i.e. name is not used by existing file and error is raised.
				FS.accessSync(newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Collision\n`;
				FS.appendFileSync(RENAME_LOG_FILE, logMessage);
				index++
				// generating a new file name for collision
				let indexWithPadding = index.toString().padStart(3, '0');
				let newFileNameWithIndex = newFileName + '-' + indexWithPadding;
				newFilePath = PATH.join(currentFileDir, (newFileNameWithIndex + currentFileExt));
				newFilePath = PATH.normalize(newFilePath);
			}
		} catch (err) {
			// file not found so we can rename/move now
			try {
				newFilePathRelative = newFilePath.replace(PWD + '\\public', '');
				FS.renameSync(currentFilePath, newFilePath);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Success\n`;
				FS.appendFileSync(RENAME_LOG_FILE, logMessage);
				successCount++;
				let newImageName, newFolderName, newImageDetails;
				if (operation !== 'delete') {
					// updating IMAGE_PATHS	and METADATA_MAP
					IMAGE_PATHS[IMAGE_PATHS.indexOf(currentFilePathRelative)] = newFilePathRelative;
					IMAGE_PATHS.sort();
					renameKey(METADATA_MAP, currentFilePathRelative, newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).baseName = PATH.basename(newFilePathRelative);
					METADATA_MAP.get(newFilePathRelative).directory = PATH.dirname(newFilePathRelative);
					// getting new image data to update stuff on page
					newImageName = METADATA_MAP.get(newFilePathRelative).baseName;
					newFolderName = METADATA_MAP.get(newFilePathRelative).directory;
					// render .imagesidebar again
					newImageDetails = compileImageDetailsTemplate({
						imagePath : newFilePathRelative,
						imageLinkEscaped : encodeURIComponent(newFilePathRelative),
						imageName: newImageName,
						folderName: newFolderName,
						imageResolution: METADATA_MAP.get(newFilePathRelative).resolution,
						imageSizeReadable: METADATA_MAP.get(newFilePathRelative).sizeReadable
					})
					console.log(newImageDetails);
				} else {
					IMAGE_PATHS.splice(IMAGE_PATHS.indexOf(currentFilePathRelative), 1);
					METADATA_MAP.delete(currentFilePathRelative);
				}
				newImagesData.set(imageId, {
					newFilePathRelative: newFilePathRelative,
					newImageTitle: newImageName,
					newSubTitle: newFolderName,
					newImageDetails: newImageDetails
				});
			} catch (err) {
				console.error(`Error renaming file: ${currentFilePath}: ${err.message}`, err);
				const logMessage = `${new Date().toISOString()}|${currentFilePath}|${newFilePath}|Fail: ${err}\n`;
				FS.appendFileSync(RENAME_LOG_FILE, logMessage);
				failCount++;
				newImagesData.set(imageId, 'fail');
			}
		}
	});
	return {
		successCount: successCount,
		failCount: failCount,
		newImagesData: newImagesData
	};
}

module.exports = {
	readImageFiles,
	initializeImagesMetadata,
	insertMetadataToDB,
	shuffle,
	sortByName,
	sortBySize,
	sortByModifiedTime,
	sortByDimensions,
	renameKey,
	getImagesMetadata,
	moveRenameFiles
}