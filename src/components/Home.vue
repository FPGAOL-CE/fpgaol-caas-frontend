<script setup>
import { Codemirror } from 'vue-codemirror'
import { ref } from 'vue'
import { computed } from 'vue'
import { onMounted } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { StreamLanguage } from '@codemirror/language'
import { verilog } from '@codemirror/legacy-modes/mode/verilog'
import Module from '/public/wasmFPGAloader_lite.js';
import axios from 'axios'

const version = ref(import.meta.env.VITE_VERSION)

const job_id_prefix = ref('')
const job_id_bare = ref('')
const job_id = ref('')
const top_name = ref('')
const fpga_part = ref('')
const auto_fpga_part = ref('')
const part_inuse = computed(() => {return fpga_part.value == 'auto' ? auto_fpga_part.value : fpga_part.value})
const backend = ref('')
const auto_backend = ref('')
const bkend_inuse = computed(() => {return backend.value == 'auto' ? auto_backend.value : backend.value})

const activeTab = ref('editor')
window.activeTab = activeTab

const v = ref('')
const xdc = ref('')
const bitname = computed(() => {return bkend_inuse.value == 'gowin' ? 'top.fs' : 'top.bit'})
const conf = computed(() => {return `[project]
Backend = ${bkend_inuse.value}
Part = ${part_inuse.value}
Top = ${top_name.value}
Bitname = ${bitname.value}
`})
const github_url = ref('')
const gh_conf = computed(() => {return conf.value + `Giturl = ${github_url.value}`})
const gh_conf_ext = ref('')
const use_gh_conf = ref('')
const gh_conf_name = ref('caas.conf')

const webusb_supported = ref('')
const webusb_connected = ref('')
const wfl_loaded = ref('')
const log_content = ref('')
//const usblog_content = ref('')
const usblog_xterm = new Terminal({
  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 14
})
const cable = ref('auto')
const auto_cable = ref('ft2232')
const flash_enabled = ref('')
const cable_inuse = computed(() => {return cable.value == 'auto' ? auto_cable.value : cable.value})
const wfl = ref('')

window.Module = Module;
window.wfl = wfl;

window.bkend_inuse = bkend_inuse
window.fpga_part = fpga_part
window.backend = backend
window.conf = conf

const extensions = [StreamLanguage.define(verilog)]

function new_job_id() {
  return Math.round(Math.random() * 8388607 + 8388608).toString(16)
}

