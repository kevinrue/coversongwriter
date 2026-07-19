# Cover Song Writer

A local web app for writing parody cover songs, with the original lyrics (read-only) and your parody lyrics (editable) side by side.

## Features

- Side-by-side view: original lyrics on the left (read-only), parody lyrics on the right (editable)
- Parody lyrics auto-save to disk (`data/songs/`) so your work persists between sessions
- Working on a parody line highlights the corresponding original line (and clicking an original line jumps you to its parody line)

## Usage

```
npm install
npm start
```

Then open http://localhost:3000.

Click **+ New Song** to paste in a song's title, artist, and original lyrics (one line per row), then write your parody line-by-line next to the original. Changes save automatically a moment after you stop typing.

## Notes

- A song's original lyrics are fixed once created; only the parody lyrics are editable afterward.
- Parody lines are paired 1:1 with the original lines (same line count), which is what makes the line highlighting possible.
