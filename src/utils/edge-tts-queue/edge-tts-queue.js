import { EdgeTTSBrowser as EdgeTTS } from 'edge-tts-universal'
import { AsyncQueue } from './asyncQueue.js'

class EdgeTTSQueue extends EdgeTTS {
  constructor (voice = 'Microsoft Server Speech Text to Speech Voice (en-US, EmmaMultilingualNeural)', options = {}) {
    super('', voice, options)
    this.activeReconnectionTime = options.activeReconnectionTime || 0
    this.requestTimeout = options.requestTimeout || 10 * 1000
    this.requestTimeouter = null
    this.queue = new AsyncQueue()
  }

  /**
   * Initiates the synthesis process.
   * @returns A promise that resolves with the synthesized audio and subtitle data.
   */
  async _synthesizeQueue () {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.ws) {
        this.ws.close()
      }
      await this.connect()
      if (this.activeReconnectionTime) {
        setTimeout(() => {
          this.queue.enqueue(() => this.ws.close())
        }, this.activeReconnectionTime)
      }
      this.ws.send(this.createSpeechConfig())
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected.')
    }
    return new Promise((resolve, reject) => {
      const audioChunks = []
      let wordBoundaries = []
      this.requestTimeouter = null
      this.ws.onmessage = (event) => {
        this.requestTimeouter && clearTimeout(this.requestTimeouter)
        if (typeof event.data === 'string') {
          const { headers, body } = this.parseMessage(event.data)
          if (headers.Path === 'audio.metadata') {
            try {
              const metadata = JSON.parse(body)
              if (metadata.Metadata && Array.isArray(metadata.Metadata)) {
                const boundaries = metadata.Metadata.filter((item) => item.Type === 'WordBoundary' && item.Data).map((item) => ({
                  offset: item.Data.Offset,
                  duration: item.Data.Duration,
                  text: item.Data.text.Text
                }))
                wordBoundaries = wordBoundaries.concat(boundaries)
              }
            } catch (e) {
            }
          } else if (headers.Path === 'turn.end') {
            resolve(Promise.all(audioChunks).then(buffers => {
              return {
                audio: new Blob(buffers.filter(buf => buf),
                  { type: 'audio/mpeg' }
                ),
                subtitle: wordBoundaries
              }
            }))
          }
        } else if (event.data instanceof Blob) {
          audioChunks.push(event.data.arrayBuffer().then((arrayBuffer) => {
            const dataView = new DataView(arrayBuffer)
            const headerLength = dataView.getUint16(0)
            if (arrayBuffer.byteLength > headerLength + 2) {
              return new Uint8Array(arrayBuffer, headerLength + 2)
            }
          }))
        }
      }
      this.ws.onerror = (error) => {
        reject(error)
      }
      this.ws.send(this.createSSML())

      this.requestTimeouter && clearTimeout(this.requestTimeouter)
      this.requestTimeouter = setTimeout(() => {
        resolve(this._synthesizeQueue())
      }, this.requestTimeout)
    })
  }

  async synthesizeQueue (text) {
    return this.queue.enqueue(() => {
      this.text = text
      return this._synthesizeQueue()
    })
  }

  close () {
    this.queue = null
    clearTimeout(this.requestTimeouter)
    this.ws && this.ws.close()
    this.ws = null
  }
}
export { EdgeTTSQueue }
