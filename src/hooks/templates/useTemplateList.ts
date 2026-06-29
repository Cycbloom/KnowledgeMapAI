import { useState, useEffect, useMemo } from "react";
import { taskTemplatesApi, TaskTemplate } from "../../services/api/taskTemplates";

interface TemplateListState {
  templates: TaskTemplate[];
  loading: boolean;
  searchQuery: string;
  selectedCategory: string;
}

export function useTemplateList() {
  const [state, setState] = useState<TemplateListState>({
    templates: [],
    loading: true,
    searchQuery: "",
    selectedCategory: "all",
  });

  const { templates, loading, searchQuery, selectedCategory } = state;

  const loadTemplates = async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const response = await taskTemplatesApi.getTemplates();
      if (response.success) {
        setState((prev) => ({ ...prev, templates: response.data || [] }));
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description &&
          t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === "all" || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const setSearchQuery = (query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query }));
  };

  const setSelectedCategory = (category: string) => {
    setState((prev) => ({ ...prev, selectedCategory: category }));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  return {
    templates,
    loading,
    searchQuery,
    selectedCategory,
    filteredTemplates,
    loadTemplates,
    setSearchQuery,
    setSelectedCategory,
  };
}
