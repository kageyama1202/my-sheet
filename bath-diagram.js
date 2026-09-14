/* bath-diagram.js — 浴室現場チェックの図面SVG生成【新規分離】
   shared-modal.js内「📐 浴室図面」の「図面を表示」ボタンから、
   ensureBathDiagramLibModal()によってボタンクリック時にのみ動的読込される。
   ここに定義する関数(buildBathDiagramSVG / numModal / fitBoxModal)は
   グローバルにぶら下がり、shared-modal.js側から直接呼び出される想定。
   escHtmlModal()はshared-modal.js側にある想定(このファイルは常にshared-modal.jsの後に読み込まれる)。
   ★2026-09-13変更★ PDF化は廃止(画面表示してスクショで運用するため)。
   html2canvas/jsPDF読込用だったensurePdfLibsModal()は不要になったため削除。
   ★2026-09-14変更★ A/B・L/Rの定義を修正し、浴槽自体を平面図に作図するようにした。
   ★2026-09-14再修正★ 浴槽の左右位置が扉の勝手(L/R)と無関係に固定されていたため、
   扉を開けた直後に浴槽に突き当たる不自然な配置になっていたのを修正(浴槽は扉と反対側に配置)。
   ★2026-09-14追加★ 間口方向(左右)の実クリア自動計算・表示を追加(吊元側:下地+枠-標準出寸34、
   戸先側:建物実測-吊元側クリア-製品幅(配管加算込み)から逆算)。
   ※この計算には以下の新規入力項目が必要(現状shared-modal.js側の入力欄は未確認・未追加):
     bathTsurimotoShitaji(吊元下地厚み) / bathTsurimotoWaku(吊元枠厚み) /
     bathTsurimotoPanel(吊元追加パネル厚み、既定0) / bathHaikanHoushiki('下配管'/'上配管') /
     bathJouhaikanSupace(上配管時追加スペースmm、現場入力目安30〜40) /
     bathMizumotoGawa('吊元側'/'戸先側'/'なし')
*/
// VERSION: 2026-09-15-009
// CREATED: 2026-09-15 01:55

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

// ★2026-09-13追加★ SVGの<text>は自動改行しないため、長い文章(報告書取込の伝達事項など)が
// 象限をまたいではみ出す不具合が起きていた。文字数ベースで簡易的に折り返す。
// (日本語は全角前提のざっくり計算。英数字混じりでも大きく崩れない程度の安全マージンを取る)
function wrapTextModal(text, maxChars) {
  var str = String(text == null ? '' : text);
  var lines = [];
  for (var i = 0; i < str.length; i += maxChars) {
    lines.push(str.slice(i, i + maxChars));
  }
  return lines.length ? lines : [''];
}

