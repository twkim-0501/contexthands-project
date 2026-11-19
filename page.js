'use strict';

const byId = id => document.getElementById(id);
const asset = file => 'assets/' + file;

const models = ['Reference', 'ContextHands', 'BOTH2Hands', 'MDM', 'T2M-GPT', 'MLD', 'HandX'];
const cases = {
  s19: {
    prompt: 'Cut the apple with the orange cleaver knife.', hand: 'Right', first: 0, last: 149, initial: 37,
    seed: 505, scores: ['10.53','17.94','12.41','18.06','12.03','13.12'],
    note: 'The cutting instruction starts at frame 41. This is the ContextHands sample from Figure 1, shown here with its predicted wrist rotation.'
  },
  w01: {
    prompt: 'Remove the power plug of the laptop.', hand: 'Left', first: 90, last: 149, initial: 0,
    scores: ['6.18','15.10','15.33','15.74','27.30','20.60'],
    note: 'The reference fingers stay extended through this interval. With the wrists aligned, compare the spacing between the fingers.'
  },
  t01: {
    prompt: 'Pour the content from the tall blue mug to the bowl.', hand: 'Right', first: 90, last: 149, initial: 0,
    scores: ['9.036','9.039','11.368','13.252','12.284','14.918'],
    note: 'The wrists are aligned to the reference. ContextHands and BOTH2Hands both average about 9.04° of finger rotation error over these frames.'
  },
  f01: {
    prompt: 'Pour the experiment substance B from the test tube to the conical flask.', hand: 'Left', first: 0, last: 59, initial: 0,
    scores: ['33.10','29.87','10.96','14.39','37.55','17.72'],
    note: 'The recorded fingers are bent from the first frame. Even with the wrist aligned to the reference, ContextHands keeps the left hand open.'
  }
};

function pauseOthers(active) {
  document.querySelectorAll('video').forEach(video => {
    if (video !== active && !video.paused) video.pause();
  });
}
byId('overview').addEventListener('play', () => pauseOthers(byId('overview')));

function showComparison(container, key) {
  const previous = container.querySelector('video');
  if (previous) {
    previous.pause();
    previous.removeAttribute('src');
    previous.load();
  }
  const info = cases[key];
  const tiles = models.map((name, i) => `
    <figure><figcaption>${name}</figcaption>
    <canvas width="190" height="190" role="img" aria-label="${name}, ${info.hand.toLowerCase()} hand"></canvas>
    <span class="stat">${i ? info.scores[i - 1] + '°' : 'Ground truth'}</span></figure>`).join('');
  container.innerHTML = `
    <h3>“${info.prompt}”</h3>
    <p class="meta">${info.hand} hand · Frames ${info.first}–${info.last} · Seed ${info.seed || 501}</p>
    <div class="frames">${tiles}</div>
    <p class="meta">Mean rotation error over the 15 finger joints and the full interval (degrees).</p>
    <div class="transport">
      <button type="button" aria-label="Play comparison">▶ Play</button>
      <input type="range" aria-label="Playback position for ${info.prompt}" min="0" max="${Math.floor((info.last - info.first) / 2)}" value="${info.initial}" step="1">
      <span>Frame ${info.first + 2 * info.initial}</span>
    </div>
    <p class="prose reading">${info.note}</p>
    <video muted playsinline preload="auto" hidden></video>`;
  const video = container.querySelector('video');
  const canvases = Array.from(container.querySelectorAll('canvas'));
  const play = container.querySelector('.transport button');
  const seek = container.querySelector('input');
  const index = container.querySelector('.transport span');
  const still = new Image();
  let animation;

  function paint(source) {
    // All seven panels are decoded from the same video frame.
    canvases.forEach((canvas, i) => {
      canvas.getContext('2d').drawImage(source, 28 + i * 190, 51, 190, 190, 0, 0, 190, 190);
    });
  }
  function sync() {
    if (video.readyState < 2 || video.seeking) return;
    paint(video);
    const sample = Math.min(Number(seek.max), Math.floor(video.currentTime * 15));
    seek.value = sample;
    index.textContent = 'Frame ' + (info.first + sample * 2);
  }
  function tick() {
    sync();
    if (!video.paused && !video.ended && video.isConnected) animation = requestAnimationFrame(tick);
  }
  function state() {
    cancelAnimationFrame(animation);
    const playing = !video.paused && !video.ended;
    play.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    play.setAttribute('aria-label', playing ? 'Pause comparison' : 'Play comparison');
    if (playing) tick();
  }
  still.onload = () => {
    if (video.readyState < 2 || video.seeking) paint(still);
  };
  const version = info.seed ? '?v=' + info.seed : '';
  still.src = asset(key + '-still.webp') + version;
  video.addEventListener('loadedmetadata', () => {
    if (info.initial) video.currentTime = info.initial / 15 + .001;
  }, {once: true});
  ['loadeddata','seeked','timeupdate','ended'].forEach(event => video.addEventListener(event, sync));
  ['pause','play','ended'].forEach(event => video.addEventListener(event, state));
  play.addEventListener('click', () => {
    if (!video.paused && !video.ended) { video.pause(); return; }
    pauseOthers(video);
    if (video.ended) video.currentTime = 0;
    video.play().catch(error => { if (error.name !== 'AbortError') play.textContent = 'Retry'; });
  });
  seek.addEventListener('input', () => {
    video.pause();
    if (video.readyState >= 1) video.currentTime = Number(seek.value) / 15 + .001;
  });
  video.addEventListener('error', () => {
    if (!video.isConnected || !video.getAttribute('src')) return;
    play.disabled = seek.disabled = true;
    play.textContent = 'Still frame';
    if (still.complete && still.naturalWidth) paint(still);
  });
  video.src = asset(key + '.mp4') + version;
}
const comparison = byId('comparison-player');
function chooseCase(key) {
  document.querySelectorAll('[data-case]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.case === key));
  });
  showComparison(comparison, key);
}
const initialTab = byId(location.hash.slice(1));
chooseCase((initialTab && initialTab.dataset.case) || 's19');
document.querySelectorAll('[data-case]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') !== 'true') chooseCase(button.dataset.case);
    history.replaceState(history.state, '', '#' + button.id);
  });
});

