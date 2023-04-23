<script setup>
import { Codemirror } from 'vue-codemirror'
import { ref } from 'vue'
//import { plainText as fpgaol1_v } from '@/assets/fpgaol1.v'
//import { plainText as fpgaol1_xdc } from '@/assets/fpgaol1.xdc'
//import { plainText as fpgaol2_v } from '@/assets/fpgaol2.v'
//import { plainText as fpgaol2_xdc } from '@/assets/fpgaol2.xdc'
import { StreamLanguage } from '@codemirror/language'
import { verilog } from '@codemirror/legacy-modes/mode/verilog'
import axios from 'axios'

const job_id = ref('')
const top_name = ref('')
const fpga_part = ref('')
const v = ref('')
const xdc = ref('')

const extensions = [StreamLanguage.define(verilog)]

function new_job_id() {
  return Math.round(Math.random() * 8388607 + 8388608).toString(16)
}

job_id.value = new_job_id()

function click_me_blank() {
  v.value = ''
  xdc.value = ''
  fpga_part.value = ''
  job_id.value = new_job_id()
}

function click_me(repo, path, xdc_name, v_name, device, top) {
  var gitbase = 'https://raw.githubusercontent.com/'
  var xdc_url = gitbase + repo + '/main/' + path + '/' + xdc_name
  var v_url = gitbase + repo + '/main/' + path + '/' + v_name
  axios
    .get(xdc_url)
    .then(({ data }) => {
      //console.log(data)
      xdc.value = data
    })
    .catch(({ err }) => {
      server_reply.value += '\nLoading xdc from GitHub failed: ' + err
    })
  axios
    .get(v_url)
    .then(({ data }) => {
      //console.log(data)
      v.value = data
    })
    .catch(({ err }) => {
      server_reply.value += '\nLoading verilog code from GitHub failed: ' + err
    })
  // todo: should make these happen in sequence...
  fpga_part.value = device
  top_name.value = top
}

const polling = ref(false)
const timeout = 3000
const bitstream_available = ref(false)
const log_available = ref(false)

const animarr = ['/', '-', '\\', '|']
const server_reply = ref('No reply from server.')
let cntr = 0

function poll() {
  axios
    .get(import.meta.env.VITE_HOST + '/status/' + job_id.value)
    .then(({ data }) => {
      console.log(data)
      if (data.includes('finished')) {
        console.log('Done!')
        if (data.includes('succeeded')) {
          bitstream_available.value = true
        }
        log_available.value = true
        server_reply.value = data
        polling.value = false
      } else {
        server_reply.value = animarr[cntr++ % 4] + '\t' + data
        window.setTimeout(poll, timeout)
      }
    })
    .catch(({ err }) => {
      server_reply.value = animarr[cntr++ % 4] + '\t' + err
      window.setTimeout(poll, timeout)
    })
}

function submit() {
  axios.post(
    import.meta.env.VITE_HOST + '/submit',
    new URLSearchParams({
      inputJobId: job_id.value,
      inputFpgaPart: fpga_part.value,
      inputXdcFile: xdc.value,
      inputSrcFile1: v.value,
	  inputTopName: top_name.value,
    })
  )
  polling.value = true
  bitstream_available.value = false
  log_available.value = false
  window.setTimeout(poll, timeout)
  // // here has a timing hazard: should do the post HERE and wait for finish
  // // before ispolling = true
  // if (!polllaunched.value) {
  //   polllaunched.value = true
  //   // this is the first launch of poll
  // }
  // polling.value = true
  // download_available.value = false
  // log_available.value = false
}

function download(filetype) {
  window.location.href = `${import.meta.env.VITE_HOST}/download/${job_id.value}/${filetype}`
}
</script>

