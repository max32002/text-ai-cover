/**
 * editor-server.js
 * 啟動一個本機 HTTP server，提供 config.json 視覺化編輯介面（含即時預覽）
 * 用法: node editor-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3737;
const CONFIG_PATH = path.join(__dirname, 'config.json');

// ── 取得系統字型清單 (Windows / macOS / Linux) ──────────────────────────────
function getSystemFonts() {
  try {
    const platform = process.platform;
    let raw = '';
    if (platform === 'win32') {
      raw = execSync(
        `powershell -NoProfile -Command "$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null; [System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }"`,
        { encoding: 'utf8', timeout: 15000 }
      );
    } else if (platform === 'darwin') {
      raw = execSync('system_profiler SPFontsDataType | grep "Full Name:" | sed "s/.*Full Name: //"', { encoding: 'utf8', timeout: 15000 });
    } else {
      raw = execSync('fc-list --format="%{family}\\n"', { encoding: 'utf8', timeout: 15000 });
    }
    return [...new Set(raw.split(/\r?\n/).map(f => f.trim()).filter(f => f.length > 0))].sort((a, b) => a.localeCompare(b));
  } catch (e) {
    console.error('字型列舉失敗:', e.message);
    return [];
  }
}

// ── HTML ────────────────────────────────────────────────────────────────────
function buildHTML(config, fonts) {
  const configStr = JSON.stringify(config, null, 2);
  const fontsJson = JSON.stringify(fonts);

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>設定編輯器 — Text AI Cover</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  :root {
    --bg:       #0d0f1a;
    --surface:  #161929;
    --surface2: #1e2236;
    --surface3: #252a42;
    --border:   #2a2f4a;
    --border2:  #363d5c;
    --accent:   #6c63ff;
    --accent2:  #a78bfa;
    --accent3:  #c4b5fd;
    --text:     #e2e8f0;
    --text2:    #a8b3cc;
    --muted:    #7a8aa8;
    --success:  #10d9a0;
    --error:    #f87171;
    --r:        10px;
    --r-sm:     6px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', 'Microsoft JhengHei', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    overflow: hidden;
    display: grid;
    grid-template-columns: 300px 1fr 440px;
    grid-template-rows: 64px 1fr;
  }

  /* ── Header ── */
  header {
    grid-column: 1 / -1;
    padding: 0 24px;
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(90deg,#12152a,#0d0f1a);
    border-bottom: 1px solid var(--border);
  }
  .logo { display: flex; align-items: center; gap: 11px; }
  .logo-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg,var(--accent),var(--accent2));
    display: flex; align-items: center; justify-content: center; font-size: 15px;
  }
  .logo-title { font-size: 15px; font-weight: 700; }
  .logo-sub   { font-size: 11px; color: var(--muted); }
  .save-btn {
    padding: 8px 20px;
    background: linear-gradient(135deg,var(--accent),#8b7af0);
    border: none; border-radius: var(--r-sm);
    color: #fff; font-size: 13px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: opacity .18s, transform .15s, box-shadow .18s;
    display: flex; align-items: center; gap: 6px;
    box-shadow: 0 2px 10px rgba(108,99,255,.4);
  }
  .save-btn:hover  { opacity:.9; transform:translateY(-1px); box-shadow:0 4px 16px rgba(108,99,255,.55); }
  .save-btn:active { transform:translateY(0); }
  .reload-btn {
    padding: 8px 15px;
    background: var(--surface2);
    border: 1px solid var(--border); border-radius: var(--r-sm);
    color: var(--text2); font-size: 13px; font-weight: 500; font-family: inherit;
    cursor: pointer; transition: all .18s;
    display: flex; align-items: center; gap: 6px;
  }
  .reload-btn:hover { background: var(--surface3); color: var(--text); border-color: var(--border2); }

  /* ── Panels ── */
  .panel {
    overflow-y: auto; height: calc(100vh - 64px);
    padding: 20px 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .panel::-webkit-scrollbar { width: 4px; }
  .panel::-webkit-scrollbar-track { background: transparent; }
  .panel::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  .font-panel   { background: var(--surface);  border-right: 1px solid var(--border); }
  .config-panel { background: var(--bg);       border-left:  1px solid var(--border); }
  .preview-panel {
    background: #0a0c15;
    display: flex; flex-direction: column; align-items: center;
    gap: 16px; overflow-y: auto; height: calc(100vh - 64px);
    padding: 24px 20px;
  }
  .preview-panel::-webkit-scrollbar { width: 4px; }
  .preview-panel::-webkit-scrollbar-track { background: transparent; }
  .preview-panel::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  /* ── Preview ── */
  .preview-title {
    font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
    text-transform: uppercase; color: var(--muted);
    align-self: flex-start;
  }
  .canvas-wrap {
    width: 100%; position: relative;
    border-radius: var(--r);
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,.6);
    border: 1px solid var(--border2);
  }
  #previewCanvas { display: block; width: 100%; height: auto; }

  .preview-bg-row {
    width: 100%;
    display: flex; align-items: center; gap: 8px;
    flex-wrap: wrap;
  }
  .preview-bg-row label { font-size: 11px; color: var(--muted); }
  .bg-btn {
    padding: 5px 12px; border-radius: var(--r-sm);
    border: 1px solid var(--border2);
    background: var(--surface2); color: var(--text2);
    font-size: 11px; cursor: pointer; transition: all .15s;
    font-family: inherit;
  }
  .bg-btn:hover, .bg-btn.active { background: var(--surface3); color: var(--text); border-color: var(--accent); }

  .download-btn {
    width: 100%;
    padding: 9px 0;
    border-radius: var(--r-sm);
    border: 1px solid var(--border2);
    background: linear-gradient(135deg, rgba(108,99,255,.12), rgba(167,139,250,.08));
    color: var(--accent3); font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all .18s; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .download-btn:hover {
    background: linear-gradient(135deg, rgba(108,99,255,.25), rgba(167,139,250,.18));
    border-color: var(--accent); color: #fff;
    box-shadow: 0 2px 12px rgba(108,99,255,.3);
    transform: translateY(-1px);
  }
  .download-btn:active { transform: translateY(0); }

  .preview-info {
    width: 100%;
    display: flex; gap: 6px;
  }
  .info-card {
    flex: 1;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r-sm); padding: 7px 10px;
    display: flex; flex-direction: column; gap: 2px; align-items: center;
  }
  .info-label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; white-space: nowrap; }
  .info-value { font-size: 13px; font-weight: 700; color: var(--accent3); font-family: 'Consolas', monospace; white-space: nowrap; }

  /* ── Font panel widgets ── */
  .font-count-row { display: flex; align-items: center; justify-content: space-between; }
  .badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(108,99,255,.15); color: var(--accent2); }
  .hint-sm { font-size: 12px; color: var(--muted); }

  .selected-box {
    background: linear-gradient(135deg,rgba(108,99,255,.07),rgba(167,139,250,.04));
    border: 1.5px solid rgba(108,99,255,.3); border-radius: var(--r);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 7px;
  }
  .selected-label  { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .8px; }
  .selected-name   { font-size: 16px; font-weight: 700; color: var(--accent3); word-break: break-all; min-height: 22px; }
  .selected-prev   { font-size: 22px; border-top: 1px solid var(--border); padding-top: 10px; transition: font-family .25s; line-height: 1.4; }
  .selected-hint   { font-size: 12px; color: var(--muted); }

  .search-wrap { position: relative; }
  .search-wrap input {
    width: 100%; padding: 8px 12px 8px 33px;
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--r-sm); color: var(--text); font-size: 13px; font-family: inherit;
    outline: none; transition: border-color .18s;
  }
  .search-wrap input:focus { border-color: var(--accent); }
  .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: .45; font-size: 13px; pointer-events: none; }

  .font-list {
    flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
    max-height: calc(100vh - 360px); padding-right: 2px;
  }
  .font-list::-webkit-scrollbar { width: 4px; }
  .font-list::-webkit-scrollbar-track { background: transparent; }
  .font-list::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

  .font-item {
    padding: 10px 12px; border-radius: var(--r-sm); cursor: pointer;
    display: flex; justify-content: space-between; align-items: center;
    transition: background .1s; border: 1px solid transparent; user-select: none;
  }
  .font-item:hover { background: var(--surface2); }
  .font-item.active { background: rgba(108,99,255,.11); border-color: rgba(108,99,255,.32); }
  .font-name       { font-size: 13px; font-weight: 500; }
  .font-preview-sm { font-size: 12px; color: var(--text2); margin-top: 3px; opacity: .85; }
  .font-check      { color: var(--accent2); font-size: 14px; flex-shrink: 0; margin-left: 8px; }

  /* ── Config form ── */
  .section-title {
    font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
    color: var(--muted); display: flex; align-items: center; gap: 8px;
  }
  .section-title::after { content:''; flex:1; height:1px; background:var(--border); }

  .field-group {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 16px 18px;
    display: flex; flex-direction: column; gap: 14px;
    transition: border-color .18s;
  }
  .field-group:focus-within { border-color: var(--border2); }

  .group-header {
    display: flex; align-items: center; gap: 8px;
    padding-bottom: 12px; border-bottom: 1px solid var(--border); margin-bottom: -2px;
  }
  .group-icon  { font-size: 16px; }
  .group-label { font-size: 14px; font-weight: 700; }
  .group-key   { font-size: 11px; font-family: 'Consolas',monospace; color: var(--muted); margin-left: auto; background: var(--surface2); padding: 3px 7px; border-radius: 4px; }

  .field-row { display: flex; flex-direction: column; gap: 6px; }
  .divider   { height: 1px; background: var(--border); margin: 2px 0; }

  .field-label { font-size: 13px; font-weight: 600; color: var(--text2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .field-label .zh  { color: var(--text); }
  .field-label .key { font-size: 11px; font-family: 'Consolas',monospace; color: var(--muted); background: var(--surface3); padding: 2px 6px; border-radius: 3px; }
  .field-hint { font-size: 12px; color: var(--muted); line-height: 1.6; }

  .field-input {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--r-sm); color: var(--text); font-size: 14px;
    padding: 8px 11px; outline: none; transition: border-color .18s, background .18s;
    width: 100%; font-family: inherit;
  }
  .field-input:focus { border-color: var(--accent); background: var(--surface3); }
  select.field-input { cursor: pointer; }
  select.field-input option { background: var(--surface2); }

  /* slider */
  .slider-row { display: grid; grid-template-columns: 1fr 68px; gap: 8px; align-items: center; }
  input[type="range"] {
    -webkit-appearance: none; width: 100%; height: 5px;
    background: var(--surface3); border-radius: 99px; outline: none; cursor: pointer;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
    background: var(--accent); cursor: pointer; box-shadow: 0 0 6px rgba(108,99,255,.6);
    transition: transform .15s;
  }
  input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.2); }
  .slider-row input[type="number"] {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--r-sm); color: var(--text); font-size: 13px;
    padding: 7px 4px; text-align: center; outline: none; width: 100%;
    font-family: 'Consolas',monospace; transition: border-color .18s;
  }
  .slider-row input[type="number"]:focus { border-color: var(--accent); }

  /* color */
  .color-row { display: grid; grid-template-columns: 32px 1fr; gap: 8px; align-items: center; }
  input[type="color"] {
    -webkit-appearance: none; width: 32px; height: 32px;
    border: 1.5px solid var(--border2); border-radius: var(--r-sm);
    background: none; cursor: pointer; padding: 2px; transition: border-color .18s;
  }
  input[type="color"]:hover { border-color: var(--accent); }

  /* toggle */
  .toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .toggle-info  { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .toggle-wrap  { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .toggle {
    -webkit-appearance: none; width: 38px; height: 21px;
    background: var(--surface3); border: 1.5px solid var(--border2);
    border-radius: 999px; cursor: pointer; position: relative;
    transition: background .2s, border-color .2s; flex-shrink: 0;
  }
  .toggle:checked { background: var(--accent); border-color: var(--accent); }
  .toggle::after {
    content:''; position: absolute; width: 14px; height: 14px;
    background: #fff; border-radius: 50%; top: 2px; left: 2px;
    transition: left .18s; box-shadow: 0 1px 4px rgba(0,0,0,.4);
  }
  .toggle:checked::after { left: 18px; }
  .toggle-state { font-size: 13px; color: var(--text2); min-width: 30px; text-align: center; font-weight: 500; }

  /* fontFamily display */
  .ff-display {
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: var(--r-sm); padding: 9px 11px; line-height: 2;
  }
  .ff-item {
    display: inline-block;
    background: rgba(108,99,255,.1); border: 1px solid rgba(108,99,255,.18);
    border-radius: 4px; padding: 1px 7px; margin: 1px 3px 1px 0;
    font-size: 11px; color: var(--accent3); font-family: 'Consolas',monospace;
  }
  .ff-item.primary { background: rgba(108,99,255,.22); border-color: rgba(108,99,255,.45); color: #fff; font-weight: 600; }

  /* toast */
  #toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--success); color: #052719;
    padding: 10px 24px; border-radius: 100px;
    font-weight: 700; font-size: 14px;
    opacity: 0; transition: opacity .3s, transform .3s;
    pointer-events: none; z-index: 999;
  }
  #toast.show  { opacity: 1; transform: translateX(-50%) translateY(0); }
  #toast.error { background: var(--error); color: #fff; }

  /* ── Light theme ── */
  body.light {
    --bg:       #f0f2f8;
    --surface:  #ffffff;
    --surface2: #e8eaf2;
    --surface3: #dde0ed;
    --border:   #cdd1e3;
    --border2:  #b8bdd4;
    --text:     #1a1d2e;
    --text2:    #4a5272;
    --muted:    #7278a0;
  }
  body.light header {
    background: linear-gradient(90deg,#e8eaf2,#f0f2f8);
  }
  body.light .preview-panel {
    background: #e4e6f0;
  }
  body.light .config-panel {
    background: #eceef6;
  }

  /* theme-btn */
  .theme-btn {
    padding: 8px 14px;
    background: var(--surface2);
    border: 1px solid var(--border); border-radius: var(--r-sm);
    color: var(--text2); font-size: 14px; font-family: inherit;
    cursor: pointer; transition: all .18s; line-height: 1;
    display: flex; align-items: center; gap: 6px;
  }
  .theme-btn:hover { background: var(--surface3); color: var(--text); border-color: var(--border2); }
</style>
</head>
<body>

<!-- Header -->
<header>
  <div class="logo">
    <div class="logo-icon">🎨</div>
    <div>
      <div class="logo-title">Text AI Cover</div>
      <div class="logo-sub">視覺化設定編輯器</div>
    </div>
  </div>
  <div class="header-actions" style="display:flex;gap:10px">
    <button class="theme-btn" id="theme-toggle-btn" onclick="toggleTheme()">☀️ 淺色模式</button>
    <button class="reload-btn" onclick="reloadConfig()">⏳ 重設設定</button>
    <button class="save-btn" onclick="saveConfig()">💾 儲存 config.json</button>
  </div>
</header>

<!-- ══ LEFT: Font Picker ══ -->
<div class="panel font-panel">
  <div class="font-count-row">
    <span class="section-title" style="flex:1">🔤 系統字型</span>
  </div>
  <div class="font-count-row">
    <span class="hint-sm">點選字型立即更新預覽</span>
    <span class="badge" id="font-count">載入中…</span>
  </div>

  <div class="selected-box">
    <div class="selected-label">目前選取的字型</div>
    <div class="selected-name" id="selected-name">（尚未選取）</div>
    <div class="selected-prev" id="selected-preview">封面標題 Abc 123</div>
    <div class="selected-hint">✦ 選取後覆蓋優先字型第一項</div>
  </div>

  <div class="search-wrap">
    <span class="search-icon">🔍</span>
    <input type="text" id="font-search" placeholder="搜尋字型名稱…" oninput="filterFonts()" autocomplete="off" />
  </div>

  <div class="font-list" id="font-list">
    <div style="color:var(--muted);padding:20px;text-align:center;font-size:13px">⏳ 載入中…</div>
  </div>
</div>

<!-- ══ MIDDLE: Preview ══ -->
<div class="preview-panel">
  <div class="preview-title">👁 即時預覽</div>

  <div class="canvas-wrap">
    <canvas id="previewCanvas" width="1200" height="675"></canvas>
  </div>

  <div class="preview-bg-row">
    <label>背景:</label>
    <button class="bg-btn active" onclick="setBg('dark')"    id="bg-dark">🌑 深色</button>
    <button class="bg-btn"        onclick="setBg('light')"   id="bg-light">☀️ 淺色</button>
    <button class="bg-btn"        onclick="setBg('blue')"    id="bg-blue">🌊 藍調</button>
    <button class="bg-btn"        onclick="setBg('forest')"  id="bg-forest">🌿 森林</button>
    <button class="bg-btn"        onclick="setBg('sunset')"  id="bg-sunset">🌅 落日</button>
    <button class="bg-btn"        onclick="setBg('raw')"     id="bg-raw" style="display:none">🖼️ 預覽圖片</button>
  </div>

  <button class="download-btn" onclick="downloadPreview()" id="btn-download">
    ⬇️ 下載預覽圖
  </button>

  <div class="preview-info">
    <div class="info-card">
      <div class="info-label">字級（px）</div>
      <div class="info-value" id="info-fontSize">—</div>
    </div>
    <div class="info-card">
      <div class="info-label">行數</div>
      <div class="info-value" id="info-lines">—</div>
    </div>
    <div class="info-card">
      <div class="info-label">邊距（px）</div>
      <div class="info-value" id="info-padding">—</div>
    </div>
    <div class="info-card">
      <div class="info-label">浮水印</div>
      <div class="info-value" id="info-wm">—</div>
    </div>
  </div>
</div>

<!-- ══ RIGHT: Config ══ -->
<div class="panel config-panel">

  <!-- fontFamily -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">🔤</span>
      <span class="group-label">字型優先順序</span>
      <span class="group-key">fontFamily</span>
    </div>
    <div class="field-row">
      <div class="field-label"><span class="zh">目前字型清單</span><span class="key">fontFamily[ ]</span></div>
      <div class="ff-display" id="ff-display"></div>
      <div class="field-hint">✦ ★ 為優先字型，其餘依序備用。從左側選取後點「儲存」更新第一項。</div>
    </div>
  </div>

  <!-- Title & Align -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">📝</span><span class="group-label">標題文字</span><span class="group-key">title / align</span>
    </div>
    <div class="field-row">
      <div class="field-label"><span class="zh">標題內容</span><span class="key">title</span></div>
      <input class="field-input" id="f-title" type="text" placeholder="輸入欲疊加的標題文字…" oninput="schedulePreview()" />
      <div class="field-hint">✦ 超過每行最大字元數時自動換行</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">對齊方式</span><span class="key">align</span></div>
      <select class="field-input" id="f-align" onchange="schedulePreview()">
        <option value="center">置中對齊（center）</option>
        <option value="left">靠左對齊（left）</option>
        <option value="right">靠右對齊（right）</option>
      </select>
    </div>
  </div>

  <!-- Layout -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">📐</span><span class="group-label">版面排版</span><span class="group-key">layout</span>
    </div>
    <div class="field-row">
      <div class="field-label"><span class="zh">每行最大字元數</span><span class="key">maxCharsPerLine</span></div>
      <div class="slider-row">
        <input type="range"  id="f-maxChars-s" min="5" max="40" step="1"    oninput="syncVal('f-maxChars',this.value);schedulePreview()" />
        <input type="number" id="f-maxChars"   min="5" max="40" step="1"    oninput="syncVal('f-maxChars-s',this.value);schedulePreview()" />
      </div>
      <div class="field-hint">✦ 中文字計 1，ASCII 計 0.55</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">字級比例</span><span class="key">fontSizeRatio</span></div>
      <div class="slider-row">
        <input type="range"  id="f-fsr-s" min="0.02" max="0.15" step="0.001" oninput="syncVal('f-fsr',this.value);schedulePreview()" />
        <input type="number" id="f-fsr"   min="0.02" max="0.15" step="0.001" oninput="syncVal('f-fsr-s',this.value);schedulePreview()" />
      </div>
      <div class="field-hint">✦ 字級 = 圖片寬 × 比例（建議 0.04～0.08）</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">邊距比例</span><span class="key">paddingRatio</span></div>
      <div class="slider-row">
        <input type="range"  id="f-pr-s" min="0.01" max="0.2" step="0.001" oninput="syncVal('f-pr',this.value);schedulePreview()" />
        <input type="number" id="f-pr"   min="0.01" max="0.2" step="0.001" oninput="syncVal('f-pr-s',this.value);schedulePreview()" />
      </div>
      <div class="field-hint">✦ 邊距 = 圖片寬 × 比例（建議 0.04～0.10）</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">粗體文字</span><span class="key">bold</span></div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-bold" onchange="syncToggle('f-bold','boldLabel','開','關');schedulePreview()" />
          <span class="toggle-state" id="boldLabel">關</span>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">斜體文字</span><span class="key">italic</span></div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-italic" onchange="syncToggle('f-italic','italicLabel','開','關');schedulePreview()" />
          <span class="toggle-state" id="italicLabel">關</span>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">文字陰影</span><span class="key">shadowEnable</span></div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-shadowEnable" onchange="syncToggle('f-shadowEnable','shadowLabel','開','關');schedulePreview()" />
          <span class="toggle-state" id="shadowLabel">開</span>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">陰影偏移</span><span class="key">shadowOffset</span></div>
      <div class="slider-row">
        <input type="range"  id="f-shOff-s" min="0" max="20" step="1" oninput="syncVal('f-shOff',this.value);schedulePreview()" />
        <input type="number" id="f-shOff"   min="0" max="20" step="1" oninput="syncVal('f-shOff-s',this.value);schedulePreview()" />
      </div>
    </div>
  </div>

  <!-- Title Background -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">🖼️</span><span class="group-label">標題背景</span><span class="group-key">titleBackground</span>
    </div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">啟用標題背景</span><span class="key">titleBgEnable</span></div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-bgEnable" onchange="syncToggle('f-bgEnable','bgEnableLabel','開','關');schedulePreview()" />
          <span class="toggle-state" id="bgEnableLabel">關</span>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">背景顏色</span><span class="key">titleBgColor</span></div>
      <div class="color-row">
        <input type="color" id="f-bgcPicker" oninput="v('f-bgc').value=this.value;schedulePreview()" />
        <input class="field-input" id="f-bgc" type="text" placeholder="rgba(0,0,0,0.5)" oninput="syncColorPicker('f-bgcPicker',this.value);schedulePreview()" />
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">背景內距比例</span><span class="key">titleBgPaddingRatio</span></div>
      <div class="slider-row">
        <input type="range"  id="f-bgp-s" min="0" max="1" step="0.01" oninput="syncVal('f-bgp',this.value);schedulePreview()" />
        <input type="number" id="f-bgp"   min="0" max="1" step="0.01" oninput="syncVal('f-bgp-s',this.value);schedulePreview()" />
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">背景圓角</span><span class="key">titleBgRadius</span></div>
      <div class="slider-row">
        <input type="range"  id="f-bgr-s" min="0" max="50" step="1" oninput="syncVal('f-bgr',this.value);schedulePreview()" />
        <input type="number" id="f-bgr"   min="0" max="50" step="1" oninput="syncVal('f-bgr-s',this.value);schedulePreview()" />
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">背景透明度</span><span class="key">titleBgOpacity</span></div>
      <div class="slider-row">
        <input type="range"  id="f-bgo-s" min="0" max="1" step="0.01" oninput="syncVal('f-bgo',this.value);schedulePreview()" />
        <input type="number" id="f-bgo"   min="0" max="1" step="0.01" oninput="syncVal('f-bgo-s',this.value);schedulePreview()" />
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">背景垂直微調</span><span class="key">titleBgOffsetYRatio</span></div>
      <div class="slider-row">
        <input type="range"  id="f-bgoy-s" min="-0.2" max="0.2" step="0.001" oninput="syncVal('f-bgoy',this.value);schedulePreview()" />
        <input type="number" id="f-bgoy"   min="-0.2" max="0.2" step="0.001" oninput="syncVal('f-bgoy-s',this.value);schedulePreview()" />
      </div>
      <div class="field-hint">✦ 正值背景向上、負值向下</div>
    </div>
  </div>

  <!-- Colors -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">🎨</span><span class="group-label">顏色設定</span><span class="group-key">customColors</span>
    </div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">自動偵測亮度</span><span class="key">useAutoLuminance</span></div>
          <div class="field-hint">✦ 依背景亮度自動切換深/淺色文字</div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-autoLum" onchange="syncToggle('f-autoLum','autoLumLabel','開','關');schedulePreview()" />
          <span class="toggle-state" id="autoLumLabel">開</span>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">強制文字顏色</span><span class="key">forceTextColor</span></div>
      <div class="color-row">
        <input type="color" id="f-tcPicker" oninput="document.getElementById('f-tc').value=this.value;schedulePreview()" />
        <input class="field-input" id="f-tc" type="text" placeholder="#ffffff" oninput="syncColorPicker('f-tcPicker',this.value);schedulePreview()" />
      </div>
      <div class="field-hint">✦ 停用自動亮度時生效</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">強制陰影顏色</span><span class="key">forceShadowColor</span></div>
      <input class="field-input" id="f-sc" type="text" placeholder="rgba(0,0,0,0.5)" oninput="schedulePreview()" />
    </div>
  </div>

  <!-- Watermark -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">💧</span><span class="group-label">浮水印</span><span class="group-key">watermark</span>
    </div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">啟用浮水印</span><span class="key">enable</span></div>
          <div class="field-hint">✦ 在圖片角落疊加半透明版權文字</div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-wmEnable" onchange="syncToggle('f-wmEnable','wmEnableLabel','開','關');schedulePreview()" />
          <span class="toggle-state" id="wmEnableLabel">開</span>
        </div>
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">浮水印文字</span><span class="key">text</span></div>
      <input class="field-input" id="f-wmText" type="text" placeholder="例：Max的每一天" oninput="schedulePreview()" />
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">字級比例</span><span class="key">fontSizeRatio</span></div>
      <div class="slider-row">
        <input type="range"  id="f-wmFs-s" min="0.005" max="0.05" step="0.001" oninput="syncVal('f-wmFs',this.value);schedulePreview()" />
        <input type="number" id="f-wmFs"   min="0.005" max="0.05" step="0.001" oninput="syncVal('f-wmFs-s',this.value);schedulePreview()" />
      </div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">透明度</span><span class="key">opacity</span></div>
      <div class="slider-row">
        <input type="range"  id="f-wmOp-s" min="0" max="1" step="0.01" oninput="syncVal('f-wmOp',this.value);schedulePreview()" />
        <input type="number" id="f-wmOp"   min="0" max="1" step="0.01" oninput="syncVal('f-wmOp-s',this.value);schedulePreview()" />
      </div>
      <div class="field-hint">✦ 0 = 完全透明，1 = 完全不透明</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">垂直位置（從底部算起比例）</span><span class="key">bottomRatio</span></div>
      <div class="slider-row">
        <input type="range"  id="f-wmBt-s" min="0" max="1" step="0.01" oninput="syncVal('f-wmBt',this.value);schedulePreview()" />
        <input type="number" id="f-wmBt"   min="0" max="1" step="0.01" oninput="syncVal('f-wmBt-s',this.value);schedulePreview()" />
      </div>
      <div class="field-hint">✦ 0.9 = 距圖片頂端 10% 處</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">靠右對齊</span><span class="key">position.right</span></div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-wmRight" onchange="syncToggle('f-wmRight','wmRightLabel','靠右','靠左');schedulePreview()" />
          <span class="toggle-state" id="wmRightLabel">靠右</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Output Format -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">🖼️</span><span class="group-label">輸出格式</span><span class="group-key">forceJpg</span>
    </div>
    <div class="field-row">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="field-label"><span class="zh">強制轉換為 JPG 格式</span><span class="key">forceJpg</span></div>
          <div class="field-hint">✦ 啟用後所有輸出圖片統一轉為 .jpg，停用則保留原始格式</div>
        </div>
        <div class="toggle-wrap">
          <input class="toggle" type="checkbox" id="f-forceJpg" onchange="syncToggle('f-forceJpg','forceJpgLabel','強制 JPG','原始格式')" />
          <span class="toggle-state" id="forceJpgLabel">強制 JPG</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Paths -->
  <div class="field-group">
    <div class="group-header">
      <span class="group-icon">📁</span><span class="group-label">資料夾路徑</span><span class="group-key">paths</span>
    </div>
    <div class="field-row">
      <div class="field-label"><span class="zh">原始圖片來源</span><span class="key">inputDir</span></div>
      <input class="field-input" id="f-inputDir" type="text" placeholder="./raw_images" />
      <div class="field-hint">✦ 掃描此資料夾內所有 jpg / png / webp</div>
    </div>
    <div class="divider"></div>
    <div class="field-row">
      <div class="field-label"><span class="zh">輸出目標資料夾</span><span class="key">outputDir</span></div>
      <input class="field-input" id="f-outputDir" type="text" placeholder="./final_posts" />
      <div class="field-hint">✦ 輸出檔名加 covered_ 前綴，不存在自動建立</div>
    </div>
  </div>

  <div style="height:6px"></div>
</div>

<div id="toast"></div>

<script>
// ══════════════════════════════════════════════════════════════════════════════
//  State
// ══════════════════════════════════════════════════════════════════════════════
let config     = ${configStr};
let allFonts   = ${fontsJson};
let selectedFont = null;
let currentBg  = 'dark';
let previewTimer = null;
let rawImgCache  = null;
let isRawImgLoading = false;

// ══════════════════════════════════════════════════════════════════════════════
//  Tiny helpers
// ══════════════════════════════════════════════════════════════════════════════
function syncVal(id, v) { const e = document.getElementById(id); if (e) e.value = v; }
function syncColorPicker(id, hex) { if (/^#[0-9a-fA-F]{6}$/.test(hex)) { const e = document.getElementById(id); if (e) e.value = hex; } }

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('theme-toggle-btn').textContent = isLight ? '🌑 深色模式' : '☀️ 淺色模式';
}
function syncToggle(id, labelId, on, off) {
  document.getElementById(labelId).textContent = document.getElementById(id).checked ? on : off;
}
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 120);
}
function v(id) { return document.getElementById(id); }

// ══════════════════════════════════════════════════════════════════════════════
//  Init
// ══════════════════════════════════════════════════════════════════════════════
function init() {
  populateFields();
  renderFontList(allFonts);
  v('font-count').textContent = allFonts.length + ' 個字型';

  // 客戶端偵測是否有原始圖片（不依賴伺服器變數）
  fetch('/preview-image', { method: 'HEAD' })
    .then(r => {
      if (r.ok) {
        v('bg-raw').style.display = 'inline-block';
        setBg('raw');
      } else {
        renderPreview();
      }
    })
    .catch(() => renderPreview());
}

function populateFields() {
  v('f-title').value    = config.title  || '';
  v('f-align').value    = config.align  || 'center';

  const mc = config.layout?.maxCharsPerLine ?? 15;
  syncVal('f-maxChars', mc); syncVal('f-maxChars-s', mc);

  const fsr = config.layout?.fontSizeRatio ?? 0.055;
  syncVal('f-fsr', fsr); syncVal('f-fsr-s', fsr);

  const pr = config.layout?.paddingRatio ?? 0.06;
  syncVal('f-pr', pr); syncVal('f-pr-s', pr);

  v('f-bold').checked   = config.layout?.bold   ?? false;
  v('f-italic').checked = config.layout?.italic ?? false;
  v('f-shadowEnable').checked = config.layout?.shadowEnable ?? true;
  syncToggle('f-bold',   'boldLabel',   '開', '關');
  syncToggle('f-italic', 'italicLabel', '開', '關');
  syncToggle('f-shadowEnable', 'shadowLabel', '開', '關');

  syncVal('f-shOff',   config.layout?.shadowOffset ?? 2);
  syncVal('f-shOff-s', config.layout?.shadowOffset ?? 2);

  v('f-bgEnable').checked = config.layout?.titleBgEnable ?? false;
  syncToggle('f-bgEnable', 'bgEnableLabel', '開', '關');

  const bgc = config.layout?.titleBgColor || 'rgba(0,0,0,0.5)';
  v('f-bgc').value = bgc; 
  if (/^#[0-9a-fA-F]{6}$/.test(bgc)) v('f-bgcPicker').value = bgc;
  
  const bgp = config.layout?.titleBgPaddingRatio ?? 0.2;
  syncVal('f-bgp', bgp); syncVal('f-bgp-s', bgp);
  
  const bgr = config.layout?.titleBgRadius ?? 8;
  syncVal('f-bgr', bgr); syncVal('f-bgr-s', bgr);

  const bgo = config.layout?.titleBgOpacity ?? 0.5;
  syncVal('f-bgo', bgo); syncVal('f-bgo-s', bgo);

  const bgoy = config.layout?.titleBgOffsetYRatio ?? 0.0;
  syncVal('f-bgoy', bgoy); syncVal('f-bgoy-s', bgoy);

  const autoLum = config.customColors?.useAutoLuminance ?? true;
  v('f-autoLum').checked = autoLum;
  syncToggle('f-autoLum','autoLumLabel','開','關');

  const tc = config.customColors?.forceTextColor || '#ffffff';
  v('f-tc').value = tc;
  if (/^#[0-9a-fA-F]{6}$/.test(tc)) v('f-tcPicker').value = tc;

  v('f-sc').value = config.customColors?.forceShadowColor || 'rgba(0,0,0,0.5)';

  v('f-wmEnable').checked = config.watermark?.enable ?? true;
  syncToggle('f-wmEnable','wmEnableLabel','開','關');
  v('f-wmText').value = config.watermark?.text || '';

  const wmFs = config.watermark?.fontSizeRatio ?? 0.01;
  syncVal('f-wmFs', wmFs); syncVal('f-wmFs-s', wmFs);

  const wmOp = config.watermark?.opacity ?? 0.1;
  syncVal('f-wmOp', wmOp); syncVal('f-wmOp-s', wmOp);

  const wmBt = config.watermark?.position?.bottomRatio ?? 0.9;
  syncVal('f-wmBt', wmBt); syncVal('f-wmBt-s', wmBt);

  v('f-wmRight').checked = config.watermark?.position?.right ?? true;
  syncToggle('f-wmRight','wmRightLabel','靠右','靠左');

  v('f-inputDir').value  = config.paths?.inputDir  || './raw_images';
  v('f-outputDir').value = config.paths?.outputDir || './final_posts';

  v('f-forceJpg').checked = config.forceJpg ?? true;
  syncToggle('f-forceJpg', 'forceJpgLabel', '強制 JPG', '原始格式');

  updateFFDisplay();
}

function updateFFDisplay() {
  const ff  = config.fontFamily;
  const arr = Array.isArray(ff) ? ff : [ff];
  v('ff-display').innerHTML = arr.map((f, i) =>
    \`<span class="ff-item \${i===0?'primary':''}">\${i===0?'★ ':''}\${f}</span>\`
  ).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
//  Background presets
// ══════════════════════════════════════════════════════════════════════════════
const BG_PRESETS = {
  dark:   [['#0d0d14','#232338'],['#232338','#0d0d14']],
  light:  [['#e8eaf0','#c5c8d8'],['#c5c8d8','#e8eaf0']],
  blue:   [['#0a1628','#1a3a5c'],['#1a3a5c','#0a1628']],
  forest: [['#0a1f0f','#1a3d22'],['#1a3d22','#0a1f0f']],
  sunset: [['#1a0a05','#3d1a10'],['#3d1a10','#1a0a05']],
};

function setBg(name) {
  currentBg = name;
  document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
  v('bg-' + name)?.classList.add('active');
  if (name === 'raw' && !rawImgCache) {
    loadRawImage();
  } else {
    renderPreview();
  }
}

function loadRawImage() {
  if (isRawImgLoading) return;
  isRawImgLoading = true;
  const img = new Image();
  img.src = '/preview-image?t=' + Date.now();
  img.onload = () => { rawImgCache = img; isRawImgLoading = false; renderPreview(); };
  img.onerror = () => { isRawImgLoading = false; showToast('❌ 無法載入原始圖片', true); setBg('dark'); };
}

function downloadPreview() {
  const canvas = v('previewCanvas');
  const title  = (v('f-title').value || 'preview').replace(/[\\/:*?"<>|]/g, '_').trim() || 'preview';
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = title + '.png';
  a.click();
  showToast('✅ 圖片已下載！', false);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Text wrap (mirrors add-text.js logic)
// ══════════════════════════════════════════════════════════════════════════════
function wrapText(text, maxCharsPerLine) {
  const lines = [];
  let cur = '', curW = 0;
  for (const ch of text) {
    const w = /^[\\x00-\\x7F]$/.test(ch) ? 0.55 : 1;
    if (curW + w > maxCharsPerLine) { lines.push(cur); cur = ch; curW = w; }
    else { cur += ch; curW += w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Canvas preview  (mirrors the full SVG compositing logic of add-text.js)
// ══════════════════════════════════════════════════════════════════════════════
function renderPreview() {
  const canvas = v('previewCanvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // ── read current form values ──────────────────────────────────────────────
  const title       = v('f-title').value  || '（無標題）';
  const align       = v('f-align').value  || 'center';
  const maxChars    = parseFloat(v('f-maxChars').value) || 15;
  const fsRatio     = parseFloat(v('f-fsr').value)  || 0.055;
  const padRatio    = parseFloat(v('f-pr').value)   || 0.06;
  const isBold      = v('f-bold').checked;
  const isItalic    = v('f-italic').checked;
  const shadowEnable = v('f-shadowEnable').checked;
  const shadowOffset = parseFloat(v('f-shOff').value) || 0;
  const autoLum     = v('f-autoLum').checked;
  
  const titleBgEnable  = v('f-bgEnable').checked;
  const titleBgColor   = v('f-bgc').value || 'rgba(0,0,0,0.5)';
  const titleBgPadRatio = parseFloat(v('f-bgp').value) || 0;
  const titleBgRadius  = parseFloat(v('f-bgr').value) || 0;
  const titleBgOpacity = parseFloat(v('f-bgo').value) || 0;
  const titleBgOffsetY = parseFloat(v('f-bgoy').value) || 0;
  const forceTC     = v('f-tc').value     || '#ffffff';
  const forceSC     = v('f-sc').value     || 'rgba(0,0,0,0.5)';
  const wmEnable    = v('f-wmEnable').checked;
  const wmText      = v('f-wmText').value || '';
  const wmFsRatio   = parseFloat(v('f-wmFs').value) || 0.01;
  const wmOpacity   = parseFloat(v('f-wmOp').value) || 0.1;
  const wmBottomRat = parseFloat(v('f-wmBt').value) || 0.9;
  const wmRight     = v('f-wmRight').checked;

  const fontFamily  = Array.isArray(config.fontFamily) ? config.fontFamily : [config.fontFamily];
  const fontStack   = fontFamily.map(f => '"'+f+'"').join(', ') + ', Microsoft JhengHei, sans-serif';

  // ── derived values ────────────────────────────────────────────────────────
  const fontSize   = Math.floor(W * fsRatio);
  const padding    = Math.floor(W * padRatio);
  const lineHeight = fontSize * 1.4;
  const lines      = wrapText(title, maxChars);

  // ── determine isDark from background preset ───────────────────────────────
  const isDark = (currentBg !== 'light');

  let textColor, shadowColor, gradColor, gradOpacity;
  if (autoLum) {
    gradColor   = isDark ? 'black'  : 'white';
    gradOpacity = isDark ? 0.7      : 0.8;
    textColor   = isDark ? '#ffffff': '#222222';
    shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
  } else {
    gradColor   = 'black';
    gradOpacity = 0.6;
    textColor   = forceTC;
    shadowColor = forceSC;
  }

  // ── 1. Background ─────────────────────────────────────────────────────────
  if (currentBg === 'raw' && rawImgCache) {
    const ia = rawImgCache.width / rawImgCache.height, ca = W / H;
    let dw, dh, dx, dy;
    if (ia > ca) { dh = H; dw = H * ia; dx = (W - dw) / 2; dy = 0; }
    else         { dw = W; dh = W / ia; dx = 0; dy = (H - dh) / 2; }
    ctx.drawImage(rawImgCache, dx, dy, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, W, H);
  } else {
    const stops = BG_PRESETS[currentBg] || BG_PRESETS.dark;
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, stops[0][0]);
    bgGrad.addColorStop(1, stops[0][1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // subtle noise dots for texture
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();

  // ── 2. Gradient overlay (bottom 40%) ─────────────────────────────────────
  const gradY  = H * 0.6;
  const overlay = ctx.createLinearGradient(0, gradY, 0, H);
  overlay.addColorStop(0,   \`\${gradColor === 'black' ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)'}\`);
  overlay.addColorStop(1,   gradColor === 'black'
    ? \`rgba(0,0,0,\${gradOpacity})\`
    : \`rgba(255,255,255,\${gradOpacity})\`);
  ctx.fillStyle = overlay;
  ctx.fillRect(0, gradY, W, H - gradY);

  // ── 3. Alignment & Font ──────────────────────────────────────────────────
  let xPos;
  if (align === 'center')      { ctx.textAlign = 'center'; xPos = W / 2; }
  else if (align === 'right')  { ctx.textAlign = 'right';  xPos = W - padding; }
  else                         { ctx.textAlign = 'left';   xPos = padding; }

  const fontStyle = isItalic ? 'italic ' : '';
  const fontWeight = isBold ? 'bold ' : '';
  ctx.font = fontStyle + fontWeight + fontSize + "px " + fontStack;
  ctx.textBaseline = 'alphabetic';

  // ── 4. Title Background Rects ─────────────────────────────────────────────
  const bgPadding = fontSize * titleBgPadRatio;

  if (titleBgEnable) {
    ctx.save();
    ctx.globalAlpha = titleBgOpacity;
    ctx.fillStyle = titleBgColor;
    lines.forEach((line, i) => {
      const lineW = ctx.measureText(line).width;
      const rectW = lineW + bgPadding * 2;
      const rectH = fontSize * 1.35 + bgPadding * 2;
      
      let rectX;
      if (align === 'center')      rectX = W/2 - lineW/2 - bgPadding;
      else if (align === 'right')  rectX = W - padding - lineW - bgPadding;
      else                         rectX = padding - bgPadding;
      
      const yPos = H - padding - (lines.length - 1 - i) * lineHeight;
      const rectY = yPos - fontSize * (1.07 + titleBgOffsetY) - bgPadding;
      
      // Draw rounded rect
      ctx.beginPath();
      ctx.roundRect(rectX, rectY, rectW, rectH, titleBgRadius);
      ctx.fill();
    });
    ctx.restore();
  }

  // ── 5. Title text ─────────────────────────────────────────────────────────
  lines.forEach((line, i) => {
    const yPos = H - padding - (lines.length - 1 - i) * lineHeight;
    // shadow
    if (shadowEnable) {
      ctx.fillStyle = shadowColor;
      ctx.fillText(line, xPos + shadowOffset, yPos + shadowOffset);
    }
    // main
    ctx.fillStyle = textColor;
    ctx.fillText(line, xPos, yPos);
  });

  // ── 4. Watermark ─────────────────────────────────────────────────────────
  if (wmEnable && wmText) {
    const wmFontSize = Math.floor(W * wmFsRatio);
    const wmX        = wmRight ? W - padding : padding;
    const wmY        = H - H * wmBottomRat;
    ctx.font         = \`\${wmFontSize}px \${fontStack}\`;
    ctx.textAlign    = wmRight ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';

    // shadow
    ctx.fillStyle    = 'rgba(0,0,0,0.8)';
    ctx.fillText(wmText, wmX + 1, wmY + 1);
    // main
    ctx.globalAlpha  = wmOpacity;
    ctx.fillStyle    = textColor;
    ctx.fillText(wmText, wmX, wmY);
    ctx.globalAlpha  = 1;
  }

  // ── 5. Info cards ─────────────────────────────────────────────────────────
  v('info-fontSize').textContent = fontSize + ' px';
  v('info-lines').textContent    = lines.length + ' 行';
  v('info-padding').textContent  = padding + ' px';
  v('info-wm').textContent       = (wmEnable && wmText) ? '開啟' : '關閉';
}

// ══════════════════════════════════════════════════════════════════════════════
//  Font list
// ══════════════════════════════════════════════════════════════════════════════
function renderFontList(fonts) {
  const list = v('font-list');
  if (fonts.length === 0) {
    list.innerHTML = '<div style="color:var(--muted);padding:20px;text-align:center;font-size:13px">找不到符合的字型</div>';
    return;
  }
  list.innerHTML = fonts.map(f => \`
    <div class="font-item \${selectedFont===f?'active':''}"
         onclick="selectFont('\${f.replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'")}')">
      <div style="min-width:0;overflow:hidden">
        <div class="font-name" style="font-family:'\${f}',sans-serif">\${f}</div>
        <div class="font-preview-sm" style="font-family:'\${f}',sans-serif">封面標題 Abc 123</div>
      </div>
      \${selectedFont===f?'<span class="font-check">✓</span>':''}
    </div>
  \`).join('');
}

function filterFonts() {
  const q = v('font-search').value.toLowerCase();
  const filtered = allFonts.filter(f => f.toLowerCase().includes(q));
  renderFontList(filtered);
  v('font-count').textContent = filtered.length + ' / ' + allFonts.length + ' 個字型';
}

function selectFont(name) {
  selectedFont = name;
  v('selected-name').textContent = name;
  v('selected-preview').style.fontFamily = "'" + name + "', sans-serif";

  const existing = Array.isArray(config.fontFamily) ? config.fontFamily : [config.fontFamily];
  config.fontFamily = [name, ...existing.slice(1)];
  updateFFDisplay();

  const q = v('font-search').value.toLowerCase();
  renderFontList(allFonts.filter(f => f.toLowerCase().includes(q)));
  renderPreview();
}

// ══════════════════════════════════════════════════════════════════════════════
//  Build & save
// ══════════════════════════════════════════════════════════════════════════════
function buildConfig() {
  return {
    forceJpg: v('f-forceJpg').checked,
    paths: {
      inputDir:  v('f-inputDir').value,
      outputDir: v('f-outputDir').value
    },
    title: v('f-title').value,
    align: v('f-align').value,
    fontFamily: config.fontFamily,
    customColors: {
      useAutoLuminance: v('f-autoLum').checked,
      forceTextColor:   v('f-tc').value,
      forceShadowColor: v('f-sc').value
    },
    layout: {
      maxCharsPerLine: parseFloat(v('f-maxChars').value),
      fontSizeRatio:   parseFloat(v('f-fsr').value),
      paddingRatio:    parseFloat(v('f-pr').value),
      bold:            v('f-bold').checked,
      italic:          v('f-italic').checked,
      shadowEnable:    v('f-shadowEnable').checked,
      shadowOffset:    parseFloat(v('f-shOff').value),
      titleBgEnable:   v('f-bgEnable').checked,
      titleBgColor:    v('f-bgc').value,
      titleBgOpacity:  parseFloat(v('f-bgo').value),
      titleBgOffsetYRatio: parseFloat(v('f-bgoy').value),
      titleBgPaddingRatio: parseFloat(v('f-bgp').value),
      titleBgRadius:   parseFloat(v('f-bgr').value)
    },
    watermark: {
      enable:      v('f-wmEnable').checked,
      text:        v('f-wmText').value,
      fontSizeRatio: parseFloat(v('f-wmFs').value),
      opacity:     parseFloat(v('f-wmOp').value),
      position: {
        right:       v('f-wmRight').checked,
        bottomRatio: parseFloat(v('f-wmBt').value)
      }
    }
  };
}

async function saveConfig() {
  const payload = buildConfig();
  try {
    const res  = await fetch('/save', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const data = await res.json();
    if (data.ok) { config = payload; showToast('✅ config.json 已儲存', false); }
    else          showToast('❌ 儲存失敗：' + data.error, true);
  } catch(e)  { showToast('❌ 網路錯誤：' + e.message, true); }
}

async function reloadConfig() {
  if (!confirm('將捨棄目前的變更並重新讀取 config.json，確定嗎？')) return;
  try {
    const res = await fetch('/reload');
    const data = await res.json();
    config = data;
    populateFields();
    renderPreview();
    showToast('🔄 設定已重設', false);
  } catch(e) { showToast('❌ 載入失敗：' + e.message, true); }
}

function showToast(msg, isErr) {
  const t = v('toast');
  t.textContent = msg;
  t.className = isErr ? 'error show' : 'show';
  setTimeout(() => t.className = '', 3000);
}

init();
</script>
</body>
</html>`;
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      console.log('📂 讀取 config.json 成功');
      console.log('🔤 列舉系統字型中...');
      const fonts = getSystemFonts();
      console.log(`✅ 找到 ${fonts.length} 個系統字型`);
      const html = buildHTML(config, fonts);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (e) {
      res.writeHead(500);
      res.end('Server Error: ' + e.message);
    }
  } else if (req.method === 'GET' && req.url === '/reload') {
    try {
      const config = fs.readFileSync(CONFIG_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(config);
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
  } else if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const newConfig = JSON.parse(body);
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf8');
        console.log('💾 config.json 已更新');
        console.log('   fontFamily[0]:', newConfig.fontFamily?.[0]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
  } else if ((req.method === 'GET' || req.method === 'HEAD') && (req.url === '/preview-image' || req.url.startsWith('/preview-image?'))) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const inputDir = path.resolve(__dirname, config.paths?.inputDir || './raw_images');
      const files = fs.readdirSync(inputDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      if (files.length === 0) { res.writeHead(404); return res.end('Not found'); }
      const imgPath = path.join(inputDir, files[0]);
      const ext = path.extname(imgPath).slice(1).toLowerCase();
      const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(imgPath).pipe(res);
    } catch(e) { res.writeHead(500); res.end(e.message); }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('🎨 Config 視覺化編輯器已啟動！');
  console.log(`👉 請用瀏覽器開啟: http://localhost:${PORT}`);
  console.log('   (按 Ctrl+C 可關閉伺服器)');
  console.log('');
});
