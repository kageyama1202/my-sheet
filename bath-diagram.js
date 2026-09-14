/* bath-diagram.js — 浴室現場チェックの図面SVG生成【新規分離】
   shared-modal.js内「📐 浴室図面」の「図面を表示」ボタンから、
   ensureBathDiagramLibModal()によってボタンクリック時にのみ動的読込される。
   ここに定義する関数(buildBathDiagramSVG / numModal / fitBoxModal)は
   グローバルにぶら下がり、shared-modal.js側から直接呼び出される想定。
   escHtmlModal()はshared-modal.js側にある想定(このファイルは常にshared-modal.jsの後に読み込まれる)。
   ★2026-09-13変更★ PDF化は廃止(画面表示してスクショで運用するため)。
   html2canvas/jsPDF読込用だったensurePdfLibsModal()は不要になったため削除。
*/
// VERSION: 2026-09-13-013

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
  // ★2026-09-13変更★ 下段を2分割(メモ|窓位置)から3分割(メモ|窓|梁)に変更。
  // 窓表示を右下の約1/3、コンクリート梁・基礎の表示を残りの1/3に割り当てる。
  var col2X = Math.round(W/3), col3X = Math.round(W*2/3);
  // ★2026-09-13変更★ width/heightは指定せず100%+preserveAspectRatioにして、
  // モーダルのプレビュー幅に自動で収まるようにする(スクショで全面を撮れるようにするため)。
  var svg = '<svg width="100%" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" font-family="\'Hiragino Kaku Gothic ProN\',\'Meiryo\',sans-serif" style="display:block;">';
  svg += '<rect width="'+W+'" height="'+H+'" fill="#fdfaf3"/>';
  svg += '<line x1="'+MX+'" y1="0" x2="'+MX+'" y2="'+MY+'" stroke="#c0392b" stroke-width="2"/>';
  svg += '<line x1="0" y1="'+MY+'" x2="'+W+'" y2="'+MY+'" stroke="#c0392b" stroke-width="2"/>';
  svg += '<line x1="'+col2X+'" y1="'+MY+'" x2="'+col2X+'" y2="'+H+'" stroke="#c0392b" stroke-width="2"/>';
  svg += '<line x1="'+col3X+'" y1="'+MY+'" x2="'+col3X+'" y2="'+H+'" stroke="#c0392b" stroke-width="2"/>';

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
  // ★2026-09-13追加★ 製品間口・製品奥行きが入力されていれば、内側(製品)の箱にも
  // 数値だけ(ラベル文字無し)で記入する。間口＝横方向・奥行き＝縦方向という、
  // 外枠側の間口/奥行き表示と同じ向きの慣習に合わせる。
  if (seiMaguchi) {
    svg += '<text x="'+(ix+iw/2)+'" y="'+(iy+16)+'" text-anchor="middle" font-size="11" fill="#00695c">'+seiMaguchi+'</text>';
  }
  if (seiOkuyuki) {
    svg += '<text x="'+(ix+iw-10)+'" y="'+(iy+ih/2)+'" font-size="11" fill="#00695c" transform="rotate(90 '+(ix+iw-10)+' '+(iy+ih/2)+')" text-anchor="middle">'+seiOkuyuki+'</text>';
  }
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
    svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+rClosedX+'" y2="'+rClosedY+'" stroke="#222" stroke-width="3"/>';
    svg += '<line x1="'+rHingeX+'" y1="'+rHingeY+'" x2="'+rOpenX+'" y2="'+rOpenY+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+rClosedX+','+rClosedY+' A'+doorR+','+doorR+' 0 0 0 '+rOpenX+','+rOpenY+'" fill="none" stroke="#999" stroke-width="1.5"/>';
    svg += '<text x="'+(ox+ow+10)+'" y="'+(doorY+18)+'" font-size="14" fill="#c0392b">右勝手</text>';
  } else if (doorPos === '左') {
    var lHingeX = ox, lHingeY = doorY;
    var lClosedX = lHingeX, lClosedY = lHingeY - doorR;      // 閉じた状態：左の壁沿いに上へ
    var lOpenX = lHingeX + doorR, lOpenY = lHingeY;          // 開いた状態：室内側(右)へ
    svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+lClosedX+'" y2="'+lClosedY+'" stroke="#222" stroke-width="3"/>';
    svg += '<line x1="'+lHingeX+'" y1="'+lHingeY+'" x2="'+lOpenX+'" y2="'+lOpenY+'" stroke="#222" stroke-width="2"/>';
    svg += '<path d="M'+lClosedX+','+lClosedY+' A'+doorR+','+doorR+' 0 0 1 '+lOpenX+','+lOpenY+'" fill="none" stroke="#999" stroke-width="1.5"/>';
    svg += '<text x="'+(ox-70)+'" y="'+(doorY+18)+'" font-size="14" fill="#c0392b">左勝手</text>';
  } else {
    svg += '<text x="'+(ox+ow/2)+'" y="'+(doorY+16)+'" text-anchor="middle" font-size="12" fill="#aaa">(勝手未選択)</text>';
  }

  // 石膏ボード部分：選択された壁面ごとに強調線＋ラベル
  // ★2026-09-13変更★ 石膏ボードは製品(浴槽等)の内側ではなく、間口/奥行きの
  // 実寸(外枠=部屋の壁そのもの)の端に貼られるものなので、内側の箱(ix/iy/iw/ih)ではなく
  // 外枠(ox/oy/ow/oh)を基準に描画する。
  var sekkou = sc.bathSekkouBoard ? String(sc.bathSekkouBoard).split(',') : [];
  var sekkouWalls = {
    '右': { x1: ox+ow, y1: oy, x2: ox+ow, y2: oy+oh },
    '左': { x1: ox, y1: oy, x2: ox, y2: oy+oh },
    '正面': { x1: ox, y1: oy, x2: ox+ow, y2: oy },
    'ドア横': { x1: ox, y1: oy+oh, x2: ox+ow, y2: oy+oh }
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

  // ---------- 右下・列2：窓位置(col2X〜col3X、下段の中央列) ----------
  // ★2026-09-13変更★ 下段を3列化したことで窓の表示スペースが約1/3に縮小。
  // 「窓の有無」を明示的にチェックできるようにし、無しの場合は図の代わりに
  // 「窓なし」を大きく表示する(空白のまま図が壊れて見えるのを防ぐ)。
  var col2W = col3X - col2X;
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
    // ★2026-09-13変更★ 列幅が約1/3(384px)に縮小したため、最大枠を260→180に縮小。
    var winBox = scaleReady ? fitBoxModal(wallWidthMM, wallHeightMM, 180, 180) : { w: 180, h: 180, scale: null };
    var wallW = winBox.w, wallH = winBox.h;
    var wx = col2X + (col2W - wallW)/2, wy = MY + 55;
    var winTitle = '窓位置';
    if (trueWallMode) winTitle += '（'+madoMen+'・約'+wallAreaM2+'㎡）';
    else if (!scaleReady) winTitle += '（概算配置）';
    svg += '<text x="'+(col2X+col2W/2)+'" y="'+(wy-14)+'" text-anchor="middle" font-size="12" fill="#333">'+winTitle+'</text>';
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
    svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy-2)+'" text-anchor="middle" font-size="9" fill="#004d40">'+(madoUe!=null?madoUe:'')+'</text>';
    svg += '<text x="'+(mx1+mW/2)+'" y="'+(wy+wallH+13)+'" text-anchor="middle" font-size="9" fill="#004d40">'+(madoShita!=null?madoShita:'')+'</text>';
    svg += '<text x="'+(wx-5)+'" y="'+(my1+mH/2+4)+'" text-anchor="end" font-size="9" fill="#004d40">'+(madoHidari!=null?madoHidari:'')+'</text>';
    svg += '<text x="'+(wx+wallW+5)+'" y="'+(my1+mH/2+4)+'" font-size="9" fill="#004d40">'+(madoMigi!=null?madoMigi:'')+'</text>';
    svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2+3)+'" text-anchor="middle" font-size="9" fill="#004d40">'+(madoW||'?')+'×'+(madoH||'?')+'</text>';
    svg += '<text x="'+(mx1+mW/2)+'" y="'+(my1+mH/2+15)+'" text-anchor="middle" font-size="9" fill="#004d40">奥行D：'+(madoD!=null?madoD:'?')+'</text>';
  }

  // ---------- 右下・列3：梁(コンクリート梁・基礎)(col3X〜W) ----------
  // ★2026-09-13追加★ 浴室設置部分の壁(左壁/正面/右壁)ごとに、天井側から垂れる梁(上)や
  // 床側から出っ張る基礎(下)がある場合を表示する。高さは天井高さ(tenjou)を基準にした
  // 縮尺で縦方向に実寸描画し、奥行きは数値ラベルとして添える(1つの2D図では奥行き方向を
  // 正確に描き分けられないため)。
  var col3W = W - col3X;
  var hariWalls = [
    { key: '左壁', ueT: numModal(sc.bathHariHidariUeTakasa), ueD: numModal(sc.bathHariHidariUeOkuyuki), shimoT: numModal(sc.bathHariHidariShimoTakasa), shimoD: numModal(sc.bathHariHidariShimoOkuyuki) },
    { key: '正面', ueT: numModal(sc.bathHariShoumenUeTakasa), ueD: numModal(sc.bathHariShoumenUeOkuyuki), shimoT: numModal(sc.bathHariShoumenShimoTakasa), shimoD: numModal(sc.bathHariShoumenShimoOkuyuki) },
    { key: '右壁', ueT: numModal(sc.bathHariMigiUeTakasa), ueD: numModal(sc.bathHariMigiUeOkuyuki), shimoT: numModal(sc.bathHariMigiShimoTakasa), shimoD: numModal(sc.bathHariMigiShimoOkuyuki) }
  ];
  var anyHari = hariWalls.some(function(w){ return w.ueT || w.shimoT; });
  if (!anyHari) {
    svg += '<text x="'+(col3X+col3W/2)+'" y="'+(MY+90)+'" text-anchor="middle" font-size="22" font-weight="bold" fill="#999">梁の指定なし</text>';
  } else {
    svg += '<text x="'+(col3X+col3W/2)+'" y="'+(MY+26)+'" text-anchor="middle" font-size="12" fill="#333">梁(コンクリート)</text>';
    var hariColW = col3W / 3;
    var hariAreaTop = MY + 55, hariAreaBottom = H - 40;
    var hariPanelH = hariAreaBottom - hariAreaTop;
    var hariPxScale = hariPanelH / (tenjou || 2400);
    var barW = 20;
    hariWalls.forEach(function(wall, idx){
      var panelCenterX = col3X + idx*hariColW + hariColW/2;
      svg += '<line x1="'+panelCenterX+'" y1="'+hariAreaTop+'" x2="'+panelCenterX+'" y2="'+hariAreaBottom+'" stroke="#ccc" stroke-width="1" stroke-dasharray="2,2"/>';
      svg += '<line x1="'+(panelCenterX-14)+'" y1="'+hariAreaTop+'" x2="'+(panelCenterX+14)+'" y2="'+hariAreaTop+'" stroke="#333" stroke-width="1"/>';
      svg += '<line x1="'+(panelCenterX-14)+'" y1="'+hariAreaBottom+'" x2="'+(panelCenterX+14)+'" y2="'+hariAreaBottom+'" stroke="#333" stroke-width="1"/>';
      if (wall.ueT) {
        var ueH = Math.min(hariPanelH, wall.ueT * hariPxScale);
        svg += '<rect x="'+(panelCenterX-barW/2)+'" y="'+hariAreaTop+'" width="'+barW+'" height="'+ueH+'" fill="#8d6e63" stroke="#5d4037" stroke-width="1"/>';
        svg += '<text x="'+panelCenterX+'" y="'+(hariAreaTop+ueH+13)+'" text-anchor="middle" font-size="9" fill="#5d4037">上H'+wall.ueT+(wall.ueD?'/D'+wall.ueD:'')+'</text>';
      }
      if (wall.shimoT) {
        var shimoH = Math.min(hariPanelH, wall.shimoT * hariPxScale);
        svg += '<rect x="'+(panelCenterX-barW/2)+'" y="'+(hariAreaBottom-shimoH)+'" width="'+barW+'" height="'+shimoH+'" fill="#8d6e63" stroke="#5d4037" stroke-width="1"/>';
        svg += '<text x="'+panelCenterX+'" y="'+(hariAreaBottom-shimoH-6)+'" text-anchor="middle" font-size="9" fill="#5d4037">下H'+wall.shimoT+(wall.shimoD?'/D'+wall.shimoD:'')+'</text>';
      }
      svg += '<text x="'+panelCenterX+'" y="'+(hariAreaBottom+16)+'" text-anchor="middle" font-size="10" fill="#333">'+wall.key+'</text>';
    });
  }

  svg += '</svg>';
  return svg;
}
