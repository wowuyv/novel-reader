<template>
  <div class="novel-splitter">
    <el-card class="upload-card" shadow="hover">
      <div slot="header" class="card-header">
        <span>📖 小说章节分割器（Web Worker 加速版）</span>
        <el-tag size="small" type="info">支持楔子/引子/第x章等格式</el-tag>
      </div>

      <!-- 小说名输入 -->
      <el-form label-width="80px">
        <el-form-item label="小说名">
          <el-input
            v-model="novelName"
            placeholder="自动从文件名或书名号中提取，可手动修改"
            clearable
          >
            <template slot="prepend">📕</template>
          </el-input>
          <div class="form-tip">导出文件名格式：小说名_00001_章节标题.txt</div>
        </el-form-item>
      </el-form>

      <el-upload
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
        drag
        accept=".txt"
      >
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">将TXT文件拖到此处，或<em>点击上传</em></div>
        <div class="el-upload__tip" slot="tip">
          支持 UTF-8 编码的TXT小说，自动按章节分割（使用 Web Worker 后台处理，不阻塞界面）
        </div>
      </el-upload>

      <div v-if="fileInfo" class="file-info">
        <el-alert
          :title="`已加载：${fileInfo.name}`"
          type="success"
          :closable="false"
          show-icon
        />
        <div v-if="parsing" class="parsing-tip">
          <i class="el-icon-loading"></i> 正在解析章节，请稍候...
        </div>
      </div>
    </el-card>

    <el-card v-if="chapters.length" class="result-card" shadow="hover">
      <div slot="header" class="card-header">
        <span>📑 分割结果（共 {{ chapters.length }} 个章节）</span>
        <el-button
          type="primary"
          size="small"
          :loading="zipLoading"
          @click="generateZip"
        >
          {{ zipLoading ? '打包中...' : '📦 导出全部章节为ZIP' }}
        </el-button>
      </div>

      <el-table :data="chapters" height="400" stripe border>
        <el-table-column type="index" label="#" width="50" align="center" />
        <el-table-column prop="title" label="章节名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="contentLength" label="字数" width="100" align="center">
          <template slot-scope="scope">
            {{ scope.row.contentLength }} 字
          </template>
        </el-table-column>
        <el-table-column label="预览" min-width="250">
          <template slot-scope="scope">
            <div class="preview-text">{{ scope.row.preview }}</div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div v-if="!chapters.length && fileInfo && !parsing" class="no-chapter-warning">
      <el-alert
        title="未识别到任何章节，请检查文件格式是否符合章节标题规范（如“第一章”“楔子”等）"
        type="warning"
        show-icon
        :closable="false"
      />
    </div>
  </div>
</template>

<script>
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// 创建 Web Worker（内联方式，避免额外文件）
const createWorker = () => {
  const workerCode = `
    // 章节分割逻辑（与主线程分离）
    const chapterRegex = /^(第[零〇一二三四五六七八九十百千万\\d]+[章回节]|楔子|引子|序章|尾声|番外|后记|前言|写在前面)/i;

    function parseNovelInWorker(rawText) {
      const lines = rawText.split(/\\r?\\n/);
      let chaptersList = [];
      let currentChapter = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && chapterRegex.test(line)) {
          if (currentChapter && currentChapter.contentLines.length) {
            finalizeChapter(chaptersList, currentChapter);
          }
          currentChapter = {
            title: line,
            contentLines: [line],
          };
        } else {
          if (!currentChapter) {
            currentChapter = {
              title: '开头',
              contentLines: [],
            };
          }
          currentChapter.contentLines.push(lines[i]);
        }
      }
      if (currentChapter && (currentChapter.contentLines.length || chaptersList.length === 0)) {
        finalizeChapter(chaptersList, currentChapter);
      }

      chaptersList = chaptersList.filter(ch => ch.content.trim().length > 0);
      if (chaptersList.length === 0 && rawText.trim()) {
        chaptersList = [{
          title: '全文',
          content: rawText,
        }];
      } else {
        chaptersList = chaptersList.map(ch => ({
          title: ch.title,
          content: ch.content,
          contentLength: ch.content.length,
          preview: ch.content.slice(0, 80).replace(/\\n/g, ' ') + (ch.content.length > 80 ? '…' : ''),
        }));
      }
      return chaptersList;
    }

    function finalizeChapter(list, chapter) {
      let content = chapter.contentLines.join('\\n');
      content = content.trim();
      if (!content) return;
      list.push({
        title: chapter.title,
        content: content,
      });
    }

    self.addEventListener('message', (e) => {
      const { text } = e.data;
      try {
        const chapters = parseNovelInWorker(text);
        self.postMessage({ success: true, chapters });
      } catch (err) {
        self.postMessage({ success: false, error: err.message });
      }
    });
  `
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  return new Worker(URL.createObjectURL(blob))
}

