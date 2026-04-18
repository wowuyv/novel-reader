export class AsyncQueue {
  constructor () {
    this.queue = [] // 任务队列
    this.processing = false
  }

  // 添加任务，返回 Promise，在任务完成后 resolve/reject
  enqueue (asyncTask) {
    return new Promise((resolve, reject) => {
      this.queue.push({ asyncTask, resolve, reject })
      this._run()
    })
  }

  async _run () {
    if (this.processing) return
    this.processing = true

    while (this.queue.length) {
      const { asyncTask, resolve, reject } = this.queue.shift()
      try {
        const result = await asyncTask()
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }

    this.processing = false
  }
}
