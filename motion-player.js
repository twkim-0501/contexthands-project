'use strict';

(() => {
  const sections = [...document.querySelectorAll('[data-film]')];
  const scenes = {
    plate: {first: 0, length: 87, text: [[0, 'Place the plate onto the platform of the scale.'], [59, '']]},
    burner: {first: 87, length: 75, text: [[0, 'Uncap the alcohol burner.'], [15, ''], [42, 'Ignite the alcohol burner with the ignitor.']]}
  };
  const fps = 30;
  // Both views are stored in one video frame, with the seven-hand comparison below the overview.
  const motion = [
    ['Reference', 34, 145, 495, 280], ['Inputs', 576, 264, 342, 231],
    ['GT', 976, 99, 435, 377], ['ContextHands', 1445, 99, 435, 377]
  ];
  const methods = ['GT', 'ContextHands', 'BOTH2Hands', 'MDM', 'T2M-GPT', 'MLD', 'HandX'];
  const centers = [258, 726, 1194, 1662, 492, 960, 1428];
  const baseline = methods.map((name, i) => [name, centers[i] - 205, 512 + (i < 4 ? 94 : 566), 410, 370]);
  const movie = document.createElement('video');
  movie.hidden = movie.muted = movie.playsInline = true;
  const frames = [];
  let scene = 'plate', index = 0, tick, ready = false, instruction;

  for (const section of sections) {
    const grid = section.querySelector('.film-grid');
    for (const [name, x, y, width, height] of section.dataset.film === 'motion' ? motion : baseline) {
      const tile = document.createElement('div');
      tile.className = 'film-tile';
      const label = document.createElement('strong');
      label.textContent = name;
      if (name === 'ContextHands') label.className = 'our-label';
      tile.append(label);
      if (name === 'Inputs') {
        tile.classList.add('input-tile');
        const text = document.createElement('div');
        text.className = 'current-instruction';
        const heading = document.createElement('b');
        heading.textContent = 'Text';
        instruction = document.createElement('span');
        text.append(heading, instruction);
        const body = document.createElement('b');
        body.textContent = 'Body';
        tile.append(text, body);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', name === 'Inputs' ? 'Observed upper-body skeleton' : name + (section.dataset.film === 'baseline' ? ', right hand' : ' view'));
      tile.append(canvas);
      grid.append(tile);
      frames.push({ctx: canvas.getContext('2d', {alpha: false}), x, y, width, height});
    }
  }

  const controls = sections.map(section => ({
    section, play: section.querySelector('.film-toggle'), range: section.querySelector('input'),
    output: section.querySelector('output'), choices: [...section.querySelectorAll('[data-scene]')]
  }));
  function showIndex(i) {
    index = i;
    const {length, text} = scenes[scene];
    const active = text.filter(([start]) => start <= i).at(-1)[1];
    instruction.textContent = active ? 'Right hand · ' + active : '—';
    for (const {range, output} of controls) {
      range.max = length - 1;
      range.value = i;
      output.value = (i + 1) + ' / ' + length;
      range.setAttribute('aria-valuetext', 'Frame ' + (i + 1) + ' of ' + length);
    }
  }
  function draw() {
    if (movie.readyState < 2 || movie.seeking) return;
    for (const {ctx, x, y, width, height} of frames) {
      ctx.drawImage(movie, x, y, width, height, 0, 0, width, height);
    }
  }
  function seek(i) {
    movie.pause();
    const {first, length} = scenes[scene];
    showIndex(Math.max(0, Math.min(length - 1, i)));
    // Seek into the middle of the frame, including the last frame of each scene.
    if (movie.readyState >= 1) movie.currentTime = (first + index + 0.5) / fps;
  }
  function choose(key) {
    scene = key;
    document.getElementById('wrist-convention').textContent = key === 'plate'
      ? 'Wrists are aligned to GT to show finger shape. '
      : 'Each hand retains its wrist rotation relative to the forearm. ';
    for (const {choices} of controls) {
      choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scene === key)));
    }
    seek(0);
  }
  function activeFrame(time) {
    const {first, length} = scenes[scene];
    const i = Math.floor(time * fps + 0.0001) - first;
    if (i >= length) { seek(length - 1); return; }
    if (i >= 0) { showIndex(i); draw(); }
  }
  function watch() {
    if (movie.paused || movie.ended) return;
    if (movie.requestVideoFrameCallback) {
      tick = movie.requestVideoFrameCallback((_, meta) => {
        if (!movie.paused && !movie.seeking) activeFrame(meta.mediaTime);
        watch();
      });
    } else {
      tick = requestAnimationFrame(() => {
        if (!movie.paused && !movie.seeking) activeFrame(movie.currentTime);
        watch();
      });
    }
  }
  function stopWatching() {
    if (movie.cancelVideoFrameCallback) movie.cancelVideoFrameCallback(tick);
    else cancelAnimationFrame(tick);
  }
  function playState() {
    const playing = !movie.paused && !movie.ended;
    for (const {section, play} of controls) {
      play.textContent = playing ? 'Pause' : 'Play';
      play.setAttribute('aria-label', play.textContent + ' ' + section.querySelector('h2').textContent.toLowerCase());
    }
  }
  for (const {section, play, range, choices} of controls) {
    choices.forEach(button => button.addEventListener('click', () => {
      if (button.dataset.scene !== scene) choose(button.dataset.scene);
    }));
    play.addEventListener('click', () => {
      if (!movie.paused) { movie.pause(); return; }
      if (index === scenes[scene].length - 1) seek(0);
      movie.play().catch(playState);
    });
    range.addEventListener('input', () => seek(Number(range.value)));
    const grid = section.querySelector('.film-grid');
    let drag;
    grid.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !e.isPrimary) return;
      drag = {id: e.pointerId, x: e.clientX, y: e.clientY, frame: index, moved: false};
    });
    grid.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(e.clientY - drag.y)) return;
        grid.setPointerCapture(e.pointerId);
        drag.moved = true;
      }
      seek(drag.frame + Math.round(dx * (scenes[scene].length - 1) / grid.clientWidth));
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      grid.addEventListener(event, () => { drag = null; });
    }
    grid.addEventListener('pointerleave', () => { if (drag && !drag.moved) drag = null; });
  }
  movie.addEventListener('play', () => { playState(); stopWatching(); watch(); });
  movie.addEventListener('pause', () => { stopWatching(); playState(); });
  movie.addEventListener('ended', () => { seek(scenes[scene].length - 1); playState(); });
  movie.addEventListener('seeked', draw);
  function enhance(on) {
    for (const section of sections) {
      for (const el of section.querySelectorAll('.scene-choices, .film-controls, .film-grid')) el.hidden = !on;
      section.querySelector('.film-fallback').hidden = on;
    }
  }
  movie.addEventListener('loadeddata', () => {
    if (ready) return;
    ready = true;
    // If a visitor has already started the native video, keep their player in place.
    if (sections.some(section => !section.querySelector('.film-fallback').paused)) return;
    draw(); enhance(true); choose(scene);
  }, {once: true});
  movie.addEventListener('error', () => { movie.pause(); enhance(false); });
  document.addEventListener('play', e => {
    if (e.target instanceof HTMLVideoElement && e.target !== movie) movie.pause();
    if (e.target === movie) document.querySelectorAll('video').forEach(v => { if (v !== movie) v.pause(); });
  }, true);
  document.body.append(movie);
  movie.preload = 'auto';
  movie.src = 'assets/motion-and-baselines.mp4';
})();
