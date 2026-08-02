const FACE_POSITIONS = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

function pipsMarkup(face) {
  return FACE_POSITIONS[face]
    .map(pos => `<span class="pip" data-pos="${pos}"></span>`)
    .join('');
}

function randomFace() {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollDie(dieFaceEl) {
  const dieEl = dieFaceEl.closest('.die');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finalFace = randomFace();

  if (reduceMotion) {
    dieFaceEl.innerHTML = pipsMarkup(finalFace);
    return Promise.resolve(finalFace);
  }

  return new Promise(resolve => {
    const totalDuration = 1100;
    let elapsed = 0;
    let interval = 80;

    function tick() {
      dieEl.classList.remove('is-flipping');
      void dieEl.offsetWidth; // reinicia a animação
      dieEl.classList.add('is-flipping');
      dieFaceEl.innerHTML = pipsMarkup(randomFace());

      elapsed += interval;
      interval = Math.min(interval * 1.18, 220);

      if (elapsed < totalDuration) {
        setTimeout(tick, interval);
      } else {
        dieFaceEl.innerHTML = pipsMarkup(finalFace);
        setTimeout(() => resolve(finalFace), 260);
      }
    }

    tick();
  });
}
