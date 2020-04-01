require('v8-compile-cache');
require('./log.js')(true);
const electron = require('electron');
const { app, BrowserWindow, session, net, shell, dialog, Menu, ipcMain } = electron;
const shortcut = require('electron-localshortcut');
const consts = require('./constants.js');
const url = require('url');
const Store = require('electron-store');
const config = new Store();
const fs = require('fs');
const path = require('path');
const urlTarget = 'https://shellshock.io';

let rpc = null;
let clientWindow = null,
	splashWindow = null,
	current = 0;

['SIGTERM', 'SIGHUP', 'SIGINT', 'SIGBREAK'].forEach((signal) => {
  process.on(signal, _ => {
	app.quit()
  })
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.focus();
  else if (clientWindow) {
	 if (clientWindow.isMinimized()) clientWindow.restore();
	 clientWindow.focus();
  }
})

const initSwitches = () => {
	if (config.get('utilities_unlimitedFrames', true)) {
		if (consts.isAMDCPU) app.commandLine.appendSwitch('enable-zero-copy');
		app.commandLine.appendSwitch('disable-gpu-vsync');
        app.commandLine.appendSwitch('disable-frame-rate-limit');
	}
	if (config.get('utilities_d3d11Mode', false)) {
		app.commandLine.appendSwitch('use-angle', 'd3d11');
		app.commandLine.appendSwitch('enable-webgl2-compute-context');
		app.commandLine.appendSwitch('renderer-process-limit', 100);
		app.commandLine.appendSwitch('max-active-webgl-contexts', 100);
	}
	app.commandLine.appendSwitch('enable-quic');
	app.commandLine.appendSwitch('high-dpi-support',1);
	app.commandLine.appendSwitch('ignore-gpu-blacklist');

};
initSwitches();

const spoofUserAgent = () => {
	const user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36';
	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
	details.requestHeaders['User-Agent'] = user_agent;
	callback({ cancel: false, requestHeaders: details.requestHeaders });
	});
}

const initAppMenu = () => { //Need for MacOs Build
	if (process.platform == 'darwin') {
		const template = [{
			label: "Application",
			submenu: [
				{ label: "About Application", selector: "orderFrontStandardAboutPanel:" },
				{ type: "separator" },
				{ label: "Quit", accelerator: "Command+Q", click: _ => app.quit() }
			]
		}, {
			label: "Edit",
			submenu: [
				{ label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
				{ label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
				{ type: "separator" },
				{ label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
				{ label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
				{ label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
				{ label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
			]
		}];
		Menu.setApplicationMenu(Menu.buildFromTemplate(template));
	}
};
initAppMenu();

const initclientWindow = () => {
	clientWindow = new BrowserWindow({
		width: 1600,
		height: 900,
		show: false,
		darkTheme: true,
		center: true,
		webPreferences: {
			nodeIntegration: false,
			webSecurity: false,
			preload: consts.joinPath(__dirname, 'preload.js')
		}
	});
	clientWindow.setMenu(null);
	clientWindow.rpc = rpc;
	clientWindow.loadURL(urlTarget);

	clientWindow.once('ready-to-show', () => {
		if (consts.DEBUG) clientWindow.webContents.openDevTools({ mode: 'undocked' });
		if (config.get('fullscreen', false)) clientWindow.setFullScreen(true);
		splashWindow.destroy();
		clientWindow.show();
	});

	clientWindow.on('focus', () => {
		current = 0;
	});

	clientWindow.once('closed', () => {
		clientWindow = null;
	});

	initShortcuts();
};

const initSplashWindow = () => {
	splashWindow = new BrowserWindow({
		width: 650,
		height: 370,
		transparent: true,
		frame: false,
		skipTaskbar: true,
		center: true,
		resizable: false,
		webPreferences: {
			nodeIntegration: true
		}
	});
	splashWindow.setMenu(null);
	splashWindow.loadURL(url.format({
		pathname: consts.joinPath(__dirname, 'splash.html'),
		protocol: 'file:',
		slashes: true
	}));
	splashWindow.webContents.once('did-finish-load', () => initclientWindow());
};

const initShortcuts = () => {
	const KEY_BINDS = {
		escape: {
			key: 'Esc',
			press: _ => clientWindow.webContents.send('esc')
		},
		quit: {
			key: 'Alt+F4',
			press: _ => app.quit()
		},
		refresh: {
			key: 'F5',
			press: _ => clientWindow.webContents.reloadIgnoringCache()
		},
		fullscreen: {
			key: 'F11',
			press: _ => {
				let full = !clientWindow.isFullScreen();
				clientWindow.setFullScreen(full);
				config.set("fullscreen", full);
			}
		},
    devTools: {
			key: 'F12',
			press: _ => {
				clientWindow.webContents.isDevToolsOpened() 
				? clientWindow.webContents.closeDevTools() 
				: clientWindow.webContents.openDevTools({ mode: 'undocked' });
			}
		},
		clearConfig: {
			key: 'Ctrl+F1',
			press: _ => {
				config.store = {};
				app.relaunch();
				app.quit();
			}
		},
		openConfig: {
			key: 'Shift+F1',
			press: _ => config.openInEditor(),
		}
	}
	Object.keys(KEY_BINDS).forEach(k => {
		shortcut.register(clientWindow, KEY_BINDS[k].key, KEY_BINDS[k].press);
	});
};

app.once('ready', () => {
	spoofUserAgent();
	initSplashWindow()
});
app.on('activate', () => {
	if (clientWindow === null && (splashWindow === null || splashWindow.isDestroyed())) initSplashWindow();
});
app.once('before-quit', () => {
	rpc.destroy().catch(console.error);
	shortcut.unregisterAll();
	clientWindow.close();
});
app.on('window-all-closed', () => app.quit());
app.on('quit', () => app.quit());