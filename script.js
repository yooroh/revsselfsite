console.log('%cDeveloped & designed by Rev AKA Will with lots of <3', 'color:#39ff14; font-size:16px; font-weight:bold; text-shadow:0 0 6px #39ff14;');

const gate = document.getElementById('gate');
const page = document.getElementById('page');
const video = document.getElementById('bg-video');
const audio = document.getElementById('track');
const idleView = document.getElementById('idle-view');
const lyricsView = document.getElementById('lyrics-view');
const lyricsTrack = document.getElementById('lyrics-track');
const muteBtn = document.getElementById('mute-btn');
const volumeSlider = document.getElementById('volume-slider');
const progress = document.getElementById('progress');
const playerTime = document.getElementById('player-time');

let lyrics = [];
let activeIndex = -1;
let mode = 'idle';
let isSeeking = false;
let lyricRows = [];
let rowH = 28.5;

fetch('lyrics.json', { cache: 'no-store' })
  .then(res => res.json())
  .then(data => { lyrics = data; buildLyricRows(); })
  .catch(err => { lyrics = []; console.warn('lyrics.json failed to load', err); });

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showIdle() {
  if (mode === 'idle') return;
  mode = 'idle';
  activeIndex = -1;
  idleView.classList.add('visible');
  lyricsView.classList.remove('visible');
}

function buildLyricRows() {
  lyricsTrack.textContent = '';
  lyricRows = lyrics.map(item => {
    const row = document.createElement('div');
    row.className = 'lyric-line';
    row.textContent = item.text;
    lyricsTrack.appendChild(row);
    return row;
  });
  measureRow();
}

function measureRow() {
  if (lyricRows.length < 2) return;
  const layout = lyricRows[1].offsetTop - lyricRows[0].offsetTop;
  if (isFinite(layout) && layout > 0) rowH = layout;
}

function styleWindow(base) {
  for (let d = -3; d <= 3; d++) {
    const row = lyricRows[base + d];
    if (!row) continue;
    if (d >= -2 && d <= 2) row.dataset.pos = String(d);
    else delete row.dataset.pos;
  }
}

function positionTrack(index, animate) {
  const viewH = lyricsView.clientHeight || 190;
  const totalH = lyricRows.length * rowH;
  let ty = viewH / 2 - rowH / 2 - index * rowH;
  if (totalH < viewH) {
    ty = (viewH - totalH) / 2;
  } else {
    ty = Math.min(ty, viewH / 2 - rowH / 2);
    ty = Math.max(ty, viewH / 2 - totalH + rowH / 2);
    ty = Math.min(ty, viewH * 0.25 - rowH / 2);
  }
  if (!animate) {
    lyricsTrack.style.transition = 'none';
    lyricsTrack.style.transform = 'translateY(' + ty + 'px)';
    void lyricsTrack.offsetWidth;
    lyricsTrack.style.transition = '';
  } else {
    lyricsTrack.style.transform = 'translateY(' + ty + 'px)';
  }
}

function showLyricsAt(index) {
  if (mode === 'lyrics' && index === activeIndex) return;
  if (mode !== 'lyrics') {
    mode = 'lyrics';
    activeIndex = index;
    styleWindow(index);
    positionTrack(index, false);
    idleView.classList.remove('visible');
    lyricsView.classList.add('visible');
    return;
  }
  const delta = index - activeIndex;
  activeIndex = index;
  styleWindow(index);
  positionTrack(index, Math.abs(delta) <= 3);
}

function findLineIndexAt(ms) {
  for (let i = 0; i < lyrics.length; i++) {
    if (ms >= lyrics[i].start && ms < lyrics[i].end) return i;
  }
  return -1;
}

function updateRangeFill() {
  const max = parseFloat(progress.max) || 1;
  const val = parseFloat(progress.value) || 0;
  const pct = (val / max) * 100;
  progress.style.setProperty('--range-progress', pct + '%');
}

function updateVolumeFill() {
  volumeSlider.style.setProperty('--vol-progress', volumeSlider.value + '%');
}

function renderFrame() {
  if (!isSeeking) {
    progress.value = audio.currentTime;
    updateRangeFill();
  }
  playerTime.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;

  if (!lyrics.length) {
    showIdle();
    return;
  }

  const ms = audio.currentTime * 1000;
  const idx = findLineIndexAt(ms);
  if (idx === -1) {
    showIdle();
  } else {
    showLyricsAt(idx);
  }
}

let frameId = null;

function frameLoop() {
  renderFrame();
  frameId = requestAnimationFrame(frameLoop);
}

function startFrameLoop() {
  cancelAnimationFrame(frameId);
  frameLoop();
}

function stopFrameLoop() {
  cancelAnimationFrame(frameId);
  frameId = null;
}

function syncDuration() {
  if (isFinite(audio.duration) && audio.duration > 0) {
    progress.max = audio.duration;
    updateRangeFill();
  }
}

