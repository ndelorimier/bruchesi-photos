import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/auth/verify', component: () => import('../views/AuthVerify.vue'), meta: { public: true } },
  { path: '/reset-password', component: () => import('../views/ResetPassword.vue'), meta: { public: true } },
  { path: '/confidentialite', component: () => import('../views/Confidentialite.vue'), meta: { public: true } },
  { path: '/', component: () => import('../views/ParentGallery.vue'), meta: { role: 'parent' } },
  { path: '/alertes', component: () => import('../views/ParentAlerts.vue'), meta: { role: 'parent' } },
  { path: '/profil', component: () => import('../views/ParentProfile.vue'), meta: { role: 'parent' } },
  { path: '/approbation', component: () => import('../views/ApprovalQueue.vue'), meta: { role: 'employe' } },
  { path: '/upload', component: () => import('../views/UploadView.vue'), meta: { role: 'employe' } },
  { path: '/selfie-station', component: () => import('../views/SelfieStation.vue'), meta: { role: 'employe' } },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { role: 'admin' },
    children: [
      { path: '', component: () => import('../views/admin/AdminDashboard.vue') },
      { path: 'semaines', component: () => import('../views/admin/AdminSemaines.vue') },
      { path: 'campeurs', component: () => import('../views/admin/AdminCampeurs.vue') },
      { path: 'parents', component: () => import('../views/admin/AdminParents.vue') },
      { path: 'equipe', component: () => import('../views/admin/AdminEquipe.vue') },
    ],
  },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuthStore();
  const user = auth.user;

  // Page publique — toujours OK
  if (to.meta.public) return true;

  // Non connecté → login
  if (!auth.token || !user) return '/login';

  // Déjà connecté et va sur /login → rediriger vers le bon endroit
  if (to.path === '/login') return roleHome(user);

  const required = to.meta.role;

  // Route admin : doit être employé avec rôle ADMIN
  if (required === 'admin') {
    if (user.type === 'employe' && user.role === 'ADMIN') return true;
    return roleHome(user);
  }

  // Route employé : doit être un employé (tout rôle)
  if (required === 'employe') {
    if (user.type === 'employe') return true;
    return roleHome(user);
  }

  // Route parent : doit être un parent
  if (required === 'parent') {
    if (user.type === 'parent') return true;
    return roleHome(user);
  }

  return true;
});

/** Renvoie la page d'accueil selon le profil connecté */
function roleHome(user) {
  if (!user) return '/login';
  if (user.type === 'parent') return '/';
  if (user.type === 'employe') {
    if (user.role === 'ADMIN') return '/admin';
    if (user.role === 'APPROBATEUR') return '/approbation';
    return '/upload';
  }
  return '/login';
}

export default router;
