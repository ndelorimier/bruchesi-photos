<template>
  <div class="min-h-screen bg-gray-950">
    <router-view class="pb-20" />
    <NavBar />
  </div>
</template>

<script setup>
import NavBar from './components/NavBar.vue';
</script>
