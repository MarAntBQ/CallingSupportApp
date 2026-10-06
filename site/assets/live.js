(function () {
  var API = 'https://api.github.com/repos/MarAntBQ/CallingSupportApp';

  function ready(el) {
    el.setAttribute('aria-busy', 'false');
    el.replaceChildren();
  }

  function showError(el) {
    ready(el);
    var p = document.createElement('p');
    p.className = 'muted';
    p.textContent = el.getAttribute('data-error');
    el.appendChild(p);
  }

  function get(path) {
    return fetch(API + path, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  var roadmap = document.getElementById('roadmap-list');
  if (roadmap) {
    get('/milestones?state=all&per_page=50')
      .then(function (data) {
        if (Array.isArray(data)) {
          data = data.filter(function (m) {
            return m && typeof m.title === 'string' && typeof m.open_issues === 'number' && typeof m.closed_issues === 'number';
          });
        }
        if (!Array.isArray(data) || !data.length) return showError(roadmap);
        ready(roadmap);
        data
          .slice()
          .sort(function (a, b) { return a.title.localeCompare(b.title, undefined, { numeric: true }); })
          .forEach(function (m) {
            var total = m.open_issues + m.closed_issues;
            var pct = total ? Math.round((m.closed_issues / total) * 100) : 0;
            var a = document.createElement('a');
            a.className = 'milestone';
            a.href = /^https:\/\/github\.com\//.test(m.html_url) ? m.html_url : 'https://github.com/MarAntBQ/CallingSupportApp/milestones';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            var head = document.createElement('div');
            head.className = 'milestone__head';
            var t = document.createElement('span');
            t.className = 'milestone__title';
            t.textContent = m.title;
            var c = document.createElement('span');
            c.className = 'milestone__count';
            c.textContent = m.closed_issues + ' ' + roadmap.getAttribute('data-of') + ' ' + total + ' ' + roadmap.getAttribute('data-closed');
            head.appendChild(t);
            head.appendChild(c);
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
            a.appendChild(head);
            a.appendChild(bar);
            roadmap.appendChild(a);
          });
      })
      .catch(function () { showError(roadmap); });
  }

  var people = document.getElementById('contributors-list');
  if (people) {
    get('/contributors?per_page=100')
      .then(function (data) {
        var humans = (Array.isArray(data) ? data : []).filter(function (u) { return u.type !== 'Bot'; });
        if (!humans.length) return showError(people);
        ready(people);
        humans.forEach(function (u) {
          var a = document.createElement('a');
          a.className = 'contributor';
          a.href = /^https:\/\/github\.com\//.test(u.html_url) ? u.html_url : 'https://github.com/';
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          if (/^https:\/\/avatars\.githubusercontent\.com\//.test(u.avatar_url)) {
            var img = document.createElement('img');
            img.src = u.avatar_url + (u.avatar_url.indexOf('?') === -1 ? '?' : '&') + 's=72';
            img.alt = '';
            img.width = 36;
            img.height = 36;
            img.loading = 'lazy';
            a.appendChild(img);
          }
          var name = document.createElement('span');
          name.textContent = '@' + u.login;
          a.appendChild(name);
          var n = document.createElement('small');
          n.textContent = u.contributions + ' ' + people.getAttribute('data-contributions');
          a.appendChild(n);
          people.appendChild(a);
        });
      })
      .catch(function () { showError(people); });
  }
})();
