import { createRequire } from 'node:module'
import axios from 'axios'
import { getCloudAPIBase, getCloudAPIKey, getCloudModel, getPPTDir } from '../config.js'
import { join } from 'node:path'
import fs from 'fs'

const require = createRequire(import.meta.url)
const PptxGenJS = require('pptxgenjs')

const SLIDE_THEMES = {
  blue: {
    bg: '1B3A5C', titleColor: 'FFFFFF', textColor: '333333',
    accent: '4A9EFF', font: 'Microsoft YaHei'
  },
  academic: {
    bg: 'FFFFFF', titleColor: '2C3E50', textColor: '333333',
    accent: '2980B9', font: 'SimSun'
  },
  warm: {
    bg: 'FFF8F0', titleColor: 'E67E22', textColor: '555555',
    accent: 'F39C12', font: 'Microsoft YaHei'
  }
}

async function callLLMForSlides(topic, detail, slideCount) {
  const apiKey = getCloudAPIKey()
  if (!apiKey) {
    const res = await axios.post(`${getCloudAPIBase()?.replace('/v1', '') || 'http://127.0.0.1:1234'}/v1/chat/completions`, {
      model: getCloudModel() || 'local',
      messages: [{
        role: 'system',
        content: 'You are a courseware designer. Output valid JSON only, no markdown fences.'
      }, {
        role: 'user',
        content: `Create a ${slideCount || 10}-slide courseware outline for: "${topic}". ${detail || ''} Format as JSON: { "title": "...", "theme": "blue", "slides": [{ "type": "title|content|bullets|chart|table|compare|exercise|summary", ... }] }.
Types:
- title: { type:"title", content:"subtitle" }
- bullets: { type:"bullets", title:"...", items:["point1","point2"] }
- content: { type:"content", title:"...", content:"paragraph text" }
- chart: { type:"chart", title:"...", chartData:{ type:"bar|pie|line", series:[{ name:"Series", labels:["A","B"], values:[1,2] }] } }
- table: { type:"table", title:"...", headers:["Col1","Col2"], rows:[["a","b"],["c","d"]] }
- compare: { type:"compare", title:"...", left:{ title:"A", items:["..."] }, right:{ title:"B", items:["..."] } }
- exercise: { type:"exercise", title:"...", items:["question1","question2"] }
- summary: { type:"summary", title:"...", items:["key point 1","key point 2"] }`
      }],
      temperature: 0.5,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, timeout: 60000 })

    const raw = res.data?.choices?.[0]?.message?.content
    return JSON.parse(raw)
  }

  const res = await axios.post(`${getCloudAPIBase()}/chat/completions`, {
    model: getCloudModel(),
    messages: [{
      role: 'system',
      content: 'You are a courseware designer. Output valid JSON only, no markdown fences.'
    }, {
      role: 'user',
      content: `Create a ${slideCount || 10}-slide courseware outline for: "${topic}". ${detail || ''} Format as JSON: { "title": "...", "theme": "blue", "slides": [{ "type": "title|content|bullets|chart|table|compare|exercise|summary", ... }] }.
Types: title(content:"subtitle"), bullets(items:["point"]), content(content:"text"), chart(chartData:{type:"bar|pie|line",series:[{name,labels,values}]}), table(headers:[],rows:[[]]), compare(left/right:{title,items}), exercise(items:["q"]), summary(items:["key"]).`
    }],
    temperature: 0.5,
    max_tokens: 3000,
    response_format: { type: 'json_object' }
  }, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    timeout: 60000
  })

  const raw = res.data?.choices?.[0]?.message?.content
  return JSON.parse(raw)
}

