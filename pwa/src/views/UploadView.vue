<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 space-y-4">
    <h1 class="font-bold text-lg">📤 Upload photos</h1>

    <label class="block w-full border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 transition">
      <input type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
      <div class="text-gray-400 space-y-2">
        <div class="text-3xl">📁</div>
        <p>Glisser-déposer ou cliquer pour sélectionner</p>
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
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const queue = ref([]);
const uploading = ref(false);

function onFiles(e) {
  queue.value = Array.from(e.target.files).map(f => ({ file: f, name: f.name, status: 'pending' }));
}

async function upload() {
  uploading.value = true;
  const form = new FormData();
  queue.value.forEach(item => form.append('photos', item.file));
  try {
    await axios.post('/api/photos/upload', form);
    queue.value.forEach(item => item.status = 'done');
  } catch {
    queue.value.forEach(item => item.status = 'error');
  } finally {
    uploading.value = false;
  }
}
</script>
