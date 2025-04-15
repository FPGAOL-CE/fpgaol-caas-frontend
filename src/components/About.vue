<script setup>
import { ref } from 'vue'
import { globalVersion } from '@/router'

const version = globalVersion
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
		<h4>		FPGAOL Community Edition: Compiling as a Service @ <b><i>Symbiotic EDA</i></b></h4>
		<br/>
		Feature request or bug report? Please contact ustcymgu at gmail.com!
	</pre>
    <pre>
		Samples and examples: <a href="https://github.com/FPGAOL-CE/user-examples">https://github.com/FPGAOL-CE/user-examples</a>
		Explore openXC7 the open-source FPGA toolchain for AMD/Xilinx FPGAs: <a href="https://github.com/openXC7">https://github.com/openXC7</a>
		See maintainer's other projects: <a href="https://github.com/regymm">GitHub</a> <a href="https://twitter.com/regymm0">Twitter</a>
	</pre>
  </div>
</template>

<style scoped>
pre {
  font-size: 18px;
}
</style>
