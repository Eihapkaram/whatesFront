import { defineStore } from 'pinia'
import axios from 'axios'

// إعداد كونسول أساسي للـ Axios ليتصل بـ Laravel
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'whatsapplaravel-production.up.railway.app/api',
})

export const useWhatsappStore = defineStore('whatsapp', {
  state: () => ({
    receivedMessages: [],
    loading: false,
    whatsappStatus: 'DISCONNECTED', // OFFLINE, DISCONNECTED, QR_READY, CONNECTED
    qrCodeImage: null,
  }),
  actions: {
    async startCampaign(messages, delay) {
      this.loading = true
      try {
        await api.post('/start-campaign', { messages, delay })
        alert('تم رفع الحملة وبدء الإرسال المتتابع في الخلفية بنجاح!')
      } catch (error) {
        console.error(error)
        alert('حدث خطأ أثناء بدء الحملة')
      } finally {
        this.loading = false
      }
    },
    async fetchReceivedMessages() {
      try {
        const response = await api.get('/received-messages')
        this.receivedMessages = response.data
      } catch (error) {
        console.error('خطأ في جلب الرسائل المستلمة', error)
      }
    },
    async checkWhatsappStatus() {
      try {
        const response = await api.get('/whatsapp-status')
        this.whatsappStatus = response.data.status
        this.qrCodeImage = response.data.qr
      } catch (error) {
        this.whatsappStatus = 'OFFLINE'
        this.qrCodeImage = null
      }
    },
  },
})
