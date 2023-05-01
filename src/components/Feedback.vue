<script setup>
import { ref } from 'vue'
const version = ref(import.meta.env.VITE_VERSION)
</script>
<template>
  <div class="container pt-5">
	  TODO
    <pre v-if="version !== 'symbioticeda'"></pre>
    <pre v-else></pre>
  </div>
</template>

<!--
<style scoped>
pre {
  font-size: 18px;
}
</style>
-->
