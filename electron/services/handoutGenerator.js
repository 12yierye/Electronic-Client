import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { getPPTDir } from '../config.js'
import { join } from 'node:path'
import fs from 'fs'

async function generateHandout(pptxResult, topic) {
  try {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
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
          new Paragraph({ text: '' }),

          new Paragraph({
            text: '内容概览',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: `课件文件：${pptxResult.fileName || ''}`, bold: true, size: 24 }),
              new TextRun({ text: '\n页数：' + (pptxResult.slideCount || 0) + ' 页', size: 22 })
            ],
            spacing: { after: 200 }
          }),

          new Paragraph({ text: '' }),
          new Paragraph({
            text: '说明',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),
          new Paragraph({
            children: [new TextRun({ text: '本文档为 AI 自动生成的课件配套讲义。请结合 .pptx 课件文件使用。详细内容和数据请参考课件中的图表和表格。', size: 22 })]
          })
        ]
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
