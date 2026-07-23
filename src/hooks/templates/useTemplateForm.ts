import { useReducer, useState } from "react";

export interface TemplateFormData {
  name: string;
  description: string;
  category: 'knowledge' | 'project' | 'analysis' | 'architecture' | 'topicResearch' | 'creative';
  title_template: string;
  description_template: string;
  estimated_duration: number;
  tags: string[];
  priority: number;
}

const initialFormData: TemplateFormData = {
  name: "",
  description: "",
  category: "knowledge",
  title_template: "",
  description_template: "",
  estimated_duration: 25,
  tags: [],
  priority: 2,
};

type FormAction =
  | { type: "UPDATE_FIELD"; field: keyof TemplateFormData; value: unknown }
  | { type: "UPDATE_FIELDS"; fields: Partial<TemplateFormData> }
  | { type: "RESET" }
  | { type: "SET_FOR_EDIT"; data: TemplateFormData }
  | { type: "ADD_TAG"; tag: string }
  | { type: "REMOVE_TAG"; tag: string };

function formReducer(state: TemplateFormData, action: FormAction): TemplateFormData {
  switch (action.type) {
    case "UPDATE_FIELD":
      return { ...state, [action.field]: action.value };
    case "UPDATE_FIELDS":
      return { ...state, ...action.fields };
    case "RESET":
      return { ...initialFormData };
    case "SET_FOR_EDIT":
      return { ...action.data };
    case "ADD_TAG":
      if (state.tags.includes(action.tag)) {
        return state;
      }
      return { ...state, tags: [...state.tags, action.tag] };
    case "REMOVE_TAG":
      return { ...state, tags: state.tags.filter((t) => t !== action.tag) };
    default:
      return state;
  }
}

export function useTemplateForm() {
  const [formData, dispatch] = useReducer(formReducer, initialFormData);
  const [newTag, setNewTag] = useState("");

  const updateField = <K extends keyof TemplateFormData>(
    field: K,
    value: TemplateFormData[K]
  ) => {
    dispatch({ type: "UPDATE_FIELD", field, value });
  };

  const updateFields = (fields: Partial<TemplateFormData>) => {
    dispatch({ type: "UPDATE_FIELDS", fields });
  };

  const resetForm = () => {
    dispatch({ type: "RESET" });
    setNewTag("");
  };

  const setFormDataForEdit = (data: TemplateFormData) => {
    dispatch({ type: "SET_FOR_EDIT", data });
  };

  const addTag = () => {
    const trimmedTag = newTag.trim();
    if (trimmedTag) {
      dispatch({ type: "ADD_TAG", tag: trimmedTag });
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    dispatch({ type: "REMOVE_TAG", tag });
  };

  return {
    formData,
    updateField,
    updateFields,
    resetForm,
    setFormDataForEdit,
    addTag,
    removeTag,
    newTag,
    setNewTag,
  };
}
