import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { getPPTDir } from '../config.js'
import { join } from 'node:path'
import fs from 'fs'

async function generateHandout(pptxResult, topic, outline) {
  try {
    const children = [
      new Paragraph({
        text: topic || '课件讲义',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        children: [new TextRun({ text: `共 ${pptxResult.slideCount || 0} 页 | 生成时间：${new Date().toLocaleString('zh-CN')}`, size: 22, color: '888888' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({ text: '' })
    ]

    if (outline?.slides?.length) {
      children.push(new Paragraph({
        text: '内容概览',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }))
      for (let i = 0; i < outline.slides.length; i++) {
        const s = outline.slides[i]
        const typeLabel = { title: '封面', bullets: '要点', content: '正文', chart: '图表', table: '表格', compare: '对比', image: '图片', exercise: '练习', summary: '小结' }[s.type] || s.type
        children.push(new Paragraph({
          children: [new TextRun({ text: `${i + 1}. [${typeLabel}] ${s.title || ''}`, bold: true, size: 24 })],
          spacing: { after: 80 }
        }))
        if (s.items?.length) {
          for (const item of s.items) {
            const text = typeof item === 'string' ? item : item.text || item
            children.push(new Paragraph({ text: `   • ${text}`, spacing: { after: 60 } }))
          }
        }
        if (s.content) {
          children.push(new Paragraph({ text: `   ${s.content.slice(0, 200)}`, spacing: { after: 100 } }))
        }
        if (s.chartData) {
          children.push(new Paragraph({ text: `   [图表类型: ${s.chartData.type || 'bar'}]`, spacing: { after: 80 } }))
        }
        if (s.headers?.length) {
          children.push(new Paragraph({ text: `   [表格: ${s.headers.join(' | ')}]`, spacing: { after: 80 } }))
        }
      }
    } else {
      children.push(new Paragraph({
        text: '课件文件',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }))
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `课件文件：${pptxResult.fileName || ''}`, bold: true, size: 24 }),
          new TextRun({ text: '\n页数：' + (pptxResult.slideCount || 0) + ' 页', size: 22 })
        ],
        spacing: { after: 200 }
      }))
    }

    children.push(new Paragraph({ text: '' }))
    children.push(new Paragraph({
      text: '说明',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 }
    }))
    children.push(new Paragraph({
      children: [new TextRun({ text: '本文档为 AI 自动生成的课件配套讲义。请结合 .pptx 课件文件使用。', size: 22 })]
    }))

    const doc = new Document({
      sections: [{
        properties: {},
        children
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    const safeName = topic.replace(/[<>:"/\\|?*]/g, '_').slice(0, 30)
    const fileName = `${safeName}_讲义_${Date.now()}.docx`
    const savePath = join(getPPTDir(), fileName)

    fs.writeFileSync(savePath, buffer)

    return {
      success: true,
      fileName,
      path: savePath,
      message: `讲义已生成：${fileName}`
    }
  } catch (error) {
    console.error('[Handout] 生成失败:', error)
    return { success: false, message: `讲义生成失败：${error.message}` }
  }
}

export { generateHandout }
