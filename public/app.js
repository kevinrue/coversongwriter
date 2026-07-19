const state = {
  songs: [],
  currentSong: null,
  saveTimer: null,
  saveInFlight: false,
  pendingSaveAfterInFlight: false,
};

const el = {
  songList: document.getElementById('song-list'),
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
  el.songList.innerHTML = '';
  for (const song of state.songs) {
    const li = document.createElement('li');
    li.dataset.id = song.id;
    if (state.currentSong && state.currentSong.id === song.id) li.classList.add('active');
    li.innerHTML = `
      <div class="song-item-title">${escapeHtml(song.title)}</div>
      <div class="song-item-artist">${escapeHtml(song.artist || '')}</div>
    `;
    li.addEventListener('click', () => selectSong(song.id));
    el.songList.appendChild(li);
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
  setSaveStatus('saved');

  el.linesGrid.innerHTML = '';
  song.originalLines.forEach((originalLine, index) => {
    const row = document.createElement('div');
    row.className = 'line-row';
    row.dataset.index = String(index);

    const originalEl = document.createElement('div');
    originalEl.className = 'original-line';
    originalEl.textContent = originalLine;
    originalEl.addEventListener('click', () => {
      const textarea = el.linesGrid.querySelector(`textarea[data-index="${index}"]`);
      if (textarea) textarea.focus();
    });

    const textarea = document.createElement('textarea');
    textarea.className = 'parody-line';
    textarea.dataset.index = String(index);
    textarea.rows = 1;
    textarea.value = song.parodyLines[index] || '';
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
  try {
    const updated = await api(`/api/songs/${state.currentSong.id}`, {
      method: 'PUT',
      body: JSON.stringify({ parodyLines }),
    });
    state.currentSong = updated;
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

(async function init() {
  await loadSongList();
  showPanel(el.emptyState);
})();
