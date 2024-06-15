const sqlite3 = require('sqlite3').verbose();
// Create SQLite database connection
const db = new sqlite3.Database('metadata.db');


function initializeMetadataTable() {
	return new Promise((resolve, reject) => {
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
		)`, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

function loadMetadataMapFromDB(METADATA_MAP) {
	db.all(`SELECT * FROM metadata`, (err, rows) => {
		if (err) {
			console.error('Error getting metadata from DB', err);
			return;
		}
		rows.forEach(row => {
			const { imagePath,
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
			} = row;

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
}

function insertMetadataToDB(
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
) {
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

module.exports = {
	initializeMetadataTable,
	loadMetadataMapFromDB,
	insertMetadataToDB
};