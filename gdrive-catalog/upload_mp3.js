const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const recursive = require('recursive-readdir');
const {promisify} = require('util');
const musicMetadata = require('music-metadata');

const CLIENT_SECRET_PATH = process.env.CLIENT_SECRET_PATH;
const TOKEN_PATH = 'token.json';
const DRIVE_MUSIC_FOLDER_ID = process.env.DRIVE_MUSIC_FOLDER_ID;

const asyncReadFile = promisify(fs.readFile);

const DEBUG = process.env.DEBUG == '1';

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listFiles(auth) {
  const drive = google.drive({version: 'v3', auth});
  const res = await drive.files.list({
    q: "mimeType='audio/mpeg'",
    pageSize: 10,
    fields: 'nextPageToken, files(id, name, properties)',
  });
  const files = res.data.files;
  if (files.length) {
    debugLog('Files:');
    files.map((file) => {
      const pr = file.properties;
      console.log(`${file.name} (${file.id}) (${pr.artist} ${pr.album} ${pr.title})`);
    });
  }
}

async function scanDirectory(dir) {
  debugLog(dir);
  return await promisify(recursive)(dir);
}

async function readMetadata(filePath) {
  const metadata = await musicMetadata.parseFile(filePath, { native: false });
  return { metadata, filePath };
}

async function createFolderUnderParent(drive, name, parentId) {
  var fileMetadata = {
    'name': name,
    'mimeType': 'application/vnd.google-apps.folder',
    parents: [parentId]
  };
  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  });
  console.log('Created folder: ', name);
  return folder.data.id;
}

async function getFolderId(drive, name, parentId) {
  return await getFileId(drive, 'application/vnd.google-apps.folder', name, parentId);
}

async function getFileId(drive, mime, name, parentId) {
  var qterm = `mimeType = '${mime}' and name = '${name}' and parents in '${parentId}'`;
  const res = await drive.files.list({
    q: qterm,
    fields: 'nextPageToken, files(id, name)',
  });
  const files = res.data.files;
  if (files.length == 1) {
    const file = files[0];
    debugLog(`Found ${mime}: ${file.name} (${file.id}); do nothing.`);
    return file.id;
  } else if (files.length > 1) {
    throw `More than 1 ${mime} found with name ${name}`;
  }
}

async function maybeCreateFolderUnderParent(drive, name, parentId) {
  const folderId = await getFolderId(drive, name, parentId);
  if (folderId) {
    return folderId;
  }
  console.log(`Did not find a folder with name "${name}" under parentId ${parentId}; creating it ...`);
  return await createFolderUnderParent(drive, name, parentId);
}

async function scanAndCreateFolders(auth) {
  const drive = google.drive({version: 'v3', auth});
  const folder = process.argv[2];
  const files = await scanDirectory(folder);
  const promises = files.map(async (x) => { return [x, await musicMetadata.parseFile(x, {native: false})]; });
  const metadatas = await Promise.all(promises);
  var artistsAndAlbums = metadatas.map(it => [it[1].common.artist, it[1].common.album])
  artistsAndAlbums = new Set(artistsAndAlbums.map(it => JSON.stringify(it)));
  debugLog("artistsAndAlbums=", artistsAndAlbums);
  for (const it of artistsAndAlbums) {
    var [artist, album] = JSON.parse(it);
    debugLog(artist, album);
    const artistFolderId = await maybeCreateFolderUnderParent(drive, artist, DRIVE_MUSIC_FOLDER_ID);
    debugLog("artistFolderId=", artistFolderId);
    const albumFolderId = await maybeCreateFolderUnderParent(drive, album, artistFolderId);
    debugLog("albumFolderId=", albumFolderId);
  }
  return metadatas;
}

async function uploadFiles(auth, metadatas) {
  const drive = google.drive({version: 'v3', auth});
  const promises = metadatas.map(async ([filepath, metadata]) => {
    const artist = metadata.common.artist;
    const album = metadata.common.album;
    const title = metadata.common.title;
    debugLog("filepath=", filepath);
    debugLog("artist=", artist);
    debugLog("album=", album);
    debugLog("title=", title);
    const artistFolderId = await getFolderId(drive, artist, DRIVE_MUSIC_FOLDER_ID);
    const albumFolderId = await getFolderId(drive, album, artistFolderId);
    debugLog("artistFolderId=", artistFolderId);
    debugLog("albumFolderId=", albumFolderId);
    if (!albumFolderId) {
      throw `Did not find a folder for album ${album}`;
    }
    const mime = 'audio/mpeg';
    const filename = `${title}.mp3`;
    var fileId = await getFileId(drive, mime, filename, albumFolderId);
    if (!fileId) {
      debugLog("filename=", filename);
      var fileMetadata = {
        name: filename,
        properties: {artist, album, title},
        parents: [albumFolderId]
      };
      debugLog("fileMetadata=", fileMetadata);
      var media = {
        mimeType: 'audio/mpeg',
        body: fs.createReadStream(filepath)
      };
      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });
      fileId = file.data.id;
      console.log('Uploaded fileId=', fileId, 'for', artist, album, filename);
    }
    console.log('Found existing fileId=', fileId, 'for', artist, album, filename);
    return {fileId, artist, album, title};
  });
  const files = await Promise.all(promises);
  debugLog('files=', files);
}

async function main() {
  const content = await asyncReadFile(CLIENT_SECRET_PATH);
  const credentials = JSON.parse(content)
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);
  const token = await asyncReadFile(TOKEN_PATH);
  oAuth2Client.setCredentials(JSON.parse(token));
  await listFiles(oAuth2Client);
  const metadatas = await scanAndCreateFolders(oAuth2Client);
  console.log("Done scanAndCreateFolders.");
  await uploadFiles(oAuth2Client, metadatas);
  console.log("Done uploadFiles.");
}

main();
