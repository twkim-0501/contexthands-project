'use strict';

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

function attachTransport(video, controls, label) {
  const button = controls.querySelector('button');
  const seek = controls.querySelector('input');
  const clock = controls.querySelector('output');
  function update() {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      seek.value = Math.round(1000 * video.currentTime / video.duration);
      clock.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
    }
    button.textContent = video.paused ? 'Play' : 'Pause';
    button.setAttribute('aria-label', button.textContent + ' ' + label);
  }
  button.addEventListener('click', () => {
    if (video.paused) video.play().catch(update);
    else video.pause();
  });
  seek.addEventListener('input', () => {
    if (Number.isFinite(video.duration)) video.currentTime = video.duration * seek.value / 1000;
  });
  for (const event of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'seeked']) {
    video.addEventListener(event, update);
  }
  controls.hidden = false;
  update();
}

const teaser = document.querySelector('#teaser-film');
const narrow = matchMedia('(max-width: 600px)');
function selectTeaser() {
  teaser.poster = narrow.matches ? 'assets/motion-mobile.webp' : 'assets/motion-poster.webp';
  teaser.load();
}
selectTeaser();
narrow.addEventListener('change', selectTeaser);
attachTransport(teaser, document.querySelector('#teaser-controls'), 'teaser');
teaser.controls = false;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let manuallyPaused = false;
const teaserButton = document.querySelector('#teaser-controls button');
teaserButton.addEventListener('click', () => { manuallyPaused = !teaser.paused; }, true);
const inView = new IntersectionObserver(entries => {
  if (!entries[0].isIntersecting) teaser.pause();
  else if (!reduce.matches && !manuallyPaused) teaser.play().catch(() => {});
}, {threshold: .25});
inView.observe(teaser);
reduce.addEventListener('change', () => { if (reduce.matches) teaser.pause(); });

const film = document.querySelector('#comparison-film');
const tiles = Array.from(document.querySelectorAll('.tile'), (tile, i) => {
  const canvas = tile.querySelector('canvas');
  return {image: tile.querySelector('img'), canvas, context: canvas.getContext('2d'), half: i === 0 ? 0 : 1};
});
function paint() {
  if (film.readyState < 2 || !film.videoWidth) return;
  const size = film.videoWidth / 2;
  for (const tile of tiles) {
    tile.context.drawImage(film, tile.half * size, 0, size, film.videoHeight, 0, 0, tile.canvas.width, tile.canvas.height);
    tile.canvas.hidden = false;
  }
}
let animation = 0;
function animate() {
  if (film.paused) return;
  paint();
  animation = requestAnimationFrame(animate);
}
film.addEventListener('play', () => { cancelAnimationFrame(animation); animate(); });
film.addEventListener('pause', () => { cancelAnimationFrame(animation); paint(); });
for (const event of ['loadeddata', 'seeked', 'timeupdate']) film.addEventListener(event, paint);
attachTransport(film, document.querySelector('#comparison-controls'), 'comparison');
const choices = document.querySelector('.choices');
choices.hidden = false;
choices.addEventListener('click', event => {
  const button = event.target.closest('[data-scene]');
  if (!button || button.getAttribute('aria-pressed') === 'true') return;
  const scene = button.dataset.scene;
  const continuePlaying = !film.paused;
  film.pause();
  for (const other of choices.querySelectorAll('button')) {
    other.setAttribute('aria-pressed', String(other === button));
  }
  document.querySelector('#scene-name').textContent = button.textContent;
  for (const tile of tiles) {
    tile.canvas.hidden = true;
    tile.image.src = 'assets/' + scene + (tile.half ? '-hand.webp' : '-reference.webp');
  }
  film.src = 'assets/' + scene + '-preview.mp4';
  if (continuePlaying) film.play().catch(() => {});
});
