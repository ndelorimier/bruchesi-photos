import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/auth/verify', component: () => import('../views/AuthVerify.vue'), meta: { public: true } },
  { path: '/', component: () => import('../views/ParentGallery.vue'), meta: { role: 'parent' } },
  { path: '/alertes', component: () => import('../views/ParentAlerts.vue'), meta: { role: 'parent' } },
  { path: '/profil', component: () => import('../views/ParentProfile.vue'), meta: { role: 'parent' } },
  { path: '/approbation', component: () => import('../views/ApprovalQueue.vue'), meta: { role: 'employe' } },
  { path: '/upload', component: () => import('../views/UploadView.vue'), meta: { role: 'employe' } },
  { path: '/selfie-station', component: () => import('../views/SelfieStation.vue'), meta: { role: 'employe' } },
  { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { role: 'admin' } },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.token) return '/login';
});

export default router;
