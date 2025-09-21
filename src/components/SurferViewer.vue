<template>
  <div class="surfer-container">
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Loading Surfer...</p>
      </div>
    </div>
    <iframe
      v-show="!loading"
      ref="surferIframe"
      :src="surferUrl"
      class="surfer-iframe"
      @load="onIframeLoad"
      @error="onIframeError"
    ></iframe>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const props = defineProps({
  waveformUrl: {
    type: String,
    default: ''
  },
  height: {
    type: String,
    default: '700px'
  }
})

const emit = defineEmits(['loaded', 'error'])

const surferIframe = ref(null)
const loading = ref(true)

// Compute the Surfer URL with query parameters
const surferUrl = computed(() => {
  let baseUrl = '/surfer/index.html'
  
  // If waveformUrl prop is provided, use it
  if (props.waveformUrl) {
    baseUrl += `?url=${encodeURIComponent(props.waveformUrl)}`
  } else {
    // Otherwise, preserve query parameters from the current route
    const queryParams = route.query
    if (Object.keys(queryParams).length > 0) {
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')
      baseUrl += `?${queryString}`
    }
  }
  
  return baseUrl
})

const onIframeLoad = () => {
  loading.value = false
  emit('loaded')
}

const onIframeError = (error) => {
  loading.value = false
  emit('error', error)
}

// Method to send commands to Surfer via postMessage
const sendCommand = (command) => {
  if (surferIframe.value && surferIframe.value.contentWindow) {
    surferIframe.value.contentWindow.postMessage(command, '*')
  }
}

// Expose methods for parent components
defineExpose({
  sendCommand
})

onMounted(() => {
  // Set up message listener for communication from Surfer
  const handleMessage = (event) => {
    // Handle messages from Surfer iframe
    if (event.source === surferIframe.value?.contentWindow) {
      console.log('Message from Surfer:', event.data)
    }
  }
  
  window.addEventListener('message', handleMessage)
  
  // Cleanup
  return () => {
    window.removeEventListener('message', handleMessage)
  }
})
</script>

<style scoped>
.surfer-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  border: none;
  background-color: #f8f9fa;
  overflow: hidden;
  z-index: 1;
}

.surfer-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e3e3e3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-spinner p {
  margin: 0;
  color: #666;
  font-size: 14px;
}
</style> 