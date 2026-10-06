(function () {
  var forms = document.querySelectorAll('form[data-contact]');
  if (!forms.length) return;

  var siteKey = forms[0].getAttribute('data-sitekey');
  var recaptcha = null;

  function loadRecaptcha() {
    if (recaptcha) return recaptcha;
    recaptcha = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey);
      s.async = true;
      s.onload = function () {
        window.grecaptcha.ready(resolve);
      };
      s.onerror = function () {
        recaptcha = null;
        reject(new Error('recaptcha'));
      };
      document.head.appendChild(s);
    });
    return recaptcha;
  }

  function each(list, fn) {
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  each(forms, function (form) {
    var fields = {
      name: form.querySelector('[name="name"]'),
      email: form.querySelector('[name="email"]'),
      message: form.querySelector('[name="message"]'),
      consent: form.querySelector('[name="consent"]'),
      website: form.querySelector('[name="website"]'),
    };
    var button = form.querySelector('button[type="submit"]');
    var status = form.querySelector('[data-status]');
    var counter = form.querySelector('[data-counter]');
    var msg = function (code) {
      return form.getAttribute('data-msg-' + code) || form.getAttribute('data-msg-generic');
    };

    function show(text, kind, field) {
      status.textContent = text;
      status.setAttribute('data-kind', kind);
      if (field) field.focus();
    }

    function updateCounter() {
      counter.textContent = counter.getAttribute('data-template').replace('{n}', String(fields.message.value.length));
    }

    function validate() {
      var name = fields.name.value.trim();
      var email = fields.email.value.trim();
      var message = fields.message.value.trim();
      if (name.length < 2 || name.length > 100) return ['name', fields.name];
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ['email', fields.email];
      if (message.length < 10 || message.length > 2000) return ['message', fields.message];
      if (!fields.consent.checked) return ['consent', fields.consent];
      return null;
    }

    form.hidden = false;
    updateCounter();
    fields.message.addEventListener('input', updateCounter);
    form.addEventListener('focusin', function () {
      loadRecaptcha().catch(function () {});
    }, { once: true });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var invalid = validate();
      if (invalid) {
        show(msg(invalid[0]), 'error', invalid[1]);
        return;
      }
      button.disabled = true;
      show(form.getAttribute('data-msg-sending'), 'info');
      loadRecaptcha()
        .then(function () {
          return window.grecaptcha.execute(siteKey, { action: 'contact' });
        })
        .then(
          function (token) {
            return fetch(form.getAttribute('action'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: fields.name.value.trim(),
                email: fields.email.value.trim(),
                message: fields.message.value.trim(),
                consent: fields.consent.checked,
                website: fields.website.value,
                lang: form.getAttribute('data-lang'),
                policyVersion: form.getAttribute('data-policy'),
                token: token,
              }),
            }).then(
              function (r) {
                return r.json().then(
                  function (body) {
                    return body;
                  },
                  function () {
                    return { ok: false, error: 'generic' };
                  },
                );
              },
              function () {
                return { ok: false, error: 'network' };
              },
            );
          },
          function () {
            return { ok: false, error: 'captcha' };
          },
        )
        .then(function (body) {
          if (body && body.ok) {
            form.reset();
            updateCounter();
            show(form.getAttribute('data-msg-ok'), 'ok');
          } else {
            show(msg((body && body.error) || 'generic'), 'error');
          }
        })
        .then(function () {
          button.disabled = false;
        });
    });
  });
})();
