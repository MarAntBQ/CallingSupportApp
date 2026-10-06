(function () {
  var LANGS = ['es', 'pt', 'en'];
  var KEY = 'csa_lang';
  var root = document.documentElement;

  function saved() {
    var l = null;
    try {
      l = window.localStorage.getItem(KEY);
    } catch (e) {}
    return LANGS.indexOf(l) === -1 ? 'es' : l;
  }

  function apply(l) {
    root.lang = l;
    root.setAttribute('data-lang', l);
    var title = root.getAttribute('data-title-' + l);
    if (title) document.title = title;
    var desc = root.getAttribute('data-desc-' + l);
    var meta = document.querySelector('meta[name="description"]');
    if (meta && desc) meta.setAttribute('content', desc);
    var labelled = document.querySelectorAll('[data-aria-' + l + ']');
    for (var i = 0; i < labelled.length; i++)
      labelled[i].setAttribute('aria-label', labelled[i].getAttribute('data-aria-' + l));
    var buttons = document.querySelectorAll('[data-set-lang]');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].setAttribute('aria-pressed', buttons[j].getAttribute('data-set-lang') === l ? 'true' : 'false');
    }
  }

  var initial = saved();
  root.lang = initial;
  root.setAttribute('data-lang', initial);

  document.addEventListener('DOMContentLoaded', function () {
    apply(saved());
    var switcher = document.querySelector('.langs');
    if (switcher) switcher.hidden = false;
    document.addEventListener('click', function (e) {
      var target = e.target && e.target.closest ? e.target.closest('[data-set-lang]') : null;
      if (!target) return;
      var l = target.getAttribute('data-set-lang');
      if (LANGS.indexOf(l) === -1) return;
      try {
        window.localStorage.setItem(KEY, l);
      } catch (err) {}
      apply(l);
    });
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) apply(saved());
  });
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) apply(saved());
  });
})();
