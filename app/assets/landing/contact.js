(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  var button = document.getElementById('contact-submit');
  var status = document.getElementById('contact-status');
  var done = document.getElementById('contact-done');
  var endpoint = form.getAttribute('data-endpoint');
  var busy = false;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var LABEL = button.textContent;

  var fields = [
    { el: document.getElementById('contact-name'), err: document.getElementById('contact-name-error'),
      check: function (v) { return v.trim() ? '' : 'Napiš prosím své jméno.'; } },
    { el: document.getElementById('contact-email'), err: document.getElementById('contact-email-error'),
      check: function (v) { return EMAIL_RE.test(v.trim()) ? '' : 'Zadej platný e-mail, například jmeno@domena.cz.'; } },
    { el: document.getElementById('contact-message'), err: document.getElementById('contact-message-error'),
      check: function (v) { return v.trim() ? '' : 'Napiš prosím zprávu.'; } }
  ];

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'contact-status' + (kind ? ' is-' + kind : '');
  }

  function validateField(f) {
    var msg = f.check(f.el.value);
    f.err.textContent = msg;
    if (msg) f.el.setAttribute('aria-invalid', 'true'); else f.el.removeAttribute('aria-invalid');
    return !msg;
  }

  function validateAll() {
    var firstBad = null;
    fields.forEach(function (f) {
      if (!validateField(f) && !firstBad) firstBad = f.el;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  fields.forEach(function (f) {
    f.el.addEventListener('blur', function () { if (f.el.value) validateField(f); });
    f.el.addEventListener('input', function () { if (f.el.getAttribute('aria-invalid')) validateField(f); });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) return;
    setStatus('', '');
    if (!validateAll()) return;

    busy = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Odesílám…';

    var data = new FormData(form);
    data.set('page', window.location.href);
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;

    fetch(endpoint, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok || !body || typeof body !== 'object' || Array.isArray(body)
          || body.ok === false || (Array.isArray(body.errors) && body.errors.length)) throw new Error('server');
      });
    }).then(function () {
      form.hidden = true;
      done.hidden = false;
      done.setAttribute('tabindex', '-1');
      done.focus();
      setTimeout(function () {
        done.hidden = true;
        form.reset();
        form.hidden = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = LABEL;
        setStatus('', '');
      }, 8000);
    }).catch(function () {
      setStatus('Zprávu se nepodařilo odeslat. Tvůj text zůstal vyplněný, zkus to prosím znovu. Případně napiš na info@iting.cz.', 'error');
    }).then(function () {
      if (timer) clearTimeout(timer);
      busy = false;
      if (!form.hidden) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = LABEL;
      }
    });
  });
})();
