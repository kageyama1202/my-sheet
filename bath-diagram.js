/* bath-diagram.js — 浴室現場チェックの図面SVG生成【新規分離】
   shared-modal.js内「📐 浴室図面」の「図面を表示」ボタンから、
   ensureBathDiagramLibModal()によってボタンクリック時にのみ動的読込される。
   ここに定義する関数(buildBathDiagramSVG / numModal / fitBoxModal)は
   グローバルにぶら下がり、shared-modal.js側から直接呼び出される想定。
   escHtmlModal()はshared-modal.js側にある想定(このファイルは常にshared-modal.jsの後に読み込まれる)。
   ★2026-09-13変更★ PDF化は廃止(画面表示してスクショで運用するため)。
   html2canvas/jsPDF読込用だったensurePdfLibsModal()は不要になったため削除。
*/
// VERSION: 2026-09-13-009

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
  svg += '<text x="'+(ox+ow/2)+'" y="'+(oy-14)+'" text-anchor="middle" font-size="13" fill="#555">'+(maguchi||'')+'</text>';
  svg += '<rect x="'+ox+'" y="'+oy+'" width="'+ow+'" height="'+oh+'" fill="none" stroke="#c0392b" stroke-width="2"/>';
  var padX = 12, padY = 12;
  if (seiMaguchi && maguchi) padX = Math.max(4, ow * (maguchi - seiMaguchi) / maguchi / 2);
  if (seiOkuyuki && okuyuki) padY = Math.max(4, oh * (okuyuki - seiOkuyuki) / okuyuki / 2);
  var ix = ox + padX, iy = oy + padY, iw = ow - padX*2, ih = oh - padY*2;
  svg += '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" fill="#dcecec" stroke="#00695c" stroke-width="1.5"/>';
  svg += '<text x="'+(ox+ow+8)+'" y="'+(oy+oh/2)+'" font-size="12" fill="#555" transform="rotate(90 '+(ox+ow+8)+' '+(oy+oh/2)+')" text-anchor="middle">'+(okuyuki||'')+'</text>';

  // 勝手(ドアの開き)：右勝手/左勝手のどちらか一方だけ描く
  // ★2026-09-13変更★ 実際の浴室ドアは室内側(内側)に開くとのご指摘のため、
  // 蝶番(コーナー)を基点にしたシンプルな作図に描き直し、開き方向を必ず室内側(箱の内側)に収める。
  // ・「開いた状態」の線＝蝶番から室内側の壁沿いへ伸ばす(以前は箱の外側にはみ出していた)
  // ・弧の中心を蝶番に固定するため、SVGのsweep-flagを幾何計算で導出(右勝手=0／左勝手=1で中心が蝶番に一致)
  var doorPos = sc.bathDoorPosition || '';
  var doorY = oy + oh;
  var kaikou = numModal(sc.bathKaikou);
  var doorWidthMM = kaikou || 650;
  // 極端な入力での破綻防止のため、部屋の辺の90%を上限にクランプ(見た目の安全策であり、実寸方針は変えない)
  var doorR = Math.min(Math.max(15, doorWidthMM * outerBox.scale), ow*0.9, oh*0.9);
  // ★2026-09-13変更★ メモ開始Y座標をドアの大きさに依存させず、常に箱の下+40pxの固定位置にする
  // (以前はドアが大きいとメモが下象限にめり込んで表示崩れの原因になっていた)。
  var planNoteStartY = oy + oh + 40;
  if (doorPos === '右') {
    var rHingeX = ox+ow, rHingeY = doorY;
    var rClosedX = rHingeX, rClosedY = rHingeY - doorR;      // 閉じた状態：右の壁沿いに上へ
    var rOpenX = rHingeX - doorR, rOpenY = rHingeY;          // 開いた状態：室内側(左)へ
    svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+rClosedX+'" y2="'+rClosedY+'" stroke="#222" stroke-width="2"/>';
    svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+rOpenX+'" y2="'+rOpenY+'" stroke="#222" stroke-width="1.3"/>';
    svg += '<path d="M'+rClosedX+','+rClosedY+' A'+doorR+','+doorR+' 0 0 0 '+rOpenX+','+rOpenY+'" fill="none" stroke="#999" stroke-width="0.8" stroke-dasharray="3,3"/>';
    svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+16)+'" font-size="12" fill="#c0392b">右勝手</text>';
  } else if (doorPos === '左') {
    var lHingeX = ox, lHingeY = doorY;
    var lClosedX = lHingeX, lClosedY = lHingeY - doorR;      // 閉じた状態：左の壁沿いに上へ
    var lOpenX = lHingeX + doorR, lOpenY = lHingeY;          // 開いた状態：室内側(右)へ
    svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+lClosedX+'" y2="'+lClosedY+'" stroke="#222" stroke-width="2"/>';
    svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+lOpenX+'" y2="'+lOpenY+'" stroke="#222" stroke-width="1.3"/>';
    svg += '<path d="M'+lClosedX+','+lClosedY+' A'+doorR+','+doorR+' 0 0 1 '+lOpenX+','+lOpenY+'" fill="none" stroke="#999" stroke-width="0.8" stroke-dasharray="3,3"/>';
    svg += '<text x="'+(ox-70)+'" y="'+(doorY+16)+'" font-size="12" fill="#c0392b">左勝手</text>';
  } else {
    svg += '<text x="'+(ox+ow/2)+'" y="'+(doorY+16)+'" text-anchor="middle" font-size="11" fill="#aaa">(勝手未選択)</text>';
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
  // ★2026-09-13変更★ 設置方法・枠材の厚みはドア枠(開口)の話なので、メモ欄(左下)ではなく
  // 平面図(左上)の下、ドア図形と重ならない位置(planNoteStartY)にまとめて表示する。
  var planNoteLines = [];
  if (sekkou.length) planNoteLines.push({ text: '石膏ボード：'+sekkou.join('・'), color: '#8e24aa', size: 12 });
  if (sc.bathSetchiHouhou) planNoteLines.push({ text: '設置方法：'+sc.bathSetchiHouhou, color: '#555', size: 13 });
  if (sc.bathWakuzaiAtsumi) planNoteLines.push({ text: '枠材の厚み：'+sc.bathWakuzaiAtsumi, color: '#555', size: 12 });
  var planNoteY = planNoteStartY;
  planNoteLines.forEach(function(item){
    var fsize = item.size || 11;
    svg += '<text x="'+ix+'" y="'+planNoteY+'" font-size="'+fsize+'" fill="'+item.color+'">'+escHtmlModal(item.text)+'</text>';
    planNoteY += fsize + 7;
  });

  // ---------- 右上：高さ関係（断面） ----------
  var tenjou = numModal(sc.bathTenjouTakasa);
  var datsui = numModal(sc.bathDatsuishitsuTakasa);
  var furo = numModal(sc.bathFuroTakasa);
  var kankisen = numModal(sc.bathKankisenTakasa);
  var duct = numModal(sc.bathDuctTakasa);
  var agari = numModal(sc.bathYukaAgariTakasa, 0);
  var clear = numModal(sc.bathTenjouClear);
  var slab = numModal(sc.bathSlabYukaTakasa);
  var total = numModal(sc.bathJougeSousunpou);
  var totalJissoku = numModal(sc.bathJougeSousunpouJissoku);

  var totalMM = tenjou || ((furo||0)+(kankisen||0)+(agari||0)+(clear||0)) || 2400;
  var pxScale = 300 / totalMM;
  var baseY = oy + 300; // 床(0mm)の位置。★2026-09-13変更★ 平面図の上端(oy)と縦位置を揃え、
  // 天井ラインが平面図より低い位置から始まって見える(上端が詰まって見える)問題を解消。

  // ★2026-09-13変更★
  // ・右側に余白が空きすぎていたため、断面全体を右へ詰める(rx: 640→680)。左側はドアがある想定の余白として確保。
  // ・箱の幅は固定90pxではなく、間口(または製品間口)の実測値を高さと同じ縮尺(pxScale)で換算し、
  //   「入力値に合わせたワイド感」になるようにする。ただしラベル文字の表示スペースを確保するため60〜220pxにクランプ。
  var rx = 680;
  var widthSourceMM = maguchi || seiMaguchi || 1600;
  var hBoxW = Math.min(220, Math.max(60, Math.round(widthSourceMM * pxScale)));
  var labelX = rx + hBoxW + 10;
  var lineEndX = labelX + 170;
  var bracketX = labelX + 195;

  function segY(mmFromFloor) { return baseY - mmFromFloor * pxScale; }

  var yAgariTop = segY(agari);
  var yFuroTop = segY(agari + (furo||0));
  var yKankisenTop = segY(agari + (furo||0) + (kankisen||0));
  var yTenjou = tenjou ? segY(tenjou) : yKankisenTop;

  // ★2026-09-13変更★ 各区画の数値は「その区画の右上」に寄せる(以前は縦中央寄せで、
  // どの数値がどの区画のものか一見わかりにくかったため)。ラベルは各rectの上端に揃える。
  // 床上がり
  if (agari) {
    svg += '<rect x="'+rx+'" y="'+yAgariTop+'" width="'+hBoxW+'" height="'+(baseY-yAgariTop)+'" fill="#e0e0e0" stroke="#888" stroke-width="1"/>';
    svg += '<text x="'+labelX+'" y="'+(yAgariTop+12)+'" font-size="12" fill="#666">床上がり高さ：'+agari+'</text>';
  }
  // 風呂の高さ(製品)
  if (furo) {
    svg += '<rect x="'+rx+'" y="'+yFuroTop+'" width="'+hBoxW+'" height="'+(yAgariTop-yFuroTop)+'" fill="#dcecec" stroke="#00695c" stroke-width="1.3"/>';
    svg += '<text x="'+labelX+'" y="'+(yFuroTop+12)+'" font-size="12" fill="#00695c">風呂の高さ：'+furo+'</text>';
  }
  // 換気扇の高さ
  if (kankisen) {
    svg += '<rect x="'+rx+'" y="'+yKankisenTop+'" width="'+hBoxW+'" height="'+(yFuroTop-yKankisenTop)+'" fill="#ffe0b2" stroke="#ef6c00" stroke-width="1.3"/>';
    svg += '<text x="'+labelX+'" y="'+(yKankisenTop+12)+'" font-size="12" fill="#ef6c00">換気扇高さ：'+kankisen+'</text>';
  }
  // ★2026-09-13追加★ 排気ダクト(φ100)センター高さ：換気扇センターに接続する位置の目印として、
  // 床からの高さ(pxScale換算)に丸印＋点線を表示。他の区画と重なる可能性があるため、まずは目立つ紫色で。
  if (duct) {
    var yDuct = baseY - duct * pxScale;
    svg += '<line x1="'+(rx-15)+'" y1="'+yDuct+'" x2="'+(rx+hBoxW+15)+'" y2="'+yDuct+'" stroke="#6a1b9a" stroke-width="1" stroke-dasharray="2,2"/>';
    svg += '<circle cx="'+(rx+hBoxW/2)+'" cy="'+yDuct+'" r="4" fill="#fff" stroke="#6a1b9a" stroke-width="1.5"/>';
    svg += '<text x="'+labelX+'" y="'+(yDuct+4)+'" font-size="12" fill="#6a1b9a">排気ダクト(φ100)センター：'+duct+'</text>';
  }
  // 天井とのクリア
  if (clear !== null && tenjou) {
    svg += '<rect x="'+rx+'" y="'+yTenjou+'" width="'+hBoxW+'" height="'+(yKankisenTop-yTenjou)+'" fill="#fff" stroke="#c0392b" stroke-width="1" stroke-dasharray="4,3"/>';
    svg += '<text x="'+labelX+'" y="'+(yTenjou+12)+'" font-size="12" fill="#c0392b">天井とのクリア：'+clear+'</text>';
  }
  // 天井ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+yTenjou+'" x2="'+lineEndX+'" y2="'+yTenjou+'" stroke="#333" stroke-width="1"/>';
  svg += '<text x="'+(rx-30)+'" y="'+(yTenjou-6)+'" text-anchor="end" font-size="12" fill="#555">天井高さ'+(tenjou?'：'+tenjou:'')+'</text>';
  // 床ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+baseY+'" x2="'+lineEndX+'" y2="'+baseY+'" stroke="#333" stroke-width="1"/>';
  // ★2026-09-13変更★ 床構成は中央(rx-30・右寄せ)だと左の平面図側にはみ出して見えていたため、
  // 右側の数値ラベル列(labelX)に統一して「右の欄」に収める。
  svg += '<text x="'+labelX+'" y="'+(baseY+16)+'" font-size="12" fill="#555">床構成'+(sc.bathYukaKousei?'：'+escHtmlModal(sc.bathYukaKousei):'')+'</text>';

  // 脱衣室高さ(別ブラケット・左側)
  if (datsui) {
    var yDatsuiTop = baseY - datsui * pxScale;
    svg += '<line x1="'+(rx-70)+'" y1="'+baseY+'" x2="'+(rx-70)+'" y2="'+yDatsuiTop+'" stroke="#5c6bc0" stroke-width="1"/>';
    svg += '<text x="'+(rx-80)+'" y="'+((baseY+yDatsuiTop)/2)+'" text-anchor="end" font-size="11" fill="#5c6bc0" transform="rotate(0)">脱衣室高さ：'+datsui+'</text>';
  }

  // スラブ寸法＋上下総寸法（床の下側。★2026-09-13変更★ 他の高さ要素と同じpxScaleを使い、
  // 見やすさ優先の固定オフセットをやめて実寸スケール描画に変更）
  if (slab) {
    var ySlab = baseY + slab * pxScale;
    svg += '<line x1="'+(rx-20)+'" y1="'+ySlab+'" x2="'+lineEndX+'" y2="'+ySlab+'" stroke="#333" stroke-width="1"/>';
    svg += '<text x="'+(rx-30)+'" y="'+(ySlab+13)+'" text-anchor="end" font-size="12" fill="#555">スラブ寸法：'+slab+'</text>';
    svg += '<line x1="'+bracketX+'" y1="'+yTenjou+'" x2="'+bracketX+'" y2="'+ySlab+'" stroke="#00695c" stroke-width="1"/>';
    // ★2026-09-13変更★ ブラケットの右に文字を置くとキャンバス右端で見切れることがあったため、
    // ブラケットの左側(text-anchor:end)に寄せる。
    svg += '<text x="'+(bracketX-10)+'" y="'+((yTenjou+ySlab)/2-6)+'" text-anchor="end" font-size="12" fill="#00695c">上下総寸法：'+(total!==null?total:'?')+'</text>';
    if (totalJissoku !== null) {
      svg += '<text x="'+(bracketX-10)+'" y="'+((yTenjou+ySlab)/2+10)+'" text-anchor="end" font-size="12" fill="#c0392b">実測：'+totalJissoku+'</text>';
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
  if (sc.bathRemoconUmu) extraNotes.push('リモコン開口：'+sc.bathRemoconUmu + (sc.bathRemoconMemo?'（'+sc.bathRemoconMemo+'）':''));
  if (sc.bathHandbarHouhou) extraNotes.push('ハンドバー：'+sc.bathHandbarHouhou);
  if (sc.bathTsuriKanaguKubun || sc.bathTsuriKanaguSize) extraNotes.push('吊り金具：'+(sc.bathTsuriKanaguKubun||'?')+' / '+(sc.bathTsuriKanaguSize||'?')+' / 現地入れ'+(sc.bathTsuriKanaguGenchi||'?'));
  extraNotes.forEach(function(line, i){
    svg += '<text x="30" y="'+(MY+64+(memoLines.length+i+1)*16)+'" font-size="11" fill="#666">'+escHtmlModal(line)+'</text>';
  });

  // ---------- 右下：窓位置 ----------
  // ★2026-09-13変更★ 精度向上のため「窓がある面(正面/右面/左面)」を追加。
  // 面がわかれば、その面の実際の壁寸法(正面=間口×天井高さ／右面・左面=奥行き×天井高さ)を
  // そのまま壁のスケールとして使えるので、窓自身の離れ寸法が多少欠けていても実寸に近い表示になる。
  // 優先順位: ①面選択+室内寸法(最も正確・面積も算出可) → ②離れ4点から逆算(面積は出せない) → ③概算配置
  var madoW = numModal(sc.bathMadoW), madoH = numModal(sc.bathMadoH), madoD = numModal(sc.bathMadoD);
  var madoUe = numModal(sc.bathMadoUe), madoShita = numModal(sc.bathMadoShita), madoHidari = numModal(sc.bathMadoHidari), madoMigi = numModal(sc.bathMadoMigi);
  var madoMen = sc.bathMadoMen || '';
  var wallWidthMM = null, wallHeightMM = null, wallAreaM2 = null;
  if (madoMen === '正面') { wallWidthMM = maguchi || seiMaguchi || null; wallHeightMM = tenjou || null; }
  else if (madoMen === '右面' || madoMen === '左面') { wallWidthMM = okuyuki || seiOkuyuki || null; wallHeightMM = tenjou || null; }
  var trueWallMode = !!(wallWidthMM && wallHeightMM);
  if (trueWallMode) wallAreaM2 = Math.round((wallWidthMM/1000) * (wallHeightMM/1000) * 100) / 100;

  var madoScaleReady = madoW!=null && madoH!=null && madoUe!=null && madoShita!=null && madoHidari!=null && madoMigi!=null;
  // trueWallModeでなければ従来通り離れ4点の合計から壁サイズを逆算(面積は不明のため出さない)
  if (!trueWallMode && madoScaleReady) {
    wallWidthMM = madoHidari + madoW + madoMigi;
    wallHeightMM = madoUe + madoH + madoShita;
  }
  var scaleReady = trueWallMode || madoScaleReady;
  var winBox = scaleReady ? fitBoxModal(wallWidthMM, wallHeightMM, 260, 260) : { w: 260, h: 260, scale: null };
  var wx = 695, wy = MY+40, wallW = winBox.w, wallH = winBox.h;
  var winTitle = '窓位置';
  if (trueWallMode) winTitle += '（'+madoMen+'・壁面積約'+wallAreaM2+'㎡）';
  else if (!scaleReady) winTitle += '（概算配置）';
  svg += '<text x="'+(wx+wallW/2)+'" y="'+(wy-14)+'" text-anchor="middle" font-size="13" fill="#333">'+winTitle+'</text>';
  svg += '<rect x="'+wx+'" y="'+wy+'" width="'+wallW+'" height="'+wallH+'" fill="#eef3ee" stroke="#00695c" stroke-width="1.5"/>';
  var mW, mH, mx1, my1;
  if (scaleReady) {
    // trueWallModeで離れ寸法が一部欠けている場合は、わかる軸だけ実寸配置、欠けている軸は中央寄せにする
    mW = madoW!=null ? madoW * winBox.scale : wallW*0.35;
    mH = madoH!=null ? madoH * winBox.scale : wallH*0.35;
    mx1 = madoHidari!=null ? wx + madoHidari*winBox.scale : wx + (wallW-mW)/2;
    my1 = madoUe!=null ? wy + madoUe*winBox.scale : wy + (wallH-mH)/2;
  } else {
    mW = madoW ? Math.min(wallW*0.6, madoW*0.15) : wallW*0.35;
    mH = madoH ? Math.min(wallH*0.6, madoH*0.15) : wallH*0.35;
    mx1 = wx + (madoHidari!=null && madoMigi!=null ? (madoHidari/(madoHidari+madoMigi))*(wallW-mW) : (wallW-mW)/2);
    my1 = wy + (madoUe!=null && madoShita!=null ? (madoUe/(madoUe+madoShita))*(wallH-mH) : (wallH-mH)/2);
  }
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
  // ★2026-09-13変更★ 奥行き(D)寸法も記載してほしいとの要望のため、W×Hの下にD寸法を追記。
  svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2+18)+'" text-anchor="middle" font-size="10" fill="#004d40">奥行D：'+(madoD!=null?madoD:'?')+'</text>';

  svg += '</svg>';
  return svg;
}
