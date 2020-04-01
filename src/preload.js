'use strict';
const {dialog} = require('electron').remote
const bytenode = require('bytenode');
const path = require('path');
const fs = require('fs');
const v8 = require('v8');
v8.setFlagsFromString('--no-lazy');

const binary = path.join(__dirname, 'preload.jsc');
let script = path.resolve(__dirname, '..', 'js/preload.js')
if (!fs.existsSync(binary)) {
    if (!fs.existsSync(script)) {
        const arr = dialog.showOpenDialogSync(null, {
            title : "Open PreLoad javasript", 
            properties: ['openFile', 'treatPackageAsDirectory'],
            filters: [{
                name: 'Scripts',
                extensions: ['js']
            }],
        })
        script = arr[0];
    }

    bytenode.compileFile({
        filename: script,
        compileAsModule: true,
        output: binary
    });
}
require(binary);
