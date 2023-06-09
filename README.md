## Introduction
This is just a gallery that works in yout browser, and is meant for viewing your images and videos without being constrained to the directory structures.
Makes discovering stuff easier with instant search and exploring fun with shuffle mode.
The text you see on the screen is always hyperlinked and will take you to similar content based on the file/directory names.

Currently this does not read the file tags but may integrate that in furture, so currently it is important that your image names and folder names are meaningful for search to work.

Notes:
1. Images are only shuffled once per every search and list is not shuffled untill next search

## Getting Started
Place the hardlinks / junctions / symlinks / folders containing images in `<project folder>/public/images/<here>`  

Using a terminal `cd` to the project folder where `index.js` file is located  
Run the server with `node .\index.js`

The gallery website can then be accessed on the same system with below url:  
`Localhost:3000`  
or you can access on your lan with
`<ip address where server is running>:3000`

## Searching
Searching is done in three modes (case insensitive)
1. Normal: entire string is searched in all filenames
2. Advanced: if the search string includes && || or !! then search is automatically done in advanced mode  
E.g. potato && tomato || apple !! mango  

	1. First && tokens are processed, file must contain all such tokens to be included in the result. First token is by default an && token, so file name must contain potato AND tomato  
	2. The || tokens are processed, if file contains ANY one of these tokens, it will be included in result i.e. any files containing apple will be added even if they dont contain potato or tomato and these will be added to the list created by first step  
	3. Lastly !! tokens are processed, any file containing any of these are removed from the results computed so far by first two steps  

3. Regex: If you're one of those, just begin your search by //

## Browsing
All file names and folder names are hyperlinks and will start another search

1. File name links are searched after stripping numbers and extensions, so if you are viewing apple (11).png or apple-111.mp4, then search will be done for "apple" and "apple-" respectively. This is helpful when you want to list down entire series of a picture or video or something
2. Folder names are searched as is and will return everthing in recursive manner

Clicking on image will take you to its own separate page. And you can traverse forward or backward.

## Hotkeys
Work when a text box is not in focus.

- f - toggle fullscreen(immersive)

### Search Screen

- s - Toggle shuffle
- 1 - View images at actual size
- 2 - Images are streched to available space
- 3 - Images bigger than screen are shrinked to fit smaller images are zoomed to a max of 75% of screen height

### Main Screen

- Left - previous image/video as per folder path
- Right - next image/video as per folder paths
- Down - a random image/video is shown
- Up - previous random image

PC / landscape  
![PC / landscape](https://i.vgy.me/rSixTa.png)
Phone / Portrait  
<img src='https://i.vgy.me/6fXWzS.png' style="width:600px;">
