// Платформа Telegram Mini Apps + реклама Adsgram.
// Впиши сюда ID блоков из кабинета Adsgram (partner.adsgram.ai):
var ADSGRAM_REWARD_BLOCK = '53971';   // блок Reward, только цифры
var ADSGRAM_INTER_BLOCK = 'int-53972';    // блок Interstitial

// Пока ID не вписаны (или игра открыта не в Telegram), награда за рекламу выдаётся сразу — для проверки.
var Platform = {
  tg: null,
  lang: 'ru',
  reward: null,
  inter: null,
  lastInter: 0,
  INTER_COOLDOWN: 60000,
  onAdStart: function () {},
  onAdEnd: function () {},
  STORE_KEY: 'slime-merge-save',

  init: function () {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) {
      this.tg = tg;
      try {
        tg.ready();
        tg.expand();
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // чтобы свайп по игре не закрывал её
        if (tg.setHeaderColor) tg.setHeaderColor('#2b1b5a');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#1d1240');
      } catch (e) {}
      var u = tg.initDataUnsafe && tg.initDataUnsafe.user;
      if (u && u.language_code) this.lang = u.language_code;
      // тестовый режим: ссылка t.me/<бот>/play?startapp=debug — Adsgram всегда показывает тестовую рекламу
      this.debug = tg.initDataUnsafe && tg.initDataUnsafe.start_param === 'debug';
    } else {
      this.lang = (navigator.language || 'ru').slice(0, 2);
    }
    if (window.Adsgram) {
      try {
        if (ADSGRAM_REWARD_BLOCK) this.reward = window.Adsgram.init({ blockId: ADSGRAM_REWARD_BLOCK, debug: this.debug });
        if (ADSGRAM_INTER_BLOCK) this.inter = window.Adsgram.init({ blockId: ADSGRAM_INTER_BLOCK, debug: this.debug });
      } catch (e) { console.warn('Adsgram init failed', e); this.adError = String(e && e.message || e); }
    }
    return Promise.resolve();
  },

  debug: false,
  adError: '',  // последний ответ Adsgram, если реклама не показалась (виден в тестовом режиме)

  ready: function () {},
  gameplay: function () {},
  leaderboard: function () {},

  _show: function (ctrl) {
    var self = this;
    self.onAdStart();
    return ctrl.show().then(function (r) {
      self.onAdEnd();
      var ok = !!(r && r.done && !r.error);
      self.adError = ok ? '' : String(r && r.description || 'not done');
      return ok;
    }, function (r) {
      self.onAdEnd();
      self.adError = String(r && (r.description || r.message) || r);
      return false;
    });
  },

  fullscreen: function () {
    if (!this.inter || Date.now() - this.lastInter < this.INTER_COOLDOWN) return Promise.resolve(false);
    this.lastInter = Date.now();
    return this._show(this.inter);
  },

  rewarded: function () {
    if (!this.reward) return new Promise(function (r) { setTimeout(function () { r(true); }, 300); });
    return this._show(this.reward);
  },

  _cloud: function () {
    var tg = this.tg;
    return tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;
  },

  load: function () {
    var data = {};
    try { data = JSON.parse(localStorage.getItem(this.STORE_KEY) || '{}') || {}; } catch (e) {}
    var cloud = this._cloud(), key = this.STORE_KEY;
    if (!cloud) return Promise.resolve(data);
    return new Promise(function (resolve) {
      try {
        cloud.getItem(key, function (err, value) {
          if (!err && value) {
            try {
              var c = JSON.parse(value);
              data = Object.assign({}, data, c, { best: Math.max(data.best || 0, c.best || 0) });
            } catch (e) {}
          }
          resolve(data);
        });
      } catch (e) { resolve(data); }
    });
  },

  save: function (data) {
    var s = JSON.stringify(data);
    try { localStorage.setItem(this.STORE_KEY, s); } catch (e) {}
    var cloud = this._cloud();
    if (cloud) { try { cloud.setItem(this.STORE_KEY, s); } catch (e) {} }
  }
};
