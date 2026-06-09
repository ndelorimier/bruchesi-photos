<template>
  <div class="relative aspect-square cursor-pointer group" @click="$emit('click', photo)">
    <img
      :src="`/api/photos/file/${photo.id}/thumb`"
      :alt="`Photo approuvée`"
      class="w-full h-full object-cover rounded-lg"
      loading="lazy"
    />
    <div class="absolute bottom-1 left-1 flex gap-1 flex-wrap">
      <span
        v-for="tag in photo.tags"
        :key="tag.campeurId"
        class="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded"
      >
        {{ tag.campeur.prenom }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({ photo: Object });
defineEmits(['click']);
</script>
