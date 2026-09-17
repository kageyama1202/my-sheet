/* bath-diagram.js — 浴室現場チェックの図面SVG生成【3枚独立構成】
   shared-modal.js内「📐 浴室図面」の「図面を表示」ボタンから、
   ensureBathDiagramLibModal()によってボタンクリック時にのみ動的読込される。
   buildBathDiagramSVG(sc) は、平面図・高さ断面・窓の3枚を縦に並べたHTML文字列を返す。
   各枚は独立したSVGなので、1枚ずつスクショして報告書に貼れる。
   escHtmlModal()はshared-modal.js側にある想定(このファイルは常にshared-modal.jsの後に読み込まれる)。
   ★2026-09-15全面刷新★ 従来の4象限1枚レイアウトを廃止し、平面/高さ/窓の3枚独立構成にした。
     左下(メモ専用象限)は廃止。伝達事項メモは平面図の枚の下に小さく載せる。
*/
// VERSION: 2026-09-17-107
// CREATED: 2026-09-17 22:55

function numModal(v, def) {
  var n = parseFloat(v);
  return isNaN(n) ? (def === undefined ? null : def) : n;
}

// 間口(w)×奥行き(d)[mm]を、maxW×maxHの枠に収まる比率でスケールしたピクセルサイズに変換
function fitBoxModal(w, d, maxW, maxH) {
  if (!w || !d) return { w: maxW, h: maxH, scale: 1 };
  var scale = Math.min(maxW / w, maxH / d);
  return { w: w * scale, h: d * scale, scale: scale };
}

// SVGの<text>は自動改行しないため、文字数ベースで簡易的に折り返す。
function wrapTextModal(text, maxChars) {
  var str = String(text == null ? '' : text);
  var lines = [];
  for (var i = 0; i < str.length; i += maxChars) {
    lines.push(str.slice(i, i + maxChars));
  }
  return lines.length ? lines : [''];
}

// 1枚のSVGを開くヘルパー(横長 sheetW×sheetH、背景色つき)
function openSheetSVG(sheetW, sheetH, title) {
  var s = '<svg width="100%" viewBox="0 0 '+sheetW+' '+sheetH+'" preserveAspectRatio="xMidYMid meet" '
    + 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
    + 'font-family="\'Hiragino Kaku Gothic ProN\',\'Meiryo\',sans-serif" style="display:block;background:#fff;border:1px solid #ccc;">';
  s += '<rect width="'+sheetW+'" height="'+sheetH+'" fill="#fdfaf3"/>';
  if (title) s += '<text x="18" y="34" font-size="22" font-weight="bold" fill="#00695c">'+title+'</text>';
  return s;
}

// ============================================================
// メイン：3枚(平面・高さ・窓)を縦に並べたHTMLを返す
// ============================================================
function buildBathDiagramSVG(sc) {
  sc = sc || {};
  var html = '';
  html += '<div style="margin-bottom:14px;">' + buildPlanSheet(sc) + '</div>';
  html += '<div style="margin-bottom:14px;">' + buildHeightSheet(sc) + '</div>';
  html += '<div style="margin-bottom:4px;">'  + buildWindowSheet(sc) + '</div>';
  return html;
}

