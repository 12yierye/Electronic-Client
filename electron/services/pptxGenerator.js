import { createRequire } from 'node:module'
import axios from 'axios'
import { getCloudAPIBase, getCloudAPIKey, getCloudModel, getLMStudioAPI, getPPTDir, getImageGenPriority, getImageGenSubPriority, getImageGenConfig } from '../config.js'
import { join } from 'node:path'
import fs from 'fs'

import { searchAndDownload } from './imageSearch.js'
import { generateImage, generateImageWithFallback } from './imageGen.js'
const require = createRequire(import.meta.url)
const PptxGenJS = require('pptxgenjs')
const katex = require('katex')
const AdmZip = require('adm-zip')

const TRANSITION_XML_MAP = {
  fade: '<p:fade/>',
  push: '<p:push/>',
  wipe: '<p:wipe/>',
  split: '<p:split/>',
  dissolve: '<p:fade/>',
  cover: '<p:cover/>',
  reveal: '<p:push/>'
}

function injectTransitions(pptxPath, transitions) {
  if (!transitions || transitions.length === 0) return
  try {
    const zip = new AdmZip(pptxPath)
    transitions.forEach(({ slideIndex, type, duration }) => {
      if (!type || !TRANSITION_XML_MAP[type]) return
      const xmlType = TRANSITION_XML_MAP[type]
      const durMs = Math.round((duration || 0.6) * 1000)
      const entry = zip.getEntry(`ppt/slides/slide${slideIndex}.xml`)
      if (!entry) return
      let content = entry.getData().toString('utf8')
      const transitionXml = `<p:transition dur="${durMs}">${xmlType}</p:transition>`
      content = content.replace('</p:cSld>', `</p:cSld>\n${transitionXml}`)
      zip.updateFile(`ppt/slides/slide${slideIndex}.xml`, Buffer.from(content, 'utf8'))
    })
    zip.writeZip(pptxPath)
  } catch (e) {
    console.error('[PPTX] 过渡效果注入失败:', e.message)
  }
}

const FONT_MAP = {
  'zh-CN': 'Microsoft YaHei',
  'en': 'Calibri',
  'ja': 'MS Gothic'
}

function fontForLang(lang) { return FONT_MAP[lang] || 'Microsoft YaHei' }

function sanitizeKeyword(str) {
  return str.replace(/[^\w\u4e00-\u9fff]/g, '').replace(/\s+/g, '')
}

async function getImageForKeyword(keyword) {
  if (!keyword) return null
  const priority = getImageGenPriority()
  const subPriority = getImageGenSubPriority()

  if (priority === 'generate') {
    // AI 生图优先: 根据子优先级决定先尝试什么
    if (subPriority === 'server') {
      // 图片服务端优先: 尝试自建服务 → 配置的生图提供商 → 搜索
      const genBuf = await generateImageWithFallback(keyword)
      if (genBuf) return genBuf
      return searchAndDownload(keyword)
    }
    // 搜索获取优先(子选项): AI 生图 → 搜索
    const genBuf = await generateImageWithFallback(keyword)
    if (genBuf) return genBuf
    return searchAndDownload(keyword)
  }

  // 联网搜索优先: 搜索 → AI 生图
  const searchBuf = await searchAndDownload(keyword)
  if (searchBuf) return searchBuf
  return generateImageWithFallback(keyword)
}

async function getImageForSlide(slideData, topic) {
  return getImageForKeyword(sanitizeKeyword(slideData.search_keyword || slideData.description || slideData.title || topic))
}

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

function detectLanguage(topic, detail) {
  const text = (topic + ' ' + (detail || '')).toLowerCase()
  if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(topic)) {
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja'
    return 'zh-CN'
  }
  if (/[a-z]/i.test(topic)) return 'en'
  return 'zh-CN'
}

function callLLM(messages, apiKey, temperature = 0.5, maxTokens = 3000) {
  const url = apiKey ? `${getCloudAPIBase()}/chat/completions` : `${getLMStudioAPI()}/chat/completions`
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  return axios.post(url, {
    model: getCloudModel() || 'local',
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' }
  }, { headers, timeout: 60000 })
}

