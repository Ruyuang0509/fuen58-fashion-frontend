// 每個風格家族的「介面輪廓」：進到第二階段（家族頁）時，整個 UI 的形狀換成這個風格的樣子。
// 換的不是顏色而已，是圓角、邊框、字型、字距、標籤的形狀、有沒有歪一點。
//
// 使用者 2026-10-06 的裁決：「進到第二階段的畫面時，整體 UI silhouette 變化為對應風格的設計」。
// 這裡每一組都是 Claude 的暫定提案，等使用者看過實際畫面再定。
//
// vars 會變成 CSS 自訂屬性掛在頁面根元素上；chip 決定子風格標籤用哪一種形狀（樣式在 FamilyView.vue）。
export const ENTRANCE_VARS = {
  '--radius': '999px',
  '--pill-bg': 'rgba(255, 255, 255, 0.28)',
  '--pill-border': '1px solid transparent',
  '--display': "'Space Grotesk', 'Noto Sans TC', sans-serif",
  '--display-weight': '500',
  '--display-spacing': '0.08em',
  '--body': "'Noto Sans TC', sans-serif",
  '--tilt': '0deg',
  '--rule': '1px solid transparent',
}

export const SKINS = {
  // 簡約：沒有盒子，只有細線與字距
  minimal: {
    chip: 'line',
    vars: {
      '--radius': '0px',
      '--pill-bg': 'transparent',
      '--pill-border': '1px solid currentColor',
      '--display': "'Noto Sans TC', sans-serif",
      '--display-weight': '300',
      '--display-spacing': '0.3em',
      '--body': "'Noto Sans TC', sans-serif",
      '--tilt': '0deg',
      '--rule': '1px solid currentColor',
    },
  },
  // 街頭：貼紙，粗邊、硬陰影、每張歪一點
  street: {
    chip: 'sticker',
    vars: {
      '--radius': '4px',
      '--pill-bg': 'rgba(255, 255, 255, 0.9)',
      '--pill-border': '2px solid currentColor',
      '--display': "'Space Grotesk', 'Noto Sans TC', sans-serif",
      '--display-weight': '700',
      '--display-spacing': '-0.01em',
      '--body': "'Noto Sans TC', sans-serif",
      '--tilt': '-2deg',
      '--rule': '2px solid currentColor',
    },
  },
  // 龐克：撕過的紙邊、黑底白字、等寬字
  punk: {
    chip: 'torn',
    vars: {
      '--radius': '0px',
      '--pill-bg': 'rgba(18, 14, 20, 0.85)',
      '--pill-border': '1px solid rgba(255,255,255,0.4)',
      '--display': "'Space Mono', 'Noto Sans TC', monospace",
      '--display-weight': '700',
      '--display-spacing': '0.02em',
      '--body': "'Space Mono', 'Noto Sans TC', monospace",
      '--tilt': '1.5deg',
      '--rule': '2px dashed currentColor',
    },
  },
  // 戶外：裝備吊牌，圓角小、有一個穿繩的洞
  outdoor: {
    chip: 'tag',
    vars: {
      '--radius': '8px',
      '--pill-bg': 'rgba(255, 255, 255, 0.5)',
      '--pill-border': '1.5px solid currentColor',
      '--display': "'Space Grotesk', 'Noto Sans TC', sans-serif",
      '--display-weight': '500',
      '--display-spacing': '0.12em',
      '--body': "'Noto Sans TC', sans-serif",
      '--tilt': '0deg',
      '--rule': '1.5px solid currentColor',
    },
  },
  // 正式：襯線字、細的上下規線、沒有填色
  formal: {
    chip: 'rule',
    vars: {
      '--radius': '2px',
      '--pill-bg': 'transparent',
      '--pill-border': '1px solid currentColor',
      '--display': "'Cormorant Garamond', 'Noto Serif TC', serif",
      '--display-weight': '500',
      '--display-spacing': '0.14em',
      '--body': "'Noto Serif TC', serif",
      '--tilt': '0deg',
      '--rule': '1px solid currentColor',
    },
  },
  // 量產型：全圓角、白底粉邊、圓體
  ryousan: {
    chip: 'pill',
    vars: {
      '--radius': '999px',
      '--pill-bg': 'rgba(255, 255, 255, 0.85)',
      '--pill-border': '1.5px solid currentColor',
      '--display': "'Huninn', 'Noto Sans TC', sans-serif",
      '--display-weight': '400',
      '--display-spacing': '0.1em',
      '--body': "'Huninn', 'Noto Sans TC', sans-serif",
      '--tilt': '0deg',
      '--rule': '2px dotted currentColor',
    },
  },
  // 蘿莉塔：蕾絲邊（點線加內框）、襯線字
  lolita: {
    chip: 'lace',
    vars: {
      '--radius': '1.4rem',
      '--pill-bg': 'rgba(255, 250, 246, 0.8)',
      '--pill-border': '2px dotted currentColor',
      '--display': "'Cormorant Garamond', 'Noto Serif TC', serif",
      '--display-weight': '600',
      '--display-spacing': '0.1em',
      '--body': "'Noto Serif TC', serif",
      '--tilt': '0deg',
      '--rule': '2px dotted currentColor',
    },
  },
  // 復古：紙標籤、雙線框、微微歪
  vintage: {
    chip: 'label',
    vars: {
      '--radius': '2px',
      '--pill-bg': 'rgba(246, 236, 217, 0.9)',
      '--pill-border': '1px solid currentColor',
      '--display': "'Fraunces', 'Noto Serif TC', serif",
      '--display-weight': '600',
      '--display-spacing': '0.04em',
      '--body': "'Noto Serif TC', serif",
      '--tilt': '-1deg',
      '--rule': '3px double currentColor',
    },
  },
}

export function skinOf(code) {
  return SKINS[code] ?? SKINS.minimal
}
