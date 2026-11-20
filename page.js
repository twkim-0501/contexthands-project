'use strict';

const byId = id => document.getElementById(id);
const asset = file => 'assets/' + file;

const models = ['GT', 'ContextHands', 'BOTH2Hands', 'MDM', 'T2M-GPT', 'MLD', 'HandX'];
const cases = {
  plate: {frames: 87, initial: 25, file: 'plate-hands', hand: 'right'},
  burner: {frames: 75, initial: 63, file: 'burner-hands', hand: 'right'},
  s19: {frames: 75, initial: 37, file: 's19', hand: 'right', first: 0},
  w01: {frames: 30, initial: 0, file: 'w01', hand: 'left', first: 90},
  t01: {frames: 30, initial: 0, file: 't01', hand: 'right', first: 90}
};

const motionFilm = byId('motion-film');
const compactMotion = matchMedia('(max-width: 600px)');
function matchPoster() {
  const mobileFile = motionFilm.currentSrc
    ? motionFilm.currentSrc.endsWith('motion-examples-mobile.mp4')
    : compactMotion.matches;
  motionFilm.poster = asset(mobileFile ? 'motion-mobile-first.webp' : 'motion-examples-first.webp');
}
matchPoster();
motionFilm.addEventListener('loadedmetadata', matchPoster);
compactMotion.addEventListener('change', () => {
  if (!motionFilm.currentSrc || motionFilm.currentSrc.endsWith('-mobile.mp4') === compactMotion.matches) return;
  const time = motionFilm.currentTime;
  const playing = !motionFilm.paused;
  motionFilm.addEventListener('loadedmetadata', () => {
    motionFilm.currentTime = time;
    if (playing) motionFilm.play().catch(() => {});
  }, {once: true});
  motionFilm.load();
});
document.addEventListener('play', event => {
  if (event.target instanceof HTMLVideoElement) {
    document.querySelectorAll('video').forEach(v => {
      if (v !== event.target && !v.paused) v.pause();
    });
  }
}, true);