audio.addEventListener('loadedmetadata', syncDuration);
audio.addEventListener('durationchange', syncDuration);
audio.addEventListener('canplay', syncDuration);

audio.addEventListener('play', startFrameLoop);
audio.addEventListener('pause', () => { stopFrameLoop(); showIdle(); });
audio.addEventListener('ended', () => { stopFrameLoop(); showIdle(); });
audio.addEventListener('seeked', renderFrame);
audio.addEventListener('error', () => {
  console.warn('audio failed to load — open devtools > Network and check the request for assets/audio/Apollon.mp3. On Cloudflare Pages, paths are case-sensitive even though your local machine may not be, so "Apollon.mp3" will 404 if the deployed file is actually named differently (e.g. "apollon.mp3").', audio.error);
});

video.addEventListener('error', () => {
  console.warn('video failed to load, check assets/video/bg.mp4 exists at that exact path/case', video.error);
});

const playBtn = document.getElementById('play-btn');

function setPlayBtn() {
  playBtn.classList.toggle('playing', !audio.paused);
}

playBtn.addEventListener('click', () => {
  if (audio.paused) {
    attemptAudioPlay();
  } else {
    audio.pause();
  }
});

audio.addEventListener('play', setPlayBtn);
audio.addEventListener('pause', setPlayBtn);

muteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  muteBtn.classList.toggle('muted', audio.muted);
});

volumeSlider.addEventListener('input', () => {
  const vol = parseFloat(volumeSlider.value) / 100;
  audio.volume = vol;
  updateVolumeFill();
  audio.muted = vol === 0;
  muteBtn.classList.toggle('muted', audio.muted);
});

lyricsTrack.addEventListener('click', (e) => {
  const row = e.target.closest('.lyric-line');
  if (!row) return;
  const i = lyricRows.indexOf(row);
  if (i === -1 || !lyrics[i]) return;
  audio.currentTime = lyrics[i].start / 1000;
  renderFrame();
});

progress.addEventListener('input', () => {
  isSeeking = true;
  updateRangeFill();
  playerTime.textContent = `${formatTime(parseFloat(progress.value))} / ${formatTime(audio.duration)}`;
});

progress.addEventListener('change', () => {
  seekTo(parseFloat(progress.value));
  isSeeking = false;
});

function seekTo(time) {
  const max = parseFloat(progress.max) || 0;
  if (!isFinite(time) || max <= 0) {
    console.warn('cannot seek yet — audio duration is not known. The file may still be loading or failed to load.');
    return;
  }
  time = Math.min(Math.max(time, 0), max);
  try {
    audio.currentTime = time;
  } catch (err) {
    console.warn('seek failed', err);
  }
  progress.value = time;
  updateRangeFill();
  playerTime.textContent = `${formatTime(time)} / ${formatTime(audio.duration)}`;
  renderFrame();
}

function seekFromPointer(evt) {
  const rect = progress.getBoundingClientRect();
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  const max = parseFloat(progress.max) || 0;
  isSeeking = true;
  seekTo(ratio * max);
  isSeeking = false;
}

progress.addEventListener('pointerdown', seekFromPointer);

showIdle();
idleView.classList.add('visible');
lyricsView.classList.remove('visible');
updateRangeFill();
updateVolumeFill();
window.addEventListener('resize', measureRow);
audio.volume = parseFloat(volumeSlider.value) / 100;
audio.loop = true;

function attemptVideoPlay() {
  video.muted = true;
  video.playsInline = true;
  const playPromise = video.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {});
  }
}

function attemptAudioPlay() {
  const playPromise = audio.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {});
  }
}

attemptVideoPlay();
document.addEventListener('DOMContentLoaded', attemptVideoPlay);
window.addEventListener('load', attemptVideoPlay);

function enter() {
  gate.classList.add('hidden');
  page.classList.add('visible');
  attemptVideoPlay();
  attemptAudioPlay();
  gate.removeEventListener('click', enter);
}

gate.addEventListener('click', enter);
document.addEventListener('click', attemptVideoPlay, { once: true });

(function typeTitle() {
  const text = "rev's mound";
  const typeSpeed = 130;
  const deleteSpeed = 70;
  const holdFull = 1400;
  const holdEmpty = 500;
  let i = 0;
  let deleting = false;

  function step() {
    if (!deleting) {
      i++;
      document.title = text.slice(0, i);
      if (i === text.length) {
        deleting = false;
        setTimeout(() => { deleting = true; step(); }, holdFull);
        return;
      }
    } else {
      i--;
      document.title = text.slice(0, i) || '_';
      if (i === 0) {
        deleting = false;
        setTimeout(step, holdEmpty);
        return;
      }
    }
    setTimeout(step, deleting ? deleteSpeed : typeSpeed);
  }

  step();
})();
