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

function pruneDB(IMAGE_PATHS) {
	return new Promise((resolve, reject) => {
		const batchSize = 10000;
		const numBatches = Math.ceil(IMAGE_PATHS.length / batchSize);
		let currentBatch = 0;
		let entriesPruned = 0;
		function pruneNextBatch() {
			const start = currentBatch * batchSize;
			const end = Math.min((currentBatch + 1) * batchSize, IMAGE_PATHS.length);
			const batch = IMAGE_PATHS.slice(start, end);
			// Prepare array of placeholders for parameterized query
			const placeholders = Array(batch.length).fill('?').join(', ');
			// Delete entries not in the current batch
			db.run(`DELETE FROM metadata WHERE imagePath NOT IN (${placeholders})`, batch, function (err, result) {
				if (err) {
					console.error('Error pruning metadata table:', err);
					reject(err);
					return;
				}
				// Count the number of entries pruned in this batch
				entriesPruned += this.changes;
				// Move to the next batch
				currentBatch++;
				// If there are more batches, recursively prune the next batch
				if (currentBatch < numBatches) {
					pruneNextBatch();
				} else {
					// Resolve with the total number of entries pruned
					resolve(entriesPruned);
				}
			});
		}
		// Start pruning with the first batch
		pruneNextBatch();
	});
}


module.exports = {
	initializeMetadataTable,
	loadMetadataMapFromDB,
	insertMetadataToDB,
	pruneDB
};