async function generatePPTX(params, userMessage, onProgress) {
  const { topic, detail, slideCount } = params

  try {
    onProgress({ type: 'pptx_progress', step: 'planning', message: '📐 正在设计课件结构...' })

    let outline
    try {
      outline = await callLLMForSlides(topic, detail, slideCount || 10)
    } catch {
      outline = {
        title: topic,
        theme: 'blue',
        slides: [
          { type: 'title', title: topic, content: detail || '' },
          { type: 'bullets', title: '主要内容', items: ['知识点一', '知识点二', '知识点三', '知识点四'] },
          { type: 'content', title: '详细内容', content: detail || '请补充具体内容' },
          { type: 'summary', title: '小结', items: ['重点回顾', '课后思考'] }
        ]
      }
    }

    onProgress({ type: 'pptx_progress', step: 'building', message: `📊 正在生成${outline.slides?.length || ''}张幻灯片...`, slideCount: outline.slides?.length })

    const theme = SLIDE_THEMES[outline.theme] || SLIDE_THEMES.blue
    const pres = new PptxGenJS()
    pres.layout = 'LAYOUT_WIDE'
    pres.author = 'Electronic AI'
    pres.title = topic

    for (const slideData of outline.slides) {
      const slide = pres.addSlide()

      switch (slideData.type) {
        case 'title':
          slide.background = { fill: theme.bg }
          slide.addText(slideData.title || topic, {
            x: 1, y: 1.5, w: 11, h: 2,
            fontSize: 40, bold: true, color: theme.titleColor,
            fontFace: theme.font, align: 'center'
          })
          if (slideData.content) {
            slide.addText(slideData.content, {
              x: 1, y: 4, w: 11, h: 1.5,
              fontSize: 20, color: theme.titleColor,
              fontFace: theme.font, align: 'center'
            })
          }
          break

        case 'bullets':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50',
            fontFace: theme.font
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          if (slideData.items?.length) {
            const bulletItems = slideData.items.map(item => ({
              text: typeof item === 'string' ? item : item.text || item,
              options: { bullet: true, fontSize: 18, fontFace: theme.font, color: theme.textColor, breakLine: true, paraSpaceAfter: 8 }
            }))
            slide.addText(bulletItems, {
              x: 1, y: 1.5, w: 11, h: 5,
              valign: 'top'
            })
          }
          break

        case 'content':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          slide.addText(slideData.content || '', {
            x: 1, y: 1.5, w: 11, h: 5,
            fontSize: 16, fontFace: theme.font, color: theme.textColor, valign: 'top'
          })
          break

        case 'exercise':
          slide.addText(slideData.title || '练习', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font
          })
          const questions = slideData.items || []
          const exTexts = questions.map((q, i) => ({
            text: `${i + 1}. ${typeof q === 'string' ? q : q.text || q}`,
            options: { fontSize: 16, fontFace: theme.font, color: theme.textColor, breakLine: true, paraSpaceAfter: 12 }
          }))
          slide.addText(exTexts, {
            x: 1, y: 1.5, w: 11, h: 5.5, valign: 'top'
          })
          break

        case 'chart':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          if (slideData.chartData) {
            const cd = slideData.chartData
            const chartType = cd.type === 'pie' ? 'pie' : cd.type === 'line' ? 'line' : 'bar'
            slide.addChart(chartType, cd.series || [], {
              x: 0.8, y: 1.5, w: 11.5, h: 5,
              showTitle: false, showLegend: true, legendPos: 'b',
              showValue: cd.type !== 'line',
              chartColors: [theme.accent || '4A9EFF', 'E67E22', '27AE60', '9B59B6', 'F39C12']
            })
          }
          break

        case 'table':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          if (slideData.headers?.length && slideData.rows?.length) {
            const cols = slideData.headers.length
            const headerRow = slideData.headers.map(h => ({ text: h, options: { bold: true, fill: { color: theme.accent || '4A9EFF' }, color: 'FFFFFF', fontSize: 14 } }))
            const dataRows = slideData.rows.map(r => r.map(c => ({ text: String(c), options: { fontSize: 13 } })))
            slide.addTable([headerRow, ...dataRows], {
              x: 0.5, y: 1.5, w: 12, colW: Array(cols).fill(12 / cols),
              border: { type: 'solid', pt: 0.5, color: 'D0D0D0' },
              rowH: [0.45, ...dataRows.map(() => 0.35)]
            })
          }
          break

        case 'compare':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          if (slideData.left) {
            slide.addText(slideData.left.title || 'A', {
              x: 0.5, y: 1.5, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: theme.accent, fontFace: theme.font
            })
            const leftItems = (slideData.left.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n')
            slide.addText(leftItems, { x: 0.5, y: 2, w: 5.5, h: 4.5, fontSize: 14, fontFace: theme.font, color: theme.textColor, valign: 'top' })
          }
          slide.addShape(pres.ShapeType.rect, { x: 6.25, y: 1.5, w: 0.02, h: 5, fill: { color: theme.accent } })
          if (slideData.right) {
            slide.addText(slideData.right.title || 'B', {
              x: 6.5, y: 1.5, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: '#E67E22', fontFace: theme.font
            })
            const rightItems = (slideData.right.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n')
            slide.addText(rightItems, { x: 6.5, y: 2, w: 5.5, h: 4.5, fontSize: 14, fontFace: theme.font, color: theme.textColor, valign: 'top' })
          }
          break

        case 'summary':
          slide.background = { fill: theme.bg }
          slide.addText(slideData.title || '本章小结', {
            x: 1, y: 1, w: 11, h: 1.5,
            fontSize: 32, bold: true, color: theme.titleColor, fontFace: theme.font, align: 'center'
          })
          if (slideData.items?.length) {
            const sumItems = slideData.items.map(item => ({
              text: '· ' + (typeof item === 'string' ? item : item.text || item),
              options: { fontSize: 18, color: theme.titleColor, fontFace: theme.font, breakLine: true, paraSpaceAfter: 6 }
            }))
            slide.addText(sumItems, {
              x: 1.5, y: 3, w: 10, h: 4, valign: 'top'
            })
          }
          break

        default:
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font
          })
          slide.addText(slideData.content || '', {
            x: 1, y: 1.5, w: 11, h: 5,
            fontSize: 16, fontFace: theme.font, color: theme.textColor
          })
      }
    }

    onProgress({ type: 'pptx_progress', step: 'saving', message: '💾 正在保存课件文件...' })

    const safeName = topic.replace(/[<>:"/\\|?*]/g, '_').slice(0, 40)
    const fileName = `${safeName}_${Date.now()}.pptx`
    const savePath = join(getPPTDir(), fileName)

    await pres.writeFile({ fileName: savePath })

    // 保存元数据用于后续编辑
    try {
      const metaPath = savePath.replace('.pptx', '.meta.json')
      const pptxSize = fs.existsSync(savePath) ? fs.statSync(savePath).size : 0
      fs.writeFileSync(metaPath, JSON.stringify({
        topic, detail, slideCount: outline.slides?.length || 0,
        theme: outline.theme || 'blue',
        type: 'pptx',
        pptxSize,
        outline,
        createdAt: new Date().toISOString()
      }, null, 2))
    } catch (e) { console.error('[PPTX] 元数据保存失败:', e.message) }

    return {
      success: true,
      message: `✅ 课件已生成：${fileName}（${outline.slides?.length || 0} 页）\n\n点击上方卡片可直接打开文件。所有课件可在顶部导航「内容库」中查看和管理。`,
      path: savePath,
      fileName,
      slideCount: outline.slides?.length || 0
    }

  } catch (error) {
    console.error('[PPTX] 生成失败:', error)
    return { success: false, message: `课件生成失败：${error.message}` }
  }
}

async function generatePPTXFromMeta(metaPath, onProgress) {
  try {
    const raw = fs.readFileSync(metaPath, 'utf-8')
    const meta = JSON.parse(raw)

    onProgress({ type: 'pptx_progress', step: 'building', message: '正在重新生成幻灯片...', slideCount: meta.outline?.slides?.length })

    const theme = SLIDE_THEMES[meta.theme] || SLIDE_THEMES.blue
    const pres = new PptxGenJS()
    pres.layout = 'LAYOUT_WIDE'
    pres.author = 'Electronic AI'
    pres.title = meta.topic

    for (const slideData of (meta.outline?.slides || [])) {
      const slide = pres.addSlide()
      renderSlide(slide, slideData, pres, theme, meta.topic)
    }

    const safeName = meta.topic.replace(/[<>:"/\\|?*]/g, '_').slice(0, 40)
    const fileName = `${safeName}_${Date.now()}.pptx`
    const savePath = join(getPPTDir(), fileName)

    await pres.writeFile({ fileName: savePath })

    const pptxSize = fs.existsSync(savePath) ? fs.statSync(savePath).size : 0
    fs.writeFileSync(savePath.replace('.pptx', '.meta.json'), JSON.stringify({
      ...meta, type: 'pptx', pptxSize, createdAt: new Date().toISOString()
    }, null, 2))

    return { success: true, path: savePath, fileName, slideCount: meta.outline?.slides?.length || 0, message: `✅ 课件已更新：${fileName}。点击卡片打开文件，或在「内容库」中查看。` }
  } catch (error) {
    return { success: false, message: `课件编辑失败：${error.message}` }
  }
}

function renderSlide(slide, slideData, pres, theme, topic) {
  switch (slideData.type) {
    case 'title':
      slide.background = { fill: theme.bg }
      slide.addText(slideData.title || topic, { x: 1, y: 1.5, w: 11, h: 2, fontSize: 40, bold: true, color: theme.titleColor, fontFace: theme.font, align: 'center' })
      if (slideData.content) {
        slide.addText(slideData.content, { x: 1, y: 4, w: 11, h: 1.5, fontSize: 20, color: theme.titleColor, fontFace: theme.font, align: 'center' })
      }
      break
    case 'bullets':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.items?.length) {
        const bulletItems = slideData.items.map(item => ({
          text: typeof item === 'string' ? item : item.text || item,
          options: { bullet: true, fontSize: 18, fontFace: theme.font, color: theme.textColor, breakLine: true, paraSpaceAfter: 8 }
        }))
        slide.addText(bulletItems, { x: 1, y: 1.5, w: 11, h: 5, valign: 'top' })
      }
      break
    case 'content':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      slide.addText(slideData.content || '', { x: 1, y: 1.5, w: 11, h: 5, fontSize: 16, fontFace: theme.font, color: theme.textColor, valign: 'top' })
      break
    case 'exercise':
      slide.addText(slideData.title || '练习', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font })
      const qs = slideData.items || []
      slide.addText(qs.map((q, i) => ({ text: `${i + 1}. ${typeof q === 'string' ? q : q.text || q}`, options: { fontSize: 16, fontFace: theme.font, color: theme.textColor, breakLine: true, paraSpaceAfter: 12 } })), { x: 1, y: 1.5, w: 11, h: 5.5, valign: 'top' })
      break
    case 'summary':
      slide.background = { fill: theme.bg }
      slide.addText(slideData.title || '本章小结', { x: 1, y: 1, w: 11, h: 1.5, fontSize: 32, bold: true, color: theme.titleColor, fontFace: theme.font, align: 'center' })
      if (slideData.items?.length) {
        slide.addText(slideData.items.map(item => ({ text: '· ' + (typeof item === 'string' ? item : item.text || item), options: { fontSize: 18, color: theme.titleColor, fontFace: theme.font, breakLine: true, paraSpaceAfter: 6 } })), { x: 1.5, y: 3, w: 10, h: 4, valign: 'top' })
      }
      break
    case 'chart':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.chartData) {
        const ct = slideData.chartData.type === 'pie' ? 'pie' : slideData.chartData.type === 'line' ? 'line' : 'bar'
        slide.addChart(ct, slideData.chartData.series || [], { x: 0.8, y: 1.5, w: 11.5, h: 5, showTitle: false, showLegend: true, legendPos: 'b', showValue: ct !== 'line', chartColors: [theme.accent || '4A9EFF', 'E67E22', '27AE60', '9B59B6', 'F39C12'] })
      }
      break
    case 'table':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.headers?.length && slideData.rows?.length) {
        const hRow = slideData.headers.map(h => ({ text: h, options: { bold: true, fill: { color: theme.accent || '4A9EFF' }, color: 'FFFFFF', fontSize: 14 } }))
        const dRows = slideData.rows.map(r => r.map(c => ({ text: String(c), options: { fontSize: 13 } })))
        slide.addTable([hRow, ...dRows], { x: 0.5, y: 1.5, w: 12, colW: Array(slideData.headers.length).fill(12 / slideData.headers.length), border: { type: 'solid', pt: 0.5, color: 'D0D0D0' } })
      }
      break
    case 'compare':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.left) {
        slide.addText(slideData.left.title || 'A', { x: 0.5, y: 1.5, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: theme.accent, fontFace: theme.font })
        slide.addText((slideData.left.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n'), { x: 0.5, y: 2, w: 5.5, h: 4.5, fontSize: 14, fontFace: theme.font, color: theme.textColor, valign: 'top' })
      }
      slide.addShape(pres.ShapeType.rect, { x: 6.25, y: 1.5, w: 0.02, h: 5, fill: { color: theme.accent } })
      if (slideData.right) {
        slide.addText(slideData.right.title || 'B', { x: 6.5, y: 1.5, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: '#E67E22', fontFace: theme.font })
        slide.addText((slideData.right.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n'), { x: 6.5, y: 2, w: 5.5, h: 4.5, fontSize: 14, fontFace: theme.font, color: theme.textColor, valign: 'top' })
      }
      break
    default:
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: theme.font })
      slide.addText(slideData.content || '', { x: 1, y: 1.5, w: 11, h: 5, fontSize: 16, fontFace: theme.font, color: theme.textColor })
  }
}

export { generatePPTX, generatePPTXFromMeta, SLIDE_THEMES }