export default {
  name: 'NovelSplitter',
  data () {
    return {
      fileInfo: null, // 上传的文件信息
      novelName: '', // 用户可编辑的小说名
      chapters: [], // 章节列表
      zipLoading: false,
      parsing: false, // 是否正在解析
      currentWorker: null // 当前 worker 实例
    }
  },
  watch: {
    // 当上传文件后，自动提取默认小说名（仅当用户未手动修改时）
    fileInfo: {
      handler (newVal) {
        if (newVal && !this.novelName) {
          this.extractDefaultNovelName(newVal.name)
        }
      },
      immediate: true
    }
  },
  beforeDestroy () {
    if (this.currentWorker) {
      this.currentWorker.terminate()
      this.currentWorker = null
    }
  },
  methods: {
    // 从文件名中提取小说名（优先书名号内内容）
    extractDefaultNovelName (filename) {
      let name = filename.replace(/\.txt$/i, '')
      // 匹配书名号内的内容
      const bracketMatch = name.match(/《([^》]+)》/)
      if (bracketMatch) {
        name = bracketMatch[1]
      }
      // 清理非法字符（用于显示，但文件名生成时会再次清理）
      name = name.trim()
      if (!name) name = '小说'
      this.novelName = name
    },

    // 处理文件上传
    handleFileChange (file) {
      const rawFile = file.raw
      if (!rawFile) return
      // 终止之前的 worker（如有）
      if (this.currentWorker) {
        this.currentWorker.terminate()
        this.currentWorker = null
      }
      this.fileInfo = {
        name: rawFile.name,
        raw: rawFile
      }
      this.chapters = [] // 清空旧结果
      this.readFileContent(rawFile)
    },

    // 读取文件内容并交给 worker 解析
    readFileContent (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target.result
        this.startParseWithWorker(text)
      }
      reader.onerror = () => {
        this.$message.error('文件读取失败，请重试')
        this.parsing = false
      }
      reader.readAsText(file, 'UTF-8')
    },

    // 启动 Web Worker 解析
    startParseWithWorker (text) {
      this.parsing = true
      this.currentWorker = createWorker()
      this.currentWorker.addEventListener('message', (e) => {
        const { success, chapters, error } = e.data
        this.parsing = false
        if (success) {
          this.chapters = chapters
          this.$message.success(`解析完成！共识别 ${chapters.length} 个章节`)
        } else {
          this.$message.error(`解析失败：${error}`)
          this.chapters = []
        }
        this.currentWorker.terminate()
        this.currentWorker = null
      })
      this.currentWorker.postMessage({ text })
    },

    // 清理文件名中的非法字符
    sanitizeFilename (str) {
      if (!str) return '未命名'
      // 移除 Windows/Linux 文件名非法字符 \ / : * ? " < > |
      return str.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名'
    },

    // 生成 ZIP 并下载
    async generateZip () {
      if (!this.chapters.length) {
        this.$message.warning('没有可导出的章节')
        return
      }
      if (!this.novelName.trim()) {
        this.$message.warning('请填写小说名')
        return
      }

      this.zipLoading = true
      const zip = new JSZip()
      // 清理小说名作为文件夹前缀
      let baseName = this.sanitizeFilename(this.novelName.trim())
      if (!baseName) baseName = 'novel'

      for (let i = 0; i < this.chapters.length; i++) {
        const ch = this.chapters[i]
        // 清理章节标题
        let chapterTitle = this.sanitizeFilename(ch.title)
        if (!chapterTitle) chapterTitle = `第${i + 1}章`
        // 序号补零到5位
        const serial = String(i + 1).padStart(5, '0')
        const fileName = `${baseName}_${serial}_${chapterTitle}.txt`
        zip.file(fileName, ch.content)
      }

      try {
        const blob = await zip.generateAsync({ type: 'blob' })
        saveAs(blob, `${baseName}_章节合集.zip`)
        this.$message.success('打包完成，开始下载')
      } catch (err) {
        console.error(err)
        this.$message.error('打包失败，请重试')
      } finally {
        this.zipLoading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.novel-splitter {
  max-width: 1200px;
  margin: 20px auto;
  padding: 0 20px;

  .upload-card {
    margin-bottom: 24px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 18px;
    }

    .file-info {
      margin-top: 20px;
    }

    .form-tip {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }

    .parsing-tip {
      margin-top: 12px;
      color: #409eff;
      i {
        margin-right: 6px;
      }
    }
  }

  .result-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .preview-text {
      font-size: 12px;
      color: #606266;
      line-height: 1.4;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .no-chapter-warning {
    margin-top: 20px;
  }
}
</style>
