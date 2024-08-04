const sqlite3 = require('sqlite3').verbose();
// Create SQLite database connection
const db = new sqlite3.Database('metadata.db');

async function initializeMetadataTable() {
	try {
		// Create a table to store metadata if it doesn't exist
		await new Promise((resolve, reject) => {
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
		console.log('Metadata table initialized');
	} catch (err) {
		throw err;
	}
}

async function loadMetadataMapFromDB(METADATA_MAP) {
	console.log('Loading metadata from DB...');
	const startTime = Date.now();
	try {
		const rows = await new Promise((resolve, reject) => {
			db.all(`SELECT * FROM metadata`, (err, rows) => {
				if (err) {
					reject(err);
				} else {
					resolve(rows);
				}
			});
		});

		for (const row of rows) {
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
		}
	} catch (err) {
		console.error('Error getting metadata from DB', err);
		throw err;
	}
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
	console.log('Pruning metadata table...');
	return new Promise((resolve, reject) => {
		// Fetch all existing image paths from the database
		db.all('SELECT imagePath FROM metadata', (err, rows) => {
			if (err) {
				console.error('Error fetching image paths from metadata table:', err);
				reject(err);
				return;
			}
			// Extract the image paths from the database result
			console.log("Creating array of image paths");
			const dbImagePaths = rows.map(row => row.imagePath);
			console.log("Converting IMAGE_PATHS to a Set for fast lookup");
			// with this: 0.829 seconds, without: 189 seconds LOL
			const imagePathSet = new Set(IMAGE_PATHS);
			console.log("Identifying image paths to delete (not in IMAGE_PATHS)");
			const pathsToDelete = dbImagePaths.filter(path => !imagePathSet.has(path));

			// Function to execute deletion in batches
			const deleteInBatches = async (paths, batchSize = 999) => {
				for (let i = 0; i < paths.length; i += batchSize) {
					const batch = paths.slice(i, i + batchSize);
					const placeholders = batch.map(() => '?').join(', ');
					await new Promise((batchResolve, batchReject) => {
						db.run(`DELETE FROM metadata WHERE imagePath IN (${placeholders})`, batch, function (err) {
							if (err) {
								console.error('Error pruning metadata table:', err);
								batchReject(err);
							} else {
								batchResolve(this.changes);
							}
						});
					});
				}
			};

			// Delete the identified paths from metadata table in batches
			if (pathsToDelete.length > 0) {
				console.log("Deleting image paths from metadata table");
				deleteInBatches(pathsToDelete, 999)
					.then(() => resolve(pathsToDelete.length))
					.catch(err => reject(err));
			} else {
				// If no paths to delete, resolve with 0 changes
				resolve(0);
			}
		});
	});
}

module.exports = {
	initializeMetadataTable,
	loadMetadataMapFromDB,
	insertMetadataToDB,
	pruneDB
};