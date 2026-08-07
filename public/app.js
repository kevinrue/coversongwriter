const state = {
  songs: [],
  currentSong: null,
  saveTimer: null,
  saveInFlight: false,
  pendingSaveAfterInFlight: false,
};

const el = {
  songList: document.getElementById('song-list'),
  letterIndex: document.getElementById('letter-index'),
  newSongBtn: document.getElementById('new-song-btn'),
  newSongForm: document.getElementById('new-song-form'),
  newTitle: document.getElementById('new-title'),
  newArtist: document.getElementById('new-artist'),
  newLyrics: document.getElementById('new-lyrics'),
  createSongBtn: document.getElementById('create-song-btn'),
  cancelNewSongBtn: document.getElementById('cancel-new-song-btn'),
  newSongError: document.getElementById('new-song-error'),
  editor: document.getElementById('editor'),
  songTitle: document.getElementById('song-title'),
  songArtist: document.getElementById('song-artist'),
  saveStatus: document.getElementById('save-status'),
  deleteSongBtn: document.getElementById('delete-song-btn'),
  parodyTitleDisplay: document.getElementById('parody-title-display'),
  parodyTitleText: document.getElementById('parody-title-text'),
  parodyTitleInput: document.getElementById('parody-title-input'),
  parodyArtistDisplay: document.getElementById('parody-artist-display'),
  parodyArtistText: document.getElementById('parody-artist-text'),
  parodyArtistInput: document.getElementById('parody-artist-input'),
  linesGrid: document.getElementById('lines-grid'),
  emptyState: document.getElementById('empty-state'),
};

function showPanel(panel) {
  el.newSongForm.classList.add('hidden');
  el.editor.classList.add('hidden');
  el.emptyState.classList.add('hidden');
  panel.classList.remove('hidden');
}

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadSongList() {
  state.songs = await api('/api/songs');
  renderSongList();
}

function renderSongList() {
  const sorted = [...state.songs].sort((a, b) => a.title.localeCompare(b.title));
  buildLetterIndex(sorted);

  el.songList.innerHTML = '';
  for (const song of sorted) {
    const li = document.createElement('li');
    li.dataset.id = song.id;
    li.dataset.letter = song.title.charAt(0).toUpperCase();
    if (state.currentSong && state.currentSong.id === song.id) li.classList.add('active');
    li.innerHTML = `
      <div class="song-item-title">${escapeHtml(song.title)}</div>
      <div class="song-item-artist">${escapeHtml(song.artist || '')}</div>
    `;
    li.addEventListener('click', () => selectSong(song.id));
    el.songList.appendChild(li);
  }
}

function buildLetterIndex(songs) {
  const letters = new Set();
  for (const song of songs) {
    const letter = song.title.charAt(0).toUpperCase();
    if (/[A-Z]/.test(letter)) {
      letters.add(letter);
    }
  }

  const sorted = Array.from(letters).sort();
  el.letterIndex.innerHTML = '';

  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.textContent = letter;
    btn.dataset.letter = letter;

    if (sorted.includes(letter)) {
      btn.addEventListener('click', () => scrollToLetter(letter));
    } else {
      btn.classList.add('inactive');
      btn.disabled = true;
    }

    el.letterIndex.appendChild(btn);
  }
}

