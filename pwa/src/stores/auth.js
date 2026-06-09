import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token'));
  const user = computed(() => {
    if (!token.value) return null;
    try { return JSON.parse(atob(token.value.split('.')[1])); } catch { return null; }
  });

  function setToken(t) {
    token.value = t;
    localStorage.setItem('token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
  }

  function logout() {
    token.value = null;
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  }

  if (token.value) axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;

  return { token, user, setToken, logout };
});
