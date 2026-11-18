'use strict';

const byId = id => document.getElementById(id);
const asset = file => 'assets/' + file;

const models = ['Reference', 'ContextHands', 'BOTH2Hands', 'MDM', 'T2M-GPT', 'MLD', 'HandX'];
const cases = {
  s19: {
    prompt: 'Cut the apple with the orange cleaver knife.', hand: 'Right', first: 0, last: 149, initial: 37,
    scores: ['16.00','18.25','11.80','16.62','15.87','13.52'],
    note: 'The cutting description applies to frames 41–149. The reference includes the recorded cleaver. Each prediction retains its own wrist orientation. Over the full 150-frame clip, MDM has the lowest right-finger rotation error.'
  },
  w01: {
    prompt: 'Remove the power plug of the laptop.', hand: 'Left', first: 90, last: 149, initial: 0,
    scores: ['6.18','15.10','15.33','15.74','27.30','20.60'],
    note: 'In this selected interval, ContextHands has lower left-finger rotation error than each of the five baselines. Wrist orientations are aligned to the reference to show the differences in finger articulation.'
  },
  t01: {
    prompt: 'Pour the content from the tall blue mug to the bowl.', hand: 'Right', first: 90, last: 149, initial: 0,
    scores: ['9.036','9.039','11.368','13.252','12.284','14.918'],
    note: 'With the wrists aligned to the reference, ContextHands and BOTH2Hands have nearly identical mean right-finger rotation errors in this pour.'
  },
  f01: {
    prompt: 'Pour the experiment substance B from the test tube to the conical flask.', hand: 'Left', first: 0, last: 59, initial: 0,
    scores: ['33.10','29.87','10.96','14.39','37.55','17.72'],
    note: 'The recorded left fingers are bent in the opening frame. ContextHands opens the hand, and its mean finger-rotation error is 33.10° over the interval. MDM more closely follows the recording at 10.96°. The wrists are aligned for this comparison.'
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
    <p class="meta">${info.hand} hand · Frames ${info.first}–${info.last}</p>
    <div class="frames">${tiles}</div>
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
  still.src = asset(key + '-still.webp');
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
  video.src = asset(key + '.mp4');
}
showComparison(byId('comparison-player'), 's19');
showComparison(byId('failure-player'), 'f01');
document.querySelectorAll('[data-case]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-case]').forEach(b => b.setAttribute('aria-pressed', b === button));
    showComparison(byId('comparison-player'), button.dataset.case);
  });
});

document.querySelectorAll('.example video').forEach(video => video.addEventListener('play', () => pauseOthers(video)));

const reader = byId('reader');
const detail = byId('detail');
const pane = reader.querySelector('.pan');
const toggle = byId('zoom');
function magnify(on) {
  pane.classList.toggle('magnified', on);
  toggle.setAttribute('aria-pressed', String(on));
  toggle.textContent = on ? 'Fit figure' : 'Zoom in';
  pane.scrollTo(0, 0);
}
document.querySelectorAll('[data-figure]').forEach(button => {
  button.addEventListener('click', () => {
    const number = button.dataset.figure;
    const original = byId('figure-' + number).querySelector('img');
    byId('reader-title').textContent = number === '1' ? 'Figure 1 · Hand-motion completion' : 'Figure 2 · Method';
    detail.src = original.currentSrc || original.src;
    detail.alt = original.alt;
    byId('figure-detail-note').textContent = number === '1'
      ? 'Each example displays one of the supplied instructions. For stirring and cutting, the close-ups use the reference wrist orientation. The lid preserves relative predicted wrist rotations. Object placement only illustrates the action.'
      : 'During training, the posterior also observes the target hand motion. At inference, the prior uses the observed body motion and assigned descriptions.';
    reader.showModal();
    magnify(matchMedia('(max-width: 640px)').matches);
    byId('close').focus();
  });
});
toggle.addEventListener('click', () => magnify(!pane.classList.contains('magnified')));
byId('close').addEventListener('click', () => reader.close());
reader.addEventListener('click', event => { if (event.target === reader) reader.close(); });
