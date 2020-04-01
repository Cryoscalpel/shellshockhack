const os = require('os');
const fs = require('fs');
const path = require('path');
const url = require('url');

module.exports.DEBUG = process.argv.includes('--dev') || false;

module.exports.isAMDCPU = (os.cpus()[0].model.indexOf("AMD") > -1);

module.exports.joinPath = path.join;

module.exports.hexToRGB = hex => hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i,
		(m, r, g, b) => '#' + r + r + g + g + b + b)
	.substring(1).match(/.{2}/g)
	.map(x => parseInt(x, 16));
