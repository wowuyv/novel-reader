import { openDatabase } from '@/utils/db.js'

async function loadBooksFromIndexDb () {
  const db = await openDatabase('ebookShelf')
  const tx = db.transaction('books', 'readonly')
  const store = tx.objectStore('books')
  const request = store.getAll()

  return new Promise((resolve, reject) => {
    request.onsuccess = event => {
      resolve(event.target.result)
    }
    request.onerror = event => {
      reject(event.target.error)
    }
  })
}

const state = {
  books: [],
  bookIsLoad: false
}

const mutations = {
  SET_BOOKS (state, books) {
    state.books = books
  },
  ADD_BOOK (state, book) {
    state.books.push(book)
  },
  SET_BOOK_IS_LOAD (state, isLoad) {
    state.bookIsLoad = isLoad
  }
}
const actions = {
  loadBooksFromIndexDb ({ commit }) {
    return loadBooksFromIndexDb().then(books => {
      commit('SET_BOOKS', books)
      commit('SET_BOOK_IS_LOAD', true)
      return books
    })
  },
  addBook ({ commit }, book) {
    return openDatabase('ebookShelf').then(db => {
      const tx = db.transaction('books', 'readwrite')
      const store = tx.objectStore('books')
      const request = store.add(book)
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          commit('ADD_BOOK', book)
          resolve()
        }
        request.onerror = event => {
          reject(event.target.error)
        }
      })
    })
  },

  deleteBooks ({ commit, state }, bookIds) {
    return openDatabase('ebookShelf').then(db => {
      const tx = db.transaction('books', 'readwrite')
      const store = tx.objectStore('books')
      const deletePromises = bookIds.map(id => {
        return new Promise((resolve, reject) => {
          const request = store.delete(id)
          request.onsuccess = () => resolve()
          request.onerror = event => reject(event.target.error)
        })
      })
      return Promise.all(deletePromises).then(() => {
        const remainingBooks = state.books.filter(book => !bookIds.includes(book.id))
        commit('SET_BOOKS', remainingBooks)
      })
    })
  },

  getBookById ({ state }, bookId) {
    return state.books.find(book => book.id === bookId)
  },

  updateBookProgress ({ commit, state }, { bookId, progress }) {
    const book = state.books.find(b => b.id === bookId)
    if (book) {
      book.readingAloudProgress = progress
      return openDatabase('ebookShelf').then(db => {
        const tx = db.transaction('books', 'readwrite')
        const store = tx.objectStore('books')
        const request = store.put(book)
        return new Promise((resolve, reject) => {
          request.onsuccess = () => resolve()
          request.onerror = event => reject(event.target.error)
        })
      })
    } else {
      return Promise.reject(new Error('Book not found'))
    }
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
