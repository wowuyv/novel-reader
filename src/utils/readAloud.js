import { EdgeTTS } from 'edge-tts-universal'
import { splitIntoSentences } from './book.js'

/**
 * @typedef {Object} SentenceInfo
 * @property {Sentence} sentence - 句子文本
 * @property {Number} chapterIndex - 句子在章节中的哪一段落
 * @property {Number} sentenceIndex - 句子在段落中的位置
 */

/**
 * @typedef {Object} AudioCache
 * @property {HTMLAudioElement} audioElement - 生成的音频元素
 * @property {Blob} audio - 生成的音频数据
 * @property {import('edge-tts-universal').WordBoundary} subtitle - 生成的字幕信息
 */

export class ReadAloud {
  /** @type {Map<string, AudioCache>} */
  audioCaches = new Map() // { 'chapterIndex_paragraphIndex': audioUrl }
  /** @type {Map<string, Promise<AudioCache>>} */
  generatingAudio = new Map() // 正在生成的音频，避免重复生成同一段落的音频
  /**
   * @param {import('./book').Chapter[]} chapters
   * @param {string} voiceName
   */
  constructor (chapters, voiceName, minDuration = 30) {
    this.chapters = chapters
    this.voiceName = voiceName
    this.minDuration = minDuration
  }

  /**
   *
   * @param {import('./book').Paragraph[]} currentChapterParagraphs
   * @param {Number} chapterIndex
   * @param {Number} paragraphIndex
   * @returns {Promise<AudioCache|null>}
   */
  async getAudio (currentChapterParagraphs, chapterIndex, paragraphIndex) {
    console.log('getAudio', new Date().toLocaleString())
    const key = `${chapterIndex}_${paragraphIndex}`
    if (this.audioCaches.has(key)) {
      const audio = this.audioCaches.get(key)
      this.audioCaches.delete(key)
      this.generateCaches(currentChapterParagraphs, chapterIndex, paragraphIndex + 1)
      this.clearUnnecessaryCaches(chapterIndex, paragraphIndex)
      return audio
    }
    const audio = await this.generateAudio(currentChapterParagraphs, chapterIndex, paragraphIndex).finally(() => {
      this.generateCaches(currentChapterParagraphs, chapterIndex, paragraphIndex + 1)
      this.clearUnnecessaryCaches(chapterIndex, paragraphIndex)
    })
    return audio
  }

  /**
   *
   * @param {import('./book').Paragraph[]} currentChapterParagraphs
   * @param {Number} paragraphIndex
   * @returns {Promise<AudioCache|null>}
   */
  async generateAudio (currentChapterParagraphs, chapterIndex, paragraphIndex) {
    const paragraph = currentChapterParagraphs[paragraphIndex]
    if (!paragraph) {
      return null
    }
    const key = `${chapterIndex}_${paragraphIndex}`
    if (this.generatingAudio.has(key)) {
      return this.generatingAudio.get(key)
    }
    console.log('开始生成音频', new Date().toLocaleString(), paragraph.text)
    const tts = new EdgeTTS(paragraph.text, this.voiceName)
    const promise = tts.synthesize().then((result) => {
      const audioElement = new Audio(URL.createObjectURL(result.audio))
      return new Promise((resolve) => {
        audioElement.addEventListener('loadedmetadata', resolve, { once: true })
      }).then(() => {
        console.log('生成完成', paragraph.text)
        console.log('缓存时长1', Array.from(this.audioCaches.values()).reduce((pre, cur) => {
          return pre + cur.audioElement.duration
        }, 0) + audioElement.duration)
        return {
          ...result,
          audioElement
        }
      })
    })
    this.generatingAudio.set(key, promise)
    return promise
  }

  /**
   *
   * @param {import('./book.js').Paragraph[]} currentChapterParagraphs
   * @param {Number} chapterIndex
   * @param {Number} paragraphIndex
   * @returns
   */
  async generateCaches (currentChapterParagraphs, chapterIndex, paragraphIndex) {
    const paragraph = currentChapterParagraphs[paragraphIndex]
    if (paragraph) {
      if (paragraph.isEmpty) {
        return this.generateCaches(currentChapterParagraphs, chapterIndex, paragraphIndex + 1)
      }
      const nextKey = `${chapterIndex}_${paragraphIndex}`
      let nextAudio = this.audioCaches.get(nextKey)
      if (!nextAudio) {
        nextAudio = await this.generateAudio(currentChapterParagraphs, chapterIndex, paragraphIndex)
        this.audioCaches.set(nextKey, nextAudio)
      }
      if (this.checkCacheDuration()) {
        return this.generateCaches(currentChapterParagraphs, chapterIndex, paragraphIndex + 1)
      }
    } else {
      if (!this.chapters[chapterIndex + 1]) {
        return
      }
      const nextChapterParagraphs = splitIntoSentences(this.chapters[chapterIndex + 1].content)
      return this.generateCaches(nextChapterParagraphs, chapterIndex + 1, 0)
    }
  }

  /**
   * 检查当前缓存的音频总时长是否超过最小阈值，如果超过则停止继续生成缓存
   * @returns {Boolean} - 是否继续生成缓存
   */
  checkCacheDuration () {
    const totalDuration = Array.from(this.audioCaches.values()).reduce((pre, cur) => {
      return pre + cur.audioElement.duration
    }, 0)
    return totalDuration < this.minDuration
  }

  /**
   * 清除不必要的缓存，保留当前章节和下一章节的缓存，以及当前章节但未播放过的段落缓存
   * @param {Number} currentChapterIndex
   * @param {Number} currentParagraphIndex
   * @returns {void}
   */
  clearUnnecessaryCaches (currentChapterIndex, currentParagraphIndex) {
    for (const key of this.audioCaches.keys()) {
      const [chapterIndex, paragraphIndex] = key.split('_').map(Number)
      if (chapterIndex < currentChapterIndex ||
         chapterIndex > (currentChapterIndex + 1) ||
         (chapterIndex === currentChapterIndex && paragraphIndex <= currentParagraphIndex)) {
        const audio = this.audioCaches.get(key).audioElement
        audio.pause()
        URL.revokeObjectURL(audio.src)
        this.audioCaches.delete(key)
      }
    }
  }
}
