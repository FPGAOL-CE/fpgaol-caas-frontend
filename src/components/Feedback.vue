<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { globalVersion } from '@/router'

const version = globalVersion
const fb_contact = ref('')
const fb_content = ref('')
const feedback_reply = ref('')

function send_fb() {
  axios
    .post(
      import.meta.env.VITE_HOST + '/feedback',
      new URLSearchParams({
        fbContact: fb_contact.value,
        fbContent: fb_content.value
      })
    )
    .then(() => {
      feedback_reply.value = 'Sent!'
    })
    .catch(({ err }) => {
      feedback_reply.value = 'Something went wrong: ' + err
    })
}
</script>
<template>
  <div class="container">
    <div class="row justify-content-start">
      <!-- <div class="form-group col-md-5">
        <label for="fb_content">Content</label>
        <textarea
          class="form-control"
          v-model="fb_content"
          type="text"
          id="fb_content"
          rows="8"
        ></textarea>
      </div>
      <div class="w-100"></div> -->
      <!-- <div class="form-group col-md-5">
        <label for="fb_contact" class="mt-1">Contact(optional)</label>
        <input
          v-model="fb_contact"
          type="text"
          class="form-control"
          name="fb_contact"
          id="fb_contact"
        />
      </div> -->
      <!-- <div class="w-100"></div>
      <div class="form-group col-md-5">
        <button class="btn btn-primary mt-3 submit-button" @click="send_fb()">Send feedback</button>
      </div>
      <div class="w-100"></div>
      <div class="form-group col-md-5">
        <p class="mt-3" id="feedback_reply">{{ feedback_reply }}</p>
      </div> -->
      <div class="form-group col-md-5">
        <a href="mailto:ustcymgu@gmail.com?subject=Feedback for SymbioticEDA CaaS&body=Hi, I have the following feedback for SymbioticEDA CaaS..." class="btn btn-primary mt-3 submit-button">Send feedback</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  margin-top: 1rem !important;
}
.flex-direction-column {
  flex-direction: column;
}

.form-group {
  margin: 0 auto;
}
</style>
