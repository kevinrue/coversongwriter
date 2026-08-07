const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SONGS_DIR = path.join(__dirname, 'data', 'songs');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ID_PATTERN = /^[a-z0-9-]+$/;

function slugify(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'song'}-${suffix}`;
}

function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

function songPath(id) {
  return path.join(SONGS_DIR, `${id}.json`);
}

async function ensureSongsDir() {
  await fs.mkdir(SONGS_DIR, { recursive: true });
}

async function readSong(id) {
  const raw = await fs.readFile(songPath(id), 'utf8');
  const song = JSON.parse(raw);
  if (song.parodyTitle === undefined) song.parodyTitle = '';
  if (song.parodyArtist === undefined) song.parodyArtist = '';
  return song;
}

async function writeSong(song) {
  await fs.writeFile(songPath(song.id), JSON.stringify(song, null, 2), 'utf8');
}

// List all songs (summary only)
app.get('/api/songs', async (req, res) => {
  try {
    await ensureSongsDir();
    const files = await fs.readdir(SONGS_DIR);
    const songs = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const song = JSON.parse(await fs.readFile(path.join(SONGS_DIR, f), 'utf8'));
          return {
            id: song.id,
            title: song.title,
            artist: song.artist,
            updatedAt: song.updatedAt,
          };
        })
    );
    songs.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    res.json(songs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list songs' });
  }
});

// Get a single song (full detail)
app.get('/api/songs/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid song id' });
  try {
    const song = await readSong(id);
    res.json(song);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Song not found' });
    console.error(err);
    res.status(500).json({ error: 'Failed to read song' });
  }
});

// Create a new song from pasted original lyrics
app.post('/api/songs', async (req, res) => {
  const { title, artist, originalLyrics } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (typeof originalLyrics !== 'string' || !originalLyrics.trim()) {
    return res.status(400).json({ error: 'Original lyrics are required' });
  }

  try {
    await ensureSongsDir();
    const originalLines = originalLyrics.replace(/\r\n/g, '\n').split('\n');
    const id = slugify(title);
    const now = new Date().toISOString();
    const song = {
      id,
      title: title.trim(),
      artist: typeof artist === 'string' ? artist.trim() : '',
      originalLines,
      parodyLines: originalLines.map(() => ''),
      parodyTitle: '',
      parodyArtist: '',
      createdAt: now,
      updatedAt: now,
    };
    await writeSong(song);
    res.status(201).json(song);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create song' });
  }
});

// Update parody lyrics (and optionally title/artist) for an existing song
app.put('/api/songs/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid song id' });

  const { parodyLines, title, artist, parodyTitle, parodyArtist } = req.body || {};

  try {
    const song = await readSong(id);

    if (parodyLines !== undefined) {
      if (!Array.isArray(parodyLines) || !parodyLines.every((l) => typeof l === 'string')) {
        return res.status(400).json({ error: 'parodyLines must be an array of strings' });
      }
      if (parodyLines.length !== song.originalLines.length) {
        return res.status(400).json({ error: 'parodyLines length must match originalLines length' });
      }
      song.parodyLines = parodyLines;
    }
    if (typeof title === 'string' && title.trim()) song.title = title.trim();
    if (typeof artist === 'string') song.artist = artist.trim();
    if (typeof parodyTitle === 'string') song.parodyTitle = parodyTitle.trim();
    if (typeof parodyArtist === 'string') song.parodyArtist = parodyArtist.trim();

    song.updatedAt = new Date().toISOString();
    await writeSong(song);
    res.json(song);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Song not found' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// Delete a song
app.delete('/api/songs/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid song id' });
  try {
    await fs.unlink(songPath(id));
    res.status(204).end();
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Song not found' });
    console.error(err);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

app.listen(PORT, () => {
  console.log(`Cover Song Writer running at http://localhost:${PORT}`);
});
