// 简单的拼音匹配工具（基础版）
// 注意：这是一个简化实现，仅支持基本的拼音匹配

const PINYIN_MAP = {
  'a': '阿啊', 'ai': '艾爱', 'an': '安按', 'ang': '昂', 'ao': '奥',
  'b': '八', 'ba': '巴把爸', 'bai': '百白拜', 'ban': '班办半', 'bang': '帮', 'bao': '包报保', 'bei': '北被背', 'ben': '本', 'beng': '崩', 'bi': '比必笔', 'bian': '边变便', 'biao': '表', 'bie': '别', 'bin': '宾', 'bing': '兵病', 'bo': '波播博',
  'c': '才', 'ca': '擦', 'cai': '才彩菜', 'can': '参餐', 'cang': '仓', 'cao': '草操', 'ce': '策', 'ceng': '层', 'cha': '茶查', 'chai': '柴', 'chan': '产单', 'chang': '长厂', 'chao': '朝超', 'che': '车', 'chen': '陈沉', 'cheng': '成城程', 'chi': '吃迟', 'chong': '充冲', 'chou': '抽', 'chu': '初出', 'chuan': '传船', 'chuang': '窗', 'chui': '吹', 'chun': '春', 'ci': '次', 'cong': '从', 'cou': '凑', 'cu': '粗', 'cuan': '窜', 'cui': '脆', 'cun': '村', 'cuo': '错',
  'd': '大', 'da': '大打', 'dai': '待代带', 'dan': '单但蛋', 'dang': '当党', 'dao': '到道导', 'de': '的', 'dei': '得', 'den': '扽', 'deng': '等', 'di': '低弟第', 'dian': '电点店', 'diao': '掉', 'die': '爹', 'ding': '定丁', 'diu': '丢', 'dong': '东动', 'dou': '都斗', 'du': '都度读', 'duan': '短段', 'dui': '对', 'dun': '吨', 'duo': '多',
  'e': '俄', 'en': '嗯', 'er': '而儿二',
  'f': '发', 'fa': '发法', 'fan': '饭反烦', 'fang': '房方', 'fei': '飞非', 'fen': '分', 'feng': '风封', 'fo': '佛', 'fou': '否', 'fu': '夫福父服负复',
  'g': '个', 'ga': '嘎', 'gai': '改', 'gan': '感干', 'gang': '刚', 'gao': '高搞', 'ge': '各歌格', 'gei': '给', 'gen': '根', 'geng': '更', 'gong': '工公', 'gou': '够狗', 'gu': '古', 'gua': '挂瓜', 'guai': '怪', 'guan': '关管', 'guang': '光', 'gui': '规贵', 'gun': '棍', 'guo': '国过',
  'h': '好', 'ha': '哈', 'hai': '海', 'han': '汉寒', 'hang': '行航', 'hao': '好号', 'he': '和合', 'hei': '黑', 'hen': '很', 'heng': '横', 'hong': '红宏', 'hou': '后厚', 'hu': '乎湖', 'hua': '花话', 'huai': '怀', 'huan': '环换', 'huang': '黄', 'hui': '会回', 'hun': '婚', 'huo': '活火',
  'j': '家', 'ji': '几记计季级继极', 'jia': '家加', 'jian': '见建间', 'jiang': '江将讲', 'jiao': '交教叫', 'jie': '节解接', 'jin': '进今近', 'jing': '京经', 'jiong': '炯', 'jiu': '久就', 'ju': '局举具', 'juan': '卷', 'jue': '觉决', 'jun': '军',
  'k': '可', 'ka': '卡', 'kai': '开', 'kan': '看', 'kang': '康', 'kao': '考', 'ke': '可科课', 'ken': '肯', 'keng': '坑', 'kong': '空', 'kou': '口', 'ku': '库', 'kua': '夸', 'kuai': '快', 'kuan': '宽', 'kuang': '况', 'kui': '亏', 'kun': '困', 'kuo': '扩阔',
  'l': '了', 'la': '拉', 'lai': '来', 'lan': '蓝兰', 'lang': '郎', 'lao': '老', 'le': '乐', 'lei': '累', 'leng': '冷', 'li': '里理李力历利', 'lian': '连练', 'liang': '梁两亮', 'liao': '了料', 'lie': '列', 'lin': '林临', 'ling': '零领', 'liu': '刘六留流', 'long': '龙', 'lou': '楼', 'lu': '路录', 'luan': '乱', 'lue': '略', 'lun': '轮', 'luo': '罗落',
  'm': '们', 'ma': '妈马', 'mai': '买卖', 'man': '满慢', 'mang': '忙', 'mao': '毛猫', 'me': '么', 'mei': '美每', 'men': '们门', 'meng': '梦', 'mi': '米密', 'mian': '面', 'miao': '苗', 'mie': '灭', 'min': '民', 'ming': '名明命', 'mo': '莫末', 'mou': '某', 'mu': '母木目',
  'n': '你', 'na': '那拿', 'nai': '乃耐', 'nan': '男南难', 'nang': '囊', 'nao': '脑', 'ne': '呢', 'nei': '内', 'nen': '嫩', 'neng': '能', 'ni': '你尼泥', 'nian': '年', 'niang': '娘', 'niao': '鸟', 'nie': '捏', 'nin': '您', 'ning': '宁', 'niu': '牛', 'nong': '农', 'nou': '耨', 'nu': '奴', 'nuan': '暖', 'nue': '虐', 'nuo': '挪诺',
  'o': '哦', 'ou': '偶欧',
  'p': '怕', 'pa': '怕爬', 'pai': '拍排', 'pan': '盘判', 'pang': '旁', 'pao': '跑炮', 'pei': '配陪', 'pen': '盆', 'peng': '朋碰', 'pi': '皮批', 'pian': '片', 'piao': '飘', 'pie': '瞥', 'pin': '品', 'ping': '平', 'po': '破', 'pou': '剖', 'pu': '铺普',
  'q': '七', 'qi': '七期起气', 'qia': '恰', 'qian': '前千钱', 'qiang': '强', 'qiao': '桥敲', 'qie': '且切', 'qin': '亲勤', 'qing': '青清轻', 'qiong': '穷', 'qiu': '秋求', 'qu': '去区取', 'quan': '全权', 'que': '却缺', 'qun': '群',
  'r': '日', 'ran': '然', 'rang': '让', 'rao': '扰', 're': '热', 'ren': '人', 'reng': '仍', 'ri': '日', 'rong': '荣容', 'rou': '肉', 'ru': '入如', 'ruan': '软', 'rui': '锐', 'run': '润', 'ruo': '若弱',
  's': '是', 'sa': '撒', 'sai': '赛', 'san': '三散', 'sang': '桑', 'sao': '扫', 'se': '色', 'sen': '森', 'seng': '僧', 'sha': '沙', 'shai': '晒', 'shan': '山', 'shang': '上商', 'shao': '少', 'she': '社设', 'shei': '谁', 'shen': '身神', 'sheng': '生声', 'shi': '是十时', 'shou': '手首', 'shu': '书数', 'shua': '刷', 'shuai': '帅', 'shuan': '栓', 'shuang': '双', 'shui': '水', 'shun': '顺', 'shuo': '说', 'si': '思', 'song': '送', 'sou': '搜', 'su': '速', 'suan': '算', 'sui': '岁', 'sun': '孙', 'suo': '锁所',
  't': '他', 'ta': '他她它', 'tai': '太台', 'tan': '谈谈', 'tang': '堂', 'tao': '套逃', 'te': '特', 'teng': '疼', 'ti': '提体题', 'tian': '天田', 'tiao': '挑条', 'tie': '铁', 'ting': '停听', 'tong': '同通', 'tou': '头', 'tu': '图土', 'tuan': '团', 'tui': '推', 'tun': '吞', 'tuo': '脱拖',
  'w': '我', 'wa': '挖', 'wai': '外', 'wan': '完万晚', 'wang': '王往望', 'wei': '为位未卫', 'wen': '文问', 'weng': '翁', 'wo': '我握', 'wu': '无务五物',
  'x': '小', 'xi': '西息系习细', 'xia': '夏下', 'xian': '先现线', 'xiang': '想向项香相', 'xiao': '小校消', 'xie': '些写谢', 'xin': '心新', 'xing': '兴行形', 'xiong': '兄雄', 'xiu': '休修', 'xu': '需许', 'xuan': '选宣', 'xue': '学', 'xun': '训',
  'y': '一', 'ya': '雅亚呀', 'yan': '言眼研演严', 'yang': '洋羊样', 'yao': '要药', 'ye': '爷页业也', 'yi': '一已意以', 'yin': '因音引', 'ying': '英影', 'yo': '哟', 'yong': '用', 'you': '有友由', 'yu': '于余鱼语育', 'yuan': '原员远元园', 'yue': '月', 'yun': '云',
  'z': '在', 'za': '杂', 'zai': '在再', 'zan': '赞', 'zang': '藏', 'zao': '早造', 'ze': '则', 'zei': '贼', 'zen': '怎', 'zeng': '增', 'zha': '查炸', 'zhai': '窄', 'zhan': '站展', 'zhang': '张章长', 'zhao': '找照', 'zhe': '这', 'zhei': '这', 'zhen': '真', 'zheng': '正政', 'zhi': '知之只纸值', 'zhong': '中种重', 'zhou': '周', 'zhu': '主住注助', 'zhua': '抓', 'zhuai': '拽', 'zhuan': '专转', 'zhuang': '装', 'zhui': '追', 'zhun': '准', 'zhuo': '着桌', 'zi': '子字', 'zong': '总', 'zou': '走', 'zu': '组', 'zuan': '钻', 'zui': '最嘴', 'zun': '尊', 'zuo': '做作左坐'
}

// 简单的拼音匹配：检查中文字符是否包含指定拼音
export function matchByPinyin(text, pinyin) {
  if (!text || !pinyin) return false
  
  pinyin = pinyin.toLowerCase().trim()
  text = text.toLowerCase()
  
  // 直接匹配（可能是拼音或英文）
  if (text.includes(pinyin)) return true
  
  // 拼音匹配
  for (const [py, chars] of Object.entries(PINYIN_MAP)) {
    if (py.startsWith(pinyin)) {
      // 检查文本中是否包含该拼音对应的汉字
      for (const char of chars) {
        if (text.includes(char)) return true
      }
    }
  }
  
  return false
}

// 获取字符的拼音（简化版）
export function getPinyin(char) {
  for (const [py, chars] of Object.entries(PINYIN_MAP)) {
    if (chars.includes(char)) {
      return py
    }
  }
  return char
}

// 将中文文本转换为拼音（简化版）
export function toPinyin(text) {
  return text.split('').map(char => getPinyin(char)).join('')
}
