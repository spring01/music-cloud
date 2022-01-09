const crypto = require('crypto');
const { promisify } = require('util');
const AWS = require('aws-sdk');
const ytdl = require('ytdl-core');

const docClient = new AWS.DynamoDB.DocumentClient();
const scanAsync = promisify(docClient.scan).bind(docClient);
const queryAsync = promisify(docClient.query).bind(docClient);
const getAsync = promisify(docClient.get).bind(docClient);
const putAsync = promisify(docClient.put).bind(docClient);

const ALL_MUSIC_QUEUE = 'Playlist.AllMusic';
const DELIM = ' ||| ';

exports.callGetPlayableContent = async (event) => {
  const attributes = event.payload.selectionCriteria.attributes;
  // Entity Type 	Catalog Type
  // TRACK 	AMAZON.MusicRecording
  // ALBUM 	AMAZON.MusicAlbum
  // ARTIST 	AMAZON.MusicGroup
  // PLAYLIST 	AMAZON.MusicPlaylist
  // GENRE 	AMAZON.Genre
  // STATION 	AMAZON.BroadcastChannel
  const header = new Header('Alexa.Media.Search', 'GetPlayableContent.Response');
  var id;
  var speechText;
  console.log(attributes);
  if (attributes.length == 1 && attributes[0].type == 'MEDIA_TYPE'
      && attributes[0].value == 'TRACK') {
    id = ALL_MUSIC_QUEUE;
    speechText = 'All music';
  }
  const payload = {
    content: {
      id,
      actions: {
        playable: true,
        browsable: false
      },
      metadata: new PlaylistMetadata(speechText),
    },
  };
  return {header, payload};
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
  //~ console.log('track=', track);
  //~ console.log('artist=', artist);
  //~ return await find(event);
}

exports.callInitiate = async (event) => {
  var id;
  var entry = null;
  if (event.payload.contentId === ALL_MUSIC_QUEUE) {
    id = ALL_MUSIC_QUEUE;
    const alphaBet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = alphaBet.charAt(Math.floor(Math.random() * alphaBet.length));
    const entries = await queryAsync({
      TableName: 'WebMusic',
      IndexName: 'IsMusic-ArtistAlbumTitle-index',
      KeyConditionExpression: 'IsMusic = :isMusic and ArtistAlbumTitle > :artistAlbumTitle',
      ExpressionAttributeValues: {
        ':isMusic': 1,
        ':artistAlbumTitle': randomLetter,
      },
      Limit: 1,
    });
    entry = entries.Items[0];
    if (!entry) {
      const entries = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic',
        ExpressionAttributeValues: {
          ':isMusic': 1,
        },
        Limit: 1,
      });
      entry = entries.Items[0];
    }
  }
  const uri = await resolveLink(entry.Link);
  const header = new Header('Alexa.Media.Playback', 'Initiate.Response');
  const payload = {
    playbackMethod: {
      type: 'ALEXA_AUDIO_PLAYER_QUEUE',
      id,
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

exports.callGetNextItem = async (event) => {
  var isQueueFinished = null;
  var entry;
  const currentItemReference = event.payload.currentItemReference;
  if (currentItemReference.queueId === ALL_MUSIC_QUEUE) {
    const lastItemContentId = currentItemReference.id;  // contentId is queueId
    if (lastItemContentId) {
      const entries = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic and ArtistAlbumTitle > :artistAlbumTitle',
        ExpressionAttributeValues: {
          ':isMusic': 1,
          ':artistAlbumTitle': lastItemContentId,
        },
        Limit: 1,
      });
      entry = entries.Items[0];
    }
    if (!entry) {
      const entries = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic',
        ExpressionAttributeValues: {
          ':isMusic': 1,
        },
        Limit: 1,
      });
      entry = entries.Items[0];
    }
    isQueueFinished = false;
  }
  const uri = await resolveLink(entry.Link);
  const header = new Header('Alexa.Audio.PlayQueue', 'GetNextItem.Response');
  const payload = {
    isQueueFinished,
    item: new Item(entry, uri),
  };
  return {header, payload};
}

exports.callGetPreviousItem = async (event) => {
  var entry = null;
  const currentItemReference = event.payload.currentItemReference;
  if (currentItemReference.queueId === ALL_MUSIC_QUEUE) {
    const currentItemContentId = currentItemReference.id;  // contentId is queueId
    if (currentItemContentId) {
      const entries = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic and ArtistAlbumTitle < :artistAlbumTitle',
        ExpressionAttributeValues: {
          ':isMusic': 1,
          ':artistAlbumTitle': currentItemContentId,
        },
        Limit: 1,
        ScanIndexForward: false,
      });
      entry = entries.Items[0];
    }
    if (!entry) {
      const entries = await queryAsync({
        TableName: 'WebMusic',
        IndexName: 'IsMusic-ArtistAlbumTitle-index',
        KeyConditionExpression: 'IsMusic = :isMusic',
        ExpressionAttributeValues: {
          ':isMusic': 1,
        },
        Limit: 1,
        ScanIndexForward: false,
      });
      entry = entries.Items[0];
    }
  }
  const uri = await resolveLink(entry.Link);
  const header = new Header('Alexa.Audio.PlayQueue', 'GetPreviousItem.Response');
  const payload = {
    item: new Item(entry, uri),
  };
  return {header, payload};
}

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
