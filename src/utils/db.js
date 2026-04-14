export async function openDatabase (name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
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
}
