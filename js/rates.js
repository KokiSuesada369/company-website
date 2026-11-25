/* ============================================================
   SAIZEN警備保障 料金表（サイト全体で共通）
   ------------------------------------------------------------
   料金を変えるときは、このファイルの BASE だけを直してください。
   根拠：警備業務請負基本契約書 別紙「料金表」（交通誘導警備員 B）
     昼間（日勤）          18,000円
     夜間（夜勤）          昼間 × 1.5   = 27,000円
     日曜・祝日 昼間        昼間 × 1.35  = 24,300円
     日曜・祝日 夜間        日祝昼間 × 1.5 = 36,450円
   土曜は平日と同じ料金です（曜日は「月〜土」と「日曜・祝日」の2区分）。
   残業単価（1時間）＝ 基本単価 ÷ 8時間 × 1.25 を、一の位で四捨五入して10円単位。
   金額はすべて税抜・1名1日あたり。消費税は Math.floor(小計 × 0.1)。
   ============================================================ */
(function (global) {
  'use strict';

  var BASE = {
    '平日':     { '日勤': 18000, '夜勤': 27000 },
    '土曜':     { '日勤': 18000, '夜勤': 27000 },
    '日曜祝日': { '日勤': 24300, '夜勤': 36450 }
  };

  var TAX_RATE = 0.1;
  var RADIO_PER_DAY = 500; // 無線機 1台1日

  function overtimeOf(base) {
    return Math.round(base / 8 * 1.25 / 10) * 10;
  }

  var OVERTIME = {};
  Object.keys(BASE).forEach(function (day) {
    OVERTIME[day] = {};
    Object.keys(BASE[day]).forEach(function (shift) {
      OVERTIME[day][shift] = overtimeOf(BASE[day][shift]);
    });
  });

  // 見積もり・お問い合わせページと同じ形 { base, overtime }
  var RATES = { base: BASE, overtime: OVERTIME };

  // 依頼フォーム・管理画面と同じ形 { weekday|saturday|sunday: { base:{day,night}, ot:{day,night} } }
  function toShiftKeys(day) {
    return {
      base: { day: BASE[day]['日勤'],     night: BASE[day]['夜勤'] },
      ot:   { day: OVERTIME[day]['日勤'], night: OVERTIME[day]['夜勤'] }
    };
  }
  var BY_DAY_TYPE = {
    weekday:  toShiftKeys('平日'),
    saturday: toShiftKeys('土曜'),
    sunday:   toShiftKeys('日曜祝日')
  };

  function tax(subtotal) { return Math.floor(subtotal * TAX_RATE); }

  // 1日分の基本料金のめやす（残業・無線機なし）
  function daily(day, shift, persons) {
    var subtotal = BASE[day][shift] * persons;
    var t = tax(subtotal);
    return { subtotal: subtotal, tax: t, total: subtotal + t };
  }

  global.SAIZEN_RATES = {
    RATES: RATES,
    BY_DAY_TYPE: BY_DAY_TYPE,
    TAX_RATE: TAX_RATE,
    RADIO_PER_DAY: RADIO_PER_DAY,
    overtimeOf: overtimeOf,
    tax: tax,
    daily: daily
  };
})(window);
