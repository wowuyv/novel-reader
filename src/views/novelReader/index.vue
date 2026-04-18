<template>
  <div class="novel-reader" @contextmenu.prevent="handleContextMenu">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <el-button-group v-if="showRestoreFileHandle">
        <el-button icon="el-icon-refresh-right" @click="loadFileByHandle">恢复文件</el-button>
      </el-button-group>

      <el-button-group>
        <el-button @click="toBookshelf">
          <img src="~@/assets/bookshelf.svg" alt="" style="width: 14px;">
          书架</el-button>
        <el-button icon="el-icon-menu" @click="showCatalog = true">目录</el-button>
        <el-button icon="el-icon-setting" @click="settingsVisible = true">设置</el-button>
      </el-button-group>

      <el-button-group>
        <el-button :type="isPlaying ? 'warning' : 'primary'" :icon="isPlaying ? 'el-icon-video-pause' : 'el-icon-video-play'" @click="togglePlayPause" :disabled="!currentChapterParagraphs.length">朗读</el-button>
        <el-button icon="el-icon-video-stop" @click="stopReading" :disabled="!isPlaying && !paused">停止</el-button>
      </el-button-group>

      <div class="reading-status" v-if="isPlaying && currentSentenceText">
        📖 {{ currentSentenceText }}
      </div>
    </div>

    <!-- 阅读区域 -->
    <div class="reading-area" ref="readingArea" :style="readingAreaStyle" @contextmenu.prevent="handleReadingAreaContextMenu">
      <div v-if="chapters.length === 0" class="empty-tip">
        <p>请点击“打开小说”选择TXT文件</p>
        <p>支持UTF-8编码，自动识别章节</p>
        <p>💡 右键点击任意句子可从该处开始朗读</p>
      </div>
      <div v-else-if="currentChapter" class="chapter-content">
        <p v-for="(paragraph, pIdx) in currentChapterParagraphs" :key="pIdx" class="paragraph">
          <span v-for="(sentence, sIdx) in paragraph.sentences" :key="sIdx" :class="{ 'highlight-sentence': isCurrentSentence(pIdx, sIdx) }">
            {{ sentence }}
          </span>
        </p>
      </div>
    </div>

    <!-- 目录侧边栏 -->
    <el-drawer title="章节目录" :visible.sync="showCatalog" direction="ltr" size="300px">
      <div class="catalog-list">
        <div v-for="(ch, idx) in chapters" :key="idx" class="catalog-item" :class="{ active: currentChapterIndex === idx }" @click="jumpToChapter(idx)">
          <span>{{ ch.title }}</span>
          <span class="sentence-count">({{ ch.content.length }}字)</span>
        </div>
      </div>
    </el-drawer>

    <!-- 朗读进度指示器 -->
    <div class="speech-progress" v-if="isPlaying || paused">
      <span>{{ readingAloudProgress.paragraphIndex + 1 }} / {{ currentChapterParagraphs.length }}</span>
      <el-progress text-color="#fff" :percentage="Math.round(((readingAloudProgress.paragraphIndex + 1) / currentChapterParagraphs.length) * 100)" :stroke-width="6"></el-progress>
    </div>
    <ReaderSettings :visible.sync="settingsVisible" @update="handleUpdateSettings" />
  </div>
</template>

<script>
import store from '@/store'
import { parseChapters, splitIntoSentences } from '@/utils/book.js'
import { ReadAloud } from '@/utils/readAloud.js'

import ReaderSettings from './components/settings.vue'
import jschardet from 'jschardet'
import iconv from 'iconv-lite'

