<template>
  <nav v-if="user" class="fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 z-40">
    <div class="flex justify-around items-center h-16 max-w-lg mx-auto">
      <router-link
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center gap-0.5 px-2 py-1 text-gray-500 transition"
        :class="{ 'text-blue-400': isActive(item.to) }"
      >
        <span class="text-xl leading-none">{{ item.icon }}</span>
        <span class="text-[10px]">{{ item.label }}</span>
      </router-link>

      <button
        @click="logout"
        class="flex flex-col items-center gap-0.5 px-2 py-1 text-gray-500 hover:text-red-400 transition"
      >
        <span class="text-xl leading-none">🚪</span>
        <span class="text-[10px]">Quitter</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const user = computed(() => (route.meta.public ? null : auth.user));

const items = computed(() => {
  const u = auth.user;
  if (!u) return [];
  if (u.type === 'parent') {
    return [
      { to: '/', icon: '🖼️', label: 'Galerie' },
      { to: '/alertes', icon: '🔔', label: 'Alertes' },
      { to: '/profil', icon: '👤', label: 'Profil' },
    ];
  }
  const tabs = [
    { to: '/approbation', icon: '✅', label: 'Approbation' },
    { to: '/upload', icon: '📤', label: 'Upload' },
    { to: '/selfie-station', icon: '🤳', label: 'Selfie' },
  ];
  if (u.role === 'ADMIN') tabs.push({ to: '/admin', icon: '⚙️', label: 'Admin' });
  return tabs;
});

function isActive(to) {
  if (to === '/') return route.path === '/';
  return route.path.startsWith(to);
}

function logout() {
  auth.logout();
  router.push('/login');
}
</script>