// ============================================================
// 【1枚目】平面図（施工図画像 or 自前平面図）＋クリア・勝手・メモ
// ============================================================
function buildPlanSheet(sc) {
  var W = 940, H = 720;
  var svg = openSheetSVG(W, H, '① 平面図');

  // --- 入力値の取り出し ---
  // 【A/B】扉から見て浴槽の長手方向。A=縦長(奥行き方向)、B=横長(間口方向)。
  // 【L/R】扉(下辺に固定)が右寄り(R)か左寄り(L)か。浴槽位置とは無関係。
  // 建物寸法は入口(扉)基準で固定。製品寸法だけ勝手(A/B)で縦横を入れ替える(swapMO)。
  var maguchiRaw = numModal(sc.bathMaguchi), okuyukiRaw = numModal(sc.bathOkuyuki);
  var seiMaguchiRaw = numModal(sc.bathSeihinMaguchi), seiOkuyukiRaw = numModal(sc.bathSeihinOkuyuki);
  var katteAB = sc.bathKatteAB || 'A';
  var swapMO = katteAB === 'B';
  var maguchi  = swapMO ? okuyukiRaw    : maguchiRaw;
  var okuyuki  = swapMO ? maguchiRaw    : okuyukiRaw;
  var seiMaguchi = swapMO ? seiOkuyukiRaw : seiMaguchiRaw;
  var seiOkuyuki = swapMO ? seiMaguchiRaw : seiOkuyukiRaw;
  var doorPos = sc.bathDoorPosition || '';
  var doorType = sc.bathDoorType || '開き戸';
  var abCode = sc.bathKatteAB || '';
  var lrCode = doorPos === '右' ? 'R' : (doorPos === '左' ? 'L' : '');
  var abrCode = (abCode && lrCode) ? (abCode+lrCode) : '';

  // 図の描画領域(左側)と、注記の領域(右側)に分ける
  var drawX = 40, drawY = 46, drawMaxW = 380, drawMaxH = 340;

  var sekouZu = sc.bathSekouZuImage || '';
  var hasSekouZu = typeof sekouZu === 'string' && sekouZu.indexOf('data:image') === 0;

  if (hasSekouZu) {
    // 施工図画像モード：施工図を大きく表示
    svg += '<image x="'+drawX+'" y="'+drawY+'" width="'+drawMaxW+'" height="'+drawMaxH+'" xlink:href="'+sekouZu+'" href="'+sekouZu+'" preserveAspectRatio="xMidYMid meet"/>';
    svg += '<text x="'+drawX+'" y="'+(drawY+drawMaxH+18)+'" font-size="15" fill="#00695c">↑施工図（現場数値は右に記載）</text>';
  } else {
    // 自前平面図モード
    var outerBox = fitBoxModal(maguchi || seiMaguchi || 1600, okuyuki || seiOkuyuki || 1600, 300, 300);
    var ox = drawX + 30, oy = drawY + 20, ow = outerBox.w, oh = outerBox.h;
    // 間口ラベル(上)★図は扉を下に固定して描くため、A/Bで各辺に来る方向が変わる。
    //   swap後の maguchi(この辺=間口方向の値)を表示する。値自体は報告書のまま(swapは並べ替えるだけ)。
    svg += '<text x="'+(ox+ow/2)+'" y="'+(oy-8)+'" text-anchor="middle" font-size="14" fill="#555">'+(maguchi||'')+'</text>';
    var hikidoAtsumi = numModal(sc.bathHikidoAtsumi);
    if (doorType === '引き戸' && hikidoAtsumi && maguchiRaw) {
      svg += '<text x="'+(ox+ow/2)+'" y="'+(oy+5)+'" text-anchor="middle" font-size="10" fill="#607d8b">(+引戸'+hikidoAtsumi+'＝'+(maguchiRaw+hikidoAtsumi)+')</text>';
    }
    // 外枠
    svg += '<rect x="'+ox+'" y="'+oy+'" width="'+ow+'" height="'+oh+'" fill="none" stroke="#c0392b" stroke-width="2"/>';
    // 内枠(製品)
    var padX = 12, padY = 12;
    if (seiMaguchi && maguchi) padX = Math.max(4, ow * (maguchi - seiMaguchi) / maguchi / 2);
    if (seiOkuyuki && okuyuki) padY = Math.max(4, oh * (okuyuki - seiOkuyuki) / okuyuki / 2);
    var ix = ox + padX, iy = oy + padY, iw = ow - padX*2, ih = oh - padY*2;
    svg += '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" fill="#dcecec" stroke="#00695c" stroke-width="1.5"/>';
    // 内枠(製品)の数字も各辺の方向に合わせて(swap後)
    if (seiMaguchi) svg += '<text x="'+(ix+iw/2)+'" y="'+(iy+16)+'" text-anchor="middle" font-size="12" fill="#00695c">'+seiMaguchi+'</text>';
    if (seiOkuyuki) svg += '<text x="'+(ix+iw-10)+'" y="'+(iy+ih/2)+'" font-size="12" fill="#00695c" transform="rotate(90 '+(ix+iw-10)+' '+(iy+ih/2)+')" text-anchor="middle">'+seiOkuyuki+'</text>';
    // 奥行きラベル(右)★swap後の okuyuki(この辺=奥行き方向の値)
    svg += '<text x="'+(ox+ow+8)+'" y="'+(oy+oh/2)+'" font-size="14" fill="#555" transform="rotate(90 '+(ox+ow+8)+' '+(oy+oh/2)+')" text-anchor="middle">'+(okuyuki||'')+'</text>';

    // 浴槽(A=縦長/B=横長、扉と反対側に配置)
    var tubW, tubH, tubX, tubY;
    if (swapMO) { tubW = iw; tubH = Math.min(ih*0.55, 90); tubX = ix; tubY = iy; }
    else {
      tubW = Math.min(iw*0.55, 90); tubH = ih; tubY = iy;
      tubX = (doorPos === '左') ? (ix + iw - tubW) : ix;
    }
    svg += '<rect x="'+tubX+'" y="'+tubY+'" width="'+tubW+'" height="'+tubH+'" rx="10" ry="10" fill="#fff" stroke="#004d40" stroke-width="1.5"/>';
    svg += '<text x="'+(tubX+tubW/2)+'" y="'+(tubY+tubH/2+4)+'" text-anchor="middle" font-size="11" fill="#004d40">浴槽</text>';

    // ドア(下辺固定・室内側に開く)
    var doorY = oy + oh;
    var kaikou = numModal(sc.bathKaikou);
    var doorWidthMM = kaikou || 650;
    var doorR = Math.min(Math.max(15, doorWidthMM * outerBox.scale), ow*0.9, oh*0.9);
    if (doorType === '引き戸') {
      if (doorPos === '右') {
        svg += '<rect x="'+(ox+ow-doorR)+'" y="'+(doorY-5)+'" width="'+doorR+'" height="10" fill="#607d8b" stroke="#37474f" stroke-width="1.5"/>';
        svg += '<text x="'+(ox+ow-doorR/2)+'" y="'+(doorY-10)+'" text-anchor="middle" font-size="14" fill="#37474f">→</text>';
        svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">右勝手(引戸)'+(abrCode?'　'+abrCode:'')+'</text>';
      } else if (doorPos === '左') {
        svg += '<rect x="'+ox+'" y="'+(doorY-5)+'" width="'+doorR+'" height="10" fill="#607d8b" stroke="#37474f" stroke-width="1.5"/>';
        svg += '<text x="'+(ox+doorR/2)+'" y="'+(doorY-10)+'" text-anchor="middle" font-size="14" fill="#37474f">←</text>';
        svg += '<text x="'+drawX+'" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">左勝手(引戸)'+(abrCode?'　'+abrCode:'')+'</text>';
      }
    } else if (doorPos === '右') {
      var rHingeX = ox+ow, rHingeY = doorY;
      svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+rHingeX+'" y2="'+(rHingeY-doorR)+'" stroke="#222" stroke-width="3"/>';
      svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+(rHingeX-doorR)+'" y2="'+rHingeY+'" stroke="#222" stroke-width="2"/>';
      svg += '<path d="M'+rHingeX+','+(rHingeY-doorR)+' A'+doorR+','+doorR+' 0 0 0 '+(rHingeX-doorR)+','+rHingeY+'" fill="none" stroke="#999" stroke-width="1.5"/>';
      svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">右勝手'+(abrCode?'　'+abrCode:'')+'</text>';
    } else if (doorPos === '左') {
      var lHingeX = ox, lHingeY = doorY;
      svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+lHingeX+'" y2="'+(lHingeY-doorR)+'" stroke="#222" stroke-width="3"/>';
      svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+(lHingeX+doorR)+'" y2="'+lHingeY+'" stroke="#222" stroke-width="2"/>';
      svg += '<path d="M'+lHingeX+','+(lHingeY-doorR)+' A'+doorR+','+doorR+' 0 0 1 '+(lHingeX+doorR)+','+lHingeY+'" fill="none" stroke="#999" stroke-width="1.5"/>';
      svg += '<text x="'+drawX+'" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">左勝手'+(abrCode?'　'+abrCode:'')+'</text>';
    } else {
      svg += '<text x="'+(ox+ow/2)+'" y="'+(doorY+16)+'" text-anchor="middle" font-size="12" fill="#aaa">(勝手未選択)</text>';
    }
  }

  // --- 右側：注記(クリア計算・勝手・石膏ボード・設置方法・メモ) ---
  var noteX = 430, noteY = 62;
  function pushNote(text, color, size) {
    // ★2026-09-16変更★ 全体的に文字を大きく(指定サイズ+4)。スクショで報告書に貼っても読みやすく。
    // ★2026-09-17変更★ 折り返しを24文字に(大きい文字でも右端で見切れないように)。
    var fs = (size || 12) + 4;
    wrapTextModal(text, 24).forEach(function(line){
      svg += '<text x="'+noteX+'" y="'+noteY+'" font-size="'+fs+'" fill="'+color+'">'+escHtmlModal(line)+'</text>';
      noteY += fs + 6;
    });
  }

  // 勝手
  if (abrCode) pushNote('勝手：'+abrCode, '#c0392b', 14);

  // 間口方向クリア計算
  // ★2026-09-17変更★ 報告書・施工図から入る間口/奥行きは「お風呂屋さん基準(浴槽基準)」に変換済みの値。
  //   一般的な建物の間口/奥行きではないので、勝手(A/B)で建物の物理方向へ割り当て直す(swapMO)必要がある。
  //   よってクリア計算も生値(Raw)ではなく、swap後の maguchi/okuyuki/seiMaguchi/seiOkuyuki を使う。
  // ★2026-09-17変更★ 配管突出18mmは製品寸法に既に含まれているため、コードで別途+18しない。
  var tsurimotoShitaji = numModal(sc.bathTsurimotoShitaji);
  var tsurimotoWaku = numModal(sc.bathTsurimotoWaku);
  var tsurimotoPanel = numModal(sc.bathTsurimotoPanel, 0);
  var TSURIMOTO_STD_OFFSET = 34;
  if (tsurimotoShitaji != null && tsurimotoWaku != null && maguchi && seiMaguchi && (doorPos === '右' || doorPos === '左')) {
    var tsurimotoClear = tsurimotoShitaji + tsurimotoWaku - (TSURIMOTO_STD_OFFSET + tsurimotoPanel);
    var oppositeClear = maguchi - tsurimotoClear - seiMaguchi;
    var oppNG = oppositeClear < 15, tsuNG = tsurimotoClear < 0;
    noteY += 4;
    pushNote('【間口方向クリア】', '#37474f', 12);
    pushNote('　吊元側：'+Math.round(tsurimotoClear)+'mm'+(tsuNG?'（不足）':''), tsuNG?'#c0392b':'#00695c', 12);
    pushNote('　戸先側：'+Math.round(oppositeClear)+'mm'+(oppNG?'（要確認）':''), oppNG?'#c0392b':'#00695c', 12);
  }
  // 奥行き方向クリア計算(swap後の値)。配管は製品奥行きに込みのため別途足さない。
  if (seiOkuyuki && okuyuki) {
    var okuNeed = seiOkuyuki;
    var okuClear = okuyuki - okuNeed;
    noteY += 4;
    pushNote('【奥行き方向クリア】', '#37474f', 12);
    pushNote('　建物'+okuyuki+'−製品'+okuNeed+'＝'+Math.round(okuClear)+'mm'+(okuClear<0?'（不足）':''), okuClear<0?'#c0392b':'#00695c', 12);
  }

  // 石膏ボード・設置方法・枠材
  var sekkou = sc.bathSekkouBoard ? String(sc.bathSekkouBoard).split(',') : [];
  noteY += 4;
  if (sekkou.length) pushNote('石膏ボード：'+sekkou.join('・'), '#8e24aa', 12);
  if (sc.bathSetchiHouhou) pushNote('設置方法：'+sc.bathSetchiHouhou, '#555', 12);
  if (sc.bathWakuzaiAtsumi) pushNote('枠材の厚み：'+sc.bathWakuzaiAtsumi, '#555', 12);

  // メモ(伝達事項) — 平面図の枚の下部に小さく
  var memo = sc.bathMemoRenraku || '';
  if (memo) {
    var memoY = 500;
    svg += '<text x="40" y="'+memoY+'" font-size="15" fill="#3b6d11">メモ・伝達事項</text>';
    memoY += 20;
    String(memo).split('\n').forEach(function(raw){
      wrapTextModal(raw, 46).forEach(function(line){
        if (memoY < H - 10) {
          svg += '<text x="40" y="'+memoY+'" font-size="14" fill="#333">'+escHtmlModal(line)+'</text>';
          memoY += 18;
        }
      });
    });
  }

  svg += '</svg>';
  return svg;
}

