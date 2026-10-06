(function () {
  var menus = document.querySelectorAll('.nav__drop, .nav__menu');

  function closeAll(except) {
    for (var i = 0; i < menus.length; i++) {
      if (menus[i] !== except) menus[i].open = false;
    }
  }

  for (var i = 0; i < menus.length; i++) {
    menus[i].addEventListener('toggle', function (e) {
      if (e.target.open) closeAll(e.target);
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.nav__drop, .nav__menu')) closeAll(null);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.nav__drop[open], .nav__menu[open]');
    if (!open) return;
    open.open = false;
    open.querySelector('summary').focus();
  });
})();