<template>
  <div class="container">
    <form method="POST" action="submit" @submit.prevent="submit">
      <div class="row">
        <div class="btn-group form-group col-md-3 dropdown">
          <button
            type="button"
            class="btn btn-danger dropdown-toggle"
            data-bs-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
          >
            Initialize(Click me)
          </button>
          <div class="dropdown-menu">
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'fpgaol1/basic',
                  'fpgaol1.xdc',
                  'top.v',
                  'xc7a100tcsg324-1',
				  'top'
                )
              "
              >FPGAOL1(for login users)</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'fpgaol2/basic',
                  'fpgaol2.xdc',
                  'top.v',
                  'xc7a100tcsg324-1', 
				  'top'
                )
              "
              >FPGAOL2(for guests)</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'openxc7/demo-projects',
                  'blinky-digilent-arty',
                  'blinky.xdc',
                  'blinky.v',
                  'xc7a35tcsg324-1', 
				  'blinky'
                )
              "
              >Digilent Arty -- blinky</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'openxc7/demo-projects',
                  'blinky-qmtech',
                  'blinky.xdc',
                  'blinky.v',
                  'xc7k325tffg676-1', 
				  'blinky'
                )
              "
              >QMTech Kintex 7 -- blinky</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'openxc7/demo-projects',
                  'blinky-genesys2',
                  'blinky.xdc',
                  'blinky.v',
                  'xc7k325tffg676-1', 
				  'blinky'
                )
              "
              >Digilent Genesys 2 -- blinky</a
            >
            <a class="dropdown-item" @click="click_me_blank">Reset</a>
          </div>
        </div>
        <div class="form-group col-md-3">
          <label for="inputJobId">JobID</label>
          <input
            disabled
            v-model="job_id"
            type="text"
            class="form-control"
            id="inputJobId"
            name="inputJobId"
            readonly
          />
        </div>
        <div class="form-group col-md-3">
          <label for="inputFpgaPart">FPGA Part</label>
          <select id="inputFpgaPart" class="form-control" name="inputFpgaPart" disabled>
            <option selected>Auto ({{ fpga_part }})</option>
            <option>xc7a100tcsg324-1</option>
            <option>xc7a35tcsg324-1</option>
          </select>
        </div>
        <div class="form-group col-md-3">
          <label for="inputTopName">Top Module Name</label>
          <input
            v-model="top_name"
            type="text"
            class="form-control"
            id="inputTopName"
            name="inputTopName"
          />
        </div>
      </div>
      <div class="row my-2">
        <div class="form-group col-md-6">
          <label for="inputXdcFile">Constraint(XDC) file</label>
          <codemirror
            v-model="xdc"
            style="height: 500px; background-color: white"
            placeholder="Code goes here..."
          />
        </div>
        <div class="form-group col-md-6">
          <label for="inputSrcFile1">Verilog source file</label>
          <codemirror
            v-model="v"
            style="height: 500px; background-color: white"
            placeholder="Code goes here..."
            :extensions="extensions"
          />
        </div>
      </div>
      <button
        formtarget="_blank"
        type="submit"
        class="btn btn-primary mt-3 submit-button"
        id="submitbutton"
        :disabled="polling"
      >
        Submit
      </button>
    </form>
  </div>

  <div class="container">
    <p id="server_reply">{{ server_reply }}</p>
    <div class="row mb-2">
      <div class="btn-group bottom-button">
        <button
          class="btn btn-primary"
          :disabled="!bitstream_available"
          @click="download('bitstream')"
        >
          Download Bitstream
        </button>
      </div>
      <div class="btn-group bottom-button">
        <button class="btn btn-primary" :disabled="!log_available" @click="download('log')">
          Download Log
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  margin-top: 1rem !important;
}

pre {
  font-size: 18;
}

textarea.form-control {
  height: 400px;
}

.subtitle {
  color: gray;
  font-size: 16px;
}

.navbar-brand {
  line-height: 24px;
  display: flex;
}

.submit-button {
  width: 200px;
}

.bottom-button {
  margin-bottom: 8px;
  width: 300px;
}
</style>
