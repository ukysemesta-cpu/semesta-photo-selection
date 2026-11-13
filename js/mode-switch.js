(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const collage = document.querySelector('.collage-app');
  const carousel = $('carouselMaker');
  const actions = $('collageExportActions');
  const buttons = {
    collage: [$('showCollageMode'), $('collageModeButton')],
    carousel: [$('showCarouselMode'), $('carouselModeButton')]
  };
  if (!collage || !carousel) {
    console.error('[Semesta Collage] Elemen mode tidak ditemukan.');
    return;
  }
  function setMode(mode) {
    const isCarousel = mode === 'carousel';
    collage.hidden = isCarousel;
    carousel.hidden = !isCarousel;
    if (actions) actions.hidden = isCarousel;
    buttons.collage.forEach(b => b && b.classList.toggle('active', !isCarousel));
    buttons.carousel.forEach(b => b && b.classList.toggle('active', isCarousel));
    document.body.dataset.editorMode = mode;
    if (isCarousel) {
      const preview = $('carouselCanvas');
      if (preview) preview.dispatchEvent(new Event('semesta:mode-visible'));
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  }
  buttons.collage.forEach(b => b && b.addEventListener('click', () => setMode('collage')));
  buttons.carousel.forEach(b => b && b.addEventListener('click', () => setMode('carousel')));
  // Set initial state explicitly; do not rely on browser handling of the hidden attribute.
  setMode('collage');
  console.info('[Semesta Collage] Navigasi Kolase/Carousel aktif.');
})();