const limitations = byId('limitations');
limitations.addEventListener('toggle', () => {
  const player = byId('limitation-player');
  const video = player.querySelector('video');
  if (limitations.open && !video) showComparison(player, 'f01');
  if (!limitations.open && video) video.pause();
});

const pair = byId('pair-movie');
const pairedCaptions = {
  x16: '“Stir in the green mug with the rod.”',
  s19: '“Cut the apple with the orange cleaver knife.”'
};
document.querySelectorAll('[data-pair]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    const key = button.dataset.pair;
    pair.pause();
    pair.poster = asset('hero-' + key + '.webp');
    pair.src = asset('hero-' + key + '.mp4');
    byId('pair-caption').textContent = pairedCaptions[key];
    document.querySelectorAll('[data-pair]').forEach(option => {
      option.setAttribute('aria-pressed', String(option === button));
    });
  });
});
pair.addEventListener('play', () => pauseOthers(pair));
byId('video').addEventListener('toggle', () => {
  if (!byId('video').open) byId('overview').pause();
});
function revealFragment() {
  const target = byId(location.hash.slice(1));
  if (!target) return;
  if (target.dataset.case && target.getAttribute('aria-pressed') !== 'true') chooseCase(target.dataset.case);
  if (target.tagName === 'DETAILS') {
    target.open = true;
    requestAnimationFrame(() => target.scrollIntoView());
  }
}
window.addEventListener('hashchange', revealFragment);
revealFragment();

const copyCitation = byId('copy-citation');
if (navigator.clipboard) {
  copyCitation.hidden = false;
  copyCitation.addEventListener('click', async () => {
    const bibtex = byId('bibtex');
    try {
      await navigator.clipboard.writeText(bibtex.textContent);
      copyCitation.textContent = 'Copied';
      byId('copy-status').textContent = 'BibTeX copied to clipboard.';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(bibtex);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      byId('copy-status').textContent = 'BibTeX selected for manual copying.';
    }
  });
}

const reader = byId('reader');
const detail = byId('detail');
const pane = reader.querySelector('.pan');
const zoom = byId('zoom');
const descriptions = {
  '1': ['Hand-motion completion', 'The stirring (seed 503) and cutting (seed 505) close-ups use the recorded wrist orientation. The lid grasp (seed 508) preserves the relative predicted wrist rotations.'],
  '2': ['Method', 'During training, the posterior also uses the recorded hand motion. At inference, we sample from the prior conditioned on body motion and timed descriptions.'],
  '3': ['Qualitative comparison', 'All methods use the same clip, frames, seed, cameras and scale within each example. L and R mark the left and right hands. The object views illustrate grasp shape.']
};
let opener;
function magnify(on) {
  pane.classList.toggle('magnified', on);
  zoom.setAttribute('aria-pressed', String(on));
  zoom.textContent = on ? 'Fit figure' : 'Zoom in';
  pane.scrollTo(0,0);
}
document.querySelectorAll('[data-figure]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof reader.showModal !== 'function') return;
    event.preventDefault();
    const number = link.dataset.figure;
    const original = byId('figure-' + number).querySelector('img');
    const [title, note] = descriptions[number];
    byId('reader-title').textContent = 'Figure ' + number + ' · ' + title;
    byId('figure-detail-note').textContent = note;
    detail.src = original.currentSrc || original.src;
    detail.alt = original.alt;
    pane.style.setProperty('--image-width', original.width ? original.getAttribute('width') + 'px' : '2100px');
    opener = link;
    reader.showModal();
    magnify(false);
    zoom.focus();
  });
});
zoom.addEventListener('click', () => magnify(!pane.classList.contains('magnified')));
byId('close').addEventListener('click', () => reader.close());
reader.addEventListener('click', event => { if (event.target === reader) reader.close(); });
reader.addEventListener('close', () => { if (opener) opener.focus({preventScroll:true}); });
