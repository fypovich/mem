// ИСПРАВЛЕНО: Добавлен /api/v1 к дефолтному значению
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// Вычисляем корень (http://127.0.0.1:8000) для картинок
export const BACKEND_ROOT = API_URL.replace(/\/api\/v1\/?$/, "");

const getHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

// Хелпер для получения полного URL картинки
export const getFullUrl = (path: string | null | undefined) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    // Если путь начинается с /static, добавляем хост бэкенда
    if (path.startsWith("/")) return `${BACKEND_ROOT}${path}`;
    return `${BACKEND_ROOT}/${path}`;
};

export const processImage = async (file: File, operation: 'remove_bg') => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("operation", operation);

  // ВАЖНО: API_URL теперь содержит /api/v1, поэтому путь верный
  const res = await fetch(`${API_URL}/editor/process-image`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });
  
  if (!res.ok) {
      console.error("Upload failed", res.status);
      throw new Error("Failed");
  }
  return res.json();
};

export const createSticker = async (imagePath: string, animation: string) => {
  const headers: Record<string, string> = {
    ...getHeaders(),
    "Content-Type": "application/json"
  };

  const res = await fetch(`${API_URL}/editor/create-sticker`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ image_path: imagePath, animation }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

export const checkStatus = async (taskId: string) => {
  const res = await fetch(`${API_URL}/editor/status/${taskId}`, {
    headers: getHeaders(),
  });
  return res.json();
};

// Функция для маски
export const uploadTempFile = async (file: File) => {
    return processImage(file, 'remove_bg');
};