const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 1. 讀取外部設定檔
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

/** 自動斷行邏輯 **/
function wrapText(text, maxCharsPerLine) {
  const lines = [];
  let currentLine = "";
  let currentWidth = 0;
  for (const char of text) {
    const isASCII = /^[\x00-\x7F]*$/.test(char);
    const charWidth = isASCII ? 0.55 : 1;
    if (currentWidth + charWidth > maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = char;
      currentWidth = charWidth;
    } else {
      currentLine += char;
      currentWidth += charWidth;
    }
  }
  if (currentLine) lines.push({ text: currentLine, width: currentWidth });
  return lines;
}

/** 偵測圖片亮度 **/
async function getIsImageDark(inputPath) {
  const { data } = await sharp(inputPath).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = data;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/** 單張圖片處理核心 **/
async function processSingleImage(inputPath, outputPath) {
  try {
    const image = sharp(inputPath);
    const { width, height } = await image.metadata();
    
    const { align, fontFamily, layout, customColors, title, watermark } = config;
    const isDark = await getIsImageDark(inputPath);
    
    const fontSize   = Math.floor(width * layout.fontSizeRatio);
    const padding    = Math.floor(width * layout.paddingRatio);
    const lineHeight = fontSize * 1.4;
    const lines      = wrapText(title, layout.maxCharsPerLine);
    const fontWeight = layout.bold   ? 'bold'   : 'normal';
    const fontStyle  = layout.italic ? 'italic' : 'normal';
    
    // 背景參數
    const titleBgEnable   = layout.titleBgEnable ?? false;
    const titleBgColor    = layout.titleBgColor || 'rgba(0,0,0,0.5)';
    const titleBgOpacity  = layout.titleBgOpacity ?? 0.5;
    const titleBgOffsetY  = layout.titleBgOffsetYRatio ?? 0.0;
    const titleBgPadding  = fontSize * (layout.titleBgPaddingRatio || 0.2);
    const titleBgRadius   = layout.titleBgRadius || 0;
    
    // 陰影參數
    const shadowEnable    = layout.shadowEnable ?? true;
    const shadowOffset    = layout.shadowOffset ?? 2;
    
    let textColor, shadowColor, gradColor, gradOp;
    if (customColors.useAutoLuminance) {
      gradColor = isDark ? 'black' : 'white';
      gradOp = isDark ? 0.7 : 0.8;
      textColor = isDark ? 'white' : '#222222';
      shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.3)';
    } else {
      gradColor = 'black'; 
      gradOp = 0.6;
      textColor = customColors.forceTextColor;
      shadowColor = customColors.forceShadowColor;
    }

    const xPos = align === 'center' ? width / 2 : padding;
    const textAnchor = align === 'center' ? 'middle' : 'start';
    const fontStack = fontFamily.map(f => `"${f}"`).join(', ');

    // 產生標題文字內容
    const genSpans = (offsetX = 0, offsetY = 0) => lines.map((l, i) => {
      const yPos = height - padding - (lines.length - 1 - i) * lineHeight + offsetY;
      return `<tspan x="${xPos + offsetX}" y="${yPos}">${l.text}</tspan>`;
    }).join('');

    // --- 產生背景矩形 ---
    let bgRects = '';
    if (titleBgEnable) {
      bgRects = lines.map((l, i) => {
        const lineW = l.width * fontSize;
        const rectW = lineW + titleBgPadding * 2;
        const rectH = fontSize * 1.35; // 稍微增加一點高度
        let rectX = xPos - titleBgPadding;
        if (align === 'center') rectX = xPos - (lineW / 2) - titleBgPadding;
        else if (align === 'right') rectX = xPos - lineW - titleBgPadding;
        
        const yPos = height - padding - (lines.length - 1 - i) * lineHeight;
        // 修正 yPos 令文字視覺置中。-1.06x 可平衡大部分中文字體的垂直高度感。
        // 加入 titleBgOffsetY 讓使用者能手動微調垂直校準。
        const rectY = yPos - fontSize * (1.07 + titleBgOffsetY) - titleBgPadding;
        const finalRectH = rectH + titleBgPadding * 2;
        
        return `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${finalRectH}" fill="${titleBgColor}" fill-opacity="${titleBgOpacity}" rx="${titleBgRadius}" ry="${titleBgRadius}" />`;
      }).join('');
    }

    // --- 浮水印邏輯 (修正標籤閉合問題) ---
    let watermarkContent = '';
    if (watermark.enable && watermark.text) {
      const wmFontSize = Math.floor(width * watermark.fontSizeRatio);
      const wmX = watermark.position.right ? width - padding : padding;
      const wmY = height - (height * watermark.position.bottomRatio);
      const wmAnchor = watermark.position.right ? 'end' : 'start';
      const wmShadowColor = 'rgba(0,0,0,0.8)'; // 加深陰影對比

      watermarkContent = `
        <text x="${wmX + 1}" y="${wmY + 1}" font-family='${fontStack}' font-size="${wmFontSize}px" fill="${wmShadowColor}" text-anchor="${wmAnchor}">${watermark.text}</text>
        <text x="${wmX}" y="${wmY}" font-family='${fontStack}' font-size="${wmFontSize}px" fill="${textColor}" fill-opacity="${watermark.opacity}" text-anchor="${wmAnchor}">${watermark.text}</text>
      `;
    }

    // --- 組合最終 SVG (嚴格檢查標籤) ---
    const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0" stop-color="${gradColor}" stop-opacity="0"/>
          <stop offset="1" stop-color="${gradColor}" stop-opacity="${gradOp}"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${height * 0.6}" width="${width}" height="${height * 0.4}" fill="url(#g)" />
      <style>
        .titleStyle { font-family: ${fontStack}; font-weight: ${fontWeight}; font-style: ${fontStyle}; font-size: ${fontSize}px; text-anchor: ${textAnchor}; }
      </style>
      ${bgRects}
      ${shadowEnable ? `<text class="titleStyle" fill="${shadowColor}">${genSpans(shadowOffset, shadowOffset)}</text>` : ''}
      <text class="titleStyle" fill="${textColor}">${genSpans(0, 0)}</text>
      ${watermarkContent}
    </svg>`;

    await image.composite([{ input: Buffer.from(svg.trim()) }]).toFile(outputPath);
    console.log(`✅ 已處理: ${path.basename(outputPath)}`);
  } catch (err) {
    console.error(`❌ 錯誤: ${inputPath}`, err.message);
  }
}

/** 批次處理主程式 **/
async function batchProcess() {
  const { inputDir, outputDir } = config.paths;
  if (!fs.existsSync(inputDir)) return console.error(`❌ 找不到輸入資料夾: ${inputDir}`);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const files = fs.readdirSync(inputDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  for (const file of files) {
    await processSingleImage(path.join(inputDir, file), path.join(outputDir, `covered_${file}`));
  }
}

batchProcess();