const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();
const { promisify } = require('util');
const ytdl = require('ytdl-core');

const scanAsync = promisify(docClient.scan).bind(docClient);
const queryAsync = promisify(docClient.query).bind(docClient);
const getAsync = promisify(docClient.get).bind(docClient);
const putAsync = promisify(docClient.put).bind(docClient);

const { hash } = require('../utils/');

module.exports = {
    findByTrackId: async (trackId) => {
        let response = null;

        let item = await getAsync({
            TableName: 'cloud-music',
            Key: {
                id: trackId
            }
        });

        return item.Item;
    },
    find: async (trackId, artistId) => {
        let item = null;

        if (trackId) {
            item = await getAsync({
                TableName: 'cloud-music',
                Key: {
                    id: trackId
                }
            });
            item = item.Item;
        } else if (artistId) {
            for (i = 0; i < 5; i++) {
                let lastKeyEvaluated = hash(new Date().toISOString());
                let Items = await queryAsync({
                    TableName: 'cloud-music',
                    IndexName: 'artist_id-id-index',
                    KeyConditionExpression: "artist_id=:artist_id and id > :last_id",
                    ExpressionAttributeValues: {
                        ':artist_id': artistId,
                        ':last_id': lastKeyEvaluated
                    },
                    Limit: 1
                });
                item = Items.Items[0];
                if (item)
                    break;
            }
            if (!item) {
                let Items = await queryAsync({
                    TableName: 'cloud-music',
                    IndexName: 'artist_id-id-index',
                    KeyConditionExpression: "artist_id=:artist_id",
                    ExpressionAttributeValues: {
                        ':artist_id': artistId
                    },
                    Limit: 1
                });
                item = Items.Items[0];
            }
        } else {
            let lastKeyGet = await getAsync({
                TableName: 'last-key-evaluated',
                Key: {
                    id: "0"
                }
            });
            let lastKeyEvaluated = {
                artist: hash(new Date().toISOString()),
                album_title: hash(new Date().toISOString())
            };
            if (lastKeyGet.Item) {
                lastKeyEvaluated = lastKeyGet.Item.value;
            }
            console.log(lastKeyEvaluated);
            var items;
            items = await scanAsync({
                TableName: 'web-music',
                ExclusiveStartKey: lastKeyEvaluated,
                Limit: 1
            });
            item = items.Items[0];
            if (!item) {
                items = await scanAsync({
                    TableName: 'web-music',
                    Limit: 1
                });
                item = items.Items[0];
            }
            let lastKey = await putAsync({
                TableName: 'last-key-evaluated',
                Item: {
                    id: "0",
                    'value': {artist: item.artist, album_title: item.album_title}
                }
            });
        }
        return item;
    },
    findByArtistAlbumTitle: async (artist_album_title) => {
        //~ const key = JSON.parse(artist_album_title);
        //~ console.log(key);
        //~ let response = null;

        let item = await getAsync({
            TableName: 'web-music',
            Key: JSON.parse(artist_album_title)
        });
        item = item.Item;
        const info = await ytdl.getInfo(item.link);
        //~ console.log(info);
        const audios = info.formats.filter(format => format.hasAudio && !format.hasVideo);
        const biggest = audios.reduce((f0, f1) => (f0.audioBitrate > f1.audioBitrate) ? f0 : f1);
        item.url = biggest.url;

        return item;
    },
}
