const reveal = document.querySelector('.reveal-zone');
const hint = reveal.querySelector('.hint-text');
function setReveal(value) {
  reveal.classList.toggle('revealed', value);
  reveal.setAttribute('aria-pressed', String(value));
  reveal.setAttribute('aria-label', value ? 'Накрыть Volkswagen Transporter T5 чехлом' : 'Снять чехол с Volkswagen Transporter T5');
  hint.textContent = value ? 'VOLKSWAGEN TRANSPORTER T5' : matchMedia('(hover: hover)').matches ? 'НАВЕДИ, ЧТОБЫ ОТКРЫТЬ' : 'НАЖМИ, ЧТОБЫ ОТКРЫТЬ';
}
reveal.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setReveal(true); });
reveal.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') setReveal(false); });
reveal.addEventListener('click', e => { if (e.detail === 0 || !matchMedia('(hover: hover)').matches) setReveal(!reveal.classList.contains('revealed')); });
setReveal(false);
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
