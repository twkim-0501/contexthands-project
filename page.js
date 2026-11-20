'use strict';

const byId = id => document.getElementById(id);
const asset = file => 'assets/' + file;

const motionFilm = byId('motion-film');
const compactMotion = matchMedia('(max-width: 600px)');
function matchPoster() {
  const mobile = motionFilm.currentSrc ? new URL(motionFilm.currentSrc).pathname.endsWith('motion-examples-mobile.mp4') : compactMotion.matches;
  motionFilm.poster = asset(mobile ? 'motion-mobile-first.webp?v=guided39' : 'motion-examples-first.webp?v=guided39');
}
matchPoster();
motionFilm.addEventListener('loadedmetadata', matchPoster);
compactMotion.addEventListener('change', () => {
  if (!motionFilm.currentSrc || new URL(motionFilm.currentSrc).pathname.endsWith('-mobile.mp4') === compactMotion.matches) return;
  const time = motionFilm.currentTime, playing = !motionFilm.paused;
  motionFilm.addEventListener('loadedmetadata', () => {
    motionFilm.currentTime = time;
    if (playing) motionFilm.play().catch(() => {});
  }, {once: true});
  motionFilm.load();
});
const modelNames = ['GT', 'ContextHands', 'BOTH2Hands', 'MDM', 'T2M-GPT', 'MLD', 'HandX'];

function setupComparison(section) {
  const title = section.querySelector('h3').textContent;
  const video = section.querySelector('video');
  const view = byId('hand-controls').content.firstElementChild.cloneNode(true);
  section.append(view);
  const strip = view.querySelector('.frames'), range = view.querySelector('input');
  const play = view.querySelector('button'), counter = view.querySelector('output');
  const speed = view.querySelector('select');
  const tile = 288, fps = 30, last = Number(range.max);
  let callback, drag;
  play.setAttribute('aria-label', 'Play ' + title);
  range.setAttribute('aria-label', title + ' frame');
  speed.setAttribute('aria-label', title + ' playback speed');
  const panels = modelNames.map(name => {
    const fig = document.createElement('figure'), caption = document.createElement('figcaption');
    caption.textContent = name;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = tile;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', name + ', ' + section.dataset.side + ' hand');
    fig.append(caption, canvas); strip.append(fig);
    return canvas;
  });
  function position(frame) {
    range.value = frame;
    counter.value = (video.ended ? video.duration : frame / fps).toFixed(2) + ' / 5 s';
    range.setAttribute('aria-valuetext', 'Frame ' + (frame + 1) + ' of ' + (last + 1));
  }
  function draw(time) {
    if (video.readyState < 2 || video.seeking) return;
    panels.forEach((c,i) => c.getContext('2d').drawImage(video,i*tile,124,tile,tile,0,0,tile,tile));
    position(Math.max(0, Math.min(last, Math.floor(time * fps + .0001))));
  }
  function seek(frame) {
    video.pause();
    const clamped = Math.max(0, Math.min(last,frame));
    position(clamped);
    video.currentTime = (clamped + .5) / fps;
  }
  function tick() {
    if (video.paused || video.ended) return;
    if (video.requestVideoFrameCallback) {
      callback = video.requestVideoFrameCallback((_,frame) => { draw(frame.mediaTime); tick(); });
    } else {
      callback = requestAnimationFrame(() => { draw(video.currentTime); tick(); });
    }
  }
  function transport() {
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(callback);
    else cancelAnimationFrame(callback);
    const playing = !video.paused && !video.ended;
    play.dataset.playing = String(playing); play.title = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-label',play.title + ' ' + title);
    if (playing) tick();
  }
  speed.addEventListener('change', () => { video.playbackRate = Number(speed.value); });
  range.addEventListener('input', () => seek(Number(range.value)));
  play.addEventListener('click', () => {
    if (!video.paused) { video.pause(); return; }
    if (video.ended || Number(range.value) === last) seek(0);
    video.play().catch(transport);
  });
  // Horizontal dragging steps the same decoded frame for all seven hands.
  strip.addEventListener('pointerdown', e => {
    if (e.isPrimary && e.button === 0) drag = {id:e.pointerId,x:e.clientX,y:e.clientY,frame:Number(range.value)};
  });
  strip.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!strip.hasPointerCapture(e.pointerId)) {
      if (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(e.clientY-drag.y)) return;
      strip.setPointerCapture(e.pointerId);
    }
    seek(drag.frame + Math.round(dx*last/strip.clientWidth));
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(event => strip.addEventListener(event, () => { drag=null; }));
  strip.addEventListener('pointerleave', e => { if (!strip.hasPointerCapture(e.pointerId)) drag=null; });
  ['seeked','ended','pause'].forEach(event => video.addEventListener(event, () => draw(video.currentTime)));
  ['play','pause','ended'].forEach(event => video.addEventListener(event,transport));
  function enable() {
    if (video.readyState < 2 || !view.hidden || !video.paused) return;
    draw(video.currentTime);
    view.hidden = false;
    video.hidden = true;
  }
  video.addEventListener('loadeddata',enable);
  video.addEventListener('error',() => { video.hidden=false; view.hidden=true; });
  enable();
}
document.querySelectorAll('section.comparison').forEach(setupComparison);

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
