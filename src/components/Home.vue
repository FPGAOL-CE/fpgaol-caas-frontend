<script setup>
import { Codemirror } from 'vue-codemirror'
import { ref } from 'vue'
import { computed } from 'vue'
import { StreamLanguage } from '@codemirror/language'
import { verilog } from '@codemirror/legacy-modes/mode/verilog'
import axios from 'axios'

const version = ref(import.meta.env.VITE_VERSION)

const job_id_prefix = ref('')
const job_id_bare = ref('')
const job_id = ref('')
const top_name = ref('')
const fpga_part = ref('')
const auto_fpga_part = ref('')
const backend = ref('')
const auto_backend = ref('')
const v = ref('')
const xdc = ref('')
const conf = computed(() => {return `[project]
Backend = ${backend.value == 'auto' ? auto_backend.value : backend.value}
Part = ${fpga_part.value == 'auto' ? auto_fpga_part.value : fpga_part.value}
Top = ${top_name.value}
Sources = *.v
Constraints = *.xdc`}) // not necessarily xdc but just the constraint file...

//window.fpga_part = fpga_part
//window.backend = backend
//window.conf = conf

const extensions = [StreamLanguage.define(verilog)]

function new_job_id() {
  return Math.round(Math.random() * 8388607 + 8388608).toString(16)
}

function click_me_blank() {
  v.value = ''
  xdc.value = ''
  auto_fpga_part.value = ''
  fpga_part.value = ''
  auto_backend.value = ''
  backend.value = ''
  job_id_bare.value = new_job_id()
  job_id_prefix.value = 'custom'
}

function click_me(repo, path, xdc_name, v_name, device, bend, top, jobidname) {
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
  backend.value = 'auto'
  auto_backend.value = bend
  fpga_part.value = 'auto'
  auto_fpga_part.value = device
  top_name.value = top
  job_id_prefix.value = jobidname
}

const polling = ref(false)
const timeout = 3000 // query interval
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
      // now we handle each possible response explicitly, and stop(let user submit again) immediately after vague things happened
      if (data.includes('finished')) {
        console.log('Done!')
        if (data.includes('succeeded')) {
          bitstream_available.value = true
        }
        log_available.value = true
        server_reply.value = data
        polling.value = false
      } else {
        if (!data.includes('running') && !data.includes('pending')) {
          server_reply.value = 'Compiling went wrong, please try again: ' + '\t' + data
          polling.value = false
        } else {
          server_reply.value = animarr[cntr++ % 4] + '\t' + data
          window.setTimeout(poll, timeout)
        }
      }
    })
    .catch(({ err }) => {
      server_reply.value = 'Error communicating with server, please try again: ' + '\t' + err
      polling.value = false
    })
}

