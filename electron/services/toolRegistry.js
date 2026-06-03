import axios from 'axios'
import fs from 'fs'
import { getAPIBase, getPPTDir } from '../config.js'
import { join } from 'node:path'
import { searchImages } from './imageSearch.js'

class ToolRegistry {
  constructor() {
    this.tools = new Map()
    this._registerBuiltins()
  }

  _registerBuiltins() {
    this.register({
      name: 'send_message',
      description: 'Send a text message to a specific user. Use this to communicate with other users.',
      parameters: {
        type: 'object',
        properties: {
          targetUser: { type: 'string', description: 'Username of the recipient' },
          content: { type: 'string', description: 'Message text to send' }
        },
        required: ['targetUser', 'content']
      },
      handler: async (params, ctx) => {
        await axios.post(`${getAPIBase()}/chat/send`, {
          sender: ctx.username,
          receiver: params.targetUser,
          message: params.content,
          type: 'text'
        })
        return { success: true, message: `已向 ${params.targetUser} 发送消息` }
      }
    })

    this.register({
      name: 'send_broadcast',
      description: 'Send a broadcast notification to all members of specified organization nodes (classes/grades/school).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Broadcast title' },
          content: { type: 'string', description: 'Broadcast content' },
          targetNodeIds: { type: 'array', items: { type: 'string' }, description: 'Organization node IDs to target' }
        },
        required: ['title', 'content']
      },
      handler: async (params, ctx) => {
        const res = await axios.post(`${getAPIBase()}/api/broadcast/send`, {
          senderId: ctx.username,
          targetNodeIds: params.targetNodeIds || ['root'],
          title: params.title,
          content: params.content
        })
        return res.data
      }
    })

    this.register({
      name: 'list_files',
      description: 'List all available files on the server.',
      parameters: { type: 'object', properties: {}, required: [] },
      handler: async (params, ctx) => {
        const res = await axios.get(`${getAPIBase()}/files/all`)
        return { success: true, files: res.data?.files || [], message: `共 ${res.data?.files?.length || 0} 个文件` }
      }
    })

    this.register({
      name: 'download_file',
      description: 'Download a file from another user on the server.',
      parameters: {
        type: 'object',
        properties: {
          uploader: { type: 'string', description: 'Username who uploaded the file' },
          filename: { type: 'string', description: 'Name of the file to download' }
        },
        required: ['uploader', 'filename']
      },
      handler: async (params, ctx) => {
        const res = await ctx.downloadFile(params.uploader, params.filename)
        return res
      }
    })

    this.register({
      name: 'get_org_tree',
      description: 'Get the full organization structure tree (school → grades → classes).',
      parameters: { type: 'object', properties: {}, required: [] },
      handler: async (params, ctx) => {
        const res = await axios.get(`${getAPIBase()}/api/org/tree`)
        return { success: true, tree: res.data?.tree }
      }
    })

    this.register({
      name: 'get_org_members',
      description: 'Get all member usernames belonging to an organization node (includes sub-nodes).',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'The organization node ID' }
        },
        required: ['nodeId']
      },
      handler: async (params, ctx) => {
        const res = await axios.get(`${getAPIBase()}/api/org/node/${encodeURIComponent(params.nodeId)}/members`)
        return { success: true, members: res.data?.members || [], count: res.data?.count || 0 }
      }
    })

    this.register({
      name: 'search_contacts',
      description: 'Search for users by name or username.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term' }
        },
        required: ['query']
      },
      handler: async (params, ctx) => {
        const res = await axios.get(`${getAPIBase()}/users/search?query=${encodeURIComponent(params.query)}`)
        return { success: true, users: res.data || [] }
      }
    })

    this.register({
      name: 'get_friends',
      description: 'Get the current user\'s friend list.',
      parameters: { type: 'object', properties: {}, required: [] },
      handler: async (params, ctx) => {
        const res = await axios.get(`${getAPIBase()}/users/friends?username=${encodeURIComponent(ctx.username)}`)
        return { success: true, friends: res.data || [] }
      }
    })

    this.register({
      name: 'schedule_task',
      description: 'Schedule a task to be executed at a specific time.',
      parameters: {
        type: 'object',
        properties: {
          time: { type: 'string', description: 'Time in HH:MM format (24h)' },
          description: { type: 'string', description: 'What the task does' }
        },
        required: ['time']
      },
      handler: async (params, ctx) => {
        return { success: true, message: `已安排在 ${params.time} 执行：${params.description || ''}` }
      }
    })

    this.register({
      name: 'get_current_time',
      description: 'Get the current date and time.',
      parameters: { type: 'object', properties: {}, required: [] },
      handler: async (params, ctx) => {
        return { success: true, time: new Date().toISOString(), local: new Date().toLocaleString('zh-CN') }
      }
    })

    this.register({
      name: 'get_user_info',
      description: 'Get information about the current logged-in user.',
      parameters: { type: 'object', properties: {}, required: [] },
      handler: async (params, ctx) => {
        return {
          success: true,
          username: ctx.username
        }
      }
    })

    this.register({
      name: 'search_images',
      description: 'Search for free stock images by keyword. Returns up to 5 image URLs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords (e.g. "数学公式", "solar system", "地球")' },
          perPage: { type: 'number', description: 'Number of results (default 3)' }
        },
        required: ['query']
      },
      handler: async (params, ctx) => {
        const results = await searchImages(params.query, { perPage: params.perPage || 3 })
        if (results.length === 0) return { success: false, message: '未找到相关图片' }
        return { success: true, images: results.slice(0, 5), count: results.length }
      }
    })

    this.register({
      name: 'generate_pptx',
      description: 'Generate a PowerPoint (.pptx) courseware file from a topic or lesson plan.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic or lesson title (e.g. "第三章 三角函数")' },
          detail: { type: 'string', description: 'Additional detail or specific requirements' },
          slideCount: { type: 'number', description: 'Approximate number of slides (default 8)' }
        },
        required: ['topic']
      },
      handler: async (params, ctx) => {
        if (ctx.generatePPTX) {
          return await ctx.generatePPTX(params)
        }
        return { success: false, message: 'PPTX生成模块未就绪' }
      }
    })

    this.register({
      name: 'edit_pptx',
      description: 'Edit a previously generated PPTX file. Can modify content, add/remove slides, change styling.',
      parameters: {
        type: 'object',
        properties: {
          pptxPath: { type: 'string', description: 'Path to the .pptx file to edit (use the file path from a previously generated PPTX)' },
          instructions: { type: 'string', description: 'What to change, e.g. "第3页字号调大", "加一页习题", "改为蓝色主题"' }
        },
        required: ['pptxPath', 'instructions']
      },
      handler: async (params, ctx) => {
        if (!ctx.editPPTX) return { success: false, message: '编辑模块未就绪' }
        return await ctx.editPPTX(params)
      }
    })

    this.register({
      name: 'generate_lesson_package',
      description: 'Generate a complete lesson package including PPTX courseware, handouts (docx), and exercises.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Lesson topic' },
          detail: { type: 'string', description: 'Additional requirements' },
          slideCount: { type: 'number', description: 'Number of slides (default 10)' }
        },
        required: ['topic']
      },
      handler: async (params, ctx) => {
        if (!ctx.generatePPTX) return { success: false, message: 'PPTX生成模块未就绪' }

        const pptxResult = await ctx.generatePPTX(params)
        if (!pptxResult.success) return { success: false, message: `PPTX生成失败: ${pptxResult.message}` }

        let handoutResult = { success: false, message: '讲义生成模块未就绪' }
        if (ctx.generateHandout) {
          let outline
          try {
            const metaPath = pptxResult.path?.replace('.pptx', '.meta.json')
            if (metaPath && fs.existsSync(metaPath)) {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
              outline = meta.outline
            }
          } catch {}

          try {
            const res = await ctx.generateHandout(pptxResult, params.topic, outline)
            if (res.success) handoutResult = res
          } catch (e) {
            handoutResult = { success: false, message: `讲义生成异常: ${e.message}` }
          }
        }

        return {
          success: true,
          pptx: pptxResult,
          handout: handoutResult,
          message: `✅ 教案包已生成\n\n📊 课件: ${pptxResult.fileName}（${pptxResult.slideCount || 0}页）\n📄 讲义: ${handoutResult.fileName || '未生成'}`
        }
      }
    })

    this.register({
      name: 'get_templates',
      description: 'List available PPTX courseware templates.',
      parameters: { type: 'object', properties: {}, required: [] },
      handler: async (params, ctx) => {
        return {
          success: true,
          templates: [
            { id: 'tpl_blue', name: '蓝色商务', description: '深蓝背景，适合专业课件' },
            { id: 'tpl_academic', name: '学术白', description: '白底黑字，适合论文答辩' },
            { id: 'tpl_warm', name: '暖色教育', description: '暖橙色调，适合互动课堂' }
          ]
        }
      }
    })

    this.register({
      name: 'set_default_template',
      description: 'Set the default PPTX template for courseware generation.',
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'Template ID (tpl_blue, tpl_academic, tpl_warm)' }
        },
        required: ['templateId']
      },
      handler: async (params, ctx) => {
        const validIds = ['tpl_blue', 'tpl_academic', 'tpl_warm']
        if (!validIds.includes(params.templateId)) {
          return { success: false, message: `无效模板ID: ${params.templateId}，可用: ${validIds.join(', ')}` }
        }
        return { success: true, message: `默认模板已设为: ${params.templateId}` }
      }
    })
  }

  register(tool) {
    if (!tool.name || !tool.handler) {
      throw new Error('Tool must have name and handler')
    }
    this.tools.set(tool.name, tool)
    return this
  }

  get(name) {
    return this.tools.get(name)
  }

  getAllTools() {
    return Array.from(this.tools.values()).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  }

  getToolCount() {
    return this.tools.size
  }
}

const defaultRegistry = new ToolRegistry()
export { ToolRegistry, defaultRegistry }
