const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

const appRoot = __dirname;

contextBridge.exposeInMainWorld('electronFS', {
  readBinary: (relPath) => {
    const abs = path.resolve(appRoot, relPath);
    if (!abs.startsWith(appRoot + path.sep)) {
      throw new Error('Path outside app package is not allowed');
    }
    const buf = fs.readFileSync(abs);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
  platform: process.platform,
});
