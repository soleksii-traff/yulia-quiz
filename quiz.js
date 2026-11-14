/* Квиз Юлии. Без библиотек. Все тексты и настройки в config.js. */
(function () {
  "use strict";
  var C = window.QUIZ_CONFIG;
  /* Версии для сравнения (папки v1, v2, v3…): поверх config.js подставляются их настройки */
  if (window.QUIZ_VARIANT) Object.keys(window.QUIZ_VARIANT).forEach(function (k) { C[k] = window.QUIZ_VARIANT[k]; });
  var Q = C.questions;
  var STORE = "quiz_state_v2"; // v2: новые вопросы, старый прогресс не подхватываем
  var CONSENT = "quiz_consent_v1";
  var root = document.getElementById("app");
  var LETTERS = ["А", "Б", "В", "Г"];
  /* Оформление: журнальная вёрстка, тёмная или светлая тема.
     Тема по умолчанию из config.js (theme), выбор человека запоминается в браузере. */
  var THEME = C.themeKey || "quiz_theme_v1"; // у версий свой ключ, чтобы выбор темы в одной не менял другую
  /* Варианты оформления в стиле Юлии: powder, sky. Задаётся skin в config.js или ссылкой ?skin=powder.
     У «пудры» есть тёмная пара — бургунди, у остальных вариантов кнопка смены темы скрыта. */
  var SKINS = {
    powder: { light: "#f5f1ee", dark: "#400f1c", fonts: "family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Open+Sans:wght@400;600" },
    sky: { light: "#7a9cb3", fonts: "family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Montserrat:wght@300;400;500" },
    /* «Изумруд» по словам Юлии: цвет стен её дома, голубое свечение сзади, белый вместо бежевого.
       Шрифты как «Poster» и «Deco» из её сторис (выбор alejo 12.11): Yeseva One — заголовки; текст с 14.11 — Tenor Sans (выбор Юлии), Poiret One плохо читался. */
    emerald: { light: "#ffffff", dark: "#0f4f4e", fonts: "family=Yeseva+One&family=Tenor+Sans" }
  };
  var skin = (function () { var q = new URLSearchParams(location.search).get("skin"); var k = q != null ? q : C.skin; return SKINS[k] ? k : ""; })();
  function setTheme(t) {
    t = t === "light" ? "light" : "dark";
    var h = document.documentElement, color;
    h.setAttribute("data-layout", C.layout || "journal");
    if (skin) {
      var S = SKINS[skin];
      if (!S.dark) t = "light";
      h.setAttribute("data-palette", skin);
      h.setAttribute("data-skin", skin);
      h.setAttribute("data-mode", t);
      color = S[t];
    } else {
      h.setAttribute("data-palette", t);
      color = t === "light" ? "#f6f1e9" : "#19181b";
    }
    var mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.setAttribute("content", color);
    return t;
  }
  /* themeLock: у версии одна тема, кнопка смены темы скрыта */
  var theme = setTheme(C.themeLock ? C.theme : (new URLSearchParams(location.search).get("theme") || load(THEME) || C.theme));
  if (C.themeLock) document.documentElement.setAttribute("data-no-toggle", "");
  if (skin) {
    var fl = document.createElement("link"); fl.rel = "stylesheet";
    fl.href = "https://fonts.googleapis.com/css2?" + SKINS[skin].fonts + "&display=swap";
    document.head.appendChild(fl);
    if (!SKINS[skin].dark) document.documentElement.setAttribute("data-no-toggle", "");
  }
  function toggleTheme() { theme = setTheme(theme === "dark" ? "light" : "dark"); save(THEME, theme); syncThemeBtn(); }
  function syncThemeBtn() {
    var b = document.querySelector(".theme");
    if (!b) return;
    b.innerHTML = theme === "dark" ? sunSvg : moonSvg;
    b.setAttribute("aria-label", theme === "dark" ? "Светлая тема" : "Тёмная тема");
  }
  var sunSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
  var moonSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

  /* ---------- хранение прогресса (только в браузере человека) ---------- */
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function drop(key) { try { localStorage.removeItem(key); } catch (e) {} }

  var state = load(STORE) || { answers: [] };
  if (!Array.isArray(state.answers) || state.answers.length > Q.length) state = { answers: [] };
  function persist() { save(STORE, state); }

  /* ---------- метки: всё из адреса квиза уходит дальше на лендинг ---------- */
  var incoming = new URLSearchParams(location.search);
  function withParams(url, extra) {
    try {
      var u = new URL(url, location.href);
      incoming.forEach(function (v, k) { if (!u.searchParams.has(k)) u.searchParams.set(k, v); });
      Object.keys(extra || {}).forEach(function (k) { u.searchParams.set(k, extra[k]); });
      return u.toString();
    } catch (e) { return url; }
  }

  /* ---------- аналитика: грузится только после «Принять» ---------- */
  var analyticsOn = false;
  function loadScript(src) { var s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }
  function startAnalytics() {
    if (analyticsOn) return;
    analyticsOn = true;
    if (C.ga4Id) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", C.ga4Id, { allow_google_signals: false, allow_ad_personalization_signals: false });
      loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(C.ga4Id));
    }
    if (C.pixelId) {
      /* стандартный код пикселя Meta */
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", C.pixelId);
      window.fbq("track", "PageView");
    }
  }
  /* В аналитику уходит только номер шага и факт прохождения. Ответы и модель — никогда. */
  function track(name, params) {
    if (!analyticsOn) return;
    if (window.gtag) window.gtag("event", name, params || {});
    if (window.fbq) {
      if (name === "quiz_start") window.fbq("trackCustom", "QuizStart");
      if (name === "quiz_complete") window.fbq("trackCustom", "QuizComplete");
    }
  }
  function consentBanner() {
    if (!C.ga4Id && !C.pixelId) return;
    var choice = load(CONSENT);
    if (choice === "yes") { startAnalytics(); return; }
    if (choice === "no") return;
    var box = el("div", "consent");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Cookies");
    var inner = el("div");
    var p = el("p", null, "Я использую cookies Google Analytics и Meta, чтобы понимать, сколько человек проходит тест и откуда они пришли. Твои ответы никуда не отправляются.");
    if (C.privacyUrl) { p.appendChild(document.createTextNode(" ")); var a = el("a", null, "Подробнее"); a.href = C.privacyUrl; a.target = "_blank"; a.rel = "noopener"; p.appendChild(a); }
    var row = el("div", "row");
    var no = el("button", "btn ghost", "Отклонить");
    var yes = el("button", "btn", "Принять");
    no.onclick = function () { save(CONSENT, "no"); box.remove(); };
    yes.onclick = function () { save(CONSENT, "yes"); box.remove(); startAnalytics(); };
    row.append(no, yes);
    inner.append(p, row);
    box.appendChild(inner);
    document.body.appendChild(box);
  }

  /* ---------- маленькие помощники ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduced ? Math.min(ms, 80) : ms); }); }
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var run = 0; // защита от двойных переходов
  /* Корона: мазок кистью (заливка) + линии-маски для анимации прорисовки */
  var crownPath = "M4.0 55.2L5.7 55.0L7.3 54.8L8.9 54.6L10.5 54.5L12.2 54.3L13.8 54.2L15.4 54.0L17.0 53.9L18.6 53.8L20.3 53.6L21.9 53.5L23.5 53.4L25.1 53.2L26.7 53.1L28.4 52.9L30.0 52.8L31.6 52.7L33.2 52.5L34.8 52.4L36.5 52.3L38.1 52.2L39.7 52.1L41.3 52.0L42.9 51.9L44.6 51.8L46.2 51.8L47.8 51.7L49.4 51.7L51.1 51.6L52.7 51.6L54.3 51.5L55.9 51.5L57.6 51.5L59.2 51.5L60.8 51.5L62.4 51.5L64.1 51.5L65.7 51.5L67.3 51.5L68.9 51.5L70.6 51.6L72.2 51.6L73.8 51.7L75.4 51.8L77.0 51.9L78.7 52.0L80.3 52.1L81.9 52.2L83.5 52.4L85.1 52.5L86.7 52.7L88.3 52.9L89.9 53.1L91.5 53.3L93.1 53.6L94.7 53.8L96.3 54.1L97.9 54.3L99.5 54.6L101.1 54.8L102.7 55.1L104.2 55.4L105.8 55.7L107.4 56.0L109.0 56.3L110.6 56.7L112.2 57.0L113.7 57.4L115.3 57.8L116.9 58.3L117.1 57.7L115.6 57.0L114.2 56.3L112.6 55.6L111.1 54.9L109.6 54.3L108.0 53.8L106.5 53.2L104.9 52.7L103.3 52.2L101.7 51.8L100.1 51.4L98.5 51.1L96.9 50.8L95.2 50.5L93.6 50.2L92.0 50.0L90.3 49.8L88.7 49.6L87.1 49.5L85.4 49.3L83.8 49.2L82.1 49.1L80.5 48.9L78.8 48.9L77.2 48.8L75.6 48.7L73.9 48.6L72.3 48.6L70.6 48.6L69.0 48.5L67.4 48.5L65.7 48.5L64.1 48.5L62.4 48.5L60.8 48.5L59.2 48.6L57.5 48.6L55.9 48.6L54.3 48.7L52.6 48.7L51.0 48.8L49.3 48.8L47.7 48.9L46.1 49.0L44.4 49.0L42.8 49.1L41.2 49.2L39.5 49.3L37.9 49.5L36.3 49.6L34.6 49.7L33.0 49.8L31.4 50.0L29.7 50.2L28.1 50.3L26.5 50.5L24.9 50.7L23.2 50.9L21.6 51.2L20.0 51.4L18.4 51.7L16.8 52.0L15.2 52.3L13.5 52.6L11.9 53.0L10.3 53.3L8.7 53.7L7.1 54.1L5.6 54.4L4.0 54.8ZM5.7 9.2L6.2 10.2L6.7 11.2L7.2 12.2L7.8 13.2L8.3 14.1L8.9 15.1L9.5 16.0L10.1 17.0L10.8 17.9L11.4 18.8L12.2 19.7L12.9 20.5L13.6 21.4L14.4 22.2L15.3 22.9L16.1 23.7L17.0 24.4L17.9 25.1L18.8 25.8L19.7 26.5L20.7 27.1L21.7 27.7L22.6 28.3L23.7 28.9L24.7 29.4L25.8 29.9L26.9 30.3L28.0 30.7L29.1 31.0L30.3 31.3L31.5 31.5L32.6 31.6L33.8 31.6L35.0 31.6L36.2 31.5L37.4 31.1L38.5 30.8L39.6 30.3L40.7 29.9L41.7 29.4L42.7 28.8L43.6 28.2L44.5 27.6L45.4 26.9L46.2 26.2L47.1 25.4L47.9 24.7L48.8 24.0L49.6 23.3L50.4 22.5L51.2 21.7L51.9 20.9L52.7 20.1L53.4 19.2L54.0 18.3L54.7 17.4L55.3 16.5L55.8 15.5L56.4 14.5L56.9 13.6L57.3 12.6L57.8 11.5L58.2 10.5L58.6 9.5L58.9 8.4L59.2 7.4L59.5 6.3L59.8 5.2L60.0 4.1L60.2 3.1L59.8 2.9L59.4 4.0L59.0 5.0L58.6 6.0L58.1 7.0L57.7 7.9L57.2 8.9L56.8 9.9L56.3 10.9L55.8 11.8L55.3 12.8L54.8 13.7L54.3 14.7L53.8 15.6L53.3 16.6L52.8 17.5L52.2 18.4L51.6 19.3L51.0 20.2L50.4 21.1L49.7 21.9L49.0 22.8L48.3 23.6L47.6 24.4L46.8 25.1L45.9 25.7L45.0 26.3L44.0 26.8L43.1 27.2L42.1 27.6L41.1 28.0L40.1 28.3L39.0 28.5L38.0 28.7L37.0 28.8L36.1 28.7L35.1 28.6L34.1 28.4L33.1 28.3L32.1 28.0L31.2 27.7L30.2 27.4L29.3 27.1L28.3 26.7L27.4 26.2L26.5 25.8L25.6 25.3L24.8 24.7L23.9 24.2L23.0 23.6L22.2 23.0L21.4 22.4L20.6 21.7L19.8 21.1L19.0 20.4L18.2 19.7L17.4 19.0L16.6 18.3L15.8 17.6L15.1 16.9L14.3 16.2L13.5 15.5L12.7 14.7L11.9 14.0L11.1 13.3L10.3 12.6L9.5 11.8L8.7 11.1L7.9 10.3L7.1 9.6L6.3 8.8ZM59.7 3.1L59.8 4.2L60.0 5.3L60.2 6.4L60.4 7.5L60.6 8.6L60.9 9.7L61.2 10.8L61.5 11.9L61.8 12.9L62.2 14.0L62.7 15.1L63.1 16.1L63.6 17.1L64.2 18.1L64.8 19.1L65.4 20.1L66.1 21.0L66.8 21.9L67.5 22.8L68.3 23.7L69.1 24.6L69.9 25.4L70.8 26.2L71.7 26.9L72.6 27.6L73.6 28.3L74.6 28.9L75.7 29.5L76.7 30.0L77.8 30.5L79.0 30.9L80.1 31.2L81.3 31.5L82.5 31.7L83.8 31.6L85.0 31.5L86.2 31.4L87.3 31.2L88.4 30.9L89.5 30.5L90.6 30.1L91.7 29.7L92.7 29.2L93.7 28.7L94.7 28.2L95.6 27.6L96.6 27.0L97.5 26.3L98.4 25.7L99.2 25.0L100.1 24.3L100.9 23.6L101.7 22.9L102.6 22.2L103.4 21.5L104.3 20.8L105.1 20.1L105.9 19.3L106.7 18.5L107.4 17.7L108.2 16.9L108.9 16.1L109.6 15.3L110.3 14.4L111.0 13.5L111.6 12.7L112.3 11.8L112.9 10.9L113.5 10.0L114.1 9.1L113.9 8.9L113.2 9.8L112.5 10.6L111.9 11.5L111.2 12.3L110.5 13.1L109.8 14.0L109.0 14.8L108.3 15.6L107.6 16.4L106.9 17.2L106.1 18.0L105.4 18.8L104.6 19.6L103.9 20.4L103.1 21.1L102.3 21.9L101.5 22.6L100.6 23.3L99.7 23.9L98.8 24.5L97.9 25.1L97.0 25.6L96.0 26.1L95.1 26.6L94.1 27.0L93.1 27.4L92.1 27.7L91.1 28.0L90.1 28.3L89.0 28.5L88.0 28.6L87.0 28.7L86.0 28.7L84.9 28.6L83.9 28.5L83.1 28.3L82.2 28.0L81.2 27.6L80.3 27.3L79.4 26.9L78.5 26.4L77.7 25.9L76.8 25.4L76.0 24.8L75.2 24.2L74.4 23.6L73.7 22.9L73.0 22.2L72.3 21.5L71.6 20.8L70.9 20.0L70.2 19.2L69.6 18.4L69.0 17.6L68.4 16.7L67.9 15.8L67.3 15.0L66.7 14.1L66.1 13.2L65.6 12.3L65.0 11.4L64.5 10.5L63.9 9.6L63.4 8.7L62.8 7.8L62.3 6.8L61.8 5.9L61.3 4.9L60.8 3.9L60.3 2.9ZM8.7 15.1L8.7 15.6L8.6 16.0L8.6 16.5L8.5 17.0L8.5 17.5L8.5 18.0L8.5 18.4L8.4 18.9L8.5 19.4L8.5 19.8L8.5 20.3L8.6 20.7L8.6 21.2L8.7 21.6L8.8 22.1L8.9 22.5L9.0 23.0L9.1 23.4L9.2 23.8L9.4 24.3L9.5 24.7L9.6 25.1L9.7 25.6L9.8 26.0L9.9 26.5L10.0 26.9L10.1 27.3L10.2 27.8L10.3 28.2L10.4 28.7L10.5 29.1L10.6 29.5L10.7 30.0L10.8 30.4L10.9 30.9L11.0 31.3L11.1 31.7L11.2 32.2L11.3 32.6L11.4 33.1L11.5 33.5L11.6 33.9L11.7 34.4L11.8 34.8L11.9 35.3L12.0 35.7L12.1 36.1L12.2 36.6L12.3 37.0L12.4 37.5L12.5 37.9L12.6 38.4L12.6 38.8L12.7 39.2L12.8 39.7L12.9 40.1L13.0 40.6L13.2 41.0L13.3 41.4L13.5 41.9L13.7 42.3L13.9 42.7L14.1 43.1L14.3 43.5L14.5 44.0L14.7 44.4L15.0 44.8L15.2 45.2L15.5 45.6L15.7 46.1L16.3 45.9L16.4 45.5L16.5 45.0L16.5 44.5L16.6 44.0L16.7 43.6L16.7 43.1L16.8 42.6L16.8 42.1L16.8 41.7L16.8 41.2L16.8 40.8L16.8 40.3L16.8 39.8L16.7 39.4L16.6 38.9L16.6 38.5L16.5 38.0L16.4 37.6L16.3 37.1L16.2 36.7L16.1 36.2L16.0 35.8L15.9 35.3L15.8 34.9L15.7 34.5L15.7 34.0L15.6 33.6L15.5 33.1L15.4 32.7L15.3 32.2L15.2 31.8L15.1 31.3L15.0 30.9L14.9 30.4L14.8 30.0L14.7 29.5L14.6 29.1L14.5 28.6L14.4 28.2L14.3 27.8L14.2 27.3L14.1 26.9L14.0 26.4L13.9 26.0L13.8 25.5L13.7 25.1L13.5 24.6L13.4 24.2L13.3 23.8L13.2 23.3L13.1 22.9L13.0 22.4L12.9 22.0L12.8 21.5L12.7 21.1L12.5 20.7L12.4 20.2L12.2 19.8L12.1 19.4L11.9 18.9L11.7 18.5L11.4 18.1L11.2 17.7L10.9 17.3L10.7 16.9L10.4 16.5L10.1 16.1L9.9 15.7L9.6 15.3L9.3 14.9ZM110.8 14.9L110.6 15.4L110.3 15.8L110.1 16.2L109.9 16.6L109.7 17.0L109.5 17.4L109.3 17.8L109.1 18.2L108.9 18.7L108.7 19.1L108.5 19.5L108.4 19.9L108.2 20.4L108.1 20.8L107.9 21.3L107.8 21.7L107.7 22.1L107.6 22.6L107.5 23.0L107.4 23.5L107.3 23.9L107.2 24.3L107.0 24.8L106.9 25.2L106.8 25.7L106.7 26.1L106.6 26.6L106.5 27.0L106.4 27.4L106.3 27.9L106.2 28.3L106.1 28.8L106.0 29.2L105.9 29.7L105.8 30.1L105.7 30.6L105.6 31.0L105.5 31.4L105.4 31.9L105.3 32.3L105.2 32.8L105.1 33.2L105.0 33.7L104.9 34.1L104.8 34.6L104.7 35.0L104.6 35.5L104.5 35.9L104.4 36.3L104.3 36.8L104.2 37.2L104.1 37.7L104.0 38.1L103.9 38.6L103.9 39.0L103.8 39.5L103.7 39.9L103.7 40.4L103.6 40.8L103.6 41.3L103.6 41.8L103.6 42.2L103.6 42.7L103.6 43.1L103.6 43.6L103.6 44.1L103.7 44.6L103.7 45.0L103.7 45.5L103.8 46.0L104.2 46.0L104.4 45.6L104.6 45.2L104.8 44.8L105.0 44.3L105.2 43.9L105.4 43.5L105.6 43.1L105.8 42.6L105.9 42.2L106.1 41.8L106.2 41.3L106.4 40.9L106.5 40.5L106.6 40.0L106.7 39.6L106.8 39.1L106.9 38.7L106.9 38.3L107.0 37.8L107.1 37.4L107.2 36.9L107.3 36.5L107.4 36.0L107.5 35.6L107.6 35.2L107.7 34.7L107.8 34.3L107.8 33.8L107.9 33.4L108.0 32.9L108.1 32.5L108.2 32.1L108.3 31.6L108.4 31.2L108.5 30.7L108.6 30.3L108.7 29.8L108.8 29.4L108.9 29.0L109.0 28.5L109.1 28.1L109.2 27.6L109.3 27.2L109.4 26.8L109.5 26.3L109.6 25.9L109.7 25.4L109.8 25.0L109.9 24.6L110.0 24.1L110.1 23.7L110.3 23.2L110.4 22.8L110.5 22.4L110.6 21.9L110.7 21.5L110.8 21.0L110.8 20.6L110.9 20.1L111.0 19.7L111.0 19.2L111.1 18.8L111.1 18.3L111.1 17.9L111.1 17.4L111.2 16.9L111.2 16.5L111.2 16.0L111.2 15.5L111.2 15.1Z";
  var crownLines = ["M6 9C16 23 27 31 37 30C48 28 56 17 60 3", "M60 3C64 17 72 28 83 30C93 31 104 23 114 9", "M9 15C12 26 14 35 16 46", "M111 15C108 26 106 35 104 46", "M4 55C26 51 46 50 64 50C84 50 102 52 117 58"];
  var crownSvg = '<svg viewBox="0 0 120 64" aria-hidden="true"><defs><mask id="crownMask" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="64">' +
    crownLines.map(function (d, i) { return '<path d="' + d + '" pathLength="1" style="--i:' + i + '"/>'; }).join("") +
    '</mask></defs><path d="' + crownPath + '" fill="currentColor" mask="url(#crownMask)"/></svg>';
  var backSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

  function frame(opts) {
    root.innerHTML = "";
    root.classList.remove("has-hero");
    window.scrollTo(0, 0);
    if (C.draft) root.appendChild(el("p", "draft", "Черновик"));
    var top = el("div", "top");
    var back = el("button", "back");
    back.innerHTML = backSvg;
    back.setAttribute("aria-label", "Назад");
    back.disabled = !opts.onBack;
    if (opts.onBack) back.onclick = opts.onBack;
    var bar = el("div", "bar"); var fill = el("i"); bar.appendChild(fill);
    var count = el("div", "count", opts.count || "");
    var tb = el("button", "theme");
    tb.type = "button";
    tb.onclick = toggleTheme;
    top.append(back, bar, count, tb);
    root.appendChild(top);
    syncThemeBtn();
    requestAnimationFrame(function () { fill.style.width = (opts.progress || 0) + "%"; });
    var body = el("div", opts.bodyClass || "chat");
    root.appendChild(body);
    return body;
  }
  function who() {
    var w = el("div", "who");
    var av = el("div", "avatar");
    if (C.author.avatar) { var img = el("img"); img.src = C.author.avatar; img.alt = C.author.name; av.appendChild(img); }
    else av.textContent = C.author.initials;
    var t = el("div");
    t.append(el("b", null, C.author.name), el("span", null, C.author.role));
    w.append(av, t);
    return w;
  }
  /* Держим новое сообщение в поле зрения, если человек и так внизу страницы */
  function nearBottom() { return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160; }
  function follow(node) { node.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" }); }

  /* Сообщение Юлии: сначала «печатает…», потом текст. typing — скорость из config (для первого экрана). */
  async function say(chat, text, cls, id, title, typing) {
    var stick = typing && nearBottom();
    var t = el("div", "msg typing"); t.innerHTML = "<i></i><i></i><i></i>"; t.setAttribute("aria-hidden", "true");
    chat.appendChild(t);
    if (stick) follow(t);
    var ms = typing ? Math.min(typing.max, typing.min + text.length * typing.perChar) : Math.min(1100, 350 + text.length * 9);
    await wait(ms);
    if (id !== run) return null;
    var m = el("div", "msg" + (cls ? " " + cls : ""));
    if (title) m.appendChild(el("b", "qt", title));
    m.appendChild(document.createTextNode(text));
    t.replaceWith(m);
    if (stick) follow(m);
    return m;
  }

  /* Сообщение без «печатает…»: просто плавно появляется (вопросы). delay — задержка анимации, мс */
  function show(chat, text, cls, title, delay) {
    var m = el("div", "msg" + (cls ? " " + cls : ""));
    if (title) m.appendChild(el("b", "qt", title));
    m.appendChild(document.createTextNode(text));
    if (delay) m.style.animationDelay = delay + "ms";
    chat.appendChild(m);
    return m;
  }

  /* ---------- экраны ---------- */
  /* Вид первого экрана: "chat" — переписка, "photo" — большое фото. Для сравнения можно открыть ?intro=photo */
  var introStyle = (function () { var m = location.search.match(/[?&]intro=(chat|photo)/); return m ? m[1] : (C.introStyle || "chat"); })();

  function introPhoto() {
    ++run;
    var body = frame({ progress: 0, bodyClass: "chat intro hero" });
    root.classList.add("has-hero");
    var hero = el("div", "hero-img");
    var img = el("img"); img.src = C.heroPhoto || C.author.photo || C.author.avatar; img.alt = C.author.name;
    hero.appendChild(img);
    var head = el("div", "hero-head");
    var cc = el("div", "crown"); cc.innerHTML = crownSvg;
    head.append(cc, el("p", "eyebrow", C.labels.cover), el("h1", null, C.title));
    /* подпись «Юлия Мартынюк · психолог-психотерапевт» убрана (alejo 12.11): она повторяет приветствие */
    var text = el("div", "hero-text");
    C.intro.forEach(function (t, i) { var p = el("p", null, t); p.style.animationDelay = (250 + i * 90) + "ms"; text.appendChild(p); });
    if (C.introAccent) accentIntro(text);
    var box = el("div", "answers");
    var go = el("button", "btn", C.startButton);
    go.onclick = function () { root.classList.remove("has-hero"); track("quiz_start"); question(0); };
    preload(0);
    box.appendChild(go);
    if (C.introNote) box.appendChild(el("p", "note", C.introNote));
    body.append(hero, head, text, box);
  }

  /* Вариант А: маркер и жирный на ключевых фразах (introMarks), последний абзац крупно. Текст тот же, меняются только теги. */
  function accentIntro(text) {
    var P = text.querySelectorAll("p");
    (C.introMarks || []).forEach(function (m) {
      var p = P[m[0]]; if (!p) return;
      for (var n = p.firstChild; n; n = n.nextSibling) {
        if (n.nodeType !== 3) continue;
        var i = n.nodeValue.indexOf(m[1]); if (i < 0) continue;
        var rest = n.splitText(i); rest.splitText(m[1].length);
        var w = document.createElement(m[2] === "b" ? "b" : "mark"); w.textContent = m[1];
        p.replaceChild(w, rest); return;
      }
    });
    /* introQuote: абзац с вопросами — каждый вопрос с новой строки, с золотой чертой слева (вариант Б, alejo 14.11) */
    var qp = C.introQuote != null ? P[C.introQuote] : null;
    if (qp) {
      var parts = qp.textContent.split(/\?\s+/);
      qp.textContent = "";
      parts.forEach(function (t, i) { qp.appendChild(el("span", "ln", t + (i < parts.length - 1 ? "?" : ""))); });
      qp.classList.add("quote");
    }
    if (P.length) P[P.length - 1].classList.add("call");
  }

  async function intro() {
    if (introStyle === "photo") return introPhoto();
    var id = ++run;
    var chat = frame({ progress: 0, bodyClass: "chat intro" });
    if (C.title) {
      var cover = el("div", "cover");
      var cc = el("div", "crown"); cc.innerHTML = crownSvg;
      cover.append(cc, el("p", "eyebrow", C.labels.cover), el("h1", null, C.title));
      chat.appendChild(cover);
    }
    chat.appendChild(who());
    var T = C.introTyping || { min: 1000, perChar: 14, max: 2800, pause: 700 };
    for (var i = 0; i < C.intro.length; i++) {
      if (!(await say(chat, C.intro[i], null, id, null, T))) return;
      await wait(T.pause);
    }
    if (id !== run) return;
    var stick = nearBottom();
    var box = el("div", "answers");
    var go = el("button", "btn", C.startButton);
    go.onclick = function () { track("quiz_start"); question(0); };
    box.appendChild(go);
    if (C.introNote) box.appendChild(el("p", "note", C.introNote));
    chat.appendChild(box);
    if (stick) follow(box);
    go.focus({ preventScroll: true });
  }

  /* Картинка к вопросу во всю ширину (illus в config: "draw" — рисунок, "photo" — фото) */
  var illus = (function () { var m = location.search.match(/[?&]illus=(draw|photo|none)/); var k = m ? m[1] : C.illus; return k === "draw" || k === "photo" ? k : ""; })();
  if (illus) document.documentElement.setAttribute("data-illus", illus);
  if ((illus === "draw" && window.QUIZ_ILLUS) || C.resultIcons) {
    /* общие заготовки рисунков: голубое свечение и «дрожание» линии от руки */
    var defs = document.createElement("div");
    defs.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<radialGradient id="glowGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bdf1f1" stop-opacity=".75"/><stop offset="55%" stop-color="#8fdde0" stop-opacity=".28"/><stop offset="100%" stop-color="#8fdde0" stop-opacity="0"/></radialGradient>' +
      '<filter id="hand" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="1.8"/></filter>' +
      '<filter id="handS" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="1.3"/></filter>' +
      '</defs></svg>';
    document.body.appendChild(defs.firstChild);
  }
  function qImage(i) {
    if (!illus) return null;
    var f = el("div", "qimg " + illus);
    f.setAttribute("aria-hidden", "true");
    if (illus === "photo") {
      var img = el("img"); img.src = "img/q" + (i < 9 ? "0" : "") + (i + 1) + ".jpg"; img.alt = ""; img.decoding = "async";
      f.appendChild(img);
    } else {
      var a = window.QUIZ_ILLUS && window.QUIZ_ILLUS[i];
      if (!a) return null;
      f.innerHTML = '<svg viewBox="0 0 120 90"><g filter="url(#hand)">' + a.svg + '</g></svg>';
    }
    return f;
  }
  /* предзагрузка следующей фотографии, чтобы переход был без пустой рамки */
  function preload(i) { if (illus === "photo" && i < Q.length) { var im = new Image(); im.src = "img/q" + (i < 9 ? "0" : "") + (i + 1) + ".jpg"; } }

  /* dir: "back" — пришли кнопкой «Назад», экран въезжает слева */
  function question(i, dir) {
    var id = ++run;
    var q = Q[i];
    var chat = frame({
      progress: (i / Q.length) * 100,
      count: (i + 1) + " из " + Q.length,
      onBack: function () { if (i === 0) { state.answers = []; persist(); intro(); } else { state.answers = state.answers.slice(0, i - 1); persist(); question(i - 1, "back"); } }
    });
    chat.classList.add("step");
    if (dir === "back") chat.classList.add("from-left");
    chat.appendChild(who());
    var pic = qImage(i);
    if (pic) chat.appendChild(pic);
    var sm = show(chat, q.scene, "scene", q.title);
    sm.setAttribute("data-n", (i < 9 ? "0" : "") + (i + 1) + " / " + Q.length);
    sm.setAttribute("data-num", (i < 9 ? "0" : "") + (i + 1));
    if (q.ask) show(chat, q.ask, "q", null, 140);
    var box = el("div", "answers");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", q.ask || q.title);
    q.options.forEach(function (o, k) {
      var b = el("button", "opt");
      if (C.showLetters) b.appendChild(el("span", "lt", LETTERS[k]));
      b.appendChild(el("span", null, o.text));
      b.style.animationDelay = (120 + k * 50) + "ms";
      b.onclick = function () { pick(i, k, b, box, chat, id); };
      box.appendChild(b);
    });
    chat.appendChild(box);
    preload(i + 1);
  }

  async function pick(i, k, btn, box, chat, id) {
    if (box.classList.contains("locked") || id !== run) return;
    box.classList.add("locked");
    btn.classList.add("on");
    state.answers = state.answers.slice(0, i);
    state.answers[i] = k;
    persist();
    track("quiz_step", { step: i + 1 });
    /* выбранный ответ подсвечивается, экран уходит влево, следующий въезжает справа */
    await wait(170);
    if (id !== run) return;
    chat.classList.add("leave");
    await wait(170);
    if (id !== run) return;
    var n = i + 1;
    if (C.remarks && C.remarks[n] && n < Q.length) return remark(n);
    next(n);
  }
  function next(n) { if (n >= Q.length) calc(); else question(n); }

  async function remark(n) {
    var id = ++run;
    var chat = frame({ progress: (n / Q.length) * 100, count: n + " из " + Q.length });
    chat.classList.add("step");
    chat.appendChild(who());
    show(chat, C.remarks[n]);
    var go = el("button", "link", "Дальше");
    var box = el("div", "answers"); box.appendChild(go); chat.appendChild(box);
    var done = false;
    function on() { if (done || id !== run) return; done = true; next(n); }
    go.onclick = on;
    await wait(1700);
    on();
  }

  /* Подсчёт: каждый ответ +1 своей модели; побеждает модель с наибольшим числом ответов.
     Ничья: все лидеры по порядку modelOrder (А → Б → В → Г). */
  function score(answers) {
    var counts = {};
    C.modelOrder.forEach(function (m) { counts[m] = 0; });
    answers.forEach(function (k, i) { var m = Q[i].options[k].m; counts[m] += 1; });
    var max = Math.max.apply(null, C.modelOrder.map(function (m) { return counts[m]; }));
    var leaders = C.modelOrder.filter(function (m) { return counts[m] === max; });
    return { counts: counts, leaders: leaders };
  }
  window.__quizScore = score; // для проверки

  async function calc() {
    var id = ++run;
    var body = frame({ progress: 100, count: Q.length + " из " + Q.length, bodyClass: "calc" });
    var c = el("div", "crown"); c.innerHTML = crownSvg;
    var p = el("p", null, C.calcText);
    body.append(c, p);
    track("quiz_complete");
    await wait(2300);
    if (id !== run) return;
    before(body, p);
  }

  /* Текст после 10-го вопроса и кнопка «Посмотреть результаты» */
  function before(body, p) {
    if (!body) {
      ++run;
      body = frame({ progress: 100, count: Q.length + " из " + Q.length, bodyClass: "calc" });
      var c = el("div", "crown done"); c.innerHTML = crownSvg; body.appendChild(c);
    }
    var box = el("div", "before");
    C.beforeResults.forEach(function (t) { box.appendChild(el("p", null, t)); });
    var go = el("button", "btn", C.buttons.toResults);
    go.onclick = function () { result(0); };
    box.appendChild(go);
    if (p) p.replaceWith(box); else body.appendChild(box);
  }

  /* Результат: по одному экрану на модель. При ничьей — по очереди А → Б → В → Г. */
  function result(idx) {
    ++run;
    var r = score(state.answers);
    var n = r.leaders.length;
    idx = Math.max(0, Math.min(idx || 0, n - 1));
    var m = r.leaders[idx], M = C.models[m];
    var body = frame({ progress: 100, count: n > 1 ? (idx + 1) + " из " + n : "", bodyClass: "res", onBack: function () { if (idx > 0) result(idx - 1); else before(); } });
    track("result_view", { result: idx + 1 });

    var head = el("div");
    head.appendChild(el("p", "eyebrow", n > 1 ? C.labels.resultOf.replace("{N}", idx + 1).replace("{M}", n) : C.labels.result));
    var h1 = el("h1"); h1.appendChild(el("em", null, "«" + M.name + "»")); head.appendChild(h1);
    body.appendChild(head);

    if (idx === 0) {
      var prof = el("div", "profile");
      prof.setAttribute("aria-label", "Сколько ответов у каждой модели");
      var bars = [];
      C.modelOrder.forEach(function (k) {
        var row = el("div", "prow" + (r.leaders.indexOf(k) > -1 ? " lead" : ""));
        row.append(el("span", null, C.models[k].name), el("span", "n", r.counts[k] + " из " + Q.length));
        var pb = el("div", "pbar"); var f = el("i"); pb.appendChild(f); row.appendChild(pb);
        bars.push([f, r.counts[k]]);
        prof.appendChild(row);
      });
      body.appendChild(prof);
      requestAnimationFrame(function () { setTimeout(function () { bars.forEach(function (b) { b[0].style.width = (b[1] / Q.length * 100) + "%"; }); }, 60); });
    }

    var I = C.resultIcons;
    function h3(text) { var h = el("h3"); h.appendChild(el("span", null, text)); return h; }
    var t = el("div", "rtext" + (I ? " with-icons" : ""));
    t.appendChild(el("p", "strategy", M.strategy));
    M.intro.forEach(function (x) { t.appendChild(el("p", null, x)); });
    t.appendChild(h3(C.labels.origin, "sprout"));
    t.appendChild(el("p", null, M.origin));
    t.appendChild(h3(C.labels.life, "spark"));
    var ul = el("ul", "life");
    M.life.forEach(function (x) {
      var li = el("li");
      if (I) { li.appendChild(drawn(lifeIcon(x[0]))); var d = el("div"); d.append(el("b", null, x[0]), document.createTextNode(" " + x[1])); li.appendChild(d); }
      else li.append(el("b", null, x[0]), document.createTextNode(" " + x[1]));
      ul.appendChild(li);
    });
    t.appendChild(ul);
    t.appendChild(h3(C.labels.hurts, "wall"));
    t.appendChild(el("p", null, M.hurts));
    var ch = el("div", "change");
    var sm = el("small"); sm.appendChild(el("span", null, C.labels.change));
    ch.append(sm, el("p", null, M.change));
    t.appendChild(ch);
    body.appendChild(t);

    var last = idx === n - 1;
    if (last && C.resultVideo) { videoBlock(body, r); window.scrollTo(0, 0); return; }
    var go = el("button", "btn", last ? C.buttons.toFinal : C.buttons.nextResult);
    go.onclick = function () { if (last) final(); else result(idx + 1); };
    body.appendChild(go);
    window.scrollTo(0, 0);
  }

  /* Значки на экране результата: тонкая линия, цвет берут из темы */
  var ICONS = {
    sprout: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 15c0-3-2.5-5.5-7-5.5 0 3.5 2.5 5.5 7 5.5z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z"/>',
    wall: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18M9 5v7M15 12v7"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.6 0-2.7.8-2.7 2s1.1 1.7 2.7 2c1.6.3 2.7.9 2.7 2.1S13.6 16 12 16c-1.2 0-2.2-.5-2.7-1.3M12 6.5V8M12 16v1.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    cup: '<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3.5c-.8 1 .8 2 0 3M12.5 3.5c-.8 1 .8 2 0 3"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    play: '<path d="M9 6.5v11l9-5.5z" fill="currentColor" stroke="none"/>'
  };
  /* Рисованные значки к пунктам «В деньгах», «В отношениях»…: линия от руки + одна золотая деталь, как рисунки к вопросам */
  var DRAWN = {
    coin: '<ellipse class="d-gold" cx="22" cy="17" rx="11" ry="4"/><path class="d-ink" d="M11 17v6c0 2.2 4.9 4 11 4s11-1.8 11-4v-6M11 23v6c0 2.2 4.9 4 11 4s11-1.8 11-4v-6M11 29v6c0 2.2 4.9 4 11 4s11-1.8 11-4v-6"/><path class="d-ink" d="M39 7v6M36 10h6"/>',
    heart: '<path class="d-ink" d="M19 40S6 32.5 6 22.5A7 7 0 0 1 19 18.6 7 7 0 0 1 32 22.5C32 32.5 19 40 19 40z"/><path class="d-gold" d="M34 23s-6-3.6-6-8.4a3.4 3.4 0 0 1 6-2.1 3.4 3.4 0 0 1 6 2.1c0 4.8-6 8.4-6 8.4z"/>',
    sun: '<path class="d-ink" d="M8 22L24 9l16 13M12 19v20h24V19"/><path class="d-gold" d="M20 39V28h8v11z"/><path class="d-ink" d="M31 13V8h4v8"/>',
    cup: '<path class="d-gold" d="M10 21h21v7a9.5 9.5 0 0 1-9.5 9.5h-2A9.5 9.5 0 0 1 10 28z"/><path class="d-ink" d="M31 23h3a4.5 4.5 0 0 1 0 9h-3M7 41h28M16 7c-2.5 3 2.5 5.5 0 9M23 7c-2.5 3 2.5 5.5 0 9"/>',
    compass: '<path class="d-ink" d="M24 7v34M16 41h16"/><path class="d-gold" d="M24 11h12l4 4.5-4 4.5H24z"/><path class="d-ink" d="M24 23H12l-4 4.5 4 4.5h12z"/>',
    star: '<path class="d-gold" d="M22 9l4.3 8.8 9.7 1.4-7 6.8 1.7 9.6-8.7-4.6-8.7 4.6 1.7-9.6-7-6.8 9.7-1.4z"/><path class="d-ink" d="M39 6v6M36 9h6M38 32v5M35.5 34.5h5"/>'
  };
  function drawn(k) {
    var s = el("span", "ico drawn");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<svg viewBox="0 0 48 48"><g filter="url(#handS)">' + (DRAWN[k] || DRAWN.sun) + '</g></svg>';
    return s;
  }
  function icon(k) {
    var s = el("span", "ico");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[k] || ICONS.spark) + '</svg>';
    return s;
  }
  function lifeIcon(t) {
    t = t.toLowerCase();
    if (t.indexOf("деньг") > -1) return "coin";
    if (t.indexOf("отношен") > -1) return "heart";
    if (t.indexOf("отдых") > -1) return "cup";
    if (t.indexOf("решени") > -1) return "compass";
    if (t.indexOf("самореализ") > -1) return "star";
    return "sun";
  }

  /* Сразу под результатом: обложка видео, текст про лекцию и кнопка (вместо кнопки «Дальше») */
  function videoBlock(body, r) {
    var F = C.final;
    var href = withParams(C.landingUrl, { via: "test" });
    var v = el("div", "vblock");
    var cover = el("a", "vcover");
    cover.href = href; cover.target = "_top";
    cover.setAttribute("aria-label", F.cta);
    var img = el("img"); img.src = C.videoCover || C.heroPhoto || C.author.photo; img.alt = ""; img.loading = "lazy";
    var play = el("span", "play"); play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS.play + '</svg>';
    cover.append(img, play);
    cover.onclick = function () { track("cta_click", { cta: "lecture_cover" }); };
    var cta = el("a", "btn", F.cta);
    cta.href = href; cta.target = "_top";
    cta.onclick = function () { track("cta_click", { cta: "lecture" }); };
    v.append(cover, el("p", "ftext", F.text), el("h2", null, F.title), cta);
    body.appendChild(v);
    var links = el("div", "links");
    if (C.share && C.share.enabled) {
      var sh = el("button", "link", C.buttons.share);
      sh.onclick = function () { shareCard(r.leaders); };
      links.appendChild(sh);
    }
    var again = el("button", "link", C.buttons.restart || "Пройти заново");
    again.onclick = restart;
    links.appendChild(again);
    body.appendChild(links);
  }

  /* Картинка 1080×1920 для сторис. Делится через меню телефона, иначе показываем картинку для сохранения. */
  async function shareCard(leaders) {
    track("share_click");
    var S = C.share;
    try { await Promise.all([document.fonts.load("600 80px Lora"), document.fonts.load("italic 500 80px Lora"), document.fonts.load("400 40px 'Golos Text'")]); } catch (e) {}
    var cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920;
    var g = cv.getContext("2d");
    g.fillStyle = "#19181b"; g.fillRect(0, 0, 1080, 1920);
    g.strokeStyle = "#c9a45c"; g.lineWidth = 3; g.strokeRect(60, 60, 960, 1800);
    /* корона */
    g.save(); g.translate(540 - 210, 300); g.scale(3.5, 3.5); g.fillStyle = "#c9a45c"; g.fill(new Path2D(crownPath)); g.restore();
    g.textAlign = "center";
    g.fillStyle = "#c9a45c"; g.font = "600 40px 'Golos Text', sans-serif";
    g.fillText(S.title.toUpperCase().split("").join(String.fromCharCode(8202)), 540, 700);
    g.fillStyle = "#f3eee6";
    var y = 820;
    leaders.forEach(function (m) {
      var words = ("«" + C.models[m].name + "»").split(" "), line = "", lines = [];
      g.font = "italic 500 92px Lora, Georgia, serif";
      words.forEach(function (w) { var t = line ? line + " " + w : w; if (g.measureText(t).width > 860 && line) { lines.push(line); line = w; } else line = t; });
      lines.push(line);
      lines.forEach(function (l) { g.fillText(l, 540, y); y += 110; });
      y += 30;
    });
    g.fillStyle = "#b4ada3"; g.font = "400 48px 'Golos Text', sans-serif";
    g.fillText(S.question, 540, Math.max(y + 80, 1250));
    /* подпись внизу: переносим по словам, чтобы не вылезала за рамку */
    g.fillStyle = "#f3eee6"; g.font = "600 44px 'Golos Text', sans-serif";
    var fw = S.footer.split(" "), fl = [], cur = "";
    fw.forEach(function (w) { var t = cur ? cur + " " + w : w; if (g.measureText(t).width > 820 && cur) { fl.push(cur); cur = w; } else cur = t; });
    fl.push(cur);
    var fy = 1600 - (fl.length - 1) * 58;
    fl.forEach(function (l, i) { g.fillText(l, 540, fy + i * 58); });
    g.fillStyle = "#c9a45c"; g.font = "400 40px 'Golos Text', sans-serif";
    g.fillText(S.url, 540, 1680);
    var url = cv.toDataURL("image/png");
    try {
      var blob = await new Promise(function (res) { cv.toBlob(res, "image/png"); });
      var file = new File([blob], "model.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    var ov = el("div", "sheet");
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", C.buttons.share);
    var inner = el("div");
    var img = el("img"); img.src = url; img.alt = S.title;
    var close = el("button", "btn ghost", "Готово");
    close.onclick = function () { ov.remove(); };
    inner.append(img, el("p", null, S.hint), close);
    ov.appendChild(inner);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }

  /* Последний экран: приглашение на онлайн-лекцию */
  function final() {
    ++run;
    var r = score(state.answers);
    var F = C.final;
    var body = frame({ progress: 100, count: "", bodyClass: "final", onBack: function () { result(r.leaders.length - 1); } });
    track("final_view");
    var c = el("div", "crown done"); c.innerHTML = crownSvg; body.appendChild(c);
    var p = el("p", "ftext", F.text);
    body.append(p, el("h2", null, F.title));
    var cta = el("a", "btn", F.cta);
    cta.href = withParams(C.landingUrl, { via: "test" });
    cta.target = "_top";
    cta.onclick = function () { track("cta_click", { cta: "lecture" }); };
    body.appendChild(cta);
    if (C.directUrl) {
      var d = el("div", "direct");
      var parts = C.directText.split("{WORD}");
      var dp = el("p");
      dp.append(document.createTextNode(parts[0]), el("span", "word", C.models[r.leaders[0]].word), document.createTextNode(parts[1] || ""));
      var da = el("a", "btn ghost", C.buttons.direct);
      da.href = C.directUrl; da.target = "_blank"; da.rel = "noopener";
      da.onclick = function () { track("cta_click", { cta: "direct" }); };
      d.append(dp, da);
      body.appendChild(d);
    }
    var links = el("div", "links");
    if (C.share && C.share.enabled) {
      var sh = el("button", "link", C.buttons.share);
      sh.onclick = function () { shareCard(r.leaders); };
      links.appendChild(sh);
    }
    var again = el("button", "link", C.buttons.restart || "Пройти заново");
    again.onclick = restart;
    links.appendChild(again);
    body.appendChild(links);
    window.scrollTo(0, 0);
  }

  function restart() { state = { answers: [] }; drop(STORE); question(0); }

  /* Перерисовать текущий экран (нужно режиму редактирования в превью) */
  window.__quizRefresh = function () {
    if (state.answers.length >= Q.length) before();
    else if (state.answers.length > 0) question(state.answers.length);
    else intro();
  };

  /* ---------- старт ---------- */
  consentBanner();
  if (state.answers.length >= Q.length) before();
  else if (state.answers.length > 0) question(state.answers.length);
  else intro();
})();
