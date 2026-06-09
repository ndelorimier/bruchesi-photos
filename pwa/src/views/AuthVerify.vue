<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center">
    <div class="text-center text-white space-y-4">
      <div v-if="loading" class="text-gray-400">Connexion en cours...</div>
      <div v-if="error" class="text-red-400">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  const token = route.query.token;
  if (!token) { error.value = 'Lien invalide.'; loading.value = false; return; }
  try {
    const res = await axios.get(`/api/auth/verify?token=${token}`);
    auth.setToken(res.data.token);
    router.push('/');
  } catch {
    error.value = 'Lien expiré ou déjà utilisé. Demandez un nouveau lien.';
    loading.value = false;
  }
});
</script>