function submit() {
  job_id_bare.value = new_job_id()
  job_id.value = job_id_prefix.value + '_' + job_id_bare.value
  conf.value = ''
  axios.post(
    import.meta.env.VITE_HOST + '/submit',
    new URLSearchParams({
      inputJobId: job_id.value,
      inputXdcFile: xdc.value,
      inputSrcFile: v.value,
	  inputConfFile: conf.value,
      // we keep the backward compatibility
      inputFpgaPart: fpga_part.value,
      inputSrcFile1: v.value, 
      inputTopName: top_name.value
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
        <div class="btn-group form-group col-md-2 dropdown">
          <button
            type="button"
            class="btn btn-danger dropdown-toggle"
            data-bs-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
          >
            Template
          </button>
          <div class="dropdown-menu">
            <a
              v-if="version !== 'symbioticeda'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'fpgaol1/basic',
                  'fpgaol1.xdc',
                  'top.v',
                  'xc7a100tcsg324-1',
				  'openxc7',
                  'top',
                  'fpgaol1'
                )
              "
              >FPGAOL1(for login users)</a
            >
            <a
              v-if="version !== 'symbioticeda'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'fpgaol2/basic',
                  'fpgaol2.xdc',
                  'top.v',
                  'xc7a100tcsg324-1',
				  'openxc7',
                  'top',
                  'fpgaol2'
                )
              "
              >FPGAOL2(for guests)</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'basys3',
                  'Basys3_Master.xdc',
                  'top.v',
                  'xc7a35tcpg236-1',
				  'openxc7',
                  'top',
                  'basys3'
                )
              "
              >Digilent Basys 3 -- blinky</a
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
				  'openxc7',
                  'blinky',
                  'arty35t'
                )
              "
              >Digilent Arty 35t -- blinky</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'openxc7/demo-projects',
                  'blinky-digilent-arty',
                  'blinky.xdc',
                  'blinky.v',
                  'xc7a100tcsg324-1',
				  'openxc7',
                  'blinky',
                  'arty100t'
                )
              "
              >Digilent Arty 100t -- blinky</a
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
				  'openxc7',
                  'blinky',
                  'qmtechk7'
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
                  'xc7k325tffg900-2',
				  'openxc7',
                  'blinky',
                  'genesys2'
                )
              "
              >Digilent Genesys 2 -- blinky</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'icebreaker',
                  'icebreaker.pcf',
                  'pwm.v',
                  'ice40up5k-sg48',
				  'ice40',
                  'top',
                  'icebreaker'
                )
              "
              >Icebreaker -- rgbled</a
            >
            <a
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'ulx3s',
                  'ulx3s_v20.lpf',
                  'blinky.v',
                  'lfe5u-25f-cabga381',
				  'ecp5',
                  'top',
                  'ulx3s'
                )
              "
              >ULX3S -- blinky</a
            >
            <a class="dropdown-item" @click="click_me_blank">Reset</a>
          </div>
        </div>
        <div class="form-group col-md-2">
          <label for="inputJobId">Name</label>
          <input
            v-model="job_id_prefix"
            type="text"
            class="form-control"
            id="inputJobId"
            name="inputJobId"
          />
        </div>
        <div class="form-group col-md-2">
          <label>FPGA Part</label>
          <select id="" class="form-control" name="" v-model="fpga_part">
            <option selected value="auto">Auto ({{ auto_fpga_part }})</option>
			<optgroup label="Lattice ICE40">
				<option>iCE40-HX1K-CB132</option>
				<option>iCE40-HX1K-TQ144</option>
				<option>iCE40-HX1K-VQ100</option>
				<option>iCE40-HX4K-BG121</option>
				<option>iCE40-HX4K-CB132</option>
				<option>iCE40-HX4K-TQ144</option>
				<option>iCE40-HX8K-BG121</option>
				<option>iCE40-HX8K-CB132</option>
				<option>iCE40-HX8K-CM225</option>
				<option>iCE40-HX8K-CT256</option>
				<option>iCE40-LP1K-CB121</option>
				<option>iCE40-LP1K-CB81</option>
				<option>iCE40-LP1K-CM121</option>
				<option>iCE40-LP1K-CM36</option>
				<option>iCE40-LP1K-CM49</option>
				<option>iCE40-LP1K-CM81</option>
				<option>iCE40-LP1K-QN84</option>
				<option>iCE40-LP1K-SWG16</option>
				<option>iCE40-LP384-CM36</option>
				<option>iCE40-LP384-CM49</option>
				<option>iCE40-LP384-QN32</option>
				<option>iCE40-LP4K-CM121</option>
				<option>iCE40-LP4K-CM225</option>
				<option>iCE40-LP4K-CM81</option>
				<option>iCE40-LP8K-CM121</option>
				<option>iCE40-LP8K-CM225</option>
				<option>iCE40-LP8K-CM81</option>
				<option>iCE40-UP3K-UWG30</option>
				<option>iCE40-UP5K-SG48</option>
				<option>iCE40-UP5K-UWG30</option>
            </optgroup>
			<optgroup label="Lattice ECP5">
				<option>lfe5u-12f-cabga256</option>
				<option>lfe5u-12f-cabga381</option>
				<option>lfe5u-12f-csfgba285</option>
				<option>lfe5u-12f-tqfp144</option>

				<option>lfe5u-25f-cabga256</option>
				<option>lfe5u-25f-cabga381</option>
				<option>lfe5u-25f-csfgba285</option>
				<option>lfe5u-25f-tqfp144</option>

				<option>lfe5u-45f-cabga256</option>
				<option>lfe5u-45f-cabga381</option>
				<option>lfe5u-45f-cabga554</option>
				<option>lfe5u-45f-csfgba285</option>
				<option>lfe5u-45f-tqfp144</option>

				<option>lfe5u-85f-cabga381</option>
				<option>lfe5u-85f-cabga554</option>
				<option>lfe5u-85f-cabga756</option>
				<option>lfe5u-85f-csfgba285</option>

				<option>lfe5um-25f-cabga256</option>
				<option>lfe5um-25f-cabga381</option>
				<option>lfe5um-25f-csfgba285</option>

				<option>lfe5um-45f-cabga256</option>
				<option>lfe5um-45f-cabga381</option>
				<option>lfe5um-45f-cabga554</option>
				<option>lfe5um-45f-csfgba285</option>

				<option>lfe5um-85f-cabga381</option>
				<option>lfe5um-85f-cabga554</option>
				<option>lfe5um-85f-cabga756</option>
				<option>lfe5um-85f-csfgba285</option>

				<option>lfe5um5g-25f-cabga256</option>
				<option>lfe5um5g-25f-cabga381</option>
				<option>lfe5um5g-25f-csfgba285</option>

				<option>lfe5um5g-45f-cabga256</option>
				<option>lfe5um5g-45f-cabga381</option>
				<option>lfe5um5g-45f-cabga554</option>
				<option>lfe5um5g-45f-csfgba285</option>

				<option>lfe5um5g-85f-cabga381</option>
				<option>lfe5um5g-85f-cabga554</option>
				<option>lfe5um5g-85f-cabga756</option>
				<option>lfe5um5g-85f-csfgba285</option>
            </optgroup>
            <optgroup label="Xilinx 7 Series">
				<option disabled>Spartan 7</option>
				<option>xc7s50ftgb196-1</option>
				<option>xc7s50ftgb196-1IL</option>
				<option>xc7s50ftgb196-2</option>
				<option>xc7s50csga324-1</option>
				<option>xc7s50csga324-1IL</option>
				<option>xc7s50csga324-2</option>
				<option>xc7s50fgga484-1</option>
				<option>xc7s50fgga484-1IL</option>
				<option>xc7s50fgga484-2</option>
				<option disabled>Artix 7</option>
				<option>xc7a100tcsg324-1</option>
				<option>xc7a100tcsg324-2</option>
				<option>xc7a100tcsg324-2L</option>
				<option>xc7a100tcsg324-3</option>
				<option>xc7a100tfgg484-1</option>
				<option>xc7a100tfgg484-2</option>
				<option>xc7a100tfgg484-2L</option>
				<option>xc7a100tfgg484-3</option>
				<option>xc7a100tfgg676-1</option>
				<option>xc7a100tfgg676-2</option>
				<option>xc7a100tfgg676-2L</option>
				<option>xc7a100tfgg676-3</option>
				<option>xc7a100tftg256-1</option>
				<option>xc7a100tftg256-2</option>
				<option>xc7a100tftg256-2L</option>
				<option>xc7a100tftg256-3</option>
				<option>xc7a200tfbg484-1</option>
				<option>xc7a200tfbg484-2</option>
				<option>xc7a200tfbg484-2L</option>
				<option>xc7a200tfbg484-3</option>
				<option>xc7a200tfbg676-1</option>
				<option>xc7a200tfbg676-2</option>
				<option>xc7a200tfbg676-2L</option>
				<option>xc7a200tfbg676-3</option>
				<option>xc7a200tfbv484-1</option>
				<option>xc7a200tfbv484-2</option>
				<option>xc7a200tfbv484-2L</option>
				<option>xc7a200tfbv484-3</option>
				<option>xc7a200tfbv676-1</option>
				<option>xc7a200tfbv676-2</option>
				<option>xc7a200tfbv676-2L</option>
				<option>xc7a200tfbv676-3</option>
				<option>xc7a200tffg1156-1</option>
				<option>xc7a200tffg1156-2</option>
				<option>xc7a200tffg1156-2L</option>
				<option>xc7a200tffg1156-3</option>
				<option>xc7a200tffv1156-1</option>
				<option>xc7a200tffv1156-2</option>
				<option>xc7a200tffv1156-2L</option>
				<option>xc7a200tffv1156-3</option>
				<option>xc7a200tsbg484-1</option>
				<option>xc7a200tsbg484-2</option>
				<option>xc7a200tsbg484-2L</option>
				<option>xc7a200tsbg484-3</option>
				<option>xc7a200tsbv484-1</option>
				<option>xc7a200tsbv484-2</option>
				<option>xc7a200tsbv484-2L</option>
				<option>xc7a200tsbv484-3</option>
				<option>xc7a35tcpg236-1</option>
				<option>xc7a35tcpg236-2</option>
				<option>xc7a35tcpg236-2L</option>
				<option>xc7a35tcpg236-3</option>
				<option>xc7a35tcsg324-1</option>
				<option>xc7a35tcsg324-2</option>
				<option>xc7a35tcsg324-2L</option>
				<option>xc7a35tcsg324-3</option>
				<option>xc7a35tcsg325-1</option>
				<option>xc7a35tcsg325-2</option>
				<option>xc7a35tcsg325-2L</option>
				<option>xc7a35tcsg325-3</option>
				<option>xc7a35tfgg484-1</option>
				<option>xc7a35tfgg484-2</option>
				<option>xc7a35tfgg484-2L</option>
				<option>xc7a35tfgg484-3</option>
				<option>xc7a35tftg256-1</option>
				<option>xc7a35tftg256-2</option>
				<option>xc7a35tftg256-2L</option>
				<option>xc7a35tftg256-3</option>
				<option>xc7a50tcpg236-1</option>
				<option>xc7a50tcpg236-2</option>
				<option>xc7a50tcpg236-2L</option>
				<option>xc7a50tcpg236-3</option>
				<option>xc7a50tcsg324-1</option>
				<option>xc7a50tcsg324-2</option>
				<option>xc7a50tcsg324-2L</option>
				<option>xc7a50tcsg324-3</option>
				<option>xc7a50tcsg325-1</option>
				<option>xc7a50tcsg325-2</option>
				<option>xc7a50tcsg325-2L</option>
				<option>xc7a50tcsg325-3</option>
				<option>xc7a50tfgg484-1</option>
				<option>xc7a50tfgg484-2</option>
				<option>xc7a50tfgg484-2L</option>
				<option>xc7a50tfgg484-3</option>
				<option>xc7a50tftg256-1</option>
				<option>xc7a50tftg256-2</option>
				<option>xc7a50tftg256-2L</option>
				<option>xc7a50tftg256-3</option>
				<option disabled>Kintex 7</option>
				<option>xc7k160tfbg484-2</option>
				<option>xc7k160tfbg484-2L</option>
				<option>xc7k160tfbg484-3</option>
				<option>xc7k160tfbg676-1</option>
				<option>xc7k160tfbg676-2</option>
				<option>xc7k160tfbg676-2L</option>
				<option>xc7k160tfbg676-3</option>
				<option>xc7k160tfbv484-1</option>
				<option>xc7k160tfbv484-2</option>
				<option>xc7k160tfbv484-2L</option>
				<option>xc7k160tfbv484-3</option>
				<option>xc7k160tfbv676-1</option>
				<option>xc7k160tfbv676-2</option>
				<option>xc7k160tfbv676-2L</option>
				<option>xc7k160tfbv676-3</option>
				<option>xc7k160tffg676-1</option>
				<option>xc7k160tffg676-2</option>
				<option>xc7k160tffg676-2L</option>
				<option>xc7k160tffg676-3</option>
				<option>xc7k160tffv676-1</option>
				<option>xc7k160tffv676-2</option>
				<option>xc7k160tffv676-2L</option>
				<option>xc7k160tffv676-3</option>
				<option>xc7k325tffg676-1</option>
				<option>xc7k325tffg900-2</option>
				<option>xc7k420tffg1156-1</option>
				<option>xc7k420tffg1156-2</option>
				<option>xc7k420tffg1156-2L</option>
				<option>xc7k420tffg1156-3</option>
				<option>xc7k420tffg901-1</option>
				<option>xc7k420tffg901-2</option>
				<option>xc7k420tffg901-2L</option>
				<option>xc7k420tffg901-3</option>
				<option>xc7k420tffv1156-1</option>
				<option>xc7k420tffv1156-2</option>
				<option>xc7k420tffv1156-2L</option>
				<option>xc7k420tffv1156-3</option>
				<option>xc7k420tffv901-1</option>
				<option>xc7k420tffv901-2</option>
				<option>xc7k420tffv901-2L</option>
				<option>xc7k420tffv901-3</option>
				<option>xc7k480tffg1156-1</option>
				<option>xc7k480tffg1156-2</option>
				<option>xc7k480tffg1156-2L</option>
				<option>xc7k480tffg1156-3</option>
				<option>xc7k480tffg901-1</option>
				<option>xc7k480tffg901-2</option>
				<option>xc7k480tffg901-2L</option>
				<option>xc7k480tffg901-3</option>
				<option>xc7k480tffv1156-1</option>
				<option>xc7k480tffv1156-2</option>
				<option>xc7k480tffv1156-2L</option>
				<option>xc7k480tffv1156-3</option>
				<option>xc7k480tffv901-1</option>
				<option>xc7k480tffv901-2</option>
				<option>xc7k480tffv901-2L</option>
				<option>xc7k480tffv901-3</option>
				<option>xc7k70tfbg484-1</option>
				<option>xc7k70tfbg484-2</option>
				<option>xc7k70tfbg484-2L</option>
				<option>xc7k70tfbg484-3</option>
				<option>xc7k70tfbg676-1</option>
				<option>xc7k70tfbg676-2</option>
				<option>xc7k70tfbg676-2L</option>
				<option>xc7k70tfbg676-3</option>
				<option>xc7k70tfbv484-1</option>
				<option>xc7k70tfbv484-2</option>
				<option>xc7k70tfbv484-2L</option>
				<option>xc7k70tfbv484-3</option>
				<option>xc7k70tfbv676-1</option>
				<option>xc7k70tfbv676-2</option>
				<option>xc7k70tfbv676-2L</option>
				<option>xc7k70tfbv676-3</option>
				<option disabled>Zynq 7</option>
				<option>xc7z010clg225-1</option>
				<option>xc7z010clg225-2</option>
				<option>xc7z010clg225-3</option>
				<option>xc7z010clg400-1</option>
				<option>xc7z010clg400-2</option>
				<option>xc7z010clg400-3</option>
				<option>xc7z020clg400-1</option>
				<option>xc7z020clg400-2</option>
				<option>xc7z020clg400-3</option>
				<option>xc7z020clg484-1</option>
				<option>xc7z020clg484-2</option>
				<option>xc7z020clg484-3</option>
            </optgroup>
          </select>
        </div>
        <div class="form-group col-md-2">
          <label>Backend</label>
          <select id="" class="form-control" name="" v-model="backend">
            <option selected value="auto">Auto ({{ auto_backend }})</option>
            <option>openxc7</option>
            <option>ice40</option>
            <option>ecp5</option>
          </select>
        </div>
        <div class="form-group col-md-2">
          <label for="inputTopName">Top Module</label>
          <input
            v-model="top_name"
            type="text"
            class="form-control"
            id="inputTopName"
            name="inputTopName"
          />
        </div>
      </div>
	  <!--
	  <div>
		  {{ auto_fpga_part }}
		  {{ auto_backend }}
		  <br>
		  {{ fpga_part }}
		  {{ backend }}
		  <br>
		  {{ conf }}
	  </div>
	  -->
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
