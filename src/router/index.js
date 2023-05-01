import Home from '@/components/Home.vue'
import Feedback from '@/components/Feedback.vue'
import About from '@/components/About.vue'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: Home },
  { path: '/feedback', component: Feedback },
  { path: '/about', component: About }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