function parseJSONResponse(raw) {
  if (!raw) throw new Error('LLM returned empty response')
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim())
  } catch (e) {
    console.error('[PPTX] JSON parse failed:', e.message, 'raw:', raw?.slice(0, 200))
    throw new Error('LLM returned invalid outline JSON')
  }
}

async function callLLMForSlides(topic, detail, slideCount, language) {
  const lang = language || detectLanguage(topic, detail)
  const langHint = lang === 'en' ? 'Generate ALL content in English.' : lang === 'ja' ? 'すべてのコンテンツを日本語で生成してください。' : '全部内容用中文生成。'

  const userContent = `Create a visually engaging ${slideCount || 10}-slide courseware outline for: "${topic}".
${detail || ''} ${langHint}

IMPORTANT DESIGN RULES:
1. Include at least 2 "image" slides.
2. Image slides MUST have a "search_keyword" field: short concrete keywords ONLY, no spaces, no punctuation, no symbols — ideally 2 Chinese characters (e.g. "搜索" not "搜索引擎工作原理", "飞机" not "航空飞行器"). Keywords must be specific VISUAL terms that return real image search results. Long text or abstract concepts find NO images.
3. Keep "description" for visual context, "search_keyword" for search engine query.
4. For "compare" slides about two opposing concepts, add "search_keyword_left" and "search_keyword_right" — the generator will show two images side by side.
5. Vary the content types — don't use the same type more than 3 times in a row.
6. Add an "image" slide early (slide 2-3) to grab attention.
7. Use "title" slides sparingly (max 1), prefer "bullets" or "content" for structured info.
8. The presentation must feel rich and modern — mix text slides with visual slides.
9. Each slide MUST have a "transition" field: choose from "fade"|"push"|"wipe"|"split"|"dissolve". Vary the transition type across slides — avoid using the same one more than 3 times in a row.

Output JSON format:
{
  "title": "<presentation title>",
  "theme": "blue|academic|warm",
  "slides": [
    { "type": "title", "title": "<topic>", "content": "<subtitle>" },
    { "type": "image", "title": "<slide title>", "description": "<visual description>", "search_keyword": "<short concrete keyword no spaces>" },
    { "type": "bullets", "title": "<section title>", "items": ["<point>", "<point>"] },
    { "type": "content", "title": "<section title>", "content": "<paragraph text>" },
    { "type": "chart", "title": "<title>", "chartData": { "type": "bar|pie|line", "series": [{ "name": "<series>", "labels": ["A","B"], "values": [1,2] }] } },
    { "type": "table", "title": "<title>", "headers": ["Col1","Col2"], "rows": [["a","b"]] },
    { "type": "compare", "title": "<title>", "search_keyword_left": "关键词A", "search_keyword_right": "关键词B", "left": { "title": "A", "items": ["..."] }, "right": { "title": "B", "items": ["..."] } },
    { "type": "formula", "title": "<title>", "formulas": ["$E=mc^2$", "$\\\\int_a^b f(x)dx$"] },
    { "type": "exercise", "title": "<title>", "items": ["<question>"] },
    { "type": "summary", "title": "<title>", "items": ["<key point>"] }
  ]
}

Types: title(subtitle), bullets(list), content(paragraph), image(searchable description), chart(data), table(grid), compare(side-by-side), formula(LaTeX), exercise(questions), summary(recap).`

  const apiKey = getCloudAPIKey()
  const sysMsg = 'You are a courseware designer. Output valid JSON only, no markdown fences.'

  if (!apiKey) {
    const res = await callLLM([
      { role: 'system', content: sysMsg },
      { role: 'user', content: userContent }
    ])
    return parseJSONResponse(res.data?.choices?.[0]?.message?.content)
  }

  const res = await callLLM([
    { role: 'system', content: sysMsg },
    { role: 'user', content: userContent }
  ], apiKey)
  return parseJSONResponse(res.data?.choices?.[0]?.message?.content)
}

