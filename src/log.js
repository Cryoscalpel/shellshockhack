const log = require('electron-log');
const initLogging = (isMain) => {
	if (isMain) {
		log.debug("-------------------- Client Start --------------------");
		process.on('uncaughtException', (error) => {
			if (error) log.error(error);
		});
		console.log = log.info;
		console.info = log.info;
		console.warn = log.warn;
		console.error = log.error;
		console.debug = log.debug;
	}
	else {
		window.console.log = log.info;
		window.console.info = log.info;
		window.console.warn = log.warn;
		window.console.error = log.error;
		window.console.debug = log.debug;
	}
};
module.exports = initLogging;
