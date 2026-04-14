import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'ebookShelf',
    component: () => import('@/views/ebookShelf/index.vue')
  },
  {
    path: '/novel-reader',
    name: 'novelReader',
    component: () => import('@/views/novelReader/index.vue')
  },
  {
    path: '/chapter-segmentation',
    name: 'chapterSegmentation',
    component: () => import('@/views/chapterSegmentation/index.vue')
  }
]

const router = new VueRouter({
  mode: 'hash',
  base: process.env.BASE_URL,
  routes
})

export default router
