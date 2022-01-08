
const musics = [
    ['Maroon 5', 'The B-Side Collection', 'Story', 'https://music.youtube.com/watch?v=q_KuAQcwaec'],
    ['Maroon 5', 'The B-Side Collection', 'Infatuation', 'https://music.youtube.com/watch?v=U4nJu4kd7DU'],
    ['周杰倫', '葉惠美', '她的睫毛', 'https://music.youtube.com/watch?v=AUO__poQLok'],
    ['周杰倫', '八度空間', '半島鐵盒', 'https://music.youtube.com/watch?v=dsUTcSVdU2U'],
    ['周杰倫', '八度空間', '暗號', 'https://music.youtube.com/watch?v=EU9-clxTh4A'],
    ['周杰倫', '八度空間', '火車叨位去', 'https://music.youtube.com/watch?v=swNhHdlK_tk'],
    ['Avril Lavigne', 'Let Go', 'Complicated', 'https://music.youtube.com/watch?v=DTtb9rt1tnk'],
    ['Avril Lavigne', 'Let Go', 'Losing Grip', 'https://music.youtube.com/watch?v=Y0nSey__LW8'],
    ['Avril Lavigne', 'Let Go', 'Tomorrow', 'https://music.youtube.com/watch?v=ImHCBOD66TI'],
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
    const params = {
      TableName: 'WebMusic',
      Item: {
        ArtistTitle: [artist, title].join(delimiter),
        Album: album,
        IsMusic: 1,
        ArtistAlbumTitle: [artist, album, title].join(delimiter),
        Link: link,
      }
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
