## Introduction
A gallery that works in your browser. Runs on Node.JS
This is meant for viewing your images and videos without being constrained to the directory structures.
Makes discovering stuff easier with instant search and exploring fun with shuffle mode.
The text you see on the screen is always hyperlinked and will take you to similar content based on the file/directory names.

Currently this does not read the file tags but may integrate that in furture, so currently it is important that your image names and folder names are meaningful for search to work.

## Features

- Supports large libraries: Tested with 200,000+ images
- Instantaneous search with support for token based search (using and/or/not logic) or regex
- Bulk renaming/moving files (deleting only renames the files by adding "###deleted" to their name so you can review and delete them later all in one go)

## Screenshots

![vgy.me](https://i.vgy.me/kLmV3y.png)

## Setting Up

1. **Clone the Git Repository**: First, you need to clone the Git repository to your local machine. Open a terminal or command prompt and use the git clone command followed by the repository URL.

	```
	git clone https://github.com/yogesh8130/gallery.git
	```

2. **Navigate to the Project Directory**: Once the repository is cloned, navigate into the project directory using the cd command:

	```
	cd <project directory>
	```

3. **Install Node.js Dependencies**: Dependencies are listed in a package.json file. To install these dependencies, use npm (Node Package Manager). Run the following command in the project directory:

	This command reads the package.json file and installs all the necessary dependencies into a node_modules folder in your project directory.
	```
	npm install
	```
3. Place the hardlinks / junctions / symlinks / folders containing images in `<project folder>/public/images/<here>`  
   
4. **Start the Application**: To start the Node.js application run the following command:

	```
	cd <project directory>
	node index.js
	```
	First start may take more time as the files are scanned for metadata. (You can see this as high disk READ activity in Task Manager and CPU usage)

	Note: Turning off windows defender drastically improves the read speed on SSD.

5. The gallery website can then be accessed on the same system with below url:  
	```
	Localhost:3000
	```
	or you can access on your lan with (may need to open firewall port)
	```
	<ip address of PC where server is running>:3000
	```

6. See the in application side bar (in the UI in your browser) for more details like search syntax and other tips and tricks.