// ============================================================
// 【2枚目】高さ断面 ＋ クリアA/B・沓摺り・上下総寸法・梁
// ============================================================
function buildHeightSheet(sc) {
  var W = 940, H = 700;
  var svg = openSheetSVG(W, H, '② 高さ断面');

  var maguchi = numModal(sc.bathMaguchi) || numModal(sc.bathSeihinMaguchi);
  var tenjou = numModal(sc.bathTenjouTakasa);
  var datsui = numModal(sc.bathDatsuishitsuTakasa);
  var furo = numModal(sc.bathFuroTakasa);
  var kankisen = numModal(sc.bathKankisenTakasa);
  var duct = numModal(sc.bathDuctTakasa);
  var kutsu = numModal(sc.bathKutsuzuriTakasa);
  var agari = numModal(sc.bathYukaAgariTakasa, 0);
  var clear = numModal(sc.bathTenjouClear);
  var slab = numModal(sc.bathSlabYukaTakasa);
  var total = numModal(sc.bathJougeSousunpou);
  var totalJissoku = numModal(sc.bathJougeSousunpouJissoku);

  var totalMM = tenjou || ((furo||0)+(kankisen||0)+(agari||0)+(clear||0)) || 2400;
  var pxScale = 330 / totalMM;   // 断面の高さピクセル(330)を実寸に割り当て
  var baseY = 400;               // 床(0mm)のY位置
  var rx = 120;                  // 断面の箱の左端X
  var hBoxW = Math.min(240, Math.max(80, Math.round((maguchi||1600) * pxScale)));
  var labelX = rx + hBoxW + 14;

  function segY(mm) { return baseY - mm * pxScale; }
  var yAgariTop = segY(agari);
  var yFuroTop = segY(agari + (furo||0));
  var yKankisenTop = segY(agari + (furo||0) + (kankisen||0));
  var yTenjou = tenjou ? segY(tenjou) : yKankisenTop;

  var labelItems = [];
  if (agari) {
    svg += '<rect x="'+rx+'" y="'+yAgariTop+'" width="'+hBoxW+'" height="'+(baseY-yAgariTop)+'" fill="#e0e0e0" stroke="#888" stroke-width="1"/>';
    labelItems.push({ y: yAgariTop+12, text: '床上がり：'+agari, color: '#666' });
  }
  if (furo) {
    svg += '<rect x="'+rx+'" y="'+yFuroTop+'" width="'+hBoxW+'" height="'+(yAgariTop-yFuroTop)+'" fill="#dcecec" stroke="#00695c" stroke-width="1.3"/>';
    labelItems.push({ y: yFuroTop+12, text: '風呂の高さ(製品)：'+furo, color: '#00695c' });
  }
  if (kankisen) {
    svg += '<rect x="'+rx+'" y="'+yKankisenTop+'" width="'+hBoxW+'" height="'+(yFuroTop-yKankisenTop)+'" fill="#ffe0b2" stroke="#ef6c00" stroke-width="1.3"/>';
    labelItems.push({ y: yKankisenTop+12, text: '換気扇高さ：'+kankisen, color: '#ef6c00' });
  }
  if (duct) {
    var yDuct = baseY - duct * pxScale;
    svg += '<line x1="'+(rx-15)+'" y1="'+yDuct+'" x2="'+(rx+hBoxW+15)+'" y2="'+yDuct+'" stroke="#6a1b9a" stroke-width="1" stroke-dasharray="2,2"/>';
    svg += '<circle cx="'+(rx+hBoxW/2)+'" cy="'+yDuct+'" r="4" fill="#fff" stroke="#6a1b9a" stroke-width="1.5"/>';
    labelItems.push({ y: yDuct+4, text: '排気ダクト(φ100)：'+duct, color: '#6a1b9a' });
  }
  if (clear !== null && tenjou) {
    svg += '<rect x="'+rx+'" y="'+yTenjou+'" width="'+hBoxW+'" height="'+(yKankisenTop-yTenjou)+'" fill="#fff" stroke="#c0392b" stroke-width="1" stroke-dasharray="4,3"/>';
    labelItems.push({ y: yTenjou+12, text: '天井とのクリア：'+clear, color: '#c0392b' });
  }
  labelItems.push({ y: baseY+16, text: '床構成'+(sc.bathYukaKousei?'：'+escHtmlModal(sc.bathYukaKousei):''), color: '#555' });

  // 梁
  var hariPanels = [
    { key: '浴槽側面', ueT: numModal(sc.bathHariYokusoUeTakasa), ueD: numModal(sc.bathHariYokusoUeOkuyuki), shimoT: numModal(sc.bathHariYokusoShimoTakasa), shimoD: numModal(sc.bathHariYokusoShimoOkuyuki) },
    { key: 'カウンター面', ueT: numModal(sc.bathHariCounterUeTakasa), ueD: numModal(sc.bathHariCounterUeOkuyuki), shimoT: numModal(sc.bathHariCounterShimoTakasa), shimoD: numModal(sc.bathHariCounterShimoOkuyuki) }
  ];
  var hariSubW = hBoxW / 2;
  hariPanels.forEach(function(panel, pIdx){
    var px = rx + pIdx*hariSubW;
    if (panel.ueT) {
      var ueH = Math.min(baseY-yTenjou, panel.ueT * pxScale);
      svg += '<rect x="'+px+'" y="'+yTenjou+'" width="'+hariSubW+'" height="'+ueH+'" fill="#8d6e63" opacity="0.6" stroke="#5d4037" stroke-width="1.3"/>';
      var clearAfterHari = (clear !== null) ? (clear - panel.ueT) : null;
      labelItems.push({ y: yTenjou+12, text: panel.key+'-上 H'+panel.ueT+(panel.ueD?'/D'+panel.ueD:'')+(clearAfterHari!==null?'（クリア残'+clearAfterHari+'）':''), color: '#5d4037' });
    }
    if (panel.shimoT) {
      var shimoH = Math.min(300, panel.shimoT * pxScale);
      var shimoYTop = baseY - shimoH;
      svg += '<rect x="'+px+'" y="'+shimoYTop+'" width="'+hariSubW+'" height="'+shimoH+'" fill="#8d6e63" opacity="0.6" stroke="#5d4037" stroke-width="1.3"/>';
      labelItems.push({ y: shimoYTop+12, text: panel.key+'-下 H'+panel.shimoT+(panel.shimoD?'/D'+panel.shimoD:''), color: '#5d4037' });
    }
  });

  // ラベル衝突回避(最低16px間隔)
  labelItems.sort(function(a, b){ return a.y - b.y; });
  var cur = -Infinity;
  labelItems.forEach(function(item){ item.drawY = Math.max(item.y, cur + 20); cur = item.drawY; });
  labelItems.forEach(function(item){
    svg += '<text x="'+labelX+'" y="'+item.drawY+'" font-size="15" fill="'+item.color+'">'+item.text+'</text>';
  });

  // 天井・床ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+yTenjou+'" x2="'+(labelX-4)+'" y2="'+yTenjou+'" stroke="#333" stroke-width="1"/>';
  svg += '<text x="'+(rx-26)+'" y="'+(yTenjou-6)+'" text-anchor="end" font-size="15" fill="#555">現場天井'+(tenjou?'：'+tenjou:'')+'</text>';
  svg += '<line x1="'+(rx-20)+'" y1="'+baseY+'" x2="'+(labelX-4)+'" y2="'+baseY+'" stroke="#333" stroke-width="1"/>';

  // 脱衣室高さ
  if (datsui) {
    var yD = baseY - datsui * pxScale;
    svg += '<line x1="'+(rx-70)+'" y1="'+baseY+'" x2="'+(rx-70)+'" y2="'+yD+'" stroke="#5c6bc0" stroke-width="1"/>';
    svg += '<text x="'+(rx-76)+'" y="'+((baseY+yD)/2)+'" text-anchor="end" font-size="14" fill="#5c6bc0">脱衣室：'+datsui+'</text>';
  }
  // スラブ・上下総寸法
  if (slab) {
    var ySlab = baseY + slab * pxScale;
    svg += '<line x1="'+(rx-20)+'" y1="'+ySlab+'" x2="'+(labelX-4)+'" y2="'+ySlab+'" stroke="#333" stroke-width="1"/>';
    svg += '<text x="'+(rx-26)+'" y="'+(ySlab+13)+'" text-anchor="end" font-size="15" fill="#555">スラブ：'+slab+'</text>';
    var bracketX = labelX + 250;
    svg += '<line x1="'+bracketX+'" y1="'+yTenjou+'" x2="'+bracketX+'" y2="'+ySlab+'" stroke="#00695c" stroke-width="1"/>';
    svg += '<text x="'+(bracketX-10)+'" y="'+((yTenjou+ySlab)/2-6)+'" text-anchor="end" font-size="15" fill="#00695c">上下総寸法：'+(total!==null?total:'?')+'</text>';
    if (totalJissoku !== null) svg += '<text x="'+(bracketX-10)+'" y="'+((yTenjou+ySlab)/2+10)+'" text-anchor="end" font-size="15" fill="#c0392b">実測：'+totalJissoku+'</text>';
  }

  // --- 右下：施工者向けクリアA/B・沓摺り(枠で囲って強調) ---
  var boxX = 540, boxY = 400, boxW = 340, boxH = 220;
  svg += '<rect x="'+boxX+'" y="'+boxY+'" width="'+boxW+'" height="'+boxH+'" fill="#f1f8f5" stroke="#00695c" stroke-width="1.2" rx="6"/>';
  var ly = boxY + 24;
  svg += '<text x="'+(boxX+12)+'" y="'+ly+'" font-size="17" font-weight="bold" fill="#00695c">施工クリア(お風呂天井を載せる余裕)</text>'; ly += 32;
  // クリアA = 現場天井 − 風呂の高さ
  var clearA = (tenjou != null && furo != null) ? (tenjou - furo) : null;
  var clearB = (tenjou != null && furo != null && kankisen != null) ? (tenjou - (furo + kankisen)) : null;
  if (clearA !== null) {
    svg += '<text x="'+(boxX+12)+'" y="'+ly+'" font-size="16" fill="'+(clearA<0?'#c0392b':'#333')+'">A 風呂天井〜現場天井：'+clearA+'mm'+(clearA<0?'（不足）':'')+'</text>'; ly += 28;
  } else { svg += '<text x="'+(boxX+12)+'" y="'+ly+'" font-size="16" fill="#aaa">A：現場天井・風呂高さ未入力</text>'; ly += 28; }
  if (clearB !== null) {
    svg += '<text x="'+(boxX+12)+'" y="'+ly+'" font-size="16" fill="'+(clearB<0?'#c0392b':'#333')+'">B 換気扇頭〜現場天井：'+clearB+'mm'+(clearB<0?'（不足）':'')+'</text>'; ly += 28;
  } else { svg += '<text x="'+(boxX+12)+'" y="'+ly+'" font-size="16" fill="#aaa">B：換気扇高さ未入力</text>'; ly += 28; }
  if (kutsu != null) {
    svg += '<text x="'+(boxX+12)+'" y="'+ly+'" font-size="16" fill="#c9721f">沓摺り高さ：'+kutsu+'mm ⚠毎回要確認</text>'; ly += 28;
  }

  svg += '</svg>';
  return svg;
}

