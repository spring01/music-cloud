
const musics = [
    ['Maroon 5', 'The B-Side Collection', 'Story', 'https://music.youtube.com/watch?v=q_KuAQcwaec'],
    ['周杰倫', '葉惠美', '她的睫毛', 'https://music.youtube.com/watch?v=AUO__poQLok'],
];

const AWS = require('aws-sdk');
const OpenCC = require('opencc');

const converter = new OpenCC('t2s.json');

AWS.config.update({region: 'us-east-1'});
const docClient = new AWS.DynamoDB.DocumentClient();
const delimiter = ' ||| ';

async function main() {
  musics.map(async music => {
    var [artist, album, title, link] = music;
    artist = await converter.convertPromise(artist);
    album = await converter.convertPromise(album);
    title = await converter.convertPromise(title);
    const album_title = [album, title].join(delimiter);
    const params = {
      TableName: 'web-music',
      Item: {artist, album_title, album, title, link}
    };
    console.log(params);
    docClient.put(params, function(err, data) {
      if (err) {
        console.log("Error", err);
      } else {
        console.log("Success", data);
      }
    });
  });
}

main();
