const crypto = require('crypto');
const { promisify } = require('util');
const AWS = require('aws-sdk');
const ytdl = require('./ytdl');

exports.queueGetPlayableContent = async (event) => {
  const attributes = event.payload.selectionCriteria.attributes;
  // Entity Type 	Catalog Type
  // TRACK 	AMAZON.MusicRecording
  // ALBUM 	AMAZON.MusicAlbum
  // ARTIST 	AMAZON.MusicGroup
  // PLAYLIST 	AMAZON.MusicPlaylist
  // GENRE 	AMAZON.Genre
  // STATION 	AMAZON.BroadcastChannel
  if (attributes.length == 1 && attributes[0].type == 'MEDIA_TYPE'
      && attributes[0].value == 'TRACK') {
    return allMusicQueue;
  }
  //~ var track = attributes.find(({ type }) => {
    //~ return type === 'MEDIA_TYPE';
  //~ });
  //~ var track = attributes.find(({ type }) => {
    //~ return type === 'TRACK';
  //~ });
  //~ var artist = attributes.find(({ type }) => {
    //~ return type === 'ARTIST';
  //~ });
  //~ if (track) track = track.entityId;
  //~ if (artist) artist = artist.entityId;
}

exports.queueInitiate = async (event) => {
  if (event.payload.contentId === allMusicQueue.id) {
    return allMusicQueue;
  }
}

exports.queueGetNextItem = async (event) => {
  if (event.payload.currentItemReference.queueId === allMusicQueue.id) {
    return allMusicQueue;
  }
}

exports.queueGetPreviousItem = async (event) => {
  if (event.payload.currentItemReference.queueId === allMusicQueue.id) {
    return allMusicQueue;
  }
}

exports.callGetPlayableContent = async (event, queue) => {
  const header = new Header('Alexa.Media.Search', 'GetPlayableContent.Response');
  const payload = {
    content: {
      id: queue.id,
      actions: {
        playable: true,
        browsable: false
      },
      metadata: new PlaylistMetadata(queue.name),
    },
  };
  return {header, payload};
}

exports.callInitiate = async (event, queue) => {
  const entry = await queue.getInitial();
  const uri = await resolveLink(entry.Link);
  const header = new Header('Alexa.Media.Playback', 'Initiate.Response');
  const payload = {
    playbackMethod: {
      type: 'ALEXA_AUDIO_PLAYER_QUEUE',
      id: queue.id,
      rules: {
        feedback: {
          type: 'PREFERENCE',
          enabled: false
        },
      },
      firstItem: new Item(entry, uri),
    },
  };
  return {header, payload};
}

exports.callGetNextItem = async (event, queue) => {
  const entry = await queue.getNext(event.payload.currentItemReference.id);
  const uri = await resolveLink(entry.Link);
  const header = new Header('Alexa.Audio.PlayQueue', 'GetNextItem.Response');
  const payload = {
    isQueueFinished: queue.isFinished,
    item: new Item(entry, uri),
  };
  return {header, payload};
}

exports.callGetPreviousItem = async (event, queue) => {
  const entry = await queue.getPrevious(event.payload.currentItemReference.id);
  const uri = await resolveLink(entry.Link);
  const header = new Header('Alexa.Audio.PlayQueue', 'GetPreviousItem.Response');
  const payload = {
    item: new Item(entry, uri),
  };
  return {header, payload};
}

const docClient = new AWS.DynamoDB.DocumentClient();
const db = {
  scanAsync: promisify(docClient.scan).bind(docClient),
  queryAsync: promisify(docClient.query).bind(docClient),
  getAsync: promisify(docClient.get).bind(docClient),
  putAsync: promisify(docClient.put).bind(docClient),
  queryOneEntryAsync : async (params) => {
    params.Limit = 1;
    const entries = await db.queryAsync(params);
    return entries.Items[0];
  },
}