// ============================================================
// 【3枚目】窓
// ============================================================
function buildWindowSheet(sc) {
  var W = 940, H = 500;
  var svg = openSheetSVG(W, H, '③ 窓');

  var maguchi = numModal(sc.bathMaguchi) || numModal(sc.bathSeihinMaguchi);
  var okuyuki = numModal(sc.bathOkuyuki) || numModal(sc.bathSeihinOkuyuki);
  var tenjou = numModal(sc.bathTenjouTakasa);
  var madoAri = sc.bathMadoAri || '';

  if (madoAri === '無') {
    svg += '<text x="'+(W/2)+'" y="'+(H/2)+'" text-anchor="middle" font-size="30" font-weight="bold" fill="#999">窓なし</text>';
    svg += '</svg>';
    return svg;
  }

  var madoW = numModal(sc.bathMadoW), madoH = numModal(sc.bathMadoH), madoD = numModal(sc.bathMadoD);
  var madoUe = numModal(sc.bathMadoUe), madoShita = numModal(sc.bathMadoShita), madoHidari = numModal(sc.bathMadoHidari), madoMigi = numModal(sc.bathMadoMigi);
  var madoMen = sc.bathMadoMen || '';

  var wallWidthMM = null, wallHeightMM = null, wallAreaM2 = null;
  if (madoMen === '正面') { wallWidthMM = maguchi || null; wallHeightMM = tenjou || null; }
  else if (madoMen === '右面' || madoMen === '左面') { wallWidthMM = okuyuki || null; wallHeightMM = tenjou || null; }
  var trueWallMode = !!(wallWidthMM && wallHeightMM);
  if (trueWallMode) wallAreaM2 = Math.round((wallWidthMM/1000)*(wallHeightMM/1000)*100)/100;

  var scaleReady2 = madoW!=null && madoH!=null && madoUe!=null && madoShita!=null && madoHidari!=null && madoMigi!=null;
  if (!trueWallMode && scaleReady2) { wallWidthMM = madoHidari+madoW+madoMigi; wallHeightMM = madoUe+madoH+madoShita; }
  var scaleReady = trueWallMode || scaleReady2;
  var winBox = scaleReady ? fitBoxModal(wallWidthMM, wallHeightMM, 300, 300) : { w: 300, h: 300, scale: null };
  var wallW = winBox.w, wallH = winBox.h;
  var wx = 60, wy = 70;

  var winTitle = '窓のある壁';
  if (trueWallMode) winTitle += '（'+madoMen+'・約'+wallAreaM2+'㎡）';
  else if (!scaleReady) winTitle += '（概算配置）';
  svg += '<text x="'+wx+'" y="'+(wy-14)+'" font-size="16" fill="#333">'+winTitle+'</text>';
  svg += '<rect x="'+wx+'" y="'+wy+'" width="'+wallW+'" height="'+wallH+'" fill="#eef3ee" stroke="#00695c" stroke-width="1.5"/>';

  var mW, mH, mx1, my1;
  if (scaleReady) {
    mW = madoW!=null ? madoW*winBox.scale : wallW*0.35;
    mH = madoH!=null ? madoH*winBox.scale : wallH*0.35;
    mx1 = madoHidari!=null ? wx + madoHidari*winBox.scale : wx + (wallW-mW)/2;
    my1 = madoUe!=null ? wy + madoUe*winBox.scale : wy + (wallH-mH)/2;
  } else {
    mW = wallW*0.35; mH = wallH*0.35; mx1 = wx+(wallW-mW)/2; my1 = wy+(wallH-mH)/2;
  }
  svg += '<rect x="'+mx1+'" y="'+my1+'" width="'+mW+'" height="'+mH+'" fill="#dcecec" stroke="#004d40" stroke-width="1.5"/>';
  // 離れ点線
  svg += '<line x1="'+wx+'" y1="'+(my1+mH/2)+'" x2="'+mx1+'" y2="'+(my1+mH/2)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW)+'" y1="'+(my1+mH/2)+'" x2="'+(wx+wallW)+'" y2="'+(my1+mH/2)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW/2)+'" y1="'+wy+'" x2="'+(mx1+mW/2)+'" y2="'+my1+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW/2)+'" y1="'+(my1+mH)+'" x2="'+(mx1+mW/2)+'" y2="'+(wy+wallH)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy-2)+'" text-anchor="middle" font-size="11" fill="#004d40">'+(madoUe!=null?madoUe:'')+'</text>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy+wallH+14)+'" text-anchor="middle" font-size="11" fill="#004d40">'+(madoShita!=null?madoShita:'')+'</text>';
  svg += '<text x="'+(wx-6)+'" y="'+(my1+mH/2+4)+'" text-anchor="end" font-size="11" fill="#004d40">'+(madoHidari!=null?madoHidari:'')+'</text>';
  svg += '<text x="'+(wx+wallW+6)+'" y="'+(my1+mH/2+4)+'" font-size="11" fill="#004d40">'+(madoMigi!=null?madoMigi:'')+'</text>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2)+'" text-anchor="middle" font-size="11" fill="#004d40">'+(madoW||'?')+'×'+(madoH||'?')+'</text>';

  // 右側に窓の数値一覧
  var tx = 480, ty = 90;
  function winLine(t){ svg += '<text x="'+tx+'" y="'+ty+'" font-size="17" fill="#333">'+escHtmlModal(t)+'</text>'; ty += 30; }
  winLine('窓のある面：'+(madoMen||'未選択'));
  winLine('窓サイズ：W'+(madoW||'?')+' × H'+(madoH||'?'));
  winLine('窓奥行 D：'+(madoD!=null?madoD:'?'));
  winLine('離れ 上：'+(madoUe!=null?madoUe:'?')+'　下：'+(madoShita!=null?madoShita:'?'));
  winLine('離れ 左：'+(madoHidari!=null?madoHidari:'?')+'　右：'+(madoMigi!=null?madoMigi:'?'));
  if (trueWallMode) winLine('壁面積：約'+wallAreaM2+'㎡');

  svg += '</svg>';
  return svg;
}
