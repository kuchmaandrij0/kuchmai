const hero = document.querySelector('.hero');
const reveal = document.querySelector('.reveal-zone');
const hint = reveal.querySelector('.hint-text');
let beamX = 0;
let beamY = 0;
let beamActive = false;
function setBeam(active) {
  beamActive = active;
  hero.classList.toggle('beam-active', active);
  reveal.setAttribute('aria-pressed', String(active));
  reveal.setAttribute('aria-label', active ? 'Выключить фонарик' : 'Включить фонарик: подсветить автомобиль сквозь чехол');
  hint.textContent = active ? 'СВЕТ РАСКРЫВАЕТ ДЕТАЛИ' : matchMedia('(hover: hover)').matches ? 'ПОДСВЕТИ АВТОМОБИЛЬ КУРСОРОМ' : 'КОСНИСЬ АВТОМОБИЛЯ — ВКЛЮЧИ СВЕТ';
}
function moveBeam(x, y) {
  beamX = Math.max(0, Math.min(hero.clientWidth, x));
  beamY = Math.max(0, Math.min(hero.clientHeight, y));
  hero.style.setProperty('--beam-x', `${beamX}px`);
  hero.style.setProperty('--beam-y', `${beamY}px`);
}
function followPointer(event) {
  const rect = hero.getBoundingClientRect();
  moveBeam(event.clientX - rect.left, event.clientY - rect.top);
  setBeam(true);
}
reveal.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') followPointer(event); });
reveal.addEventListener('pointermove', event => { if (event.pointerType === 'mouse' || event.buttons > 0) followPointer(event); });
reveal.addEventListener('pointerdown', followPointer);
reveal.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') setBeam(false); });
reveal.addEventListener('pointercancel', () => setBeam(false));
reveal.addEventListener('blur', () => setBeam(false));
reveal.addEventListener('click', event => {
  if (event.detail !== 0) return;
  if (!beamActive) moveBeam(hero.clientWidth * .68, hero.clientHeight * .58);
  setBeam(!beamActive);
});
reveal.addEventListener('keydown', event => {
  const directions = {ArrowLeft: [-35, 0], ArrowRight: [35, 0], ArrowUp: [0, -35], ArrowDown: [0, 35]};
  if (event.key === 'Escape') { setBeam(false); return; }
  if (!directions[event.key]) return;
  event.preventDefault();
  if (!beamActive) moveBeam(hero.clientWidth * .68, hero.clientHeight * .58);
  const [dx, dy] = directions[event.key];
  moveBeam(beamX + dx, beamY + dy);
  setBeam(true);
});
window.addEventListener('scroll', () => { if (beamActive) setBeam(false); }, {passive: true});
setBeam(false);
const dialog = document.querySelector('dialog');
const requestForm = document.querySelector('#request-form');
function openRequest(message = '') {
  requestForm.reset();
  requestForm.elements.message.value = message;
  document.querySelector('#form-status').textContent = '';
  dialog.showModal();
}
document.querySelectorAll('[data-contact]').forEach(button => button.addEventListener('click', () => openRequest()));
document.querySelector('[data-model]').addEventListener('click', e => openRequest('Интересует автомобиль ' + e.currentTarget.dataset.model));
document.querySelector('.parts-search').addEventListener('submit', e => {e.preventDefault(); openRequest('Подбор запчастей: ' + new FormData(e.currentTarget).get('query'));});
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => openRequest('Подбор запчастей. Категория: ' + button.dataset.category)));
document.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {if(e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) dialog.close(); }});
requestForm.addEventListener('submit', e => {
  e.preventDefault();
  try {
    const requests = JSON.parse(localStorage.getItem('kuchmai-requests') || '[]');
    requests.push({...Object.fromEntries(new FormData(requestForm)), createdAt:new Date().toISOString()});
    localStorage.setItem('kuchmai-requests',JSON.stringify(requests));
    document.querySelector('#form-status').textContent='Запрос сохранён в этом браузере. Отправка в магазин будет доступна после подключения сервиса заявок.';
  } catch { document.querySelector('#form-status').textContent='Браузер не разрешил сохранить запрос. Проверь настройки локального хранилища.'; }
});
const navigation = [...document.querySelectorAll('nav a')];
const observer = new IntersectionObserver(entries => {for(const entry of entries) if(entry.isIntersecting) navigation.forEach(a => a.classList.toggle('active',a.hash === '#'+entry.target.id));},{rootMargin:'-15% 0px -60% 0px'});
document.querySelectorAll('main section[id]').forEach(section=>observer.observe(section));
