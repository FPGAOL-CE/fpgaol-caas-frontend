import Home from '@/components/Home.vue'
import ProjComp from '@/components/ProjComp.vue'
import Feedback from '@/components/Feedback.vue'
import About from '@/components/About.vue'
import { createRouter, createWebHistory } from 'vue-router'
import { ref } from 'vue'

// Create a global version ref that can be accessed from components
export const globalVersion = ref(import.meta.env.VITE_VERSION)

const routes = [
  { path: '/', component: Home },
  { path: '/projcomp', component: ProjComp },
  { path: '/feedback', component: Feedback },
  { path: '/about', component: About }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// Add navigation guard to handle version parameter
router.beforeEach((to, from, next) => {
  const versionParam = to.query.version
  if (versionParam) {
    globalVersion.value = versionParam
  }
  next()
})

export default router
