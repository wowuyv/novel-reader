<template>
  <div class="ebook-shelf">
    <div class="layout-header">
      <h1>电子书书架</h1>

      <div v-if="isManageMode" class="manage-tools">
        <el-button @click="selectAll">全选</el-button>
        <el-button @click="deselectAll">全不选</el-button>
        <el-button type="danger" @click="deleteSelected" :disabled="selectedBooks.length === 0">
          删除 ({{ selectedBooks.length }})
        </el-button>
        <el-button @click="exitManageMode">取消</el-button>
      </div>
      <el-dropdown v-else @command="handleCommand">
        <i class="el-icon-s-operation"></i>
        <el-dropdown-menu slot="dropdown">
          <el-dropdown-item command="splitNovel">小说分片</el-dropdown-item>
          <el-dropdown-item command="importLocal">导入本地书</el-dropdown-item>
          <el-dropdown-item command="manage">管理</el-dropdown-item>
        </el-dropdown-menu>
      </el-dropdown>
    </div>
    <!-- 书籍列表 -->
    <div class="book-list">
      <div class="book-item" v-for="book in books" :key="book.id" :class="{ selected: selectedBooks.includes(book.id) }" @click="handleBookItemClick($event, book)">
        <div class="book-info">
          <h2>{{ book.name }}</h2>
        </div>
      </div>
    </div>
  </div>
</template>

<script>

import { parseChapters, extractDefaultNovelName } from '@/utils/book.js'
import { mapGetters } from 'vuex'
import store from '@/store'

export default {
  name: 'EbookShelf',
  data () {
    return {
      isManageMode: false,
      selectedBooks: []
    }
  },
  computed: {
    ...mapGetters(['books'])
  },
  beforeRouteEnter (to, from, next) {
    // 先加载书籍数据，确保数据已准备好
    store.dispatch('books/loadBooksFromIndexDb').then(next).catch(error => {
      console.error('加载书籍失败:', error)
      next(vm => {
        vm.$message.error('加载书籍失败')
      })
    })
  },
  methods: {
    async handleCommand (command) {
      switch (command) {
        case 'importLocal':
          this.importLocalBook()
          break
        case 'manage':
          this.isManageMode = true
          this.selectedBooks = []
          break
        case 'splitNovel':
          this.$router.push({ name: 'chapterSegmentation' })
          break
      }
    },
    async importLocalBook () {
      /** @type {[FileSystemFileHandle]} */
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: '文本文件', accept: { 'text/plain': ['.txt'] } }]
      }).catch(() => {
        this.$message.info('已取消选择文件')
        return []
      })
      if (!handle) return
      const book = {
        id: Date.now(),
        name: extractDefaultNovelName(handle.name),
        readingAloudProgress: {
          chapterIndex: 0,
          sentenceIndex: 0
        },
        handle
      }
      this.$store.dispatch('books/addBook', book)
    },

    async getChaptersForBook (handle) {
      const file = await handle.getFile()
      const text = await file.text()
      return parseChapters(text)
    },
    async saveBooksToIndexDb () {
      const db = await this.openDatabase()
      const tx = db.transaction('books', 'readwrite')
      const store = tx.objectStore('books')
      for (const book of this.books) {
        store.put(book)
      }
      await tx.complete
    },
    async openDatabase () {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('ebookShelf', 1)
        request.onupgradeneeded = event => {
          const db = event.target.result
          if (!db.objectStoreNames.contains('books')) {
            db.createObjectStore('books', { keyPath: 'id' })
          }
        }
        request.onsuccess = event => {
          resolve(event.target.result)
        }
        request.onerror = event => {
          reject(event.target.error)
        }
      })
    },
    async loadBooksFromIndexDb () {
      const db = await this.openDatabase()
      const tx = db.transaction('books', 'readonly')
      const store = tx.objectStore('books')
      const request = store.getAll()

      request.onsuccess = event => {
        this.books = event.target.result || []
      }
    },
    toggleSelectBook (bookId) {
      const index = this.selectedBooks.indexOf(bookId)
      if (index > -1) {
        this.selectedBooks.splice(index, 1)
      } else {
        this.selectedBooks.push(bookId)
      }
    },
    async deleteSelected () {
      if (this.selectedBooks.length === 0) {
        return
      }

      this.$confirm('确定要删除已选的书籍吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        this.$store.dispatch('books/deleteBooks', this.selectedBooks)

        // 清空选中状态
        this.selectedBooks = []
        this.$message.success('删除成功')
      }).catch(() => {
        this.$message.info('已取消删除')
      })
    },
    exitManageMode () {
      this.isManageMode = false
      this.selectedBooks = []
    },

    handleBookItemClick (event, book) {
      if (this.isManageMode) {
        this.toggleSelectBook(book.id)
      } else {
        // 进入小说阅读器
        this.$router.push({ name: 'novelReader', query: { bookId: book.id } })
      }
    },
    selectAll () {
      this.selectedBooks = this.books.map(book => book.id)
    },
    deselectAll () {
      this.selectedBooks = []
    }
  }
}
</script>

<style lang="scss" scoped>
.ebook-shelf {
  min-height: 100vh;
}

.layout-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px 20px;

  display: flex;
  justify-content: space-between;

  h1 {
    margin: 0;
    font-size: 24px;
  }

  .el-icon-s-operation {
    font-size: 30px;
    line-height: 40px;
    cursor: pointer;
  }
}

.book-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}

.book-item {
  background: url('~@/assets/bookCover.webp');
  width: 148px;
  height: 189.666px;
  background-size: 100% 100%;
  position: relative;
  transition: opacity 0.3s;
  // 移除原来的 margin，使用父容器的 gap 控制间距
  // 保留内部布局样式
  padding-top: 20px;
  box-sizing: border-box;

  &.selected {
    opacity: 0.6;
  }

  .book-info {
    text-align: center;
    h2 {
      font-size: 16px;
      margin: 0;
      // 添加文字阴影或背景提高可读性（可选）
      text-shadow: 0 0 2px rgba(0,0,0,0.5);
      color: #fff;
    }
  }
}

// 响应式：当屏幕宽度较小时，适当减小 padding
@media (max-width: 768px) {
  .book-list {
    padding: 16px;
    gap: 16px;
    justify-content: center; // 小屏时如果最后一行不足，居中显示更美观（可选）
  }

  // 保持左对齐为主，但 justify-content: center 会导致整体居中，子项依然从左到右排列
  // 但为了明确从左至右，可以不加 center，保持 flex-start 也可
  // 这里选择保持 flex-start，让剩余空间留在右侧
  .book-list {
    justify-content: flex-start;
  }
}
</style>
