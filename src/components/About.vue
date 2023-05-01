<script setup>
import { ref } from 'vue'
const version = ref(import.meta.env.VITE_VERSION)
</script>
<template>
  <div class="container pt-5">
    <pre v-if="version !== 'symbioticeda'">
		FPGAOL Community Edition: Compiling as a Service
		<br/>
		Feature request or bug report? <router-link to="/feedback">Feedback</router-link> or contact ustcymgu at gmail.com!
		<b>Official FPGAOL platform @ USTC: <a href="https://fpgaol.ustc.edu.cn">https://fpgaol.ustc.edu.cn</a></b>
	</pre>
    <pre v-else>
		FPGAOL Community Edition: Compiling as a Service @ Symbiotic EDA
		<br/>
		Feature request or bug report? <router-link to="/feedback">Feedback</router-link> or contact ustcymgu at gmail.com!
		Not working? Try backup server at <a href="http://149.28.136.195:18888">http://149.28.136.195:18888</a>
	</pre>
    <pre>
		Samples and examples: <a href="https://github.com/FPGAOL-CE/user-examples">https://github.com/FPGAOL-CE/user-examples</a>
		See maintainer's other projects: <a href="https://github.com/regymm">GitHub</a> <a href="https://twitter.com/regymm0">Twitter</a> <a href="http://149.28.136.195">http://149.28.136.195</a>
	</pre>
  </div>
</template>

<style scoped>
pre {
  font-size: 18px;
}
</style>