function scrollToLetter(letter) {
  const items = el.songList.querySelectorAll('li');
  for (const item of items) {
    if (item.dataset.letter === letter) {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      break;
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function selectSong(id) {
  const song = await api(`/api/songs/${id}`);
  state.currentSong = song;
  renderSongList();
  renderEditor(song);
  showPanel(el.editor);
}

function renderEditor(song) {
  el.songTitle.textContent = song.title;
  el.songArtist.textContent = song.artist || '';
  el.parodyTitleText.textContent = song.parodyTitle || '';
  el.parodyArtistText.textContent = song.parodyArtist || '';
  el.parodyTitleInput.value = song.parodyTitle || '';
  el.parodyArtistInput.value = song.parodyArtist || '';
  deactivateParodyEdit('title');
  deactivateParodyEdit('artist');
  setSaveStatus('saved');

  el.linesGrid.innerHTML = '';
  song.originalLines.forEach((originalLine, index) => {
    const row = document.createElement('div');
    row.className = 'line-row';
    row.dataset.index = String(index);

    const originalEl = document.createElement('div');
    originalEl.className = 'original-line';
    originalEl.textContent = originalLine;
    if (originalLine.trim() === '') {
      originalEl.classList.add('blank-line');
    }
    originalEl.addEventListener('click', () => {
      const textarea = el.linesGrid.querySelector(`textarea[data-index="${index}"]`);
      if (textarea) textarea.focus();
    });

    const textarea = document.createElement('textarea');
    textarea.className = 'parody-line';
    textarea.dataset.index = String(index);
    textarea.rows = 1;
    textarea.value = song.parodyLines[index] || '';
    if (originalLine.trim() === '') {
      textarea.classList.add('blank-line');
    }
    textarea.addEventListener('focus', () => setActiveRow(index));
    textarea.addEventListener('input', () => {
      autoResize(textarea);
      scheduleSave();
    });

    row.appendChild(originalEl);
    row.appendChild(textarea);
    el.linesGrid.appendChild(row);

    requestAnimationFrame(() => autoResize(textarea));
  });
}

function setActiveRow(index) {
  el.linesGrid.querySelectorAll('.line-row.active').forEach((r) => r.classList.remove('active'));
  const row = el.linesGrid.querySelector(`.line-row[data-index="${index}"]`);
  if (row) {
    row.classList.add('active');
    row.scrollIntoView({ block: 'nearest' });
  }
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function activateParodyEdit(field) {
  if (field === 'title') {
    el.parodyTitleDisplay.classList.add('hidden');
    el.parodyTitleInput.classList.remove('hidden');
    el.parodyTitleInput.value = state.currentSong.parodyTitle || '';
    el.parodyTitleInput.focus();
    el.parodyTitleInput.select();
  } else if (field === 'artist') {
    el.parodyArtistDisplay.classList.add('hidden');
    el.parodyArtistInput.classList.remove('hidden');
    el.parodyArtistInput.value = state.currentSong.parodyArtist || '';
    el.parodyArtistInput.focus();
    el.parodyArtistInput.select();
  }
}

function deactivateParodyEdit(field) {
  if (field === 'title') {
    el.parodyTitleDisplay.classList.remove('hidden');
    el.parodyTitleInput.classList.add('hidden');
    el.parodyTitleText.textContent = state.currentSong.parodyTitle || '';
  } else if (field === 'artist') {
    el.parodyArtistDisplay.classList.remove('hidden');
    el.parodyArtistInput.classList.add('hidden');
    el.parodyArtistText.textContent = state.currentSong.parodyArtist || '';
  }
}

function setSaveStatus(status) {
  el.saveStatus.classList.remove('saving', 'error');
  if (status === 'saving') {
    el.saveStatus.textContent = 'Saving...';
    el.saveStatus.classList.add('saving');
  } else if (status === 'error') {
    el.saveStatus.textContent = 'Save failed';
    el.saveStatus.classList.add('error');
  } else {
    el.saveStatus.textContent = 'Saved';
  }
}

function scheduleSave() {
  setSaveStatus('saving');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveParodyLines, 600);
}

async function saveParodyLines() {
  if (!state.currentSong) return;
  if (state.saveInFlight) {
    state.pendingSaveAfterInFlight = true;
    return;
  }
  state.saveInFlight = true;
  const parodyLines = Array.from(el.linesGrid.querySelectorAll('textarea.parody-line')).map((t) => t.value);
  const parodyTitle = el.parodyTitleInput.value.trim();
  const parodyArtist = el.parodyArtistInput.value.trim();
  try {
    const updated = await api(`/api/songs/${state.currentSong.id}`, {
      method: 'PUT',
      body: JSON.stringify({ parodyLines, parodyTitle, parodyArtist }),
    });
    state.currentSong = updated;
    el.parodyTitleText.textContent = updated.parodyTitle || '';
    el.parodyArtistText.textContent = updated.parodyArtist || '';
    setSaveStatus('saved');
  } catch (err) {
    console.error(err);
    setSaveStatus('error');
  } finally {
    state.saveInFlight = false;
    if (state.pendingSaveAfterInFlight) {
      state.pendingSaveAfterInFlight = false;
      saveParodyLines();
    }
  }
}

el.newSongBtn.addEventListener('click', () => {
  el.newTitle.value = '';
  el.newArtist.value = '';
  el.newLyrics.value = '';
  el.newSongError.classList.add('hidden');
  showPanel(el.newSongForm);
});

el.cancelNewSongBtn.addEventListener('click', () => {
  if (state.currentSong) {
    showPanel(el.editor);
  } else {
    showPanel(el.emptyState);
  }
});

el.createSongBtn.addEventListener('click', async () => {
  const title = el.newTitle.value.trim();
  const artist = el.newArtist.value.trim();
  const originalLyrics = el.newLyrics.value;

  if (!title || !originalLyrics.trim()) {
    el.newSongError.textContent = 'Title and original lyrics are required.';
    el.newSongError.classList.remove('hidden');
    return;
  }

  try {
    const song = await api('/api/songs', {
      method: 'POST',
      body: JSON.stringify({ title, artist, originalLyrics }),
    });
    await loadSongList();
    state.currentSong = song;
    renderSongList();
    renderEditor(song);
    showPanel(el.editor);
  } catch (err) {
    el.newSongError.textContent = err.message;
    el.newSongError.classList.remove('hidden');
  }
});

el.deleteSongBtn.addEventListener('click', async () => {
  if (!state.currentSong) return;
  const confirmed = confirm(`Delete "${state.currentSong.title}"? This cannot be undone.`);
  if (!confirmed) return;
  await api(`/api/songs/${state.currentSong.id}`, { method: 'DELETE' });
  state.currentSong = null;
  await loadSongList();
  showPanel(el.emptyState);
});

el.parodyTitleDisplay.addEventListener('click', () => activateParodyEdit('title'));
el.parodyTitleInput.addEventListener('blur', () => deactivateParodyEdit('title'));
el.parodyTitleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    deactivateParodyEdit('title');
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    el.parodyTitleInput.value = state.currentSong.parodyTitle || '';
    deactivateParodyEdit('title');
  }
});
el.parodyTitleInput.addEventListener('input', scheduleSave);

el.parodyArtistDisplay.addEventListener('click', () => activateParodyEdit('artist'));
el.parodyArtistInput.addEventListener('blur', () => deactivateParodyEdit('artist'));
el.parodyArtistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    deactivateParodyEdit('artist');
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    el.parodyArtistInput.value = state.currentSong.parodyArtist || '';
    deactivateParodyEdit('artist');
  }
});
el.parodyArtistInput.addEventListener('input', scheduleSave);

(async function init() {
  await loadSongList();
  showPanel(el.emptyState);
})();
