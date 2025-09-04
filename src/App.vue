<script setup>
import 'bootstrap/dist/css/bootstrap.css'
import '@popperjs/core/dist/umd/popper'
import 'bootstrap/dist/js/bootstrap'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <nav v-if="!route.path.startsWith('/surfer')" class="navbar navbar-expand-sm navbar-light bg-light shadow-sm sticky-top">
    <a class="navbar-brand px-3">
      <b>FPGAOL-CE</b><i class="subtitle ps-3">Compiling as a Service</i>
    </a>
    <button
      class="navbar-toggler"
      type="button"
      data-toggle="collapse"
      data-target="#navbarSupportedContent"
      aria-controls="navbarSupportedContent"
      aria-expanded="false"
      aria-label="Toggle navigation"
    >
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="navbarSupportedContent">
      <ul class="navbar-nav">
        <li class="nav-item">
          <router-link to="/" class="nav-link" :class="{ active: $route.path == '/' }">
            SUBMIT
          </router-link>
        </li>
        <li class="nav-item">
          <router-link to="/projcomp" class="nav-link" :class="{ active: $route.path == '/' }">
            PROJ_COMPILE
          </router-link>
        </li>
        <li class="nav-item">
          <router-link
            to="/feedback"
            class="nav-link"
            :class="{ active: $route.path == '/feedback' }"
          >
            FEEDBACK
          </router-link>
        </li>
        <li class="nav-item">
          <router-link to="/about" class="nav-link" :class="{ active: $route.path == '/about' }">
            ABOUT
          </router-link>
        </li>
      </ul>
    </div>
  </nav>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>

<style>
body {
  font-family: Arial, sans-serif;
  background-color: #e4d9d9;
}
</style>
