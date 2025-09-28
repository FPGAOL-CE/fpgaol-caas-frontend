<script setup>
import { Codemirror } from 'vue-codemirror'
import { ref } from 'vue'
import { computed } from 'vue'
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { StreamLanguage } from '@codemirror/language'
import { verilog } from '@codemirror/legacy-modes/mode/verilog'
import Module from '/public/wasmFPGAloader_lite.js';
import axios from 'axios'
import { globalVersion } from '@/router'

const version = globalVersion

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
const sim = ref('')
const mode = ref('bitstream') // 'bitstream' or 'simulation'
const bitname = computed(() => {return bkend_inuse.value == 'gowin' ? 'top.fs' : 'top.bit'})
const conf = computed(() => {return `[project]
Backend = ${bkend_inuse.value}
Part = ${part_inuse.value}
Top = ${top_name.value}
Bitname = ${bitname.value}
`})
const github_url = ref('')
const use_gh_conf = ref('')
const gh_conf_ext = ref('')
const gh_conf_name = ref('caas.conf')
const gh_conf = computed(() => {return conf.value + `
Giturl = ${github_url.value}
Usegitconf = ${use_gh_conf.value}
Gitconf = ${gh_conf_name.value}
` + gh_conf_ext.value})

const webusb_supported = ref('')
const webusb_connected = ref('')
const wfl_loaded = ref('')
const log_content = ref('')
const usblog_xterm = new Terminal({
  fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 14
})
const cable = ref('auto')
const auto_cable = ref('cable ft2232')
const flash_enabled = ref('')
const cable_inuse = computed(() => {return cable.value == 'auto' ? auto_cable.value : cable.value})
const wfl = ref('')
const wfl_busy = ref(false)
const connected_usb_device = ref(null)

let __originalConsoleError = null

const surferUrl = '/surfer-viewer/';

window.Module = Module;
window.wfl = wfl;

window.bkend_inuse = bkend_inuse
window.fpga_part = fpga_part
window.backend = backend
window.conf = conf

const extensions = [StreamLanguage.define(verilog)]

// Watch for mode changes to initialize Surfer viewer when switching to simulation mode
// should run this only once when the page is loaded, but maybe this can reduce page loading time?
watch(mode, (newMode) => {
  if (newMode === 'simulation') {
    // Initialize Surfer viewer when switching to simulation mode
    setTimeout(() => {
      initializeSurferViewer();
    }, 5)
  }
})

function new_job_id() {
  return Math.round(Math.random() * 8388607 + 8388608).toString(16)
}

function click_me_blank() {
  v.value = ''
  xdc.value = ''
  sim.value = ''
  auto_fpga_part.value = ''
  fpga_part.value = 'auto'
  auto_backend.value = ''
  backend.value = 'auto'
  top_name.value = ''
  job_id_bare.value = new_job_id()
  job_id_prefix.value = ''
  cable.value = 'auto'
  auto_cable.value = 'ft2232'
  mode.value = 'bitstream'
  server_reply.value = 'No reply from server.'
  server_reply_sim.value = 'No reply from server.'
  simulation_available.value = false
  simulation_log_content.value = ''
  waveform_data.value = ''
  waveform_loaded.value = false
  log_content.value = ''
}

