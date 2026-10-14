(function () {
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.faq-q'));
  if (!buttons.length) return;

  function setOpen(btn, open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
  }

  buttons.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      var willOpen = btn.getAttribute('aria-expanded') !== 'true';
      buttons.forEach(function (other) { setOpen(other, false); });
      setOpen(btn, willOpen);
    });
    btn.addEventListener('keydown', function (e) {
      var target = null;
      if (e.key === 'ArrowDown') target = buttons[(i + 1) % buttons.length];
      else if (e.key === 'ArrowUp') target = buttons[(i - 1 + buttons.length) % buttons.length];
      else if (e.key === 'Home') target = buttons[0];
      else if (e.key === 'End') target = buttons[buttons.length - 1];
      if (target) { e.preventDefault(); target.focus(); }
    });
  });
})();
