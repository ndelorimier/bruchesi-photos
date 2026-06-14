<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Header + onglets -->
    <div class="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-gray-800 z-30">
      <h1 class="font-bold text-lg px-4 pt-4">⚙️ Administration</h1>
      <div class="flex gap-1 px-2 pt-2 overflow-x-auto">
        <router-link
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="px-3 py-2 text-sm whitespace-nowrap rounded-t-lg border-b-2 border-transparent text-gray-400"
          :class="{ 'text-blue-400 border-blue-400 bg-gray-900': isActive(tab) }"
        >
          {{ tab.label }}
        </router-link>
      </div>
    </div>

    <router-view class="p-4" />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();

const tabs = [
  { to: '/admin', label: '📊 Dashboard', exact: true },
  { to: '/admin/semaines', label: '📅 Semaines' },
  { to: '/admin/campeurs', label: '🏕️ Campeurs' },
  { to: '/admin/parents', label: '👪 Parents' },
  { to: '/admin/equipe', label: '👥 Équipe' },
];

function isActive(tab) {
  return tab.exact ? route.path === tab.to : route.path.startsWith(tab.to);
}
</script>
