<template>
  <div class="setting-dialog">
    <!-- 设置弹窗 -->
    <el-dialog title="阅读设置" :visible="visible" @close="handleClose" width="500px">
      <el-form label-width="100px" :model="formModel">
        <el-form-item label="字号(px)">
          <el-slider v-model="formModel.fontSize" :min="12" :max="40" :step="1" show-input @change="updateValue"></el-slider>
        </el-form-item>
        <el-form-item label="字体">
          <el-select v-model="formModel.fontFamily" placeholder="请选择字体" @change="updateValue">
            <el-option label="系统默认" value=""></el-option>
            <el-option label="宋体" value="'SimSun', '宋体', serif"></el-option>
            <el-option label="黑体" value="'Microsoft YaHei', '黑体', sans-serif"></el-option>
            <el-option label="楷体" value="'KaiTi', '楷体', serif"></el-option>
            <el-option label="仿宋" value="'FangSong', '仿宋', serif"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="文本颜色">
          <el-color-picker v-model="formModel.textColor" show-alpha @change="updateValue"></el-color-picker>
        </el-form-item>
        <el-form-item label="背景色">
          <el-color-picker v-model="formModel.bgColor" show-alpha @change="updateValue"></el-color-picker>
        </el-form-item>
        <el-form-item label="背景图片">
          <el-input v-model="formModel.bgImageUrl" placeholder="输入图片URL（留空则使用纯色）"></el-input>
          <el-button type="mini" @click="updateValue">确定</el-button>
          <div class="form-tip">支持网络图片地址</div>
        </el-form-item>
        <el-form-item label="左右空白(%)">
          <el-slider v-model="formModel.paddingPercent" :min="0" :max="30" :step="1" show-input @change="updateValue"></el-slider>
        </el-form-item>
        <el-form-item label="朗读语速">
          <el-slider v-model="formModel.speechRate" :min="0.5" :max="2" :step="0.1" show-input @change="updateValue"></el-slider>
        </el-form-item>
        <el-form-item label="朗读语音">
          <el-select v-model="formModel.selectedVoiceName" placeholder="请选择语音" filterable searchable @change="updateValue">
            <el-option
              v-for="voice in voiceList"
              :key="voice.Name"
              :label="`${voice.ShortName} (${voice.Gender}) - ${voice.Locale}`"
              :value="voice.Name">
            </el-option>
          </el-select>
          <div class="form-tip">在线语音，需要联网</div>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="resetToDefaults">恢复默认</el-button>
        <el-button @click="handleClose">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { listVoices } from 'edge-tts-universal'

const defaultSettings = {
  fontSize: 18,
  fontFamily: '',
  textColor: '#333333',
  bgColor: '#fef7e8',
  bgImageUrl: '',
  paddingPercent: 10,
  speechRate: 0.9,
  selectedVoiceName: 'zh-CN-XiaoxiaoNeural'
}

export default {
  name: 'ReaderSettings',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      formModel: { ...defaultSettings },
      voiceList: []
    }
  },
  created () {
    this.restoreSettings()
    this.updateValue()
    this.fetchVoiceList()
  },
  methods: {
    handleClose () {
      this.$emit('update:visible', false)
    },
    restoreSettings () {
      let storageSettings = {}
      try {
        storageSettings = JSON.parse(localStorage.getItem('readerSettings'))
      } catch (error) {
        console.error('解析阅读设置失败或无设置:', error)
      }
      Object.assign(this.formModel, storageSettings)
    },

    updateValue () {
      this.$emit('update', { ...this.formModel })
      localStorage.setItem('readerSettings', JSON.stringify(this.formModel))
    },

    resetToDefaults () {
      this.formModel = { ...defaultSettings }
      this.updateValue()
    },

    async fetchVoiceList () {
      try {
        const voices = await listVoices()
        // 筛选出中文语音（也可以全部显示，根据需求）
        this.voiceList = voices
        if (this.voiceList.length === 0) {
          this.voiceList = voices // 如果没有中文则显示全部
        }
        // 检查默认语音是否存在，否则使用第一个
        const exists = this.voiceList.some(v => v.Name === this.formModel.selectedVoiceName)
        if (!exists && this.voiceList.length) {
          this.formModel.selectedVoiceName = this.voiceList.filter(v => v.Locale && v.Locale.startsWith('zh-CN'))[0].Name
          this.updateValue()
        }
      } catch (err) {
        console.error('获取语音列表失败', err)
        this.$message.warning('获取语音列表失败，将使用默认语音')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
