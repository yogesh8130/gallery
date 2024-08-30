// Define the path to the root image folder
const ROOT_IMAGE_PATH = "./public/images";

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.avi'];
const IMAGE_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp', '.gif']
const ALLOWED_EXTENSIONS = [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS];

const RENAME_LOG_FILE = './logs/rename.log';

//export { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS, ALLOWED_EXTENSIONS }

module.exports = {
	ROOT_IMAGE_PATH,
	VIDEO_EXTENSIONS,
	IMAGE_EXTENSIONS,
	ALLOWED_EXTENSIONS,
	RENAME_LOG_FILE
}