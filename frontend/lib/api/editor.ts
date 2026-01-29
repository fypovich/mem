import { ProjectData } from "@/types/editor";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ИСПРАВЛЕНИЕ: Явная типизация возвращаемого значения
const getAuthHeaders = (): Record<string, string> => {
  // Проверка на window нужна, чтобы сборка не падала на сервере (где нет localStorage)
  if (typeof window === "undefined") {
    return {};
  }
  
  const token = localStorage.getItem("token");
  if (token) {
    return { "Authorization": `Bearer ${token}` };
  }
  
  return {};
};

export const uploadTempFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/editor/upload-temp`, {
    method: "POST",
    headers: getAuthHeaders(), // Убрали spread operator, теперь передаем объект напрямую
    body: formData,
  });

  if (!res.ok) throw new Error("Failed to upload temp file");
  return res.json(); 
};

export const uploadForBgRemoval = async (file: File, outline: boolean) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("outline", String(outline));

  const res = await fetch(`${API_URL}/editor/remove-bg`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  
  if (!res.ok) throw new Error("Failed to remove background");
  return res.json(); 
};

export const startRender = async (projectData: ProjectData) => {
  const res = await fetch(`${API_URL}/editor/render`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders() 
    },
    body: JSON.stringify({ project_data: projectData }),
  });

  if (!res.ok) throw new Error("Failed to start render");
  return res.json(); 
};

export const checkTaskStatus = async (taskId: string) => {
  const res = await fetch(`${API_URL}/editor/status/${taskId}`, {
    headers: getAuthHeaders(),
  });
  return res.json(); 
};