function click_me(repo, path, xdc_name, v_name, sim_name, device, bend, top, jobidname, cable_in) {
  var gitbase = 'https://raw.githubusercontent.com/'
  var xdc_url = gitbase + repo + '/main/' + path + '/' + xdc_name
  var v_url = gitbase + repo + '/main/' + path + '/' + v_name
  var sim_url = sim_name ? gitbase + repo + '/main/' + path + '/' + sim_name : null
  
  // Load constraint file (for bitstream mode)
  if (xdc_name) {
    axios
      .get(xdc_url)
      .then(({ data }) => {
        //console.log(data)
        xdc.value = data
      })
      .catch(({ err }) => {
        server_reply.value += '\nLoading xdc from GitHub failed: ' + err
      })
  }
  
  // Load Verilog source file
  axios
    .get(v_url)
    .then(({ data }) => {
      //console.log(data)
      v.value = data
    })
    .catch(({ err }) => {
      server_reply.value += '\nLoading verilog code from GitHub failed: ' + err
    })
  
  // Load simulation file (for simulation mode)
  if (sim_name && sim_url) {
    axios
      .get(sim_url)
      .then(({ data }) => {
        //console.log(data)
        sim.value = data
      })
      .catch(({ err }) => {
        server_reply_sim.value += '\nLoading simulation file from GitHub failed: ' + err
      })
  }
  
  backend.value = 'auto'
  auto_backend.value = bend
  fpga_part.value = 'auto'
  auto_fpga_part.value = device
  top_name.value = top
  job_id_prefix.value = jobidname
  if (cable_in && cable_in.trim() !== '') {
    auto_cable.value = cable_in
    cable.value = 'auto'
  }
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
const simulation_available = ref(false)
const simulation_log_content = ref('')
const waveform_data = ref('')
const waveform_loaded = ref(false)

const animarr = ['/', '-', '\\', '|']
const server_reply = ref('No reply from server.')
const server_reply_sim = ref('No reply from server.')
let cntr = 0

function poll() {
  axios
    .get(import.meta.env.VITE_HOST + '/status/' + job_id.value)
    .then(({ data }) => {
      console.log(data)
      // now we handle each possible response explicitly, and stop(let user submit again) immediately after vague things happened
      if (data.includes('finished')) {
        console.log('Done!')
        if (mode.value === 'bitstream') {
          if (data.includes('succeeded')) {
            bitstream_available.value = true
          }
          log_available.value = true
          server_reply.value = data
          // Fetch final log
          fetch_log_during_polling()
        } else {
          if (data.includes('succeeded')) {
            simulation_available.value = true
            // Automatically fetch and show simulation results when simulation succeeds
            fetch_show_simulation_results()
          }
          server_reply_sim.value = data
          // Fetch final simulation log
          fetch_simulation_log_during_polling()
        }
        polling.value = false
      } else {
        if (!data.includes('running') && !data.includes('pending')) {
          if (mode.value === 'bitstream') {
            server_reply.value = 'Compiling went wrong, please try again: ' + '\t' + data + ', are some files empty or entries missing?'
          } else {
            server_reply_sim.value = 'Simulation went wrong, please try again: ' + '\t' + data + ', are some files empty or entries missing?'
          }
          polling.value = false
        } else {
          if (mode.value === 'bitstream') {
            server_reply.value = animarr[cntr++ % 4] + '\t' + data
            // Fetch log during compilation
            fetch_log_during_polling()
          } else {
            server_reply_sim.value = animarr[cntr++ % 4] + '\t' + data
            // Fetch simulation log during simulation
            fetch_simulation_log_during_polling()
          }
          window.setTimeout(poll, timeout)
        }
      }
    })
    .catch(({ err }) => {
      if (mode.value === 'bitstream') {
        server_reply.value = 'Error communicating with server, please try again: ' + '\t' + err
      } else {
        server_reply_sim.value = 'Error communicating with server, please try again: ' + '\t' + err
      }
      polling.value = false
    })
}

function submit() {
  job_id_bare.value = new_job_id()
  job_id.value = job_id_prefix.value + '_' + job_id_bare.value
  
  const postData = {
    inputJobId: job_id.value,
    inputNoSource: activeTab.value == 'editor' ? '0' : '1',
    inputSrcFile: activeTab.value == 'editor' ? v.value : '',
    inputConfFile: activeTab.value == 'editor' ? conf.value : (gh_conf.value + '\n' + gh_conf_ext.value)
  }
  
  if (mode.value === 'bitstream') {
    postData.inputXdcFile = activeTab.value == 'editor' ? xdc.value : ''
  } else {
    postData.inputSimFile = activeTab.value == 'editor' ? sim.value : ''
  }
  
  axios.post(
    import.meta.env.VITE_HOST + '/submit',
    new URLSearchParams(postData)
  )
  polling.value = true
  
  if (mode.value === 'bitstream') {
    bitstream_available.value = false
    log_available.value = false
    log_content.value = 'Waiting for compilation log...\n'
  } else {
    simulation_available.value = false
    simulation_log_content.value = 'Starting simulation...\n'
  }
  
  window.setTimeout(poll, timeout)
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

async function fetch_log_during_polling() {
  if (!polling.value || !job_id.value) return;
  
  const url = `${import.meta.env.VITE_HOST}/download/${job_id.value}/log`;
  try {
    const response = await fetch(url);
	if (response.ok) {
	  const text = await response.text();
	  log_content.value = text;
	  setTimeout(() => {
	    const textarea = document.getElementById('log_textarea');
        if (textarea) {
          textarea.scrollTop = textarea.scrollHeight; // Scroll to bottom
        }
	  }, 0);
	}
  } catch (error) {
	// Silently ignore errors during polling to avoid spam
	console.debug('Error fetching log during polling:', error);
  }
}

async function fetch_simulation_log_during_polling() {
  if (!polling.value || !job_id.value) return;
  
  const logUrl = `${import.meta.env.VITE_HOST}/download/${job_id.value}/sim_log`;
  try {
    const logResponse = await fetch(logUrl);
	if (logResponse.ok) {
	  const logText = await logResponse.text();
	  simulation_log_content.value = logText;
	  setTimeout(() => {
	    const textarea = document.getElementById('simulation_log_textarea');
        if (textarea) {
          textarea.scrollTop = textarea.scrollHeight; // Scroll to bottom
        }
	  }, 0);
	}
  } catch (error) {
	// Silently ignore errors during polling to avoid spam
	console.debug('Error fetching simulation log during polling:', error);
  }
}

async function fetch_show_simulation_results() {
  simulation_log_content.value = 'Fetching simulation results...';
  waveform_data.value = 'Fetching waveform data...';
  
  // Fetch simulation log
  const logUrl = `${import.meta.env.VITE_HOST}/download/${job_id.value}/sim_log`;
  try {
    const logResponse = await fetch(logUrl);
	if (logResponse.ok) {
	  const logText = await logResponse.text();
	  simulation_log_content.value = logText;
	  setTimeout(() => {
	    const textarea = document.getElementById('simulation_log_textarea');
        textarea.scrollTop = textarea.scrollHeight; // Scroll to bottom
	  }, 0);
	} else {
	  console.error('Failed to fetch simulation log.');
	  simulation_log_content.value = 'Failed to fetch simulation log.';
	}
  } catch (error) {
	console.error('Error fetching simulation log:', error);
	simulation_log_content.value = 'Error fetching simulation log.';
  }
  
  // Fetch waveform data
  const waveformUrl = `${import.meta.env.VITE_HOST}/download/${job_id.value}/wave`;
  try {
    const waveformResponse = await fetch(waveformUrl);
	if (waveformResponse.ok) {
	  const waveformText = await waveformResponse.text();
	  waveform_data.value = waveformText;
	  waveform_loaded.value = true;
	  // Update Surfer viewer with new data
	  setTimeout(() => {
	    initializeSurferViewer();
	  }, 100);
	} else {
	  console.error('Failed to fetch waveform data.');
	  waveform_data.value = 'Failed to fetch waveform data.';
	  waveform_loaded.value = false;
	}
  } catch (error) {
	console.error('Error fetching waveform data:', error);
	waveform_data.value = 'Error fetching waveform data.';
	waveform_loaded.value = false;
  }
}


function usb_log_append(text, error=0) {
	if (error) usblog_xterm.write('\x1B[38;5;196m')
	usblog_xterm.write(text + '\r\n');
	if (error) usblog_xterm.write('\x1B[0;0m')
}

function getDeviceVidPid(device) {
  if (!device) return { vid: '0x0000', pid: '0x0000' };
  const vid = '0x' + device.vendorId.toString(16).padStart(4, '0').toUpperCase();
  const pid = '0x' + device.productId.toString(16).padStart(4, '0').toUpperCase();
  return { vid, pid };
}

function getWindowsDriverCommand() {
  const { vid, pid } = getDeviceVidPid(connected_usb_device.value);
  return `cd %USERPROFILE%/Downloads && curl -o wdi-simple.exe https://caas.symbioticeda.com/public/wdi-simple.exe && wdi-simple.exe --vid ${vid} --pid ${pid} -t 0 -b`;
}

function maybeShowUsbAccessDeniedGuidance(message) {
	try {
		const text = (message ?? '').toString().toLowerCase();
		// Rough match: look for key words only, ignore punctuation/case
		if (
      //SecurityError: Failed to execute 'open' on 'USBDevice': Access denied.
			// text.includes('securityerror') &&
			// text.includes('usbdevice') &&
			// text.includes('open') &&
			// text.includes('access denied') || 
      // NetworkError: Failed to execute 'claimInterface' on 'USBDevice': Unable to claim interface.
      text.includes('networkerror') &&
      text.includes('usbdevice') &&
      (text.includes('claiminterface')) &&
      text.includes('unable to claim interface') ||
      // NetworkError: Failed to execute 'conntrolTransferIn' on 'USBDevice': A transfer error has occurred. 
      text.includes('networkerror') &&
      text.includes('usbdevice') &&
      (text.includes('controltransferin')) &&
      text.includes('a transfer error has occurred')
		) {
			// Bright orange colored user notification
			usblog_xterm.write('\x1B[38;5;208m');
			usb_log_append('!!!!!!');
			
			// Check if connected device is FTDI (VID 0x0403)
			const isFtdiDevice = connected_usb_device.value && 
				connected_usb_device.value.vendorId === 0x0403;
			
			if (isFtdiDevice) {
				usb_log_append('You are using an FTDI JTAG cable. \n\rTo make them work with WebUSB, run the following command on your host computer:\n\r');
				usb_log_append('Linux Terminal: sudo rmmod ftdi_sio');
				usb_log_append('Windows CMD: ' + getWindowsDriverCommand());
        usb_log_append('')
				usb_log_append('For details, please check https://github.com/FPGAOL-CE/caas-wizard/blob/main/docs/WebUSB%20Drivers%20FTDI.md');
			} else {
        usb_log_append('Are you selecting the correct USB device?');
      }
			
			usb_log_append('!!!!!!');
			usblog_xterm.write('\x1B[0;0m');
		}
	} catch (_) {}
}

async function detect_connected()
{
	const devices = await navigator.usb.getDevices();
	if (devices.length != 0) {
	  connected_usb_device.value = devices[0];
	  usb_log_append('Device already connected: ' + devices[0].manufacturerName + ' - ' + devices[0].productName);
	  const { vid, pid } = getDeviceVidPid(devices[0]);
	  usb_log_append('Device VID:PID = ' + vid + ':' + pid);
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
  // usblog_xterm.setOption('padding', { top: 5, left: 0, right: 10, bottom: 5 });
//  usblog_xterm.write('log..')
  fitAddon.fit();

	// Globally intercept console.error so errors from wasmFPGAloader_lite.js are captured
	try {
		__originalConsoleError = console.error;
		console.error = (...args) => {
			try { __originalConsoleError && __originalConsoleError.apply(console, args); } catch (_) {}
			try {
				const msg = args.map(a => {
					try { if (a && a.stack) return a.stack; if (a && a.message) return a.message; return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
				}).join(' ');
				usblog_xterm.write('\x1B[38;5;213m')
				usb_log_append(msg)
				usblog_xterm.write('\x1B[0;0m')
				maybeShowUsbAccessDeniedGuidance(msg)
			} catch (_) {}
		};
	} catch (_) {}

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
    await device.forget();
    // if (!device.opened) await device.open();
    // await device.reset();
    // await device.close();
    // await device.forget();
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
    connected_usb_device.value = device;
    usb_log_append('Device selected: ' + device.manufacturerName + ', ' + device.productName);
    const { vid, pid } = getDeviceVidPid(device);
    usb_log_append('Device VID:PID = ' + vid + ':' + pid);
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
	if (wfl_busy.value) {
		// Pink color for warning
		usblog_xterm.write('\x1B[38;5;213m')
		usb_log_append('Another operation is still running. Please wait...')
		usblog_xterm.write('\x1B[0;0m')
		return;
	}
	wfl_busy.value = true;
	try {
		if (cmd == 'detect') {
			usb_log_append('Detecting FPGA...');
			if (cable_inuse.value === 'board ice40_generic') {
				// Pink color for warning
				usblog_xterm.write('\x1B[38;5;213m')
				usb_log_append("Warning: iCE40 FPGAs do not have a JTAG detection interface. Detection will not work. Please program the bitstream directly.")
				usblog_xterm.write('\x1B[0;0m')
				return;
			}
      await wfl.value.callMain((() => {
        const sel = cable_inuse.value;
        const args = [];
        if (sel.startsWith('board ')) {
          args.push('-b', sel.substring(6));
        } else if (sel.startsWith('cable ')) {
          args.push('-c', sel.substring(6));
        } else { args.push('-c', sel); }
        args.push('--detect');
        return args; })());
			//usb_log_append('Detection done.');
		}
		else if (cmd == 'program') {
			usb_log_append('Programming bitstream to ' + 'SRAM' + '...');
			await bit2FS();
			await wfl.value.callMain((() => {
			const sel = cable_inuse.value;
			const args = [];
			if (sel.startsWith('board ')) {
				args.push('-b', sel.substring(6));
			} else if (sel.startsWith('cable ')) {
				args.push('-c', sel.substring(6));
			} else { args.push('-c', sel); }
			args.push('/' + bitname.value); if (flash_enabled.value) { args.push('-f'); } return args; })());
		}
	} finally {
		wfl_busy.value = false;
	}
}

function parseTopModuleFromSimulation() {
  try {
    const text = sim.value || '';
    const match = text.match(/module\s+([A-Za-z_]\w*)\s*\(\s*\)\s*;/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (e) {}
  return 'tb_top';
}

function openLocalSurferViewer() {
  // If we have waveform data, create a blob URL and open Surfer with it
  if (waveform_data.value && waveform_data.value !== 'Failed to fetch waveform data.' && waveform_data.value !== 'Error fetching waveform data.' && waveform_data.value !== 'Fetching waveform data...') {
    // const blob = new Blob([waveform_data.value], { type: 'text/plain' });
    // const blobUrl = URL.createObjectURL(blob);
    // surferUrl = `/surfer-viewer/?url=${encodeURIComponent(blobUrl)}`;

    // Use the direct VCD file URL from the server
    const vcdUrl = `${import.meta.env.VITE_HOST}/download/${job_id.value}/wave`;
    const topModule = parseTopModuleFromSimulation();
    // Open Surfer in a new tab with the VCD file URL and startup commands
    const surferUrlWithVcd = `${surferUrl}?load_url=${encodeURIComponent(vcdUrl)}&startup_commands=${encodeURIComponent(`module_add ${topModule}`)}`;
    window.open(surferUrlWithVcd, '_blank');
    // TODO: waveform_data is not good, just need to store a vcd valid/invalid
  }
  else {
    // Open Surfer in a new tab
    window.open(surferUrl, '_blank');
  }
  
}

function initializeSurferViewer() {
  const viewerElement = document.getElementById('surfer-viewer');
  if (!viewerElement) {
    return;
  }
  
  // Check if iframe already exists
  let iframe = viewerElement.querySelector('iframe');
  
  if (!iframe) {
    // Create Surfer viewer iframe only if it doesn't exist
    iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '700px';
    iframe.style.border = '1px solid #ccc';
    iframe.style.borderRadius = '4px';
    viewerElement.appendChild(iframe);
  }
  
  // Update iframe src if we have new waveform data
  if (waveform_data.value && waveform_data.value !== 'Failed to fetch waveform data.' && waveform_data.value !== 'Error fetching waveform data.' && waveform_data.value !== 'Fetching waveform data...') {
    // Use the direct VCD file URL from the server, same as external viewer
    const vcdUrl = `${import.meta.env.VITE_HOST}/download/${job_id.value}/wave`;
    const topModule = parseTopModuleFromSimulation();
    
    // Set up Surfer viewer URL with the VCD data using load_url parameter and startup commands
    iframe.src = `${surferUrl}?load_url=${encodeURIComponent(vcdUrl)}&startup_commands=${encodeURIComponent(`module_add ${topModule}`)}`;
  } else if (!iframe.src || iframe.src === 'about:blank') {
    // Only set src if it's not already set
    iframe.src = surferUrl;
  }
}

onBeforeUnmount(() => {
	try {
		if (__originalConsoleError) {
			console.error = __originalConsoleError;
			__originalConsoleError = null;
		}
	} catch (_) {}
})
</script>

<template>
  <div class="container container-fluid main-container">
    <form method="POST" action="submit" @submit.prevent="submit">
      <a class="mt-2" style="color:red" href="https://github.com/FPGAOL-CE/caas-wizard/blob/main/docs/CaaS%20User%20Guide.md" target="_blank">Need help? See the documents.</a>
      <a class="mt-2 ms-4" style="color:red" href="https://github.com/FPGAOL-CE/fpgaol-caas-frontend/issues" target="_blank">Issues?</a>
      <div class="row mt-2">
        <div class="form-group col-md-2 dropdown" style="width: 9.99%">
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
                  'tb_top.v',
                  'xc7a100tcsg324-1',
                  'openxc7',
                  'top',
                  'fpgaol1',
                  ''
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
                  'tb_top.v',
                  'xc7a100tcsg324-1',
                  'openxc7',
                  'top',
                  'fpgaol2',
                  ''
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
                  'tb_top.v',
                  'xc7a35tcpg236-1',
                  'openxc7',
                  'top',
                  'basys3',
                  'board basys3'
                )
              "
              >Digilent Basys 3 -- blinky</a
            >
            <a
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'arty_a7',
                  'blinky.xdc',
                  'blinky.v',
                  'tb_top.v',
                  'xc7a35tcsg324-1',
                  'openxc7',
                  'blinky',
                  'arty35t',
                  'board arty_a7_35t'
                )
              "
              >Digilent Arty 35t -- blinky</a
            >
            <a
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'arty_a7',
                  'blinky.xdc',
                  'blinky.v',
                  null,
                  'xc7a100tcsg324-1',
                  'openxc7',
                  'blinky',
                  'arty100t',
                  'board arty_a7_100t'
                )
              "
              >Digilent Arty 100t -- blinky</a
            >
            <a
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'a7lite',
                  'a7lite.xdc',
                  'top.v',
                  'tb_top.v',
                  'xc7a100tfgg484-1',
                  'openxc7',
                  'top',
                  'a7lite100t',
                  'cable ft232'
                )
              "
              >MicroPhase A7Lite 100t -- blinky</a
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
                  null,
                  'xc7k325tffg676-1',
                  'openxc7',
                  'blinky',
                  'qmtechk7',
                  'board qmtechKintex7'
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
                  null,
                  'xc7k325tffg900-2',
			          'openxc7',
                  'blinky',
                  'genesys2',
                  'board genesys2'
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
                  'tb_blinky.v',
                  'GW1NR-LV9QN88PC6\\/I5',
			          'gowin',
                  'top',
                  'tangnano9k',
                  'board tangnano9k'
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
                  null,
                  'GW1NR-LV9QN88PC6\\\/I5',
				          'gowin',
                  'HDMI_test',
                  'tangnano9k',
                  'board tangnano9k'
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
                  'tangnano20k',
                  'tangnano20k.cst',
                  'blinky.v',
                  'tb_blinky.v',
                  'GW2AR-LV18QN88C8\\/I7',
				          'gowin',
                  'top',
                  'tangnano20k',
                  'board tangnano20k'
                )
              "
              >Tang Nano 20K -- blinky</a
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
                  'tb_pwm.v',
                  'ice40up5k-sg48',
			            'ice40',
                  'top',
                  'icebreaker',
                  'board ice40_generic'
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
                  'tb_blinky.v',
                  'lfe5u-25f-cabga381',
                  'ecp5',
                  'top',
                  'ulx3s',
                  'board ulx3s'
                )
              "
              >ULX3S -- blinky</a
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
                  'tb_blinky.v',
                  'lfe5u-85f-cabga381',
                  'ecp5',
                  'top',
                  'ulx3s',
                  'board ulx3s'
                )
              "
              >ULX3S(85F) -- blinky</a
            >
            <a
              v-if="activeTab == 'github'"
              class="dropdown-item"
              @click="
                click_me_github(
                  'https://github.com/Juninho99/FPGAOL-Caas-Tangnano9k-Test',
                  '',
                  'GW1NR-LV9QN88PC6\\\/I5',
				          'gowin',
                  'Lab1',
                  'tangnano9k_github'
                )
              "
              >Tang Nano 9K -- button_led GitHub</a
            >
            <a
              v-if="activeTab == 'github'"
              class="dropdown-item"
              @click="
                click_me_github(
                  'https://github.com/FPGAOL-CE/user-examples/tree/main/ulx3s',
                  '',
                  'lfe5u-25f-cabga381',
				          'ecp5',
                  'top',
                  'ulx3s_github'
                )
              "
              >ULX3S -- blinky GitHub</a
            >
            <a
              v-if="activeTab == 'github'"
              class="dropdown-item"
              @click="
                click_me_github(
                  'https://github.com/FPGAOL-CE/user-examples/tree/main/ulx3s',
                  '',
                  'lfe5u-85f-cabga381',
				        'ecp5',
                  'top',
                  'ulx3s_github'
                )
              "
              >ULX3S(85F) -- blinky GitHub</a
            >
            <a
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'nexysa7',
                  'Nexys-A7-100T-Master.xdc',
                  'top.v',
                  'tb_top.v',
                  'xc7a50tcsg324-1',
				  'openxc7',
                  'top',
                  'nexysa7_50t',
                  'board nexys_a7'
                )
              "
              >Digilent Nexys A7 50t -- blinky</a
            >
            <a
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'nexysa7',
                  'Nexys-A7-100T-Master.xdc',
                  'top.v',
                  'tb_top.v',
                  'xc7a100tcsg324-1',
				  'openxc7',
                  'top',
                  'nexysa7_100t',
                  'board nexys_a7'
                )
              "
              >Digilent Nexys A7 100t -- blinky</a
            >
            <a class="dropdown-item" @click="click_me_blank">Reset</a>
            <a
              v-if="activeTab == 'editor'"
              class="dropdown-item"
              @click="
                click_me(
                  'FPGAOL-CE/user-examples',
                  'boolean',
                  'boolean.xdc',
                  'top.v',
                  'tb_top.v',
                  'xc7s50csga324-1',
                  'openxc7',
                  'top',
                  'boolean',
                  'cable ft2232'
                )
              "
              >Boolean (xc7s50csga324-1) -- blinky</a>
          </div>
        </div>
        <div class="form-group col-md-2" style="width: 9.99%">
          <label for="inputJobId">Name</label>
          <input
            v-model="job_id_prefix"
            type="text"
            class="form-control"
            id="inputJobId"
            name="inputJobId"
          />
        </div>
        <div class="form-group col-md-2" style="width: 9.99%">
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
                <option value="GW2AR-LV18QN88C8\/I7">GW2AR-LV18QN88C8/I7 (Tang Nano 20K)</option>
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
        <div class="form-group col-md-2" style="width: 9.99%">
          <label>Backend</label>
          <select id="" class="form-control" name="" v-model="backend">
            <option selected value="auto">Auto ({{ auto_backend }})</option>
            <option>openxc7</option>
            <option>gowin</option>
            <option>ice40</option>
            <option>ecp5</option>
          </select>
        </div>
        <div class="form-group col-md-2" style="width: 9.99%">
          <label for="inputTopName">Top Module</label>
          <input
            v-model="top_name"
            type="text"
            class="form-control"
            id="inputTopName"
            name="inputTopName"
          />
        </div>
        <!-- <div class="form-group col-md-2" style="width: 8%">
        </div> -->
		<div class="form-group col-md-2" style="width: 18.49%">
	      <label>Real or sim?</label>
		  <nav>
			  <div class="nav nav-pills" id="mode-tab" role="tablist">
				  <button class="nav-link mode-nav-link" :class="{ active: mode === 'bitstream' }" type="button" @click="mode='bitstream'">Bitstream</button>
				  <button class="nav-link mode-nav-link" :class="{ active: mode === 'simulation' }" type="button" @click="mode='simulation'">Simulation</button>
			  </div>
		  </nav>
		</div>
		<div class="form-group col-md-2" style="width: 22.49%">
	      <label>Code here or elsewhere?</label>
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
				  <label v-if="mode === 'bitstream'" for="inputXdcFile">Constraint file</label>
				  <label v-else for="inputSimFile">Simulation file</label>
				  <codemirror
					v-if="mode === 'bitstream'"
					v-model="xdc"
					style="height: 500px; background-color: #fff4f4"
					placeholder="Constraint goes here..."
				  />
				  <codemirror
					v-else
					v-model="sim"
					style="height: 500px; background-color: #f8fff8"
					placeholder="Simulation goes here..."
					:extensions="extensions"
				  />
				</div>
				<div class="form-group col-md-6">
				  <label for="inputSrcFile1">Verilog source file</label>
				  <codemirror
					v-model="v"
					style="height: 500px; background-color: white"
					placeholder="Verilog source goes here..."
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
        {{ mode === 'bitstream' ? 'Submit' : 'Submit Simulation' }}
      </button>
    </form>
    <p class="mt-2" id="server_reply" v-if="mode === 'bitstream'">{{ server_reply }}</p>
    <p class="mt-2" id="server_reply_sim" v-else>{{ server_reply_sim }}</p>
  </div>

  <!-- Bitstream Mode Bottom Section -->
  <div v-show="mode === 'bitstream'" class="container main-container">
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
      <div class="row">
        <label>WebUSB programmer log</label>
        <div class="xterm" id="usblog_xterm"></div>
      </div>
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
				  <!-- Cables -->
				  <option value="cable ft232">cable ft232</option>
				  <option value="cable ft2232">cable ft2232</option>
				  <option value="cable ft4232">cable ft4232</option>
				  <option value="cable ft231x">cable ft231x</option>
				  <option value="cable dirtyJtag">cable dirtyJtag</option>
				  <option value="cable digilent">cable digilent</option>
				  <option value="cable jlink">cable jlink</option>
				  <option value="cable usbblaster">cable usbblaster</option>
				  <option value="cable ch347">cable ch347</option>
				  <!-- Boards -->
				  <option value="board basys3">board basys3</option>
				  <option value="board arty_a7_35t">board arty_a7_35t</option>
				  <option value="board arty_a7_100t">board arty_a7_100t</option>
				  <option value="board arty_s7_25">board arty_s7_25</option>
				  <option value="board arty_s7_50">board arty_s7_50</option>
				  <option value="board genesys2">board genesys2</option>
				  <option value="board nexys_a7">board nexys_a7</option>
				  <option value="board icebreaker">board icebreaker</option>
				  <option value="board ulx3s">board ulx3s</option>
				  <option value="board tangnano">board tangnano</option>
				  <option value="board tangnano9k">board tangnano9k</option>
				  <option value="board tangnano20k">board tangnano20k</option>
				  <option value="board efinix_jtag_ft2232">board efinix_jtag_ft2232</option>
				  <option value="board zedboard">board zedboard</option>
				  <option value="board zybo_z7_10">board zybo_z7_10</option>
				  <option value="board zybo_z7_20">board zybo_z7_20</option>
				  <option value="board ac701">board ac701</option>
				  <option value="board qmtech_k7">board qmtech_k7</option>
				  <option value="board ice40_generic">board ice40_generic</option>
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

  <!-- Simulation Mode Bottom Section -->
  <div v-show="mode === 'simulation'" class="container main-container">
    <div class="row">
      <!-- <div class="btn-group bottom-button col-md-3">
      <button class="btn btn-primary" :disabled="!simulation_available" @click="fetch_show_simulation_results()">
        Fetch & Show Results
      </button>
      </div> -->
      <div class="btn-group bottom-button col-md-4">
      <button class="btn btn-primary" :disabled="!simulation_available" @click="download('wave')">
        Download Waveform
      </button>
      </div>
      <div class="btn-group bottom-button col-md-4">
      <button class="btn btn-primary" :disabled="!simulation_available" @click="download('sim_log')">
        Download Log
      </button>
      </div>
      <div class="btn-group bottom-button col-md-4">
      <button class="btn btn-dark" @click="openLocalSurferViewer()">
        Open Surfer Externally
      </button>
      </div>
		</div>
	  <div class="row">
      <div class="form-group">
        <label>Waveform Viewer (Surfer)</label>
        <div id="surfer-viewer" class="waveform-container">
          <!-- Surfer viewer will be loaded here -->
        </div>
      </div>
	  </div>
    <div class="row">
      <div class="form-group">
		    <label>Simulation log</label>
        <textarea class="form-control" id="simulation_log_textarea" readonly style="height: 300px;">{{ simulation_log_content }}</textarea>
      </div>
    </div>
    <br>
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
  padding-right: 0px;
  padding-left: 6px;
	max-height: 300px;
	box-sizing: border-box;
}

.waveform-container {
  height: 700px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f8f9fa;
}

.mode-nav-link {
  color: #198754 !important;
  /* border: 1px solid #198754 !important; */
  /* background-color: transparent !important; */
}

/* .mode-nav-link:hover {
  color: white !important;
  background-color: #198754 !important;
} */

.mode-nav-link.active {
  color: white !important;
  background-color: #198754 !important;
  /* border-color: #198754 !important; */
}
</style>