export default {
  name: 'NovelReader',
  components: {
    ReaderSettings
  },
  data () {
    return {
      // 文件相关
      fileHandle: null,
      // 数据
      chapters: [],
      currentChapterIndex: 0,
      // 朗读状态
      isPlaying: false,
      paused: false,
      currentAudio: null,
      /** 是否目录显示 */
      showCatalog: false,

      currentBook: null,
      readingAloudProgress: {
        paragraphIndex: 0,
        sentenceIndex: 0
      },

      settingsVisible: false,
      settingsData: {
        fontSize: 18,
        fontFamily: '',
        textColor: '#333333',
        bgColor: '#fef7e8',
        bgImageUrl: '',
        paddingPercent: 10,
        speechRate: 0.9,
        selectedVoiceName: ''
      },
      /** @type {ReadAloud} */
      readAloud: null
    }
  },
  computed: {
    showRestoreFileHandle () {
      return !!this.fileHandle && this.chapters.length === 0
    },
    currentChapter () {
      return this.chapters[this.currentChapterIndex] || null
    },
    /** 当前章节的段落数组 */
    currentChapterParagraphs () {
      return this.currentChapter ? splitIntoSentences(this.currentChapter.content) : []
    },
    currentParagraph () {
      return this.currentChapterParagraphs[this.readingAloudProgress.paragraphIndex] || null
    },
    currentSentenceText () {
      const sentence = this.currentParagraph ? this.currentParagraph.sentences[this.readingAloudProgress.sentenceIndex] : null
      return sentence ? sentence.substring(0, 50) + (sentence.length > 50 ? '…' : '') : ''
    },
    readingAreaStyle () {
      return {
        fontSize: `${this.settingsData.fontSize}px`,
        fontFamily: this.settingsData.fontFamily,
        color: this.settingsData.textColor,
        backgroundColor: this.settingsData.bgColor,
        backgroundImage: this.settingsData.bgImageUrl ? `url(${this.settingsData.bgImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        paddingLeft: `${this.settingsData.paddingPercent}%`,
        paddingRight: `${this.settingsData.paddingPercent}%`
      }
    }
  },
  watch: {
    currentChapterIndex (newVal, oldVal) {
      if (newVal !== oldVal) {
        this.stopReading()
        this.$nextTick(() => {
          this.scrollToCurrentSentence()
        })
      }
    }
  },
  beforeRouteEnter (to, from, next) {
    const bookId = to.query.bookId
    // 先加载书籍数据，确保数据已准备好
    store.dispatch('books/loadBooksFromIndexDb').then(() => {
      const book = store.getters.books.find(item => item.id === Number(bookId))
      if (!book) {
        return next(vm => {
          vm.$message.error('未找到对应的书籍记录')
          vm.$router.replace({ name: 'ebookShelf' })
        })
      }
      next(vm => {
        vm.currentBook = book
      })
    }).catch(error => {
      console.error('加载书籍失败:', error)
      next(vm => {
        vm.$message.error('加载书籍失败')
        vm.$router.replace({ name: 'ebookShelf' })
      })
    })
  },
  mounted () {
    this.initBooks()
  },
  beforeDestroy () {
    this.stopReading()
    this.readAloud && this.readAloud.close()
  },
  methods: {
    async initBooks () {
      if (!this.currentBook) {
        return
      }
      this.fileHandle = this.currentBook.handle
      this.readingAloudProgress.paragraphIndex = this.currentBook.readingAloudProgress.paragraphIndex
      this.currentChapterIndex = this.currentBook.readingAloudProgress.chapterIndex

      const permission = await this.fileHandle.queryPermission({ mode: 'read' })
      if (permission === 'granted') {
        const file = await this.fileHandle.getFile()
        await this.loadFile(file)
      } else {
        this.$message.info('检测到上次打开的文件，点击“恢复文件”按钮重新授权')
      }
    },
    async loadFileByHandle () {
      if (!this.fileHandle) {
        this.$message.warning('没有可恢复的文件记录')
        return
      }
      try {
        const permission = await this.fileHandle.requestPermission({ mode: 'read' })
        if (permission === 'granted') {
          const file = await this.fileHandle.getFile()
          await this.loadFile(file)
        } else {
          this.$message.warning('无法获取文件读取权限，请重新选择文件')
          this.fileHandle = null
          this.clearSavedHandle()
        }
      } catch (err) {
        this.$message.error('恢复失败：' + err.message)
        this.fileHandle = null
        this.clearSavedHandle()
      }
    },
    async loadFile (file) {
      this.$message.info('正在加载文件...')
      // const text = await file.text()
      const text = await this.getUtf8Text(file)
      this.chapters = parseChapters(text)
      this.$message.success(`加载成功，共 ${this.chapters.length} 章`)
      this.showCatalog = false
    },
    escapeHtml (str) {
      return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;'
        if (m === '<') return '&lt;'
        if (m === '>') return '&gt;'
        return m
      })
    },
    // ---------- 右键菜单从点击句子开始朗读 ----------
    handleReadingAreaContextMenu (e) {
    },
    handleContextMenu (e) {
      // 避免全局右键菜单干扰
      e.preventDefault()
    },
    // ---------- 朗读核心（段落合成）----------
    async togglePlayPause () {
      if (this.isPlaying) {
        this.pauseReading()
      } else if (this.paused) {
        this.resumeReading()
      } else {
        this.startReading()
      }
    },
    pauseReading () {
      if (this.currentAudio) {
        this.currentAudio.pause()
      }
      this.isPlaying = false
      this.paused = true
    },
    resumeReading () {
      if (this.paused && this.currentAudio) {
        this.currentAudio.play()
        this.isPlaying = true
        this.paused = false
      } else if (this.paused && !this.currentAudio) {
        this.startReading()
      }
    },
    async stopReading (resetIndex = false) {
      if (this.currentAudio) {
        this.currentAudio.pause()
        this.currentAudio = null
      }
      this.isPlaying = false
      this.paused = false
    },
    finishChapter () {
      this.stopReading()
      this.$message.success('本章朗读完毕')
      if (this.currentChapterIndex + 1 < this.chapters.length) {
        this.jumpToChapter(this.currentChapterIndex + 1)
        this.startReading()
      } else {
        this.$message.info('已朗读完最后一章')
      }
    },
    scrollToCurrentSentence () {
      this.$nextTick(() => {
        const activeSpan = document.querySelector('.highlight-sentence')
        if (activeSpan) {
          activeSpan.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    },
    scrollToTop () {
      const area = this.$refs.readingArea
      if (area) area.scrollTop = 0
    },
    jumpToChapter (index) {
      if (index === this.currentChapterIndex) {
        this.showCatalog = false
        return
      }
      this.stopReading()
      this.currentChapterIndex = index
      this.readingAloudProgress = {
        paragraphIndex: 0,
        sentenceIndex: 0
      }
      this.saveBookProgress(this.readingAloudProgress.paragraphIndex)
      this.showCatalog = false
      this.scrollToTop()
    },

    isCurrentSentence (pIdx, sIdx) {
      return this.isPlaying && this.readingAloudProgress.paragraphIndex === pIdx && this.readingAloudProgress.sentenceIndex === sIdx
    },

    async startReading () {
      if (this.currentParagraph.isEmpty) {
        this.toNextParagraph()
        return
      }
      if (!this.readAloud) {
        this.readAloud = new ReadAloud(this.chapters, this.settingsData.selectedVoiceName)
      }
      const result = await this.readAloud.getAudio(this.currentChapterParagraphs, this.currentChapterIndex, this.readingAloudProgress.paragraphIndex)
      if (!result) {
        this.toNextParagraph()
        return
      }
      const audio = result.audioElement
      this.currentAudio = audio
      this.isPlaying = true
      this.paused = false

      const sentenceDuration = this.parseSentenceDuration(this.currentParagraph, result.subtitle)
      audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime
        let index = this.readingAloudProgress.sentenceIndex
        for (let i = index; i < sentenceDuration.length; i++) {
          if (currentTime > sentenceDuration[i]) {
            index = Math.min(i + 1, sentenceDuration.length - 1)
            break
          }
        }
        if (index !== this.readingAloudProgress.sentenceIndex) {
          this.readingAloudProgress.sentenceIndex = index
          this.scrollToCurrentSentence()
        }
      })

      audio.play().catch(err => {
        console.error('播放出错', err)
        this.$message.error('播放出错')
        this.stopReading()
      })

      audio.addEventListener('ended', () => {
        audio.pause()
        URL.revokeObjectURL(audio.src)
        audio.remove()
        this.toNextParagraph()
      })

      // audio.remove()
    },
    /**
     * @param {import('@/utils/book.js').Paragraph} paragraph 当前段落的句子数组
     * @param {Array<{duration: Number, offset: Number, text: String}>} subtitles 当前段落的字幕信息（包含每个句子的文本和预估时长）
     * @returns {Array<Number>} 返回一个数组，表示段落中每个句子的结束时间（单位秒），空句和段落分隔使用前一个句子的时长
     */
    parseSentenceDuration (paragraph, subtitles) {
      const result = []
      let subtitleIndex = 0

      for (let i = 0; i < paragraph.sentences.length; i++) {
        const sentence = paragraph.sentences[i]
        let sublen = 0
        while (sentence.includes(subtitles[subtitleIndex].text) && subtitleIndex < subtitles.length - 1 && sublen < sentence.length) {
          subtitleIndex++
          sublen += subtitles[subtitleIndex].text.length
        }
        const index = subtitleIndex - 1
        result.push(subtitles[index] ? (subtitles[index].duration + subtitles[index].offset) / 10000000 : 0)
      }

      return result
    },

    async saveBookProgress (paragraphIndex = 0) {
      this.$store.dispatch('books/updateBookProgress', {
        bookId: this.currentBook.id,
        progress: {
          chapterIndex: this.currentChapterIndex,
          paragraphIndex
        }
      })
    },

    handleUpdateSettings (settings) {
      if (this.readAloud && this.settingsData.selectedVoiceName !== settings.selectedVoiceName) {
        this.readAloud.close()
        this.readAloud = new ReadAloud(this.chapters, settings.selectedVoiceName)
      }
      this.settingsData = settings
    },

    toNextParagraph () {
      this.readingAloudProgress.paragraphIndex++
      this.readingAloudProgress.sentenceIndex = 0
      this.saveBookProgress(this.readingAloudProgress.paragraphIndex)
      if (this.readingAloudProgress.paragraphIndex >= this.currentChapterParagraphs.length) {
        this.finishChapter()
      } else {
        this.startReading()
      }
    },

    toBookshelf () {
      this.$router.push('/')
    },

    async getUtf8Text (file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        // 关键：使用 readAsArrayBuffer 获取原始二进制数据[reference:5]
        reader.onload = () => {
          const arrayBuffer = reader.result
          const uint8Array = new Uint8Array(arrayBuffer)

          // 2. 关键步骤：将 Uint8Array 转换为 jschardet 所需的二进制字符串
          let binaryString = ''
          for (let i = 0; i < uint8Array.slice(0, 1024).length; i++) {
            binaryString += String.fromCharCode(uint8Array[i])
          }

          // 3. 检测编码
          // 传入二进制数据的前几KB即可高效检测，可提升性能
          const detected = jschardet.detect(binaryString)
          const originalEncoding = detected.encoding
          console.log(`检测到的编码: ${originalEncoding}, 置信度: ${detected.confidence}`)

          // 4. 如果已为 UTF-8 则直接使用，否则进行转码
          let text = ''
          // iconv-lite 解码需要 Buffer，但浏览器端通常有兼容处理，直接传入 Uint8Array 亦可
          // 此处确保传入 iconv 支持的类型
          if (originalEncoding && originalEncoding.toLowerCase() !== 'utf-8' && originalEncoding !== 'ascii') {
          // 非 UTF-8 编码，使用 iconv-lite 转换为 UTF-8 字符串
            text = iconv.decode(uint8Array, originalEncoding)
          } else {
            // 已是 UTF-8 或 ASCII，直接使用 TextDecoder 解码，性能更好
            const decoder = new TextDecoder('utf-8')
            text = decoder.decode(uint8Array)
          }

          resolve(text)
        }
        reader.onerror = (error) => reject(error)
        reader.readAsArrayBuffer(file)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.novel-reader {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #2c3e50;

  .toolbar {
    background: #fff;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    border-bottom: 1px solid #dcdfe6;
    .reading-status {
      flex: 1;
      font-size: 14px;
      color: #606266;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .reading-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px 0;
    transition: all 0.2s;
    .empty-tip {
      text-align: center;
      color: #999;
      margin-top: 100px;
    }
    .chapter-content {
      line-height: 1.8;
      .sentence {
        display: inline;
        transition: background-color 0.1s ease;
        cursor: pointer;
        &:hover {
          background-color: rgba(0,0,0,0.05);
        }
      }
      // 深度选择器，作用于 v-html 内的元素
      ::v-deep .highlight-sentence {
        background-color: #ffeb3b !important;
        color: #000 !important;
        border-radius: 4px;
        box-shadow: 0 0 0 2px #ffeb3b;
      }
    }
  }

  .catalog-list {
    .catalog-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #ebeef5;
      display: flex;
      justify-content: space-between;
      &:hover {
        background: #f5f7fa;
      }
      &.active {
        background: #e6f7ff;
        color: #1890ff;
        border-left: 3px solid #1890ff;
      }
    }
  }

  .speech-progress {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 200px;
    background: rgba(0,0,0,0.7);
    border-radius: 8px;
    padding: 8px 12px;
    color: white;
    font-size: 12px;
    z-index: 1000;
    backdrop-filter: blur(4px);
    span {
      display: block;
      margin-bottom: 4px;
    }
  }
}

.paragraph {
  text-indent: 2em;
  margin-top: 12px;
}
</style>
