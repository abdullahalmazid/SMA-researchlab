import { useMemo } from "react";
import { useEditableContentStore } from "../context/EditableContentContext";

export function useEditableContent(id: string, defaultValue: string) {
  const store = useEditableContentStore();
  const localValue = useMemo(() => localStorage.getItem(`syedlab_content_${id}`), [id]);
  return {
    value: store.content[id] ?? localValue ?? defaultValue,
    save: (newValue: string) => store.save(id, newValue),
    loading: store.loading,
  };
}
