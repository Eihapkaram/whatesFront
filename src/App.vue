<template>
  <div class="container">
    <h2>أداة الإرسال والاستقبال الذكي عبر الواتساب</h2>
    <!-- كارت متابعة حالة الاتصال والـ QR Code -->
    <div class="card status-card">
      <h3>حالة اتصال رقمك الشخصي</h3>

      <div v-if="store.whatsappStatus === 'CONNECTED'" class="alert success">
        ● تم ربط رقمك بالواتساب بنجاح وهو جاهز للعمل الآن!
      </div>

      <div v-else-if="store.whatsappStatus === 'QR_READY'" class="qr-container">
        <p class="alert warning">برجاء فتح تطبيق الواتساب من هاتفك وعمل Scan للـ QR Code التالي:</p>
        <img :src="store.qrCodeImage" alt="WhatsApp QR Code" class="qr-image" />
      </div>

      <div v-else-if="store.whatsappStatus === 'DISCONNECTED'" class="alert info">
        جاري تشغيل خادم الواتساب وتوليد الـ QR Code...
      </div>

      <div v-else class="alert danger">
        فشل الاتصال بخادم الواتساب الوسيط. تأكد من تشغيل سكريبت الـ Node.
      </div>
    </div>
    <!-- شق إرسال الرسائل المجدولة -->
    <div class="card">
      <h3>1. إرسال حملة رسايل جديدة (من ملف Excel)</h3>
      <div class="form-group">
        <label>حدد فرق الوقت بين كل رسالة (بالثواني):</label>
        <input type="number" v-model.number="delaySeconds" min="1" />
      </div>

      <div class="form-group">
        <label>ارفع ملف الإكسيل (يجب أن يحتوي على عمودين باسم "الرقم" و "الرسالة"):</label>
        <input type="file" @change="handleExcelUpload" accept=".xlsx, .xls" />
      </div>

      <button :disabled="parsedMessages.length === 0 || store.loading" @click="submitCampaign">
        {{ store.loading ? 'جاري البدء...' : `بدء إرسال ${parsedMessages.length} رسالة` }}
      </button>
    </div>

    <!-- شق استقبال وتصدير الرسائل المستلمة -->
    <div class="card">
      <div class="header-row">
        <h3>2. الرسائل المستلمة الجديدة</h3>
        <button class="btn-success" @click="exportToExcel">
          تصدير الرسائل المستلمة إلى شيت Excel
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>رقم المرسل</th>
            <th>نص الرسالة</th>
            <th>وقت الاستلام</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="msg in store.receivedMessages" :key="msg.id">
            <td>{{ msg.phone }}</td>
            <td>{{ msg.message }}</td>
            <td>{{ new Date(msg.received_at).toLocaleString('ar-EG') }}</td>
          </tr>
          <tr v-if="store.receivedMessages.length === 0">
            <td colspan="3" style="text-align: center">لا توجد رسائل مستلمة جديدة حتى الآن.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useWhatsappStore } from './stores/whatsappStore'
import * as XLSX from 'xlsx'

const store = useWhatsappStore()
const delaySeconds = ref(5)
const parsedMessages = ref([])

// قراءة شيت الإكسيل في المتصفح فوراً
const handleExcelUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // تحويل البيانات لـ JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet)

    // فلترة وتنسيق البيانات لتبسيط إرسالها للباكيند
    parsedMessages.value = rawData
      .map((row) => ({
        phone: String(row['الرقم'] || row['phone'] || '').trim(),
        message: String(row['الرسالة'] || row['message'] || '').trim(),
      }))
      .filter((item) => item.phone && item.message)
  }
  reader.readAsArrayBuffer(file)
}

const submitCampaign = async () => {
  await store.startCampaign(parsedMessages.value, delaySeconds.value)
  parsedMessages.value = [] // تصفير البيانات بعد الإرسال بنجاح
}

// عمل الـ Export للرسائل المستلمة من الفرونت إند مباشرة باستخدام SheetJS
const exportToExcel = () => {
  if (store.receivedMessages.length === 0) {
    alert('لا توجد بيانات لتصديرها!')
    return
  }

  const dataToExport = store.receivedMessages.map((msg) => ({
    الرقم: msg.phone,
    الرسالة: msg.message,
    'وقت الاستلام': new Date(msg.received_at).toLocaleString('ar-EG'),
  }))

  const worksheet = XLSX.utils.json_to_sheet(dataToExport)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'الرسائل المستلمة')
  XLSX.writeFile(workbook, 'الرسائل_المستلمة_الجديدة.xlsx')
}

onMounted(() => {
  store.fetchReceivedMessages()
  // عمل تحديث تلقائي كل 10 ثوانٍ للرسايل المستلمة كـ fallback سريع إذا لم تستخدم WebSockets
  setInterval(() => {
    store.fetchReceivedMessages()
  }, 10000)
  // فحص حالة الواتساب كل 3 ثوانٍ لتحديث الـ QR أو إخفائه فوراً بعد السكاّن
  setInterval(() => {
    store.checkWhatsappStatus()
  }, 3000)

  // تحديث الرسايل المستلمة كل 10 ثوانٍ
  setInterval(() => {
    store.fetchReceivedMessages()
  }, 10000)
})
</script>

<style scoped>
.container {
  max-width: 900px;
  margin: 30px auto;
  font-family: sans-serif;
  direction: rtl;
}
.card {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 25px;
  border: 1px solid #eee;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
input[type='number'],
input[type='file'] {
  padding: 8px;
  width: 100%;
  max-width: 300px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.btn-success {
  background: #28a745;
}
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}
table th,
table td {
  border: 1px solid #ddd;
  padding: 10px;
  text-align: right;
}
table th {
  background-color: #f1f1f1;
}
.status-card {
  text-align: center;
}
.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 15px;
}
.qr-image {
  width: 250px;
  height: 250px;
  border: 4px solid #fff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  margin-top: 10px;
}
.alert {
  padding: 12px;
  border-radius: 6px;
  font-weight: bold;
  margin: 10px 0;
}
.success {
  background-color: #d4edda;
  color: #155724;
}
.warning {
  background-color: #fff3cd;
  color: #856404;
}
.danger {
  background-color: #f8d7da;
  color: #721c24;
}
.info {
  background-color: #d1ecf1;
  color: #0c5460;
}
</style>