async function generatePPTX(params, userMessage, onProgress) {
  const { topic, detail, slideCount, debug } = params

  try {
    onProgress({ type: 'pptx_progress', step: 'planning', message: '📐 正在设计课件结构...' })

    const language = detectLanguage(topic, detail)

    let outline
    try {
      outline = await callLLMForSlides(topic, detail, slideCount || 10, language)
    } catch {
      const lang = language || 'zh-CN'
      const fallbackTexts = {
        'zh-CN': { imgTitle: '相关图示', imgDesc: '示意图或相关图片', bulletTitle: '主要内容', items: ['知识点一', '知识点二', '知识点三', '知识点四'], contentTitle: '详细内容', contentBody: '请补充具体内容', moreImgTitle: '更多图示', moreImgDesc: '详细图示说明', summaryTitle: '小结', summaryItems: ['重点回顾', '课后思考'] },
        'en': { imgTitle: 'Related Image', imgDesc: 'Illustration or related image', bulletTitle: 'Main Content', items: ['Key Point 1', 'Key Point 2', 'Key Point 3', 'Key Point 4'], contentTitle: 'Detailed Content', contentBody: 'Please add specific content', moreImgTitle: 'More Images', moreImgDesc: 'Detailed illustration', summaryTitle: 'Summary', summaryItems: ['Key Review', 'After-class Reflection'] },
        'ja': { imgTitle: '関連図', imgDesc: 'イメージ図または関連画像', bulletTitle: '主な内容', items: ['知識点1', '知識点2', '知識点3', '知識点4'], contentTitle: '詳細内容', contentBody: '具体的な内容を追加してください', moreImgTitle: 'その他の図', moreImgDesc: '詳細図解説明', summaryTitle: 'まとめ', summaryItems: ['重点復習', '課後考察'] }
      }
      const ft = fallbackTexts[lang] || fallbackTexts['zh-CN']
      outline = {
        title: topic,
        theme: 'blue',
        slides: [
          { type: 'title', title: topic, content: detail || '' },
          { type: 'image', title: ft.imgTitle, description: topic + ' ' + ft.imgDesc },
          { type: 'bullets', title: ft.bulletTitle, items: ft.items },
          { type: 'content', title: ft.contentTitle, content: detail || ft.contentBody },
          { type: 'image', title: ft.moreImgTitle, description: topic + ' ' + ft.moreImgDesc, search_keyword: topic },
          { type: 'summary', title: ft.summaryTitle, items: ft.summaryItems }
        ]
      }
    }

    onProgress({ type: 'pptx_progress', step: 'building', message: `📊 正在生成${outline.slides?.length || ''}张幻灯片...`, slideCount: outline.slides?.length })

    const theme = SLIDE_THEMES[outline.theme] || SLIDE_THEMES.blue
    const pres = new PptxGenJS()
    pres.layout = 'LAYOUT_WIDE'
    pres.author = 'Electronic AI'
    pres.title = topic

    const transitions = []

    for (let i = 0; i < outline.slides.length; i++) {
      const slideData = outline.slides[i]
      const slide = pres.addSlide()

      if (slideData.transition) {
        transitions.push({ slideIndex: i + 1, type: slideData.transition, duration: 0.6 })
      }

      switch (slideData.type) {
        case 'title':
          slide.background = { fill: theme.bg }
          slide.addText(slideData.title || topic, {
            x: 1, y: 1.5, w: 11, h: 2,
            fontSize: 40, bold: true, color: theme.titleColor,
            fontFace: fontForLang(language), align: 'center'
          })
          if (slideData.content) {
            slide.addText(slideData.content, {
              x: 1, y: 4, w: 11, h: 1.5,
              fontSize: 20, color: theme.titleColor,
              fontFace: fontForLang(language), align: 'center'
            })
          }
          break

        case 'bullets':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50',
            fontFace: fontForLang(language)
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          if (slideData.items?.length) {
            const bulletItems = slideData.items.map(item => ({
              text: typeof item === 'string' ? item : item.text || item,
              options: { bullet: true, fontSize: 18, fontFace: fontForLang(language), color: theme.textColor, breakLine: true, paraSpaceAfter: 8 }
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
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          slide.addText(slideData.content || '', {
            x: 1, y: 1.5, w: 11, h: 5,
            fontSize: 16, fontFace: fontForLang(language), color: theme.textColor, valign: 'top'
          })
          break

        case 'exercise':
          slide.addText(slideData.title || '练习', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
          })
          const questions = slideData.items || []
          const exTexts = questions.map((q, i) => ({
            text: `${i + 1}. ${typeof q === 'string' ? q : q.text || q}`,
            options: { fontSize: 16, fontFace: fontForLang(language), color: theme.textColor, breakLine: true, paraSpaceAfter: 12 }
          }))
          slide.addText(exTexts, {
            x: 1, y: 1.5, w: 11, h: 5.5, valign: 'top'
          })
          break

        case 'chart':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
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
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
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
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          let leftImg = null, rightImg = null
          try {
            const kwL = sanitizeKeyword(slideData.search_keyword_left || '')
            const kwR = sanitizeKeyword(slideData.search_keyword_right || '')
            if (kwL || kwR) { onProgress({ type: 'pptx_progress', step: 'image_search', message: `🔍 搜索对比图片: ${kwL || ''} vs ${kwR || ''}` }) }
            ;[leftImg, rightImg] = await Promise.all([
              kwL ? getImageForKeyword(kwL) : Promise.resolve(null),
              kwR ? getImageForKeyword(kwR) : Promise.resolve(null)
            ])
          } catch (e) { console.error('[PPTX] compare image search error:', e.message) }
          const leftTitleY = leftImg ? 4.2 : 1.5
          const leftTextY = leftImg ? 4.7 : 2
          const leftTextH = leftImg ? 2 : 4.5
          const rightTitleY = rightImg ? 4.2 : 1.5
          const rightTextY = rightImg ? 4.7 : 2
          const rightTextH = rightImg ? 2 : 4.5
          if (leftImg) { slide.addImage({ data: leftImg, x: 0.5, y: 1.5, w: 5.5, h: 2.5, sizing: { type: 'contain', w: 5.5, h: 2.5 } }) }
          if (rightImg) { slide.addImage({ data: rightImg, x: 6.5, y: 1.5, w: 5.5, h: 2.5, sizing: { type: 'contain', w: 5.5, h: 2.5 } }) }
          if (slideData.left) {
            slide.addText(slideData.left.title || 'A', {
              x: 0.5, y: leftTitleY, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: theme.accent, fontFace: fontForLang(language)
            })
            const leftItems = (slideData.left.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n')
            slide.addText(leftItems, { x: 0.5, y: leftTextY, w: 5.5, h: leftTextH, fontSize: 14, fontFace: fontForLang(language), color: theme.textColor, valign: 'top' })
          }
          slide.addShape(pres.ShapeType.rect, { x: 6.25, y: 1.5, w: 0.02, h: 5, fill: { color: theme.accent } })
          if (slideData.right) {
            slide.addText(slideData.right.title || 'B', {
              x: 6.5, y: rightTitleY, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: '#E67E22', fontFace: fontForLang(language)
            })
            const rightItems = (slideData.right.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n')
            slide.addText(rightItems, { x: 6.5, y: rightTextY, w: 5.5, h: rightTextH, fontSize: 14, fontFace: fontForLang(language), color: theme.textColor, valign: 'top' })
          }
          break

        case 'image':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          const imgQuery = sanitizeKeyword(slideData.search_keyword || slideData.description || slideData.title || topic)
          let imgBuf = null
          try { imgBuf = await getImageForSlide(slideData, topic) } catch (e) { console.error('[PPTX] image search error:', e.message) }
          if (imgBuf) {
            onProgress({ type: 'pptx_progress', step: 'image_found', message: `📷 已嵌入图片: ${imgQuery}` })
            slide.addImage({ data: imgBuf, x: 2, y: 1.8, w: 9, h: 5, sizing: { type: 'contain', w: 9, h: 5 } })
          } else {
            onProgress({ type: 'pptx_progress', step: 'image_fallback', message: `⚠️ 图片搜索无结果: ${imgQuery}` })
            slide.addShape(pres.ShapeType.rect, {
              x: 2, y: 1.8, w: 9, h: 5,
              fill: { color: 'F0F4F8' }, line: { color: theme.accent || '4A9EFF', width: 1.5, dashType: 'dash' },
              rectRadius: 0.1
            })
            slide.addText(`[图片: ${imgQuery}]`, {
              x: 2, y: 3, w: 9, h: 2,
              fontSize: 16, color: '999999', fontFace: fontForLang(language), align: 'center', valign: 'middle'
            })
            if (slideData.description && slideData.description !== slideData.title) {
              slide.addText(slideData.description, {
                x: 1, y: 6.5, w: 11, h: 1,
                fontSize: 12, color: theme.textColor, fontFace: fontForLang(language), align: 'center', valign: 'top'
              })
            }
          }
          break

        case 'formula':
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
          })
          slide.addShape(pres.ShapeType.rect, {
            x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' }
          })
          if (slideData.formulas?.length) {
            const formulaTexts = slideData.formulas.map(f => {
              const plain = f.replace(/^\$|\$$/g, '').trim()
              try {
                const html = katex.renderToString(plain, { displayMode: false, throwOnError: false })
                const txt = html.replace(/<[^>]*>/g, '').trim()
                return { text: txt, options: { fontSize: 20, fontFace: 'Calibri', color: theme.textColor, italic: true, breakLine: true, paraSpaceAfter: 14, align: 'center' } }
              } catch {
                return { text: plain, options: { fontSize: 20, fontFace: 'Calibri', color: theme.textColor, italic: true, breakLine: true, paraSpaceAfter: 14, align: 'center' } }
              }
            })
            slide.addText(formulaTexts, {
              x: 1, y: 2, w: 11, h: 4.5, valign: 'middle'
            })
          }
          break

        case 'summary':
          slide.background = { fill: theme.bg }
          slide.addText(slideData.title || '本章小结', {
            x: 1, y: 1, w: 11, h: 1.5,
            fontSize: 32, bold: true, color: theme.titleColor, fontFace: fontForLang(language), align: 'center'
          })
          if (slideData.items?.length) {
            const sumItems = slideData.items.map(item => ({
              text: '· ' + (typeof item === 'string' ? item : item.text || item),
              options: { fontSize: 18, color: theme.titleColor, fontFace: fontForLang(language), breakLine: true, paraSpaceAfter: 6 }
            }))
            slide.addText(sumItems, {
              x: 1.5, y: 3, w: 10, h: 4, valign: 'top'
            })
          }
          break

        default:
          slide.addText(slideData.title || '', {
            x: 0.5, y: 0.3, w: 12, h: 0.8,
            fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: fontForLang(language)
          })
          slide.addText(slideData.content || '', {
            x: 1, y: 1.5, w: 11, h: 5,
            fontSize: 16, fontFace: fontForLang(language), color: theme.textColor
          })
      }
    }

    const slidesWithTransitions = new Set(transitions.map(t => t.slideIndex))
    for (let i = 0; i < outline.slides.length; i++) {
      if (!slidesWithTransitions.has(i + 1)) {
        transitions.push({ slideIndex: i + 1, type: 'fade', duration: 0.5 })
      }
    }

    onProgress({ type: 'pptx_progress', step: 'saving', message: '💾 正在保存课件文件...' })

    const safeName = topic.replace(/[<>:"/\\|?*]/g, '_').slice(0, 40)
    const debugTag = debug ? '(调试)' : ''
    const fileName = `${safeName}${debugTag}_${Date.now()}.pptx`
    const savePath = join(getPPTDir(), fileName)

    await pres.writeFile({ fileName: savePath })

    if (transitions.length > 0) {
      injectTransitions(savePath, transitions)
    }

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
        debug: !!debug,
        createdAt: new Date().toISOString()
      }, null, 2))
    } catch (e) { console.error('[PPTX] 元数据保存失败:', e.message) }

    const debugMsg = debug ? '（调试模式，不会出现在内容库中）' : ''
    return {
      success: true,
      message: `✅ ${debug ? '调试' : ''}课件已生成：${fileName}（${outline.slides?.length || 0} 页）${debugMsg}`,
      path: savePath,
      fileName,
      slideCount: outline.slides?.length || 0
    }

  } catch (error) {
    console.error('[PPTX] 生成失败:', error)
    return { success: false, message: `课件生成失败：${error.message}` }
  }
}

async function callLLMForEditOutline(currentOutline, instructions) {
  const apiKey = getCloudAPIKey()
  const res = await callLLM([
    { role: 'system', content: 'You are a courseware editor. Modify the slide outline per the user\'s instructions. Output valid JSON only, no markdown fences. Preserve slide types: title|content|bullets|chart|table|compare|image|formula|exercise|summary.' },
    { role: 'user', content: `Current outline (JSON):\n${JSON.stringify(currentOutline, null, 2)}\n\nEdit instructions: ${instructions}\n\nReturn the FULL modified JSON outline.` }
  ], apiKey, 0.4)
  return parseJSONResponse(res.data?.choices?.[0]?.message?.content)
}

async function generatePPTXFromMeta(metaPath, onProgress, instructions) {
  try {
    const rawMeta = fs.readFileSync(metaPath, 'utf-8')
    let meta = JSON.parse(rawMeta)

    if (instructions && meta.outline) {
      onProgress({ type: 'pptx_progress', step: 'editing', message: '📝 正在根据指示修改课件...' })
      try {
        meta.outline = await callLLMForEditOutline(meta.outline, instructions)
        meta.topic = meta.outline.title || meta.topic
      } catch (e) {
        throw new Error(`修改课件失败：${e.message}`)
      }
    }

    onProgress({ type: 'pptx_progress', step: 'building', message: '正在重新生成幻灯片...', slideCount: meta.outline?.slides?.length })

    const language = detectLanguage(meta.topic, '')

    const theme = SLIDE_THEMES[meta.theme] || SLIDE_THEMES.blue
    const pres = new PptxGenJS()
    pres.layout = 'LAYOUT_WIDE'
    pres.author = 'Electronic AI'
    pres.title = meta.topic

    const transitions = []

    for (let i = 0; i < (meta.outline?.slides || []).length; i++) {
      const slideData = meta.outline.slides[i]
      const slide = pres.addSlide()
      if (slideData.transition) {
        transitions.push({ slideIndex: i + 1, type: slideData.transition, duration: 0.6 })
      }
      await renderSlide(slide, slideData, pres, theme, meta.topic, language)
    }

    const safeName = meta.topic.replace(/[<>:"/\\|?*]/g, '_').slice(0, 40)
    const fileName = `${safeName}_${Date.now()}.pptx`
    const savePath = join(getPPTDir(), fileName)

    await pres.writeFile({ fileName: savePath })

    if (transitions.length > 0) {
      injectTransitions(savePath, transitions)
    }

    const pptxSize = fs.existsSync(savePath) ? fs.statSync(savePath).size : 0
    fs.writeFileSync(savePath.replace('.pptx', '.meta.json'), JSON.stringify({
      ...meta, type: 'pptx', pptxSize, createdAt: new Date().toISOString()
    }, null, 2))

    return { success: true, path: savePath, fileName, slideCount: meta.outline?.slides?.length || 0, message: `✅ 课件已更新：${fileName}。点击卡片打开文件，或在「内容库」中查看。` }
  } catch (error) {
    return { success: false, message: `课件编辑失败：${error.message}` }
  }
}

async function renderSlide(slide, slideData, pres, theme, topic, language = 'zh-CN') {
  const ff = fontForLang(language)
  switch (slideData.type) {
    case 'title':
      slide.background = { fill: theme.bg }
      slide.addText(slideData.title || topic, { x: 1, y: 1.5, w: 11, h: 2, fontSize: 40, bold: true, color: theme.titleColor, fontFace: ff, align: 'center' })
      if (slideData.content) {
        slide.addText(slideData.content, { x: 1, y: 4, w: 11, h: 1.5, fontSize: 20, color: theme.titleColor, fontFace: ff, align: 'center' })
      }
      break
    case 'bullets':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.items?.length) {
        slide.addText(slideData.items.map(item => ({ text: typeof item === 'string' ? item : item.text || item, options: { bullet: true, fontSize: 18, fontFace: ff, color: theme.textColor, breakLine: true, paraSpaceAfter: 8 } })), { x: 1, y: 1.5, w: 11, h: 5, valign: 'top' })
      }
      break
    case 'content':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      slide.addText(slideData.content || '', { x: 1, y: 1.5, w: 11, h: 5, fontSize: 16, fontFace: ff, color: theme.textColor, valign: 'top' })
      break
    case 'exercise':
      slide.addText(slideData.title || '练习', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addText((slideData.items || []).map((q, i) => ({ text: `${i + 1}. ${typeof q === 'string' ? q : q.text || q}`, options: { fontSize: 16, fontFace: ff, color: theme.textColor, breakLine: true, paraSpaceAfter: 12 } })), { x: 1, y: 1.5, w: 11, h: 5.5, valign: 'top' })
      break
    case 'image':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
            let imgBuf = null
      try { imgBuf = await getImageForSlide(slideData, topic) } catch (e) { console.error('[PPTX] renderSlide image error:', e.message) }
      if (imgBuf) {
        console.log('[PPTX] image embedded:', slideData.title)
        slide.addImage({ data: imgBuf, x: 2, y: 1.8, w: 9, h: 5, sizing: { type: 'contain', w: 9, h: 5 } }
)
      } else {
        slide.addShape(pres.ShapeType.rect, { x: 2, y: 1.8, w: 9, h: 5, fill: { color: 'F0F4F8' }, line: { color: theme.accent || '4A9EFF', width: 1.5, dashType: 'dash' }, rectRadius: 0.1 })
        slide.addText(`[图片: ${slideData.description || slideData.title || '插图'}]`, { x: 2, y: 3, w: 9, h: 2, fontSize: 16, color: '999999', fontFace: ff, align: 'center', valign: 'middle' })
        if (slideData.description && slideData.description !== slideData.title) {
          slide.addText(slideData.description, { x: 1, y: 6.5, w: 11, h: 1, fontSize: 12, color: theme.textColor, fontFace: ff, align: 'center', valign: 'top' })
        }
      }
      break
    case 'formula':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.formulas?.length) {
        slide.addText(slideData.formulas.map(f => {
          const plain = f.replace(/^\$|\$$/g, '').trim()
          try {
            const txt = katex.renderToString(plain, { displayMode: false, throwOnError: false }).replace(/<[^>]*>/g, '').trim()
            return { text: txt, options: { fontSize: 20, fontFace: 'Calibri', color: theme.textColor, italic: true, breakLine: true, paraSpaceAfter: 14, align: 'center' } }
          } catch {
            return { text: plain, options: { fontSize: 20, fontFace: 'Calibri', color: theme.textColor, italic: true, breakLine: true, paraSpaceAfter: 14, align: 'center' } }
          }
        }), { x: 1, y: 2, w: 11, h: 4.5, valign: 'middle' })
      }
      break
    case 'summary':
      slide.background = { fill: theme.bg }
      slide.addText(slideData.title || '本章小结', { x: 1, y: 1, w: 11, h: 1.5, fontSize: 32, bold: true, color: theme.titleColor, fontFace: ff, align: 'center' })
      if (slideData.items?.length) {
        slide.addText(slideData.items.map(item => ({ text: '· ' + (typeof item === 'string' ? item : item.text || item), options: { fontSize: 18, color: theme.titleColor, fontFace: ff, breakLine: true, paraSpaceAfter: 6 } })), { x: 1.5, y: 3, w: 10, h: 4, valign: 'top' })
      }
      break
    case 'chart':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.chartData) {
        const ct = slideData.chartData.type === 'pie' ? 'pie' : slideData.chartData.type === 'line' ? 'line' : 'bar'
        slide.addChart(ct, slideData.chartData.series || [], { x: 0.8, y: 1.5, w: 11.5, h: 5, showTitle: false, showLegend: true, legendPos: 'b', showValue: ct !== 'line', chartColors: [theme.accent || '4A9EFF', 'E67E22', '27AE60', '9B59B6', 'F39C12'] })
      }
      break
    case 'table':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      if (slideData.headers?.length && slideData.rows?.length) {
        const hRow = slideData.headers.map(h => ({ text: h, options: { bold: true, fill: { color: theme.accent || '4A9EFF' }, color: 'FFFFFF', fontSize: 14 } }))
        const dRows = slideData.rows.map(r => r.map(c => ({ text: String(c), options: { fontSize: 13 } })))
        slide.addTable([hRow, ...dRows], { x: 0.5, y: 1.5, w: 12, colW: Array(slideData.headers.length).fill(12 / slideData.headers.length), border: { type: 'solid', pt: 0.5, color: 'D0D0D0' } })
      }
      break
    case 'compare':
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 1.1, w: 12, h: 0.03, fill: { color: theme.accent || '2980B9' } })
      let cLeftImg = null, cRightImg = null
      try {
        const kwL = sanitizeKeyword(slideData.search_keyword_left || '')
        const kwR = sanitizeKeyword(slideData.search_keyword_right || '')
        ;[cLeftImg, cRightImg] = await Promise.all([
          kwL ? getImageForKeyword(kwL) : Promise.resolve(null),
          kwR ? getImageForKeyword(kwR) : Promise.resolve(null)
        ])
      } catch (e) { console.error('[PPTX] compare image search error:', e.message) }
      const cLty = cLeftImg ? 4.2 : 1.5
      const cLxy = cLeftImg ? 4.7 : 2
      const cLh = cLeftImg ? 2 : 4.5
      const cRty = cRightImg ? 4.2 : 1.5
      const cRxy = cRightImg ? 4.7 : 2
      const cRh = cRightImg ? 2 : 4.5
      if (cLeftImg) { slide.addImage({ data: cLeftImg, x: 0.5, y: 1.5, w: 5.5, h: 2.5, sizing: { type: 'contain', w: 5.5, h: 2.5 } }) }
      if (cRightImg) { slide.addImage({ data: cRightImg, x: 6.5, y: 1.5, w: 5.5, h: 2.5, sizing: { type: 'contain', w: 5.5, h: 2.5 } }) }
      if (slideData.left) {
        slide.addText(slideData.left.title || 'A', { x: 0.5, y: cLty, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: theme.accent, fontFace: ff })
        slide.addText((slideData.left.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n'), { x: 0.5, y: cLxy, w: 5.5, h: cLh, fontSize: 14, fontFace: ff, color: theme.textColor, valign: 'top' })
      }
      slide.addShape(pres.ShapeType.rect, { x: 6.25, y: 1.5, w: 0.02, h: 5, fill: { color: theme.accent } })
      if (slideData.right) {
        slide.addText(slideData.right.title || 'B', { x: 6.5, y: cRty, w: 5.5, h: 0.5, fontSize: 18, bold: true, color: '#E67E22', fontFace: ff })
        slide.addText((slideData.right.items || []).map(i => '· ' + (typeof i === 'string' ? i : i.text || i)).join('\n'), { x: 6.5, y: cRxy, w: 5.5, h: cRh, fontSize: 14, fontFace: ff, color: theme.textColor, valign: 'top' })
      }
      break
    default:
      slide.addText(slideData.title || '', { x: 0.5, y: 0.3, w: 12, h: 0.8, fontSize: 28, bold: true, color: theme.accent || '2C3E50', fontFace: ff })
      slide.addText(slideData.content || '', { x: 1, y: 1.5, w: 11, h: 5, fontSize: 16, fontFace: ff, color: theme.textColor })
  }
}

export { generatePPTX, generatePPTXFromMeta, SLIDE_THEMES }
