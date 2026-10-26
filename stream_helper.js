#!/usr/bin/env node
/**
 * Stream Helper for XYZ Player
 * Extracts and streams raw audio from YouTube using @distube/ytdl-core
 */
import { Ytdl } from '@distube/ytdl-core';

process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
});

const videoId = process.argv[2];
const mode = process.argv[3] || 'stream';

if (!videoId) {
  console.error(JSON.stringify({ error: 'Video ID required' }));
  process.exit(1);
}

const ytdl = new Ytdl();
const url = `https://www.youtube.com/watch?v=${videoId}`;

async function run() {
  try {
    const info = await ytdl.getInfo(url);

    if (mode === 'info') {
      const details = info.videoDetails;
      const audioFormats = info.formats.filter(f => !f.hasVideo && f.hasAudio);
      process.stdout.write(JSON.stringify({
        id: videoId,
        title: details.title,
        author: details.author?.name || details.ownerChannelName,
        duration: parseInt(details.lengthSeconds || '0', 10),
        thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url,
        formats: audioFormats.map(f => ({
          itag: f.itag,
          mimeType: f.mimeType,
          bitrate: f.bitrate,
          contentLength: f.contentLength
        }))
      }));
      process.exit(0);
    }

    // Default: stream audio
    const stream = ytdl.download(info, {
      filter: { hasAudio: true, hasVideo: false },
      quality: 'highestaudio',
      highWaterMark: 1 << 20
    });

    stream.pipe(process.stdout);

    stream.on('error', (err) => {
      console.error('Stream error:', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('YTDL Error:', err.message);
    process.exit(1);
  }
}

run();
