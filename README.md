# 🎨 Text AI Cover

![Text AI Cover Preview](./preview/ai-cover-generator-preview.jpg)

> Text-AI-Cover 是自動為 AI 生成的圖片批次加上標題文字與浮水印的工具，支援視覺化設定編輯介面。

使用方法：

* 是先透過 AI 生圖，生好的圖放到 raw_images 目錄下 ([AI 生圖提示詞的參考](https://github.com/max32002/text-ai-cover?tab=readme-ov-file#-gemini-%E7%94%9F%E5%9C%96%E6%8F%90%E7%A4%BA%E8%A9%9E%E5%8F%83%E8%80%83))
* 如果是要批次修改整個目錄下的圖片，可以修改 config.json ，設定放到圖片上的標題之後, 執行 run.bat 即可在 final_posts 目錄取得所有圖片套用標題的成品, 
* 如果是 raw_images 目錄下只有一張圖的話，執行 edit-config.bat 或是執行 node editor-server.js 就可以開啟網頁版本的視覺化設定編輯介面，即時直接預覽圖片套用標題的結果，最後可以在瀏覽器直接下載調整的結果。

影片講解：
https://youtu.be/VZ7pvM_1PI4

---

## 📖 目錄

- [專案簡介](#-專案簡介)
- [功能特色](#-功能特色)
- [安裝環境](#-安裝環境)
- [快速開始](#-快速開始)
- [add-text.js 使用說明](#-add-textjs-使用說明)
- [edit-config 視覺化編輯器](#-edit-config-視覺化編輯器)
- [config.json 參數說明](#-configjson-參數說明)
- [目錄結構](#-目錄結構)
- [Gemini 生圖提示詞參考](#-gemini-生圖提示詞參考)

---

## 🚀 專案簡介

**Text AI Cover** 是一套專為內容創作者設計的自動化圖文包裝工具。它能解決 AI 生成圖片雖然精美，但往往缺乏標題與品牌識別的問題。

本工具會自動掃描 `raw_images/` 資料夾，為圖片疊加具有設計感的漸層遮罩、標題文字、標題背景塊以及品牌浮水印。它特別適合用於 **YouTube 縮圖、社群貼文封面、部落格文章配圖** 等需要快速大量產出一致性設計的需求。

與一般工具不同，我們提供了基於瀏覽器的 **視覺化即時預覽編輯器**，讓您不必具備寫程式知識，也能輕鬆調校出理想的排版效果。

---

## ✨ 功能特色

- ⚡ **一鍵批次處理**：採用高效 `sharp` 引擎，數秒內即可處理數十張 JPG / PNG / WebP 圖片。
- 👁️ **視覺化即時預覽**：內建 `edit-config` 網頁介面，調整參數時 Canvas 畫布會 **120ms 內即時重繪**，所見即所得。
- 🌗 **智慧環境感知**：自動偵測原圖底色亮度，智慧切換深淺色文字（亦可手動指定），確保標題始終清晰。
- 🖼️ **進階標題樣式**：
    - **自訂背景塊**：可設定背景色、透明度、外擴內距與圓角，提升在雜亂背景下的閱讀率。
    - **文字特效**：支援粗體、斜體與自訂陰影顏色，強化視覺層次感。
- 📐 **動態版面配置**：
    - **比例座標系**：所有字級、邊距皆以圖片寬度比例計算，面對不同解析度原圖也能維持比例一致。
    - **多行智慧斷行**：獨家字寬計算法（中文1，ASCII 0.55），支援置中、靠左、靠右自動對齊。
- 🔤 **系統字型列舉**：自動抓取您電腦中已安裝的所有字型，並提供搜尋與即時套用功能。
- 💧 **品牌保護**：內建浮水印系統，可自由調整位置與透明度，防止作品被隨意盜錄。
- 🖼️ **預覽本地圖片與下載**：自動偵測 `raw_images` 資料夾內的圖片並載入為預覽背景，調校完畢後可「一鍵下載」預覽圖，格式依 `forceJpg` 設定自動輸出為 `.jpg` 或 `.png`。
- 📐 **自動偵測圖片比例**：預覽畫布會依載入圖片的實際長寬比（16:9、1:1 等）自動調整尺寸，並以「短邊適配」模式縮放，確保任何比例的圖片都能完整顯示在預覽區域內，不產生裁切。
- 🖼️ **強制 JPG 輸出**：內建 `forceJpg` 開關（預設啟用），可將所有輸出圖片統一轉換為 `.jpg` 格式，停用後則保留原始檔案格式。
- 🌓 **深色 / 淺色主題切換**：編輯器界面支援一鍵切換深色與淺色主題，適合不同作業環境與個人偏好。

---

## 🛠️ 安裝環境

**前置需求：**

- [Node.js](https://nodejs.org/) v18 以上

**安裝依賴套件：**

```bash
npm install
```

> 主要依賴套件為 [`sharp`](https://sharp.pixelplumbing.com/)，用於高效合成 SVG 文字圖層至圖片上。

---

## ⚡ 快速開始

1. 將原始圖片放入 `raw_images/` 資料夾（支援 `.jpg`、`.jpeg`、`.png`、`.webp`）
2. 確認 `config.json` 內的 `title` 為你想要的標題文字
3. 執行批次處理：

```bash
npm start
```

或直接雙擊 `run.bat`，或在終端機執行：

```bat
run.bat
```

4. 輸出圖片將存放於 `final_posts/` 資料夾，檔名前綴為 `covered_`

---

## 📝 add-text.js 使用說明

`add-text.js` 是本專案的**核心批次處理程式**，執行後會自動：

1. 讀取 `config.json` 取得所有參數
2. 掃描 `config.paths.inputDir`（預設 `./raw_images`）中的所有圖片
3. 對每張圖片執行以下處理：
   - 偵測圖片平均亮度，決定文字為白色或深色
   - 在圖片底部 40% 區域疊加漸層遮罩
   - 將 `config.title` 文字依 `layout.maxCharsPerLine` 自動斷行
   - 渲染陰影層 + 主文字層（SVG 合成）
   - 若啟用浮水印，在指定位置疊加浮水印
4. 輸出至 `config.paths.outputDir`（預設 `./final_posts`），檔名加上 `covered_` 前綴

### 執行方式

```bash
# 單次執行
npm start

# 或直接用 node
node add-text.js

# 監聽模式（修改 config.json 後自動重新執行）
npm run dev
```

### 執行輸出範例

```
# forceJpg: true（預設）— 統一輸出為 .jpg
✅ 已處理: covered_image01.jpg
✅ 已處理: covered_image02.jpg   ← 原為 .png，轉為 .jpg
❌ 錯誤: raw_images/broken.jpg  unsupported image format

# forceJpg: false — 保留原始格式
✅ 已處理: covered_image01.jpg
✅ 已處理: covered_image02.png   ← 保留 .png
```

### 文字渲染與繪圖原理

為了確保輸出品質與效能，系統採用 **SVG Layering** 技術進行多圖層合成：

1. **基礎圖層 (Base Layer)**: 載入並處理原始圖片快取。
2. **遮罩圖層 (Mask Layer)**: 自動生成線性斜向漸層 SVG，覆蓋在底部提供文字閱讀所需的對比度。
3. **背景圖層 (Background Layer)**: 若啟用了「標題背景」，系統會預先計算文字渲染後的包圍矩形，並繪製具圓角的填充色塊。
4. **文字圖層 (Text Layer)**: 依據對齊方式、字型優先順序 (Font Stack) 生成具備陰影與正確斷行的 SVG Text。
5. **浮水印 (Watermark)**: 最後在指定角落疊加具透明度的品牌標註。
6. **最終壓製**: 透過 `sharp` 影像引擎將所有 SVG 與緩衝區圖層壓製，產出最高品質的成品。

| 渲染細節 | 技術邏輯                                                           |
| -------- | ------------------------------------------------------------------ |
| 自適應置中 | 透過計算每行字寬與內距，自動校準背景矩形的起始點位置               |
| 斷行計算 | ASCII 字元計 0.55，中文字計 1，依 `maxCharsPerLine` 精確強制換行    |
| 座標系統 | 使用 **Relative Scalable System**，參數 0.06 即代表圖片寬度的 6%     |
| 環境偵測 | 縮放圖片至 1×1px 以 YUV 權重取值，當亮度 < 0.5 時切換為亮色方案 |

---

## 🖥️ edit-config 視覺化編輯器

`edit-config.bat` 會啟動一個本機網頁伺服器（`editor-server.js`），並自動開啟瀏覽器，讓你在視覺化介面中編輯 `config.json`，**無需手動修改 JSON 檔案**。

### 啟動方式

直接雙擊 `edit-config.bat`，或在終端機執行：

```bat
edit-config.bat
```

或

```bash
node editor-server.js
```


瀏覽器會自動開啟 `http://localhost:3737`

> 按 **Ctrl+C** 或關閉終端機視窗即可停止伺服器。

### 介面功能

#### 左側：🔤 系統字型選擇器

- 自動列舉出**電腦上所有已安裝的系統字型**（支援 Windows / macOS / Linux）
- 搜尋框可即時篩選字型名稱
- 點擊任一字型可**即時預覽**「漢字 Abc 123 いろは」的渲染效果
- 選取字型後，會自動**覆蓋** `config.fontFamily` 陣列的**第一項**，其餘 Fallback 字型保持不變

#### 中間：👁️ 即時預覽

- **Canvas 畫布**即時顯示標題排版效果，任何修改參數後 **120ms 內自動重繪**
- 支援多種背景預設：🌑 深色、☀️ 淺色、🌊 藍調、🌿 森林、🌅 落日
- **🖼️ 預覽圖片**：若來源資料夾內有圖片，系統會自動載入第一張作為預設背景，方便檢視真實疊加上字的效果
- **📐 自動比例適配**：預覽畫布會依載入圖片的實際長寬比（16:9、1:1 等）自動調整尺寸；以「短邊適配」方式縮放，確保正方形或直式圖片也能完整顯示於預覽區域，不產生裁切
- **⬇️ 下載預覽圖**：提供專屬按鈕，快速將目前的畫布排版結果另存，格式依 `forceJpg` 設定自動選擇 `.jpg`（高品質 JPEG）或 `.png`，以標題作為檔名
- 顯示即時資訊：字級、行數、邊距、浮水印狀態。採用水平單列緊湊顯示，保留更多垂直空間讓畫布完整展示

#### 右側：⚙️ 參數設定

可直接在表單中修改以下設定：

| 欄位                     | 對應 config.json 參數                        |
| ------------------------ | -------------------------------------------- |
| title                    | 標題文字內容                                 |
| align                    | 文字對齊方向（center / left / right）        |
| maxCharsPerLine          | 每行最大字元數（中文1，ASCII 0.55）          |
| fontSizeRatio            | 字級比例（相對於圖片寬度）                   |
| paddingRatio             | 邊距比例（相對於圖片寬度）                   |
| bold                     | 是否啟用粗體文字                             |
| italic                   | 是否啟用斜體文字                             |
| shadowEnable             | 是否啟用文字陰影                             |
| shadowOffset             | 陰影偏移量（像素）                           |
| titleBgEnable            | 是否啟用標題背景色塊                         |
| titleBgColor             | 標題背景顏色（支援 hex, rgb, rgba）          |
| titleBgOpacity           | 標題背景透明度（0.0 ~ 1.0）                  |
| titleBgOffsetYRatio      | 標題背景垂直偏移微調（正值向上）             |
| titleBgPaddingRatio      | 標題背景向外擴張的內距比例                   |
| titleBgRadius            | 標題背景矩形的圓角大小                       |
| useAutoLuminance         | 是否啟用自動亮度偵測                         |
| forceTextColor           | 強制文字顏色（停用自動亮度時生效）           |
| forceShadowColor         | 強制陰影顏色                                 |
| watermark.enable         | 是否啟用浮水印                               |
| watermark.text           | 浮水印文字                                   |
| watermark.fontSizeRatio  | 浮水印字級比例                               |
| watermark.opacity        | 浮水印透明度（0 ~ 1）                        |
| watermark.bottomRatio    | 浮水印垂直位置（佔圖片高度比例，從底部算起） |
| watermark.position.right | 浮水印靠右（true）或靠左（false）            |
| forceJpg                 | 強制將所有輸出圖片轉換為 `.jpg` 格式（預設開啟） |
| inputDir                 | 來源圖片資料夾路徑                           |
| outputDir                | 輸出圖片資料夾路徑                           |

#### 儲存設定

點擊右上角 **💾 儲存 config.json** 按鈕，所有變更會立即寫回 `config.json` 檔案。

點擊 **☀️ 淺色模式** / **🌑 深色模式** 可一鍵切換編輯器外觀主題。

---

## ⚙️ config.json 參數說明

```jsonc
{
  "forceJpg": true, // true = 所有輸出統一轉為 .jpg；false = 保留原始副檔名
  "paths": {
    "inputDir": "./raw_images", // 原始圖片來源資料夾
    "outputDir": "./final_posts", // 輸出圖片目標資料夾
  },
  "title": "讓 AI 封面圖自動加上中文標題", // 疊加在圖片上的標題文字
  "align": "center", // 文字對齊：center | left | right
  "fontFamily": [
    // 字型優先順序（陣列，依序 Fallback）
    "PingFang TC",
    "Noto Sans TC",
    "Microsoft JhengHei",
    "sans-serif",
  ],
  "customColors": {
    "useAutoLuminance": true, // true = 自動依圖片亮度決定文字顏色
    "forceTextColor": "#ffffff", // 停用自動亮度時的強制文字顏色
    "forceShadowColor": "rgba(0,0,0,0.5)", // 停用自動亮度時的強制陰影顏色
  },
  "layout": {
    "maxCharsPerLine": 15, // 每行最大字元數（中文字計1，英文字元計0.55）
    "fontSizeRatio": 0.055, // 字級 = 圖片寬度 × fontSizeRatio
    "paddingRatio": 0.06, // 邊距 = 圖片寬度 × paddingRatio
    "bold": false, // 是否啟用粗體
    "italic": false, // 是否啟用斜體
    "shadowEnable": true, // 是否啟用文字陰影
    "shadowOffset": 2, // 陰影偏移像素值
    "titleBgEnable": true, // 是否顯示標題背景色塊
    "titleBgColor": "#c9c5c5", // 標題背景顏色
    "titleBgOpacity": 0.5, // 標題背景透明度 (0.0 ~ 1.0)
    "titleBgOffsetYRatio": 0.0, // 垂直偏移微調 (正值向上，負值向下)
    "titleBgPaddingRatio": 0.2, // 背景向外擴張內距 (相對於字級)
    "titleBgRadius": 8 // 背景圓角像素值
  },
  "watermark": {
    "enable": true, // 是否顯示浮水印
    "text": "Max的每一天", // 浮水印文字
    "fontSizeRatio": 0.01, // 浮水印字級比例
    "opacity": 0.1, // 浮水印透明度（0.0 ~ 1.0）
    "position": {
      "right": true, // true = 靠右，false = 靠左
      "bottomRatio": 0.9, // 距底部的高度比例（0.9 表示距底部 90% 處）
    },
  },
}
```

---

## 📁 目錄結構

```
text-ai-cover/
├── add-text.js        # 核心批次處理程式
├── editor-server.js   # 視覺化設定編輯器後端伺服器
├── edit-config.bat    # 一鍵啟動視覺化編輯器（Windows）
├── config.json        # 所有可調整參數設定檔
├── package.json
├── raw_images/        # 📥 原始圖片放置於此
└── final_posts/       # 📤 處理後圖片輸出於此
```

---

## 🤖 Gemini 生圖提示詞參考

以下是搭配本工具使用時，在 Gemini 生圖階段建議使用的提示詞範本與心得筆記。

### 基本提示詞範本

```
Please create an image of [主題內容]. Important constraints:
1. The bottom 25% of the image should be relatively simple for text overlay.
2. NO TEXT, NO SYMBOLS, NO LETTERS, NO NUMBERS should appear in the image.
3. 圖片比例: 16:9
4. Studio Ghibli style.
```

### 底部留白比例心得

| 圖片比例 | 標題行數 | 建議底部留白 |
| -------- | -------- | ------------ |
| 16:9     | 一行     | 25%          |
| 16:9     | 多行     | 30%          |
| 1:1      | 一行     | 20%          |

> 上面的比例在不同的主題內容中常常需要手動調整，大多數無法一次就抓到最佳高度，需要修改送出的提示詞。

### 風格替換建議

吉卜力式溫暖氛圍跟很多主題無關聯，硬加上 `Studio Ghibli` 反而完全失去主題。改用 `Lighting composition` 反而會讓畫面更好看。更多的情況下是只需要使用前三點即可，不需要使用太多提示詞。

### 常用風格與質感提示詞

| 類型     | 關鍵字                                                              |
| -------- | ------------------------------------------------------------------- |
| 風格     | `Minimalist`（極簡）、`Hand-drawn`（手繪）、`Rough sketch`（粗糙草圖） |
| 筆觸     | `Ink texture`（墨水紋理）、`Shaky lines`（顫抖的線條）、`Felt tip pen`（麥克筆感） |
| 構圖     | `White background`（純白背景）、`Black and white`（黑白）、`No 3D render`（不要 3D 渲染） |
| 氛圍     | `Conceptual`（概念性的）、`Simple`（簡單）                          |

### 避免 AI 感 / 科技感太重

可加入以下指令讓畫面更有手作溫度：

- `Shaky hand-drawn lines`：避免 AI 生成太過完美的幾何線條。
- `Charcoal sketch effect`：增加碳筆或原子筆的摩擦感。
- `Primitive drawing style`：讓畫面看起來像隨手在筆記本上畫的，而不是設計軟體拉出來的。
- `White paper texture`：增加背景的真實感。

---

## 📄 授權

MIT License
