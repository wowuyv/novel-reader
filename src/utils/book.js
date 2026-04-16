
const CHAPTER_REGEX = /^(第[零〇一二三四五六七八九十百千万\d]+[章回节]|楔子|引子|序章|尾声|番外|后记|前言|写在前面)/i
/** 分割句子的标点的正则表达式 */
const reg = /(?<=[。！？；：，])/g

/**
 * 章节
 * @typedef {Object} Chapter
 * @property {String} title - 章节标题
 * @property {String} content - 章节内容
 * @property {Number} startLine - 章节在原始文本中的起始行号
 * @property {Number} endLine - 章节在原始文本中的结束行号
 */

/**
 * 句子
 * @typedef {Object} Sentence
 * @property {String} text - 句子文本
 * @property {Boolean} isParagraphBreak - 是否为段落分隔符（空行）
 * @property {Boolean} isEmpty - 句子是否仅包含符号无实际内容
 */
/**
 * 段落
 * @typedef {Object} Paragraph
 * @property {String} text - 段落文本
 * @property {Boolean} isEmpty - 段落是否仅包含符号无实际内容
 * @property {String[]} sentences - 段落中的句子数组
 */

/**
 * 判断句子是否只有符号无实际内容
 * @param {String} text - 要判断的文本
 * @returns {Boolean} - 如果文本不包含中文、英文或数字，则视为无内容
 */
function isEmptyContent (text) {
  // 包含中文字符、英文字母、数字则视为有内容
  return !/[一-龥a-zA-Z0-9]/.test(text)
}

/**
 * @param {String} rawText - 原始文本
 * @returns {Chapter[]}
 */
export function parseChapters (rawText) {
  const lines = rawText.split(/\r?\n/)
  let chaptersList = []
  let currentChapter = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line && CHAPTER_REGEX.test(line)) {
      if (currentChapter) {
        finalizeChapter(chaptersList, currentChapter)
      }
      currentChapter = {
        title: line,
        contentLines: [line],
        startLine: i,
        endLine: i
      }
    } else {
      if (!currentChapter) {
        currentChapter = { title: '开头', contentLines: [] }
      }
      currentChapter.contentLines.push(lines[i])
      currentChapter.endLine = i
    }
  }
  if (currentChapter) finalizeChapter(chaptersList, currentChapter)
  chaptersList = chaptersList.filter(ch => ch.content.trim().length > 0)
  if (chaptersList.length === 0 && rawText.trim()) {
    chaptersList = [{ title: '全文', content: rawText }]
  }
  return chaptersList
}

/**
 * 将章节内容合并成完整文本，并添加到章节列表中
 * @param {Chapter[]} list - 章节列表
 * @param {Object} chapter - 当前章节对象，包含 title 和 contentLines
 * @returns {void}
 */
export function finalizeChapter (list, chapter) {
  let content = chapter.contentLines.join('\n')
  content = content.trim()
  if (!content) return
  list.push({
    title: chapter.title,
    content: content,
    startLine: chapter.startLine,
    endLine: chapter.endLine
  })
}

/**
 * 将章节文本分割成段落和句子
 * @param {String} text - 要分割的章节文本
 * @return {Paragraph[]} - 包含段落信息的数组，每个段落包含文本、是否为空以及句子数组
 */
export function splitIntoSentences (text) {
  return text.split(/\r?\n/).map(para => {
    return {
      text: para,
      isEmpty: isEmptyContent(para),
      sentences: para.split(reg)
    }
  })
}

/**
 * 从文件名中提取小说名（优先书名号内内容）
 * @param {String} filename - 文件名
 * @returns {String} 提取的小说名
 */
export function extractDefaultNovelName (filename) {
  let name = filename.replace(/\.txt$/i, '')
  // 匹配书名号内的内容
  const bracketMatch = name.match(/《([^》]+)》/)
  if (bracketMatch) {
    name = bracketMatch[1]
  }
  // 清理非法字符（用于显示，但文件名生成时会再次清理）
  name = name.trim()
  if (!name) name = '小说'
  return name
}
