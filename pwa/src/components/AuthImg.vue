<template>
  <img v-if="objUrl" :src="objUrl" v-bind="$attrs" :alt="alt" />
  <div v-else v-bind="$attrs" class="bg-gray-800 animate-pulse"></div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import axios from 'axios';

// Charge une image protégée par JWT : un <img src> classique n'envoie pas
// l'en-tête Authorization, alors on récupère l'image via axios (avec le jeton)
// puis on l'affiche via un object URL.
defineOptions({ inheritAttrs: false });
const props = defineProps({ src: { type: String, default: '' }, alt: { type: String, default: '' } });

const objUrl = ref('');
let courant = '';

async function charger() {
  if (courant) { URL.revokeObjectURL(courant); courant = ''; objUrl.value = ''; }
  if (!props.src) return;
  try {
    const res = await axios.get(props.src, { responseType: 'blob' });
    courant = URL.createObjectURL(res.data);
    objUrl.value = courant;
  } catch { objUrl.value = ''; }
}

watch(() => props.src, charger, { immediate: true });
onUnmounted(() => { if (courant) URL.revokeObjectURL(courant); });
</script>
