import { useState } from "react";
import { TaskTemplate, extractPlaceholders } from "../../services/api/taskTemplates";

interface ModalState {
  isCreating: boolean;
  isEditing: boolean;
  isApplying: boolean;
  editingTemplate: TaskTemplate | null;
  applyingTemplate: TaskTemplate | null;
}

export const useTemplateModals = () => {
  const [modalState, setModalState] = useState<ModalState>({
    isCreating: false,
    isEditing: false,
    isApplying: false,
    editingTemplate: null,
    applyingTemplate: null,
  });

  const [placeholderValues, setPlaceholderValues] = useState<
    Record<string, string>
  >({});

  const openCreateModal = () => {
    setModalState({
      isCreating: true,
      isEditing: false,
      isApplying: false,
      editingTemplate: null,
      applyingTemplate: null,
    });
  };

  const openEditModal = (template: TaskTemplate) => {
    setModalState({
      isCreating: false,
      isEditing: true,
      isApplying: false,
      editingTemplate: template,
      applyingTemplate: null,
    });
  };

  const openApplyModal = (template: TaskTemplate) => {
    const placeholders = extractPlaceholders(template);
    const initialValues: Record<string, string> = {};
    placeholders.forEach((p: string) => {
      initialValues[p] = "";
    });
    setPlaceholderValues(initialValues);
    setModalState({
      isCreating: false,
      isEditing: false,
      isApplying: true,
      editingTemplate: null,
      applyingTemplate: template,
    });
  };

  const closeAllModals = () => {
    setModalState({
      isCreating: false,
      isEditing: false,
      isApplying: false,
      editingTemplate: null,
      applyingTemplate: null,
    });
    setPlaceholderValues({});
  };

  const updatePlaceholderValue = (key: string, value: string) => {
    setPlaceholderValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return {
    modalState,
    placeholderValues,
    setPlaceholderValues,
    openCreateModal,
    openEditModal,
    openApplyModal,
    closeAllModals,
    updatePlaceholderValue,
  };
};
