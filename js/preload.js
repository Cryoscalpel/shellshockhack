require('./log.js')();
const log = require('electron-log');
const consts = require('./constants.js');
const { remote, ipcRenderer } = require('electron');
const clientWindow = remote.getCurrentWindow();

const initIPC = () => {
	ipcRenderer.on('esc', () => {
		document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
		document.exitPointerLock();
	});
	ipcRenderer.on('log', console.log);
};
initIPC();