// 現場チェック(浴室)の入力値から、IMG_6909の4象限レイアウトを模したSVGを組み立てる。
// 初版のため、位置・比率は今後の見た目調整を前提とする。
function buildBathDiagramSVG(sc) {
  sc = sc || {};
  var W = 1150, H = 900, MX = 500, MY = 450;
  // ★2026-09-13変更★ 梁は右上の高さ断面に重ね描きする方式に変更したため、
  // 下段は再びメモ／窓の2分割に戻す(3分割だった梁専用列は廃止)。
  // ★2026-09-13変更★ width/heightは指定せず100%+preserveAspectRatioにして、
  // モーダルのプレビュー幅に自動で収まるようにする(スクショで全面を撮れるようにするため)。
  var svg = '<svg width="100%" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" font-family="\'Hiragino Kaku Gothic ProN\',\'Meiryo\',sans-serif" style="display:block;">';
  svg += '<rect width="'+W+'" height="'+H+'" fill="#fdfaf3"/>';
  svg += '<line x1="'+MX+'" y1="0" x2="'+MX+'" y2="'+H+'" stroke="#c0392b" stroke-width="2"/>';
  svg += '<line x1="0" y1="'+MY+'" x2="'+W+'" y2="'+MY+'" stroke="#c0392b" stroke-width="2"/>';

  // ---------- 左上：平面図（間口・奥行き／勝手／石膏ボード／浴槽） ----------
  // ★2026-09-14確定★ A/B・L/Rの正しい定義（現場のヒアリングにより判明）。
  //
  // 【L/R(勝手)】扉(下辺＝手前の壁に固定)が箱の右端寄りか左端寄りか、それだけで決まる。
  //   浴槽がどちらにあるかとは完全に無関係。doorPosition(右/左)がそのままL/Rに対応する。
  //
  // 【A/B】扉から見て浴槽の長手方向がどちらを向くか。
  //   ・A：浴槽が縦長＝奥行き方向に伸びる。扉を開けて下を見ると、床(通路)が正面の壁まで
  //        まっすぐ伸びており、浴槽は扉から見て左右どちらかの脇に、通路と並行に配置される。
  //   ・B：浴槽が横長＝間口方向に伸びる。扉を開けて下を見ると、床は途中までしかなく、
  //        その先(正面の壁側)は浴槽が扉の正面方向を横切るように横たわっている。
  //
  // この2軸(L/RとA/B)は独立していて、AR/AL/BR/BLの4パターンが成立する。
  // 扉は常にこの下辺に固定して描く(現場の実務上、脱衣室側の扉の実際の位置は別図面の話であり、
  // このアプリの平面図では扉=下辺固定として運用する)。A/Bで変わるのは、間口(横方向の数値)と
  // 奥行き(縦方向の数値)のどちらの入力値を浴槽の長手方向として使うか＝swapMOのロジックと、
  // それに応じた浴槽自体の描画(縦長/横長)のみで、doorPos(L/R)の判定には一切影響しない。
  var maguchiRaw = numModal(sc.bathMaguchi), okuyukiRaw = numModal(sc.bathOkuyuki);
  var seiMaguchiRaw = numModal(sc.bathSeihinMaguchi), seiOkuyukiRaw = numModal(sc.bathSeihinOkuyuki);
  var katteAB = sc.bathKatteAB || 'A';
  var swapMO = katteAB === 'B';
  // 横方向(ow)・縦方向(oh)にどちらの入力値を使うかをA/Bで切り替える
  var maguchi  = swapMO ? okuyukiRaw    : maguchiRaw;   // 横方向の数値
  var okuyuki  = swapMO ? maguchiRaw    : okuyukiRaw;   // 縦方向の数値
  var seiMaguchi = swapMO ? seiOkuyukiRaw : seiMaguchiRaw;
  var seiOkuyuki = swapMO ? seiMaguchiRaw : seiOkuyukiRaw;
  var outerBox = fitBoxModal(maguchi || seiMaguchi || 1600, okuyuki || seiOkuyuki || 1600, 300, 300);
  var ox = 60, oy = 40, ow = outerBox.w, oh = outerBox.h;
  svg += '<text x="'+(ox+ow/2)+'" y="'+(oy-14)+'" text-anchor="middle" font-size="13" fill="#555">'+(maguchi||'')+'</text>';
  // ★2026-09-13追加★ 引き戸の場合、脱衣室側は間口+引き戸の厚み分の寸法が必要になるため、
  // 間口の数値の下に「+引き戸厚み＝合計」を小さく併記する。
  var hikidoAtsumi = numModal(sc.bathHikidoAtsumi);
  if (sc.bathDoorType === '引き戸' && hikidoAtsumi && maguchiRaw) {
    svg += '<text x="'+(ox+ow/2)+'" y="'+(oy-1)+'" text-anchor="middle" font-size="10" fill="#607d8b">(+引き戸'+hikidoAtsumi+'＝'+(maguchiRaw+hikidoAtsumi)+')</text>';
  }
  svg += '<rect x="'+ox+'" y="'+oy+'" width="'+ow+'" height="'+oh+'" fill="none" stroke="#c0392b" stroke-width="2"/>';
  var padX = 12, padY = 12;
  if (seiMaguchi && maguchi) padX = Math.max(4, ow * (maguchi - seiMaguchi) / maguchi / 2);
  if (seiOkuyuki && okuyuki) padY = Math.max(4, oh * (okuyuki - seiOkuyuki) / okuyuki / 2);
  var ix = ox + padX, iy = oy + padY, iw = ow - padX*2, ih = oh - padY*2;
  svg += '<rect x="'+ix+'" y="'+iy+'" width="'+iw+'" height="'+ih+'" fill="#dcecec" stroke="#00695c" stroke-width="1.5"/>';
  // ★2026-09-13追加★ 製品間口・製品奥行きが入力されていれば、内側(製品)の箱にも
  // 数値だけ(ラベル文字無し)で記入する。間口＝横方向・奥行き＝縦方向という、
  // 外枠側の間口/奥行き表示と同じ向きの慣習に合わせる(A/Bによる入れ替え後の向きに追従)。
  if (seiMaguchi) {
    svg += '<text x="'+(ix+iw/2)+'" y="'+(iy+16)+'" text-anchor="middle" font-size="11" fill="#00695c">'+seiMaguchi+'</text>';
  }
  if (seiOkuyuki) {
    svg += '<text x="'+(ix+iw-10)+'" y="'+(iy+ih/2)+'" font-size="11" fill="#00695c" transform="rotate(90 '+(ix+iw-10)+' '+(iy+ih/2)+')" text-anchor="middle">'+seiOkuyuki+'</text>';
  }
  svg += '<text x="'+(ox+ow+8)+'" y="'+(oy+oh/2)+'" font-size="12" fill="#555" transform="rotate(90 '+(ox+ow+8)+' '+(oy+oh/2)+')" text-anchor="middle">'+(okuyuki||'')+'</text>';

  // ★2026-09-14追加★ 浴槽自体の作図。
  // 扉は下辺(手前の壁)に固定。扉のある側は人が出入りする通路として空けておく必要があるため、
  // 浴槽は必ず「扉と反対側」に配置する(扉と同じ側に浴槽があると、扉を開けた直後に
  // 浴槽の側面へ突き当たってしまい、現実の浴室として成立しない)。
  // A：浴槽は縦長(奥行き方向に伸びる)。扉が右勝手なら浴槽は左脇、扉が左勝手なら浴槽は右脇。
  // B：浴槽は横長(間口方向に伸びる)。扉から見て奥(正面の壁側)に横たわる(左右の位置は無関係)。
  // ★doorPosはこの下で定義される値と同じものを、ここで先読みして使う(扉の勝手が
  // まだ未選択の場合は便宜上「右勝手」と同じ配置=浴槽は左脇、をデフォルトにする)。
  var doorPosForTub = sc.bathDoorPosition || '';
  var tubW, tubH, tubX, tubY;
  if (swapMO) {
    // B：浴槽は横長。内箱の上端(扉から見て正面の壁側)に寄せて配置。左右位置は扉の勝手と無関係。
    tubW = iw;
    tubH = Math.min(ih * 0.55, 90);
    tubX = ix;
    tubY = iy;
  } else {
    // A：浴槽は縦長。扉と反対側の脇に寄せて配置。
    tubW = Math.min(iw * 0.55, 90);
    tubH = ih;
    tubY = iy;
    tubX = (doorPosForTub === '左') ? (ix + iw - tubW) : ix; // 扉が左→浴槽は右脇／扉が右(またはデフォルト)→浴槽は左脇
  }
  svg += '<rect x="'+tubX+'" y="'+tubY+'" width="'+tubW+'" height="'+tubH+'" rx="10" ry="10" fill="#ffffff" stroke="#004d40" stroke-width="1.5"/>';
  svg += '<text x="'+(tubX+tubW/2)+'" y="'+(tubY+tubH/2+4)+'" text-anchor="middle" font-size="11" fill="#004d40">浴槽</text>';

  // 勝手(ドアの開き)：右勝手/左勝手のどちらか一方だけ描く
  // ★2026-09-13変更★ 実際の浴室ドアは室内側(内側)に開くとのご指摘のため、
  // 蝶番(コーナー)を基点にしたシンプルな作図に描き直し、開き方向を必ず室内側(箱の内側)に収める。
  // ・「開いた状態」の線＝蝶番から室内側の壁沿いへ伸ばす(以前は箱の外側にはみ出していた)
  // ・弧の中心を蝶番に固定するため、SVGのsweep-flagを幾何計算で導出(右勝手=0／左勝手=1で中心が蝶番に一致)
  // ★2026-09-13追加★ ドアタイプ(開き戸/引き戸)、浴槽の向き(A/B)に対応。
  // 引き戸の場合は蝶番+弧ではなく、壁沿いのパネル+スライド方向の矢印で表示する。
  // ★2026-09-14確定★ 扉は常にこの下辺(手前の壁)に描く。L/Rは「扉が下辺の右端寄りか
  // 左端寄りか」だけで決まり、浴槽の向き(A/B)や位置とは無関係。
  var doorPos = sc.bathDoorPosition || '';
  var doorType = sc.bathDoorType || '開き戸';
  var abCode = sc.bathKatteAB || '';
  var lrCode = doorPos === '右' ? 'R' : (doorPos === '左' ? 'L' : '');
  var abrCode = (abCode && lrCode) ? ('　'+abCode+lrCode) : '';
  var doorY = oy + oh;
  var kaikou = numModal(sc.bathKaikou);
  var doorWidthMM = kaikou || 650;
  // 極端な入力での破綻防止のため、部屋の辺の90%を上限にクランプ(見た目の安全策であり、実寸方針は変えない)
  var doorR = Math.min(Math.max(15, doorWidthMM * outerBox.scale), ow*0.9, oh*0.9);
  // ★2026-09-13変更★ メモ開始Y座標をドアの大きさに依存させず、常に箱の下+40pxの固定位置にする
  // (以前はドアが大きいとメモが下象限にめり込んで表示崩れの原因になっていた)。
  var planNoteStartY = oy + oh + 40;
  if (doorType === '引き戸') {
    if (doorPos === '右') {
      var sPx1 = ox+ow-doorR, sPx2 = ox+ow;
      svg += '<rect x="'+sPx1+'" y="'+(doorY-5)+'" width="'+doorR+'" height="10" fill="#607d8b" stroke="#37474f" stroke-width="1.5"/>';
      svg += '<text x="'+(sPx1+doorR/2)+'" y="'+(doorY-10)+'" text-anchor="middle" font-size="14" fill="#37474f">→</text>';
      svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">右勝手(引き戸)'+abrCode+'</text>';
    } else if (doorPos === '左') {
      var sLx1 = ox, sLx2 = ox+doorR;
      svg += '<rect x="'+sLx1+'" y="'+(doorY-5)+'" width="'+doorR+'" height="10" fill="#607d8b" stroke="#37474f" stroke-width="1.5"/>';
      svg += '<text x="'+(sLx1+doorR/2)+'" y="'+(doorY-10)+'" text-anchor="middle" font-size="14" fill="#37474f">←</text>';
      svg += '<text x="5" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">左勝手(引き戸)'+abrCode+'</text>';
    } else {
      svg += '<text x="'+(ox+ow/2)+'" y="'+(doorY+16)+'" text-anchor="middle" font-size="12" fill="#aaa">(勝手未選択)</text>';
    }
  } else if (doorPos === '右') {
    var rHingeX = ox+ow, rHingeY = doorY;
    var rClosedX = rHingeX, rClosedY = rHingeY - doorR;      // 閉じた状態：右の壁沿いに上へ
    var rOpenX = rHingeX - doorR, rOpenY = rHingeY;          // 開いた状態：室内側(左)へ
    svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+rClosedX+'" y2="'+rClosedY+'" stroke="#222" stroke-width="3"/>';
    svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+rOpenX+'" y2="'+rOpenY+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+rClosedX+','+rClosedY+' A'+doorR+','+doorR+' 0 0 0 '+rOpenX+','+rOpenY+'" fill="none" stroke="#999" stroke-width="1.5"/>';
    svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">右勝手'+abrCode+'</text>';
  } else if (doorPos === '左') {
    var lHingeX = ox, lHingeY = doorY;
    var lClosedX = lHingeX, lClosedY = lHingeY - doorR;      // 閉じた状態：左の壁沿いに上へ
    var lOpenX = lHingeX + doorR, lOpenY = lHingeY;          // 開いた状態：室内側(右)へ
    svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+lClosedX+'" y2="'+lClosedY+'" stroke="#222" stroke-width="3"/>';
    svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+lOpenX+'" y2="'+lOpenY+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+lClosedX+','+lClosedY+' A'+doorR+','+doorR+' 0 0 1 '+lOpenX+','+lOpenY+'" fill="none" stroke="#999" stroke-width="1.5"/>';
    svg += '<text x="5" y="'+(doorY+18)+'" font-size="13" fill="#c0392b">左勝手'+abrCode+'</text>';
  } else {
    svg += '<text x="'+(ox+ow/2)+'" y="'+(doorY+16)+'" text-anchor="middle" font-size="12" fill="#aaa">(勝手未選択)</text>';
  }

  // ★2026-09-15確定★ 間口方向(左右)＋奥行き方向(前後)の実クリア計算。
  // 【勝手(L/R)と水栓の位置の確定ルール】
  //   ・扉は常に下辺(手前の壁)。L/Rは扉が下辺の右寄り(R)か左寄り(L)か。
  //   ・A勝手：浴槽は縦長。水栓・カウンターは扉の【正面の壁】にある
  //            → 配管突出は【奥行き方向】に効く(間口方向の左右クリアには加算しない)。
  //   ・B勝手：浴槽は横長。水栓・カウンターは【扉と左右反対側の側面壁】にある
  //            (ドアの開閉スペース確保のため必ず扉と反対側)。配管は水栓の壁の裏を通るので、
  //            配管突出は【間口方向】のうち“扉と反対側の壁”だけに加算される(非対称)。
  // 【建物寸法は入口(扉)基準・固定】建物間口(bathMaguchi)=扉のある壁の幅、
  //   建物奥行き(bathOkuyuki)=扉と垂直方向。勝手による入れ替えはしない(swapMOは製品寸法側のみ)。
  //   ※図面表示上は swap 後の maguchi/okuyuki を使うが、建物実測値としての意味は入口基準で固定。
  // 【吊元側クリア】柱(または壁)にPB→下地→枠が組まれ、その枠の位置が蝶番(吊元)の起点になる。
  //   吊元側クリア = 下地厚み + 枠厚み − (標準出寸34mm + 追加パネル厚み)
  //   ※吊元側は扉のある側なので、B勝手でも配管は来ない(水栓は反対側のため)。
  // 【戸先側クリア】建物間口 − 吊元側クリア − 製品幅。B勝手のときだけ製品幅に配管突出を加算。
  // 【奥行き方向(前後)必要寸法】扉の厚み + キープクリーンフロア余裕5mm + 製品奥行き
  //   ＋ 正面壁クリア(A勝手のときだけ配管突出を加算／B勝手は側面壁側なので加算しない)。
  //   扉の厚み＝開き戸は30mm固定、引き戸は入力値(bathHikidoAtsumi、75/100など)。
  var tsurimotoShitaji = numModal(sc.bathTsurimotoShitaji);
  var tsurimotoWaku = numModal(sc.bathTsurimotoWaku);
  var tsurimotoPanel = numModal(sc.bathTsurimotoPanel, 0);
  var haikanHoushiki = sc.bathHaikanHoushiki || '下配管';
  var jouhaikanSupace = numModal(sc.bathJouhaikanSupace, 35); // 上配管時、現場入力が無い場合の目安(30〜40の中間)
  var TSURIMOTO_STD_OFFSET = 34; // 標準出寸(パネル無しの場合)
  var plumbingAdd = (haikanHoushiki === '上配管') ? jouhaikanSupace : 18;
  // 扉の厚み：入力欄の値を優先。空のときだけ既定(開き戸30／引き戸75)。開き戸でも欄に値があればそれを使う。
  var doorThicknessRaw = numModal(sc.bathHikidoAtsumi);
  var doorThickness = (doorThicknessRaw != null) ? doorThicknessRaw : (doorType === '引き戸' ? 75 : 30);
  var KKF_MARGIN = 5; // キープクリーンフロア余裕

  // 左下に、勝手ラベルの下から順に積み上げる(文字被り防止)。勝手ラベルは上でdoorY+18に描画済み。
  // ★2026-09-15変更★ 左下象限は情報量が多いので、フォントを小さめ(11px基準)・行間も詰めて省スペース化。
  var leftY = doorY + 34;
  function pushLeftLine(text, color, size) {
    var fs = size || 11;
    wrapTextModal(text, 32).forEach(function(line){
      svg += '<text x="5" y="'+leftY+'" font-size="'+fs+'" fill="'+color+'">'+escHtmlModal(line)+'</text>';
      leftY += fs + 3;
    });
  }

  // --- 間口方向(左右)クリア ---
  if (tsurimotoShitaji != null && tsurimotoWaku != null && maguchi && seiMaguchi && (doorPos === '右' || doorPos === '左')) {
    var tsurimotoClear = tsurimotoShitaji + tsurimotoWaku - (TSURIMOTO_STD_OFFSET + tsurimotoPanel);
    var addToOpposite = (katteAB === 'B') ? plumbingAdd : 0;
    var effProductMaguchi = seiMaguchi + addToOpposite;
    var oppositeClear = maguchi - tsurimotoClear - effProductMaguchi;
    var MIN_CLEAR = 15;
    var tsurimotoNG = tsurimotoClear < 0;
    var oppositeNG = oppositeClear < MIN_CLEAR;
    var oppositeExtra = (katteAB === 'B') ? '（水栓側・配管込）' : '';
    pushLeftLine('【間口方向】', '#37474f', 11);
    pushLeftLine('　吊元側クリア：'+Math.round(tsurimotoClear)+'mm'+(tsurimotoNG?'（不足）':''), tsurimotoNG ? '#c0392b' : '#00695c', 11);
    pushLeftLine('　戸先側クリア：'+Math.round(oppositeClear)+'mm'+oppositeExtra+(oppositeNG?'（要確認）':''), oppositeNG ? '#c0392b' : '#00695c', 11);
  }

  // --- 奥行き方向(前後)必要寸法 ---
  if (seiOkuyuki && okuyuki) {
    // 扉側加算(扉厚み＋KKF余裕) ＋ 製品奥行き ＋ A勝手なら配管
    var frontPlumbing = (katteAB === 'A') ? plumbingAdd : 0;
    var okuNeed = doorThickness + KKF_MARGIN + seiOkuyuki + frontPlumbing;
    var okuClear = okuyuki - okuNeed; // 建物奥行きに対する余り
    var okuNG = okuClear < 0;
    pushLeftLine('【奥行き方向】', '#37474f', 11);
    pushLeftLine('　扉厚'+doorThickness+'＋余裕'+KKF_MARGIN+'＋製品'+seiOkuyuki+(frontPlumbing?'＋配管'+frontPlumbing:'')+'＝'+okuNeed, '#555', 10);
    pushLeftLine('　建物奥行き'+okuyuki+' − 必要'+okuNeed+' ＝ 残り'+Math.round(okuClear)+'mm'+(okuNG?'（不足）':''), okuNG ? '#c0392b' : '#00695c', 11);
  }

  // 石膏ボード・設置方法などの注記は、上のクリア表示の続き(leftY)から積む(文字被り防止)。
  var planNoteStartY2 = Math.max(planNoteStartY, leftY + 4);
  var sekkou = sc.bathSekkouBoard ? String(sc.bathSekkouBoard).split(',') : [];
  // ★2026-09-13変更★ 設置方法・枠材の厚みはドア枠(開口)の話なので、メモ欄(左下)ではなく
  // 平面図(左上)の下、ドア図形と重ならない位置(planNoteStartY)にまとめて表示する。
  var planNoteLines = [];
  if (sekkou.length) planNoteLines.push({ text: '石膏ボード：'+sekkou.join('・'), color: '#8e24aa', size: 12 });
  if (sc.bathSetchiHouhou) planNoteLines.push({ text: '設置方法：'+sc.bathSetchiHouhou, color: '#555', size: 13 });
  if (sc.bathWakuzaiAtsumi) planNoteLines.push({ text: '枠材の厚み：'+sc.bathWakuzaiAtsumi, color: '#555', size: 12 });
  var planNoteY = planNoteStartY2;
  planNoteLines.forEach(function(item){
    var fsize = item.size || 11;
    // ★2026-09-13変更★ 長文(設置方法など)が平面図の枠外にはみ出さないよう、折り返してから描画。
    wrapTextModal(item.text, 30).forEach(function(line){
      svg += '<text x="'+ix+'" y="'+planNoteY+'" font-size="'+fsize+'" fill="'+item.color+'">'+escHtmlModal(line)+'</text>';
      planNoteY += fsize + 6;
    });
    planNoteY += 3;
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

  // ★2026-09-13変更★ 各ラベルの位置が近すぎて文字が重なるケース(換気扇・クリア・ダクトなど)が
  // あったため、まず区画(色付きの帯)だけ先に描画し、ラベル文字は一旦「候補位置」を集めて
  // Y座標順に並べ替えたうえで、隣同士が最低15px以上離れるように自動でずらしてから描画する。
  var labelItems = [];

  // 床上がり
  if (agari) {
    svg += '<rect x="'+rx+'" y="'+yAgariTop+'" width="'+hBoxW+'" height="'+(baseY-yAgariTop)+'" fill="#e0e0e0" stroke="#888" stroke-width="1"/>';
    labelItems.push({ y: yAgariTop+12, text: '床上がり高さ：'+agari, color: '#666' });
  }
  // 風呂の高さ(製品)
  if (furo) {
    svg += '<rect x="'+rx+'" y="'+yFuroTop+'" width="'+hBoxW+'" height="'+(yAgariTop-yFuroTop)+'" fill="#dcecec" stroke="#00695c" stroke-width="1.3"/>';
    labelItems.push({ y: yFuroTop+12, text: '風呂の高さ：'+furo, color: '#00695c' });
  }
  // 換気扇の高さ
  if (kankisen) {
    svg += '<rect x="'+rx+'" y="'+yKankisenTop+'" width="'+hBoxW+'" height="'+(yFuroTop-yKankisenTop)+'" fill="#ffe0b2" stroke="#ef6c00" stroke-width="1.3"/>';
    labelItems.push({ y: yKankisenTop+12, text: '換気扇高さ：'+kankisen, color: '#ef6c00' });
  }
  // ★2026-09-13追加★ 排気ダクト(φ100)センター高さ：換気扇センターに接続する位置の目印として、
  // 床からの高さ(pxScale換算)に丸印＋点線を表示。
  if (duct) {
    var yDuct = baseY - duct * pxScale;
    svg += '<line x1="'+(rx-15)+'" y1="'+yDuct+'" x2="'+(rx+hBoxW+15)+'" y2="'+yDuct+'" stroke="#6a1b9a" stroke-width="1" stroke-dasharray="2,2"/>';
    svg += '<circle cx="'+(rx+hBoxW/2)+'" cy="'+yDuct+'" r="4" fill="#fff" stroke="#6a1b9a" stroke-width="1.5"/>';
    labelItems.push({ y: yDuct+4, text: '排気ダクト(φ100)：'+duct, color: '#6a1b9a' });
  }
  // 天井とのクリア
  if (clear !== null && tenjou) {
    svg += '<rect x="'+rx+'" y="'+yTenjou+'" width="'+hBoxW+'" height="'+(yKankisenTop-yTenjou)+'" fill="#fff" stroke="#c0392b" stroke-width="1" stroke-dasharray="4,3"/>';
    labelItems.push({ y: yTenjou+12, text: '天井とのクリア：'+clear, color: '#c0392b' });
  }
  // 床構成(区画ではないが、床上がりラベルと近接しやすいので同じ衝突回避の対象に含める)
  labelItems.push({ y: baseY+16, text: '床構成'+(sc.bathYukaKousei?'：'+escHtmlModal(sc.bathYukaKousei):''), color: '#555' });

  // ★2026-09-14追加★ 梁(コンクリート梁・基礎)：断面図に直接重ねて表示する。
  // 浴槽側面・カウンター面の2面×上/下。高さ(H)は天井高さ基準の縮尺で実寸描画(半透明で
  // 既存の帯の上に重ねる)、奥行き(D=壁からの突出量)はテキストで添える(断面図では
  // 奥行き方向を正確に描き分けられないため)。ラベルは既存の衝突回避リストに合流させる。
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
      // ★2026-09-14追加★ 天井とのクリア(538など)は梁を考慮しない単純計算のままなので、
      // 梁がある場所での「実際に残るクリア」を(クリア－梁の高さ)で別途計算して添える。
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

  // Y座標順に並べ替えて、隣り合うラベルの間隔が最低15pxになるよう下方向にずらす
  labelItems.sort(function(a, b){ return a.y - b.y; });
  var labelCursor = -Infinity;
  labelItems.forEach(function(item){
    item.drawY = Math.max(item.y, labelCursor + 15);
    labelCursor = item.drawY;
  });
  labelItems.forEach(function(item){
    svg += '<text x="'+labelX+'" y="'+item.drawY+'" font-size="12" fill="'+item.color+'">'+item.text+'</text>';
  });

  // 天井ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+yTenjou+'" x2="'+lineEndX+'" y2="'+yTenjou+'" stroke="#333" stroke-width="1"/>';
  svg += '<text x="'+(rx-30)+'" y="'+(yTenjou-6)+'" text-anchor="end" font-size="12" fill="#555">天井高さ'+(tenjou?'：'+tenjou:'')+'</text>';
  // 床ライン
  svg += '<line x1="'+(rx-20)+'" y1="'+baseY+'" x2="'+lineEndX+'" y2="'+baseY+'" stroke="#333" stroke-width="1"/>';

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

  // ---------- 左下：メモ・連絡事項(下段1列目:0〜col2X) ----------
  svg += '<text x="30" y="'+(MY+40)+'" font-size="13" fill="#3b6d11">メモ・連絡事項</text>';
  var memo = sc.bathMemoRenraku || '';
  var memoRawLines = memo ? String(memo).split('\n') : ['(未入力)'];
  var memoY = MY + 64;
  // ★2026-09-13変更★ 下段が3列になり幅が狭くなったため、折り返し文字数も縮小(34→26)。
  memoRawLines.forEach(function(rawLine){
    wrapTextModal(rawLine, 26).forEach(function(line){
      svg += '<text x="30" y="'+memoY+'" font-size="12" fill="#333">'+escHtmlModal(line)+'</text>';
      memoY += 16;
    });
  });
  memoY += 8;
  var extraNotes = [];
  if (sc.bathRemoconUmu) extraNotes.push('リモコン開口：'+sc.bathRemoconUmu + (sc.bathRemoconMemo?'（'+sc.bathRemoconMemo+'）':''));
  if (sc.bathHandbarHouhou) extraNotes.push('ハンドバー：'+sc.bathHandbarHouhou);
  if (sc.bathTsuriKanaguKubun || sc.bathTsuriKanaguSize) extraNotes.push('吊り金具：'+(sc.bathTsuriKanaguKubun||'?')+' / '+(sc.bathTsuriKanaguSize||'?')+' / 現地入れ'+(sc.bathTsuriKanaguGenchi||'?'));
  extraNotes.forEach(function(line){
    wrapTextModal(line, 27).forEach(function(l){
      svg += '<text x="30" y="'+memoY+'" font-size="11" fill="#666">'+escHtmlModal(l)+'</text>';
      memoY += 15;
    });
  });

  // ---------- 右下：窓位置(MX〜W) ----------
  // ★2026-09-13変更★ 梁は右上の高さ断面に重ね描きする方式に変更したため、下段は再び
  // メモ／窓の2分割(各約575px)に戻り、窓の表示スペースも元の広さに戻る。
  var col2X = MX, col2W = W - MX;
  var madoAri = sc.bathMadoAri || '';
  if (madoAri === '無') {
    svg += '<text x="'+(col2X+col2W/2)+'" y="'+(MY+90)+'" text-anchor="middle" font-size="24" font-weight="bold" fill="#999">窓なし</text>';
  } else {
    // 精度向上のため「窓がある面(正面/右面/左面)」を追加。
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
    if (!trueWallMode && madoScaleReady) {
      wallWidthMM = madoHidari + madoW + madoMigi;
      wallHeightMM = madoUe + madoH + madoShita;
    }
    var scaleReady = trueWallMode || madoScaleReady;
    var winBox = scaleReady ? fitBoxModal(wallWidthMM, wallHeightMM, 230, 230) : { w: 230, h: 230, scale: null };
    var wallW = winBox.w, wallH = winBox.h;
    var wx = col2X + (col2W - wallW)/2, wy = MY + 55;
    var winTitle = '窓位置';
    if (trueWallMode) winTitle += '（'+madoMen+'・約'+wallAreaM2+'㎡）';
    else if (!scaleReady) winTitle += '（概算配置）';
    svg += '<text x="'+(col2X+col2W/2)+'" y="'+(wy-14)+'" text-anchor="middle" font-size="13" fill="#333">'+winTitle+'</text>';
    svg += '<rect x="'+wx+'" y="'+wy+'" width="'+wallW+'" height="'+wallH+'" fill="#eef3ee" stroke="#00695c" stroke-width="1.5"/>';
    var mW, mH, mx1, my1;
    if (scaleReady) {
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
    svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2+3)+'" text-anchor="middle" font-size="10" fill="#004d40">'+(madoW||'?')+'×'+(madoH||'?')+'</text>';
    svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2+16)+'" text-anchor="middle" font-size="10" fill="#004d40">奥行D：'+(madoD!=null?madoD:'?')+'</text>';
  }

  svg += '</svg>';
  return svg;
}
