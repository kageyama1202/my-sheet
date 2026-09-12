/* bath-diagram.js — 浴室現場チェックの図面SVG生成【新規分離】
   shared-modal.js内「📐 浴室図面」の「図面を表示」ボタンから、
   ensureBathDiagramLibModal()によってボタンクリック時にのみ動的読込される。
   ここに定義する関数(buildBathDiagramSVG / numModal / fitBoxModal)は
   グローバルにぶら下がり、shared-modal.js側から直接呼び出される想定。
   escHtmlModal()はshared-modal.js側にある想定(このファイルは常にshared-modal.jsの後に読み込まれる)。
   ★2026-09-13変更★ PDF化は廃止(画面表示してスクショで運用するため)。
   html2canvas/jsPDF読込用だったensurePdfLibsModal()は不要になったため削除。
*/
// VERSION: 2026-09-13-002

// ============ 📐 浴室図面（4象限レイアウトのSVG生成） ============
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

// 現場チェック(浴室)の入力値から、IMG_6909の4象限レイアウトを模したSVGを組み立てる。
// 初版のため、位置・比率は今後の見た目調整を前提とする。
function buildBathDiagramSVG(sc) {
  sc = sc || {};
  var W = 1150, H = 900, MX = 500, MY = 450;
  // ★2026-09-13変更★ width/heightは指定せず100%+preserveAspectRatioにして、
  // モーダルのプレビュー幅に自動で収まるようにする(スクショで全面を撮れるようにするため)。
  var svg = '<svg width="100%" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" font-family="\'Hiragino Kaku Gothic ProN\',\'Meiryo\',sans-serif" style="display:block;">';
  svg += '<rect width="'+W+'" height="'+H+'" fill="#fdfaf3"/>';
  svg += '<line x1="'+MX+'" y1="0" x2="'+MX+'" y2="'+H+'" stroke="#c0392b" stroke-width="2"/>';
  svg += '<line x1="0" y1="'+MY+'" x2="'+W+'" y2="'+MY+'" stroke="#c0392b" stroke-width="2"/>';

  // ---------- 左上：平面図（間口・奥行き／勝手／石膏ボード） ----------
  var maguchi = numModal(sc.bathMaguchi), okuyuki = numModal(sc.bathOkuyuki);
  var seiMaguchi = numModal(sc.bathSeihinMaguchi), seiOkuyuki = numModal(sc.bathSeihinOkuyuki);
  var outerBox = fitBoxModal(maguchi || seiMaguchi || 1600, okuyuki || seiOkuyuki || 1600, 300, 300);
  var ox = 60, oy = 40, ow = outerBox.w, oh = outerBox.h;
  svg += '<text x="'+(ox+ow/2)+'" y="'+(oy-14)+'" text-anchor="middle" font-size="13" fill="#555">間口'+(maguchi?'：'+maguchi:'')+'</text>';
  svg += '<rect x="'+ox+'" y="'+oy+'" width="'+ow+'" height="'+oh+'" fill="none" stroke="#c0392b" stroke-width="2"/>';
  var padX = 12, padY = 12;
  if (seiMaguchi && maguchi) padX = Math.max(4, ow * (maguchi - seiMaguchi) / maguchi / 2);
  if (seiOkuyuki && okuyuki) padY = Math.max(4, oh * (okuyuki - seiOkuyuki) / okuyuki / 2);
  var ix = ox + padX, iy = oy + padY, iw = ow - padX*2, ih = oh - padY*2;
  svg += '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" fill="#dcecec" stroke="#00695c" stroke-width="1.5"/>';
  svg += '<text x="'+(ox+ow+8)+'" y="'+(oy+oh/2)+'" font-size="12" fill="#555" transform="rotate(90 '+(ox+ow+8)+' '+(oy+oh/2)+')" text-anchor="middle">奥行き'+(okuyuki?'：'+okuyuki:'')+'</text>';

  // 勝手(ドアの開き)：右勝手/左勝手のどちらか一方だけ描く
  // ★2026-09-13変更★ 弧の半径が固定48pxで部屋の大きさに対して小さすぎたため、
  // 標準的なドア扉幅(650mm想定)を間口/奥行きと同じスケール(outerBox.scale)で換算した実寸ベースに変更。
  var doorPos = sc.bathDoorPosition || '';
  var doorY = oy + oh;
  var DOOR_LEAF_MM = 650;
  var doorR = Math.min(90, Math.max(24, DOOR_LEAF_MM * outerBox.scale));
  var doorRatio = doorR / 48; // 元の描画比率(縦40:横30:8)を維持したまま拡大縮小するための係数
  if (doorPos === '右') {
    svg += '<path d="M'+(ox+ow)+','+(doorY-40*doorRatio)+' L'+(ox+ow)+','+(doorY+30*doorRatio)+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+(ox+ow)+','+(doorY+30*doorRatio)+' L'+(ox+ow-40*doorRatio)+','+(doorY-8*doorRatio)+'" stroke="#222" stroke-width="1.3"/>';
    svg += '<path d="M'+(ox+ow)+','+(doorY-40*doorRatio)+' A'+doorR+','+doorR+' 0 0 0 '+(ox+ow-40*doorRatio)+','+(doorY-8*doorRatio)+'" fill="none" stroke="#999" stroke-width="0.8" stroke-dasharray="3,3"/>';
    svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+45*doorRatio)+'" font-size="12" fill="#c0392b">右勝手</text>';
  } else if (doorPos === '左') {
    svg += '<path d="M'+ox+','+(doorY-40*doorRatio)+' L'+ox+','+(doorY+30*doorRatio)+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+ox+','+(doorY+30*doorRatio)+' L'+(ox+40*doorRatio)+','+(doorY-8*doorRatio)+'" stroke="#222" stroke-width="1.3"/>';
    svg += '<path d="M'+ox+','+(doorY-40*doorRatio)+' A'+doorR+','+doorR+' 0 0 1 '+(ox+40*doorRatio)+','+(doorY-8*doorRatio)+'" fill="none" stroke="#999" stroke-width="0.8" stroke-dasharray="3,3"/>';
    svg += '<text x="'+(ox-70)+'" y="'+(doorY+45*doorRatio)+'" font-size="12" fill="#c0392b">左勝手</text>';
  } else {
    svg += '<text x="'+(ox+ow/2)+'" y="'+(doorY+45)+'" text-anchor="middle" font-size="11" fill="#aaa">(勝手未選択)</text>';
  }

  // 石膏ボード部分：選択された壁面ごとに強調線＋ラベル
  var sekkou = sc.bathSekkouBoard ? String(sc.bathSekkouBoard).split(',') : [];
  var sekkouWalls = {
    '右': { x1: ix+iw, y1: iy, x2: ix+iw, y2: iy+ih },
    '左': { x1: ix, y1: iy, x2: ix, y2: iy+ih },
    '正面': { x1: ix, y1: iy, x2: ix+iw, y2: iy },
    'ドア横': { x1: ix, y1: iy+ih, x2: ix+iw, y2: iy+ih }
  };
  sekkou.forEach(function(w){
    var seg = sekkouWalls[w];
    if (!seg) return;
    svg += '<line x1="'+seg.x1+'" y1="'+seg.y1+'" x2="'+seg.x2+'" y2="'+seg.y2+'" stroke="#8e24aa" stroke-width="6" stroke-linecap="round" opacity="0.85"/>';
  });
  if (sekkou.length) {
    svg += '<text x="'+ix+'" y="'+(iy+ih+40)+'" font-size="11" fill="#8e24aa">石膏ボード：'+sekkou.join('・')+'</text>';
  }

  // ---------- 右上：高さ関係（断面） ----------
  var rx = 640;
  var tenjou = numModal(sc.bathTenjouTakasa);
  var datsui = numModal(sc.bathDatsuishitsuTakasa);
  var furo = numModal(sc.bathFuroTakasa);
  var kankisen = numModal(sc.bathKankisenTakasa);
  var agari = numModal(sc.bathYukaAgariTakasa, 0);
  var clear = numModal(sc.bathTenjouClear);
  var slab = numModal(sc.bathSlabYukaTakasa);
  var total = numModal(sc.bathJougeSousunpou);
  var totalJissoku = numModal(sc.bathJougeSousunpouJissoku);

  var totalMM = tenjou || ((furo||0)+(kankisen||0)+(agari||0)+(clear||0)) || 2400;
  var pxScale = 300 / totalMM;
  var baseY = 400; // 床(0mm)の位置

  function segY(mmFromFloor) { return baseY - mmFromFloor * pxScale; }

  var yAgariTop = segY(agari);
  var yFuroTop = segY(agari + (furo||0));
  var yKankisenTop = segY(agari + (furo||0) + (kankisen||0));
  var yTenjou = tenjou ? segY(tenjou) : yKankisenTop;

  // ★2026-09-13変更★ 各区画の数値は「その区画の右上」に寄せる(以前は縦中央寄せで、
  // どの数値がどの区画のものか一見わかりにくかったため)。ラベルは各rectの上端に揃える。
  // 床上がり
  if (agari) {
    svg += '<rect x="'+rx+'" y="'+yAgariTop+'" width="26" height="'+(baseY-yAgariTop)+'" fill="#e0e0e0" stroke="#888" stroke-width="1"/>';
    svg += '<text x="'+(rx+34)+'" y="'+(yAgariTop+11)+'" font-size="11" fill="#666">床上がり高さ：'+agari+'</text>';
  }
  // 風呂の高さ(製品)
  if (furo) {
    svg += '<rect x="'+rx+'" y="'+yFuroTop+'" width="26" height="'+(yAgariTop-yFuroTop)+'" fill="#dcecec" stroke="#00695c" stroke-width="1.3"/>';
    svg += '<text x="'+(rx+34)+'" y="'+(yFuroTop+11)+'" font-size="11" fill="#00695c">風呂の高さ：'+furo+'</text>';
  }
  // 換気扇の高さ
  if (kankisen) {
    svg += '<rect x="'+rx+'" y="'+yKankisenTop+'" width="26" height="'+(yFuroTop-yKankisenTop)+'" fill="#ffe0b2" stroke="#ef6c00" stroke-width="1.3"/>';
    svg += '<text x="'+(rx+34)+'" y="'+(yKankisenTop+11)+'" font-size="11" fill="#ef6c00">換気扇高さ：'+kankisen+'</text>';
  }
  // 天井とのクリア
  if (clear !== null && tenjou) {
    svg += '<rect x="'+rx+'" y="'+yTenjou+'" width="26" height="'+(yKankisenTop-yTenjou)+'" fill="#fff" stroke="#c0392b" stroke-width="1" stroke-dasharray="4,3"/>';
    svg += '<text x="'+(rx+34)+'" y="'+(yTenjou+11)+'" font-size="11" fill="#c0392b">天井とのクリア：'+clear+'</text>';
  }
  // 天井ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+yTenjou+'" x2="'+(rx+260)+'" y2="'+yTenjou+'" stroke="#333" stroke-width="1"/>';
  svg += '<text x="'+(rx-30)+'" y="'+(yTenjou-6)+'" text-anchor="end" font-size="12" fill="#555">天井高さ'+(tenjou?'：'+tenjou:'')+'</text>';
  // 床ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+baseY+'" x2="'+(rx+260)+'" y2="'+baseY+'" stroke="#333" stroke-width="1"/>';
  svg += '<text x="'+(rx-30)+'" y="'+(baseY+16)+'" text-anchor="end" font-size="12" fill="#555">床構成'+(sc.bathYukaKousei?'：'+escHtmlModal(sc.bathYukaKousei):'')+'</text>';

  // 脱衣室高さ(別ブラケット・左側)
  if (datsui) {
    var yDatsuiTop = baseY - datsui * pxScale;
    svg += '<line x1="'+(rx-70)+'" y1="'+baseY+'" x2="'+(rx-70)+'" y2="'+yDatsuiTop+'" stroke="#5c6bc0" stroke-width="1"/>';
    svg += '<text x="'+(rx-80)+'" y="'+((baseY+yDatsuiTop)/2)+'" text-anchor="end" font-size="11" fill="#5c6bc0" transform="rotate(0)">脱衣室高さ：'+datsui+'</text>';
  }

  // スラブ寸法＋上下総寸法（床の下側。実寸スケールではなく見やすさ優先の固定オフセット）
  if (slab) {
    var ySlab = baseY + 35;
    svg += '<line x1="'+(rx-20)+'" y1="'+ySlab+'" x2="'+(rx+260)+'" y2="'+ySlab+'" stroke="#333" stroke-width="1"/>';
    svg += '<text x="'+(rx-30)+'" y="'+(ySlab+13)+'" text-anchor="end" font-size="12" fill="#555">スラブ寸法：'+slab+'</text>';
    svg += '<line x1="'+(rx+280)+'" y1="'+yTenjou+'" x2="'+(rx+280)+'" y2="'+ySlab+'" stroke="#00695c" stroke-width="1"/>';
    svg += '<text x="'+(rx+290)+'" y="'+((yTenjou+ySlab)/2-6)+'" font-size="11" fill="#00695c">上下総寸法：'+(total!==null?total:'?')+'</text>';
    if (totalJissoku !== null) {
      svg += '<text x="'+(rx+290)+'" y="'+((yTenjou+ySlab)/2+10)+'" font-size="11" fill="#c0392b">実測：'+totalJissoku+'</text>';
    }
  }

  // ---------- 左下：メモ・連絡事項 ----------
  svg += '<text x="30" y="'+(MY+40)+'" font-size="13" fill="#3b6d11">メモ・連絡事項</text>';
  var memo = sc.bathMemoRenraku || '';
  var memoLines = memo ? String(memo).split('\n') : ['(未入力)'];
  memoLines.forEach(function(line, i){
    svg += '<text x="30" y="'+(MY+64+i*16)+'" font-size="12" fill="#333">'+escHtmlModal(line)+'</text>';
  });
  var extraNotes = [];
  if (sc.bathSetchiHouhou) extraNotes.push('設置方法：'+sc.bathSetchiHouhou);
  if (sc.bathRemoconUmu) extraNotes.push('リモコン開口：'+sc.bathRemoconUmu + (sc.bathRemoconMemo?'（'+sc.bathRemoconMemo+'）':''));
  if (sc.bathHandbarHouhou) extraNotes.push('ハンドバー：'+sc.bathHandbarHouhou);
  if (sc.bathTsuriKanaguKubun || sc.bathTsuriKanaguSize) extraNotes.push('吊り金具：'+(sc.bathTsuriKanaguKubun||'?')+' / '+(sc.bathTsuriKanaguSize||'?')+' / 現地入れ'+(sc.bathTsuriKanaguGenchi||'?'));
  if (sc.bathWakuzaiAtsumi) extraNotes.push('枠材の厚み：'+sc.bathWakuzaiAtsumi);
  extraNotes.forEach(function(line, i){
    svg += '<text x="30" y="'+(MY+64+(memoLines.length+i+1)*16)+'" font-size="11" fill="#666">'+escHtmlModal(line)+'</text>';
  });

  // ---------- 右下：窓位置 ----------
  var wx = 695, wy = MY+40, wallW = 260, wallH = 260;
  svg += '<text x="'+(wx+wallW/2)+'" y="'+(wy-14)+'" text-anchor="middle" font-size="13" fill="#333">窓位置</text>';
  svg += '<rect x="'+wx+'" y="'+wy+'" width="'+wallW+'" height="'+wallH+'" fill="#eef3ee" stroke="#00695c" stroke-width="1.5"/>';
  var madoW = numModal(sc.bathMadoW), madoH = numModal(sc.bathMadoH);
  var madoUe = numModal(sc.bathMadoUe), madoShita = numModal(sc.bathMadoShita), madoHidari = numModal(sc.bathMadoHidari), madoMigi = numModal(sc.bathMadoMigi);
  var mW = madoW ? Math.min(wallW*0.6, madoW*0.15) : wallW*0.35;
  var mH = madoH ? Math.min(wallH*0.6, madoH*0.15) : wallH*0.35;
  var mx1 = wx + (madoHidari!=null && madoMigi!=null ? (madoHidari/(madoHidari+madoMigi))*(wallW-mW) : (wallW-mW)/2);
  var my1 = wy + (madoUe!=null && madoShita!=null ? (madoUe/(madoUe+madoShita))*(wallH-mH) : (wallH-mH)/2);
  svg += '<rect x="'+mx1+'" y="'+my1+'" width="'+mW+'" height="'+mH+'" fill="#dcecec" stroke="#004d40" stroke-width="1.5"/>';
  svg += '<line x1="'+wx+'" y1="'+(my1+mH/2)+'" x2="'+mx1+'" y2="'+(my1+mH/2)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW)+'" y1="'+(my1+mH/2)+'" x2="'+(wx+wallW)+'" y2="'+(my1+mH/2)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW/2)+'" y1="'+wy+'" x2="'+(mx1+mW/2)+'" y2="'+my1+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<line x1="'+(mx1+mW/2)+'" y1="'+(my1+mH)+'" x2="'+(mx1+mW/2)+'" y2="'+(wy+wallH)+'" stroke="#004d40" stroke-width="0.8" stroke-dasharray="2,2"/>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy-2)+'" text-anchor="middle" font-size="10" fill="#004d40">'+(madoUe!=null?madoUe:'')+'</text>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy+wallH+14)+'" text-anchor="middle" font-size="10" fill="#004d40">'+(madoShita!=null?madoShita:'')+'</text>';
  svg += '<text x="'+(wx-6)+'" y="'+(my1+mH/2+4)+'" text-anchor="end" font-size="10" fill="#004d40">'+(madoHidari!=null?madoHidari:'')+'</text>';
  svg += '<text x="'+(wx+wallW+6)+'" y="'+(my1+mH/2+4)+'" font-size="10" fill="#004d40">'+(madoMigi!=null?madoMigi:'')+'</text>';
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2+4)+'" text-anchor="middle" font-size="10" fill="#004d40">'+(madoW||'?')+'×'+(madoH||'?')+'</text>';

  svg += '</svg>';
  return svg;
}