function click_me_blank() {
  v.value = ''
  xdc.value = ''
  auto_fpga_part.value = ''
  fpga_part.value = 'auto'
  auto_backend.value = ''
  backend.value = 'auto'
  top_name.value = ''
  job_id_bare.value = new_job_id()
  job_id_prefix.value = ''
  cable.value = 'auto'
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

function click_me_github(url, urlconf, device, bend, top, jobidname) {
  github_url.value = url
  use_gh_conf.value = !urlconf == ''
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
          server_reply.value = 'Compiling went wrong, please try again: ' + '\t' + data + ', are some files empty or entries missing?'
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
  axios.post(
    import.meta.env.VITE_HOST + '/submit',
    new URLSearchParams({
      inputJobId: job_id.value,
	  inputNoSource: activeTab.value == 'editor' ? '0' : '1',
      inputXdcFile: activeTab.value == 'editor' ? xdc.value : '',
      inputSrcFile: activeTab.value == 'editor' ? v.value : '',
	  inputConfFile: activeTab.value == 'editor' ? conf.value : (gh_conf.value + '\n' + gh_conf_ext.value)
      // we keep the backward compatibility
//      inputFpgaPart: fpga_part.value,
//      inputSrcFile1: v.value, 
//      inputTopName: top_name.value
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

async function fetch_show_log() {
  log_content.value = 'Fetching log...';
  const url = `${import.meta.env.VITE_HOST}/download/${job_id.value}/log`;
  try {
    const response = await fetch(url);
	if (response.ok) {
	  const text = await response.text();
	  log_content.value = text;
	  setTimeout(() => {
	    const textarea = document.getElementById('log_textarea');
        textarea.scrollTop = textarea.scrollHeight; // Scroll to bottom
	  }, 0);
	} else {
	  console.error('Failed to fetch log.');
	  log_content.value = 'Failed to fetch log.';
	}
  } catch (error) {
	console.error('Error fetching log:', error);
	log_content.value = 'Error fetching log.';
  }
}


function usb_log_append(text, error=0) {
  if (error) usblog_xterm.write('\x1B[38;5;196m')
  usblog_xterm.write(text + '\r\n');
  if (error) usblog_xterm.write('\x1B[0;0m')
}

async function detect_connected()
{
	const devices = await navigator.usb.getDevices();
	if (devices.length != 0) {
	  usb_log_append('Device already connected: ' + devices[0].manufacturerName + ' - ' + devices[0].productName);
	  webusb_connected.value = true;
	}
}

async function load_wasmFPGALoader()
{
  usb_log_append('wasmFPGAloader initializing...');
  Module({
	onRuntimeInitialized: function(){
      usb_log_append('wasmFPGAloader loaded.');
	  wfl_loaded.value = true;
	},
	print: function(text) {
	  usb_log_append(text);
	},
	printErr: function(text) {
	  usb_log_append(text, 1);
	}
  }).then((wfll) => {
	wfl.value = wfll;
  }).catch((error) => {
    usb_log_append('wasmFPGAloader loading error: ' + error, 1);
  });
}

// WebUSB
onMounted(() => {
//  usblog_xterm.value = new Terminal();
  const fitAddon = new FitAddon();
  usblog_xterm.loadAddon(fitAddon);
  usblog_xterm.open(document.getElementById('usblog_xterm'));
  //usblog_xterm.setOption('padding', { top: 5, left: 0, right: 10, bottom: 5 });
//  usblog_xterm.write('log..')
  fitAddon.fit();

  webusb_connected.value = false;
  wfl_loaded.value = false;
  if (!navigator.usb) {
    usb_log_append('ERROR: WebUSB not supported by this browser!', 1);
    usb_log_append('Please use Chromium-based browsers and access the site with HTTPS', 1);
	webusb_supported.value = false;
  } else {
	webusb_supported.value = true;
    detect_connected();
	load_wasmFPGALoader();
  }
})

async function forget_all_devices(){
  const devices = await navigator.usb.getDevices();
  for (const device of devices) {
	if (!device.opened) await device.open();
	await device.reset();
	await device.close();
    await device.forget();
  }
  usb_log_append('All devices unpaired.');
  usb_log_append('!!Please refresh page before connect!!', 1);
  webusb_supported.value = false;
  // TODO: hijack connect button to refresh
}

async function connect_usb() {
  // forget all devices first -- have to do this before libusb can use other 
  // devices than only the first. 
  //await forget_all_devices();
  usb_log_append('Connect a new device...');
  try {
    const device = await navigator.usb.requestDevice({ filters: [] });
    usb_log_append('Device selected: ' + device.manufacturerName + ', ' + device.productName);
	webusb_connected.value = true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      usb_log_append('No device selected.', 1);
    } else {
      usb_log_append('Error: ' + error.message, 1);
    }
  }
}

/*
async function call_wfl(params) {
  return new Promise(function(resolve) {
    wfl.value.callMain(params);
	resolve();
  });
}
*/

async function bit2FS() {
  try {
    wfl.value.FS.unlink('/' + bitname.value);
  } catch (error) {}
  const url = `${import.meta.env.VITE_HOST}/download/${job_id.value}/bitstream`;
  try {
    const response = await fetch(url);
	if (!response.ok) {
	  usb_log_append('Error downloading bitstream file from server: ' + response.statusText, 1);
	}
	const arrayBuffer = await response.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);
	wfl.value.FS.writeFile('/' + bitname.value, uint8Array);
	usb_log_append('Bitstream downloaded from server.');
  } catch (error) {
    usb_log_append('Failed when downloading bitstream from server: ' + error, 1);
  }
}

async function wfl_program(cmd){
  if (cmd == 'detect') {
    usb_log_append('Detecting FPGA...');
	await wfl.value.callMain(['-c', cable_inuse.value, '--detect']);
	//usb_log_append('Detection done.');
  }
  else if (cmd == 'program') {
    usb_log_append('Programming bitstream to ' + 'SRAM' + '...');
	await bit2FS();
	await wfl.value.callMain(['-c', cable_inuse.value, '/' + bitname.value].concat(flash_enabled.value ? ['-f'] : []));
  }
}

</script>

<template>
  <div class="container container-fluid main-container">
    <form method="POST" action="submit" @submit.prevent="submit">
      <a class="mt-2" style="color:red" href="https://github.com/FPGAOL-CE/caas-wizard/blob/main/docs/CaaS%20User%20Guide.md" target="_blank">Need help? See the documents.</a>
      <div class="row mt-2">
        <div class="form-group col-md-2 dropdown" style="width: 12.49%">
          <label>Start here!</label>
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
              v-if="activeTab == 'editor'"
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
              v-if="activeTab == 'editor'"
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
              v-if="activeTab == 'editor'"
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
              v-if="activeTab == 'editor'"
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
              v-if="activeTab == 'editor'"
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
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'tangnano9k',
                  'tangnano9k.cst',
                  'blinky.v',
                  'GW1NR-LV9QN88PC6\\\/I5',
				  'gowin',
                  'top',
                  'tangnano9k'
                )
              "
              >Tang Nano 9K -- blinky</a
            >
            <a
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'hdmi',
                  'hdmi.cst',
                  'fpga4fun_hdmi_test.v',
                  'GW1NR-LV9QN88PC6\\\/I5',
				  'gowin',
                  'HDMI_test',
                  'tangnano9k'
                )
              "
              >Tang Nano 9K -- HDMI</a
            >
            <a
              v-if="activeTab == 'editor'"
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
              v-if="activeTab == 'editor'"
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
            <a
              v-if="activeTab == 'github'"
              class="dropdown-item"
              @click="
                click_me_github(
                  'https://github.com/Juninho99/FPGAOL-Caas-Tangnano9k-Test/pulls',
                  '',
                  'GW1NR-LV9QN88PC6\\\/I5',
				  'gowin',
                  'Lab1',
                  'tangnano9k_github'
                )
              "
              >Tang Nano 9K -- button_led</a
            >
            <a class="dropdown-item" @click="click_me_blank">Reset</a>
          </div>
        </div>
        <div class="form-group col-md-2" style="width: 12.49%">
          <label for="inputJobId">Name</label>
          <input
            v-model="job_id_prefix"
            type="text"
            class="form-control"
            id="inputJobId"
            name="inputJobId"
          />
        </div>
        <div class="form-group col-md-2" style="width: 12.49%">
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
			<optgroup label="GOWIN">
				<option value="GW1NZ-LV1QN48C6\/I5">GW1NZ-LV1QN48C6/I5 (Tang Nano 1K)</option>
				<option value="GW1NSR-LV4CQN48PC7\/I6">GW1NSR-LV4CQN48PC7/I6 (Tang Nano 4K)</option>
				<option value="GW1NR-LV9QN88PC6\/I5">GW1NR-LV9QN88PC6/I5 (Tang Nano 9K)</option>
				<option value="GW1NR-LV9QN88C6\/I5">GW1NR-LV9QN88C6/I5 (TEC0117)</option>
				<option value="GW2A-LV18PG256C8\/I7">GW2A-LV18PG256C8/I7 (Primer 20K)</option>
				<option value="GW1N-UV4LQ144C6\/I5">GW1N-UV4LQ144C6/I5 (Gowin Runber)</option>
				<option value="GW1N-LV1QN48C6\/I5">GW1N-LV1QN48C6/I5 (Original Tang Nano)</option>
				<option value="GW1NS-UX2CQN48C5\/I4">GW1NS-UX2CQN48C5/I4 (honeycomb)</option>
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
        <div class="form-group col-md-2" style="width: 12.49%">
          <label>Backend</label>
          <select id="" class="form-control" name="" v-model="backend">
            <option selected value="auto">Auto ({{ auto_backend }})</option>
            <option>openxc7</option>
            <option>gowin</option>
            <option>ice40</option>
            <option>ecp5</option>
          </select>
        </div>
        <div class="form-group col-md-2" style="width: 12.49%">
          <label for="inputTopName">Top Module</label>
          <input
            v-model="top_name"
            type="text"
            class="form-control"
            id="inputTopName"
            name="inputTopName"
          />
        </div>
        <div class="form-group col-md-2" style="width: 8%">
        </div>
		<div class="form-group col-md-2" style="width: 24.99%">
	      <label>What mode do you want?</label>
		  <nav>
			  <div class="nav nav-pills" id="pills-tab" role="tablist">
				  <button class="nav-link active" id="nav-editor-tab" data-bs-toggle="tab" data-bs-target="#nav-editor" type="button" role="tab" aria-controls="nav-editor" aria-selected="true" @click="activeTab='editor'">Online Editor</button>
				  <button class="nav-link" id="nav-editor-tab" data-bs-toggle="tab" data-bs-target="#nav-github" type="button" role="tab" aria-controls="nav-github" aria-selected="false" @click="activeTab='github'">GitHub Project</button>
			  </div>
		  </nav>
		</div>
      </div>
	  <div class="container tab-content mt-3" id="pills-tabContent" style="background-color: white;">
		  <div class="tab-pane show active" id="nav-editor" role="tabpanel" aria-labelledby="nav-editor-tab">
			  <div class="row">
				<div class="form-group col-md-6">
				  <label for="inputXdcFile">Constraint file</label>
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
		  </div>
		  <div class="tab-pane mt-2" id="nav-github" role="tabpanel" aria-labelledby="nav-github-tab">
			  <div class="row">
				  <div class="form-group col-md-6 mb-2">
					  <label>GitHub Project URL</label>
					  <input
						type="url"
						v-model="github_url"
						class="form-control"
					  />
				  </div>
				  <div class="form-group col-md-2">
					  <label class="form-check-label" for="use_gh_conf">
						  Use existing config file
					  </label>
					  <br>
					  <input class="form-check-input" type="checkbox" id="use_gh_conf" v-model="use_gh_conf">
				  </div>
				  <div v-if="use_gh_conf" class="form-group col-md-2">
					  <label class="form-check-label" for="use_gh_conf">
						  Config file name
					  </label>
					  <br>
					  <input
						v-model="gh_conf_name"
						type="text"
						class="form-control"
					  />
				  </div>
			  </div>
			  <div v-if="!use_gh_conf" class="form-group mt-2 col-md-6">
				  <label>Custom Compilation Configuration</label>
			      <textarea v-model="gh_conf" class="form-control gh_conf" id="gh_conf_textarea" readonly></textarea>
				  <codemirror
					v-model="gh_conf_ext"
					style="height: 200px; background-color: white;"
					placeholder="Add your extra config...
Sources = *.v, rtl/*.v
Constraint = *.xdc, *.lpf, *.cst"
					:extensions="extensions"
				  />
			  </div>
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
    <p class="mt-2" id="server_reply">{{ server_reply }}</p>
  </div>

  <div class="container main-container">
	  <div class="row">
		<div class="form-group col-md-6">
			<div class="row">
			  <div class="btn-group bottom-button col-md-6">
				<button class="btn btn-primary" :disabled="!log_available" @click="fetch_show_log()">
				  Fetch & Show Log
				</button>
			  </div>
			  <div class="btn-group bottom-button col-md-6">
				<button class="btn btn-primary" :disabled="!log_available" @click="download('log')">
				  Download Log
				</button>
			  </div>
			</div>
		    <label>Compilation log</label>
			<textarea class="form-control" id="log_textarea" readonly>{{ log_content }}</textarea>
		  <br>
		</div>
		<div class="form-group col-md-6">
			<div class="row mb-1">
			  <div class="btn-group bottom-button col-md-6">
				<button
				  class="btn btn-primary"
				  :disabled="!bitstream_available | !webusb_connected | !wfl_loaded"
				  @click="wfl_program('program')"
				>
				  Program Bitstream...
				</button>
			  </div>
			  <div class="btn-group bottom-button col-md-6">
				<button
				  class="btn btn-primary"
				  :disabled="!bitstream_available"
				  @click="download('bitstream')"
				>
				  Download Bitstream
				</button>
			  </div>
			</div>
		    <label>WebUSB programmer log</label>
				<div class="xterm" id="usblog_xterm"></div>
			<!--<textarea class="form-control" id="usblog_textarea" readonly> {{ usblog_content }}</textarea>-->
			<div class="row">
			  <div class="btn-group usb-button mt-2 col-md-4">
				<button class="btn btn-primary btn-dark" :disabled="!webusb_supported" @click="connect_usb()">
				  Connect Local USB
				</button>
			  </div>
			  <div class="btn-group usb-button mt-2 col-md-4">
				<button class="btn btn-primary btn-dark" :disabled="!webusb_connected | !wfl_loaded" @click="wfl_program('detect')">
				  Detect FPGA
				</button>
			  </div>
			  <div class="btn-group usb-button mt-2 col-md-4">
				<button class="btn btn-primary btn-dark" :disabled="!webusb_supported" @click="forget_all_devices()">
				  Disconnect all USB
				</button>
			  </div>
			  <div class="form-group md-2 col-md-6">
			    <label>JTAG Cable Type</label>
		    	<select id="" class="form-control" name="" v-model="cable">
				  <option selected value="auto">Auto ({{ auto_cable }})</option>
				  <option value="ft232">ft232</option>
				  <option value="ft2232">ft2232</option>
				  <option value="digilent">digilent</option>
			    </select>
			  </div>
			  <div class="form-group col-md-6">
				  <label class="form-check-label" for="flash_enabled">
					  Program to Flash
				  </label>
				  <br>
				  <input class="form-check-input" type="checkbox" id="flash_enabled" v-model="flash_enabled">
			  </div>
			</div>
		</div>
	  </div>
  </div>
</template>

<style scoped>
/*
.main-container {
  max-width:1300px;
}
*/

.container {
  margin-top: 1rem !important;
}

pre {
  font-size: 18;
}

textarea.form-control {
  height: 419px;
  font-size: 14px;
  font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: white;
  background-color: black;
}

textarea.gh_conf {
	height: 140px;
    color: black;
    background-color: white;
}

/*
codemirror {
	background-color: white;
}
*/

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

}
.usb-button {
  margin-bottom: 8px;

}

.xterm {
	height: 100%;
	max-height: 300px;
	box-sizing: border-box;
}
</style>
