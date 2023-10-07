<script setup>
import { ref } from 'vue'
const version = ref(import.meta.env.VITE_VERSION)
</script>
<template>
  <div class="container pt-5">
	  Compile a complex project from your local machine!
  </div>
</template>

<style scoped>
pre {
  font-size: 18px;
}
</style>