function showComparison(container, key) {
  const oldVideo = container.querySelector('video');
  if (oldVideo) {
    oldVideo.pause();
    oldVideo.removeAttribute('src');
    oldVideo.load();
  }
  const info = cases[key];
  // Earlier clips have a 190px tile and sample every other 30 fps source frame.
  const earlier = info.first !== undefined;
  const tile = earlier ? 190 : 288;
  const left = earlier ? 28 : 0;
  const top = earlier ? 51 : 40;
  const fps = earlier ? 15 : 30;
  const max = info.frames - 1;
  const title = document.querySelector('[data-case="' + key + '"]').textContent;
  const panels = models.map(name => `
    <figure><figcaption>${name}</figcaption>
    <canvas width="${tile}" height="${tile}" role="img" aria-label="${name}, ${info.hand} hand"></canvas></figure>`).join('');
  container.innerHTML = `
    <div class="frames">${panels}</div>
    <div class="transport">
      <button type="button" aria-label="Play comparison" title="Play"></button>
      <input type="range" min="0" max="${max}" step="1" value="${info.initial}" aria-label="Comparison frame for ${title}">
      <output aria-live="off"></output>
    </div>
    <video muted playsinline preload="auto" hidden></video>`;
  const video = container.querySelector('video');
  const strip = container.querySelector('.frames');
  const canvases = Array.from(strip.querySelectorAll('canvas'));
  const play = container.querySelector('button');
  const seek = container.querySelector('input');
  const output = container.querySelector('output');
  const version = key === 's19' ? '?v=505' : '';
  const still = new Image();
  let requested = info.initial;
  let animation;

  function position(sample) {
    seek.value = sample;
    output.value = earlier ? 'Frame ' + (info.first + sample * 2) : (sample + 1) + ' / ' + info.frames;
    seek.setAttribute('aria-valuetext', earlier ? output.value : 'Frame ' + (sample + 1) + ' of ' + info.frames);
  }
  function paint(source) {
    canvases.forEach((c, i) => c.getContext('2d').drawImage(source,
      left + i * tile, top, tile, tile, 0, 0, tile, tile));
  }
  function sync(time = video.currentTime) {
    if (video.readyState < 2 || video.seeking || !video.isConnected) return;
    paint(video);
    position(Math.min(max, Math.floor(time * fps + 0.0001)));
  }
  function watch() {
    if (video.paused || video.ended || !video.isConnected) return;
    if (video.requestVideoFrameCallback) {
      animation = video.requestVideoFrameCallback((_, frame) => { sync(frame.mediaTime); watch(); });
    } else {
      animation = requestAnimationFrame(() => { sync(); watch(); });
    }
  }
  function cancelWatch() {
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(animation);
    else cancelAnimationFrame(animation);
  }
  function transport() {
    cancelWatch();
    const playing = !video.paused && !video.ended;
    play.dataset.playing = playing;
    play.title = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-label', play.title + ' comparison');
    if (playing) watch();
  }
  function move(sample) {
    video.pause();
    requested = Math.max(0, Math.min(max, sample));
    position(requested);
    if (video.readyState >= 1) video.currentTime = (requested + 0.5) / fps;
  }
  position(requested);
  still.onload = () => { if (video.readyState < 2 || video.seeking || video.error) paint(still); };
  still.src = asset(info.file + (earlier ? '-still.webp' : '.webp')) + version;
  video.addEventListener('loadedmetadata', () => { video.currentTime = (requested + 0.5) / fps; }, {once: true});
  ['loadeddata','seeked','ended'].forEach(event => video.addEventListener(event, () => sync()));
  ['play','pause','ended'].forEach(event => video.addEventListener(event, transport));
  seek.addEventListener('input', () => move(Number(seek.value)));
  play.addEventListener('click', () => {
    if (!video.paused) { video.pause(); return; }
    if (video.ended || Number(seek.value) === max) move(0);
    video.play().catch(transport);
  });
  let drag;
  strip.addEventListener('pointerdown', e => {
    if (e.isPrimary && e.button === 0) drag = {id: e.pointerId, x: e.clientX, y: e.clientY, start: Number(seek.value)};
  });
  strip.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!strip.hasPointerCapture(e.pointerId)) {
      if (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(e.clientY - drag.y)) return;
      strip.setPointerCapture(e.pointerId);
    }
    move(drag.start + Math.round(dx * max / strip.clientWidth));
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(event => strip.addEventListener(event, () => { drag = null; }));
  strip.addEventListener('pointerleave', e => { if (!strip.hasPointerCapture(e.pointerId)) drag = null; });
  video.addEventListener('error', () => {
    if (!video.isConnected || !video.hasAttribute('src')) return;
    play.disabled = seek.disabled = true;
    if (still.complete && still.naturalWidth) paint(still);
    position(info.initial);
    const link = document.createElement('a');
    link.href = video.src;
    link.textContent = 'Open video';
    output.replaceChildren(link);
  });
  video.src = asset(info.file + '.mp4') + version;
}
byId('baseline-video').hidden = false;
const comparison = byId('comparison-player');
function chooseCase(key) {
  document.querySelectorAll('[data-case]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.case === key));
  });
  showComparison(comparison, key);
}
const initialTab = byId(location.hash.slice(1));
chooseCase((initialTab && initialTab.dataset.case) || 'plate');
document.querySelectorAll('[data-case]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') !== 'true') chooseCase(button.dataset.case);
    history.replaceState(history.state, '', '#' + button.id);
  });
});
window.addEventListener('hashchange', () => {
  const tab = byId(location.hash.slice(1));
  if (tab && tab.dataset.case && tab.getAttribute('aria-pressed') !== 'true') chooseCase(tab.dataset.case);
});

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
