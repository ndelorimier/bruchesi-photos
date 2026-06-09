const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

function streamZip(res, files, zipName) {
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  res.setHeader('Content-Type', 'application/zip');
  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.pipe(res);
  for (const filePath of files) {
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: path.basename(filePath) });
    }
  }
  archive.finalize();
}

module.exports = { streamZip };
