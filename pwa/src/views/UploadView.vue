<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 space-y-4">
    <h1 class="font-bold text-lg">📤 Upload photos</h1>

    <!-- Semaine de camp -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-2">
      <label class="text-sm font-medium">Semaine de camp</label>
      <select v-model="semaineId" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <option value="">— Choisir la semaine —</option>
        <option v-for="s in semaines" :key="s.id" :value="s.id">{{ s.nom }}</option>
      </select>
      <p class="text-xs text-gray-500">Les photos seront rattachées à cette semaine (la reconnaissance ne cherchera que parmi ses campeurs).</p>
    </div>

    <label class="block w-full border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 transition"
      :class="{ 'opacity-40 pointer-events-none': !semaineId }">
      <input type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
      <div class="text-gray-400 space-y-2">
        <div class="text-3xl">📁</div>
        <p>{{ semaineId ? 'Glisser-déposer ou cliquer pour sélectionner' : 'Choisis d\'abord une semaine' }}</p>
        <p class="text-xs">JPG, PNG — max 20 MB par photo</p>
      </div>
    </label>

    <div v-if="queue.length" class="space-y-2">
      <div v-for="(item, i) in queue" :key="i" class="bg-gray-900 rounded-lg p-3 flex items-center gap-3">
        <div class="flex-1 truncate text-sm">{{ item.name }}</div>
        <div class="text-xs" :class="item.status === 'done' ? 'text-green-400' : item.status === 'error' ? 'text-red-400' : 'text-gray-400'">
          {{ item.status === 'done' ? '✓' : item.status === 'error' ? '✗' : '...' }}
        </div>
      </div>
    </div>

    <button
      v-if="queue.length && !uploading"
      @click="upload"
      class="w-full bg-green-600 hover:bg-green-500 rounded-xl py-3 font-semibold"
    >
      Uploader {{ queue.length }} photo(s)
    </button>
    <p v-if="msg" class="text-green-400 text-sm text-center">{{ msg }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const semaines = ref([]);
const semaineId = ref('');
const queue = ref([]);
const uploading = ref(false);
const msg = ref('');

onMounted(async () => {
  semaines.value = (await axios.get('/api/semaines')).data;
});

function onFiles(e) {
  queue.value = Array.from(e.target.files).map(f => ({ file: f, name: f.name, status: 'pending' }));
  msg.value = '';
}

async function upload() {
  if (!semaineId.value) return;
  uploading.value = true;
  msg.value = '';
  const form = new FormData();
  form.append('semaineId', semaineId.value);
  queue.value.forEach(item => form.append('photos', item.file));
  try {
    await axios.post('/api/photos/upload', form);
    queue.value.forEach(item => item.status = 'done');
    msg.value = '✓ Photos envoyées — en attente d\'approbation.';
    setTimeout(() => { queue.value = []; }, 1500);
  } catch {
    queue.value.forEach(item => item.status = 'error');
  } finally {
    uploading.value = false;
  }
}
</script>