class AllMusicQueue {
  constructor() {
    this.id = 'Playlist.AllMusic';
    this.name = 'All music';
    this.isFinished = false;  // Wraps around both ways and never finishes.
  }
  async getInitial() {
    const alphaBet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = alphaBet.charAt(Math.floor(Math.random() * alphaBet.length));
    return this.getNext(randomLetter)
  }
  async getNext(currentId) {
    var entry = null;
    if (currentId) {
      entry = await this.queryOneEntryAsync(currentId);
    }
    if (!entry) {
      entry = await this.queryOneEntryAsync();
    }
    return entry;
  }
  async getPrevious(currentId) {
    var entry = null;
    if (currentId) {
      entry = await this.queryOneEntryAsync(currentId, false);
    }
    if (!entry) {
      entry = await this.queryOneEntryAsync(null, false);
    }
    return entry;
  }
  async queryOneEntryAsync(currentId = null, scanForward = true) {
    var expr = 'IsMusic = :isMusic';
    var attr = {
      ':isMusic': 1,
    };
    if (currentId) {
      const direction = scanForward ? '>' : '<';
      expr = `${expr} and ArtistAlbumTitle ${direction} :currentId`;
      attr[':currentId'] = currentId;
    }
    return db.queryOneEntryAsync({
      TableName: 'WebMusic',
      IndexName: 'IsMusic-ArtistAlbumTitle-index',
      KeyConditionExpression: expr,
      ExpressionAttributeValues: attr,
      ScanIndexForward: scanForward,
    });
  }
}

const allMusicQueue = new AllMusicQueue();

async function resolveLink(link) {
  const info = await ytdl.getInfo(link);
  const audios = info.formats.filter(fmt => fmt.hasAudio && !fmt.hasVideo);
  const biggest = audios.reduce(
      (f0, f1) => (f0.audioBitrate > f1.audioBitrate) ? f0 : f1);
  return biggest.url;
}

function hash(value) {
  return crypto.createHash('sha1').update(value).digest('base64');
}

function newId() {
  return hash(new Date().toISOString());
}

class Header {
  constructor(namespace, name) {
    this.namespace = namespace;
    this.name = name;
    this.messageId = newId();
    this.payloadVersion = '1.0';
  }
}

const DELIM = ' ||| ';

class Item {
  constructor(entry, uri) {
    const [artist, album, title] = entry.ArtistAlbumTitle.split(DELIM);
    this.id = entry.ArtistAlbumTitle;
    this.playbackInfo = new PlaybackInfo();
    this.metadata = new TrackMetadata(artist, album, title);
    this.controls = bidirectionalControls();
    this.rules = new ItemRules();
    this.stream = new Stream(entry.ArtistAlbumTitle, uri);
  }
}

class PlaybackInfo {
  type = 'DEFAULT';
}

class SpeechInfo {
  type = 'PLAIN_TEXT';
  constructor(text) {
    this.text = text;
  }
}

class MetadataNameProperty {
  constructor(text) {
    this.speech = new SpeechInfo(text);
    this.display = text;
  }
}

class EntityMetadata {
  constructor(text) {
    this.name = new MetadataNameProperty(text);
  }
}

class BaseMetadata {
  type = null;
  constructor(text, sources = []) {
    this.name = new MetadataNameProperty(text);
    this.art = {sources};
  }
}

class PlaylistMetadata extends BaseMetadata {
  type = 'PLAYLIST';
}

class TrackMetadata extends BaseMetadata {
  type = 'TRACK';
  constructor(artist, album, title, sources = []) {
    super(title, sources);
    this.authors = [
      new EntityMetadata(artist),
    ];
    this.album = new EntityMetadata(album);
  }
}

class Stream {
  constructor(id, uri) {
    this.id = id;
    this.uri = uri;
    this.offsetInMilliseconds = 0;
    this.validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }
}

class ItemControl {
  type = 'COMMAND';
  enabled = true;
  constructor(name) {
    this.name = name;
  }
}

function bidirectionalControls() {
  return [new ItemControl('NEXT'), new ItemControl('PREVIOUS')];
}

class ItemRules {
  feedbackEnabled = false;
}
