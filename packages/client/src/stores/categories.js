import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../composables/useApi.js';

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref([]);
  const loading = ref(false);

  async function fetchCategories(spaceId) {
    loading.value = true;
    try {
      const res = await api.get(`/spaces/${spaceId}/categories`);
      categories.value = res.categories;
      return res.categories;
    } finally {
      loading.value = false;
    }
  }

  async function createCategory(spaceId, data) {
    const res = await api.post(`/spaces/${spaceId}/categories`, data);
    categories.value.push(res.category);
    return res.category;
  }

  async function updateCategory(spaceId, categoryId, data) {
    const res = await api.patch(`/spaces/${spaceId}/categories/${categoryId}`, data);
    const index = categories.value.findIndex(c => c.id === categoryId);
    if (index !== -1) {
      categories.value[index] = res.category;
    }
    return res.category;
  }

  async function deleteCategory(spaceId, categoryId) {
    await api.delete(`/spaces/${spaceId}/categories/${categoryId}`);
    categories.value = categories.value.filter(c => c.id !== categoryId);
  }

  async function reorderCategories(spaceId, categoryIds) {
    const res = await api.post(`/spaces/${spaceId}/categories/reorder`, { category_ids: categoryIds });
    categories.value = res.categories;
    return res.categories;
  }

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories
  };
});
