const sqlite3 = require('sqlite3').verbose();
// Create SQLite database connection
const db = new sqlite3.Database('metadata.db');


function initializeMetadataTable() {
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

module.exports = {
	initializeMetadataTable,
	loadMetadataMapFromDB
};