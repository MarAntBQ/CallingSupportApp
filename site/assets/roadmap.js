(function () {
  var list = document.getElementById('roadmap-list');
  if (!list) return;

  var labels = {
    of: list.getAttribute('data-of'),
    closed: list.getAttribute('data-closed'),
    error: list.getAttribute('data-error'),
  };

  function done() {
    list.setAttribute('aria-busy', 'false');
  }

  function showError() {
    done();
    list.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'muted';
    p.textContent = labels.error;
    list.appendChild(p);
  }

  function render(milestones) {
    done();
    list.innerHTML = '';
    milestones
      .slice()
      .sort(function (a, b) { return a.title.localeCompare(b.title, undefined, { numeric: true }); })
      .forEach(function (m) {
        var total = m.open_issues + m.closed_issues;
        var pct = total ? Math.round((m.closed_issues / total) * 100) : 0;

        var item = document.createElement('a');
        item.className = 'milestone';
        item.href = /^https:\/\/github\.com\//.test(m.html_url)
          ? m.html_url
          : 'https://github.com/MarAntBQ/CallingSupportApp/milestones';

        var head = document.createElement('div');
        head.className = 'milestone__head';
        var title = document.createElement('span');
        title.className = 'milestone__title';
        title.textContent = m.title;
        var count = document.createElement('span');
        count.className = 'milestone__count';
        count.textContent = m.closed_issues + ' ' + labels.of + ' ' + total + ' ' + labels.closed;
        head.appendChild(title);
        head.appendChild(count);

        var bar = document.createElement('div');
        bar.className = 'bar';
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-label', m.title);
        var fill = document.createElement('span');
        fill.style.width = pct + '%';
        bar.appendChild(fill);

        item.appendChild(head);
        item.appendChild(bar);
        list.appendChild(item);
      });
  }

  fetch('https://api.github.com/repos/MarAntBQ/CallingSupportApp/milestones?state=all&per_page=50', {
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then(function (data) {
      if (!Array.isArray(data) || data.length === 0) return showError();
      render(data);
    })
    .catch(showError);
})();
