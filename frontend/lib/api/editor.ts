// ДОБАВЛЕН префикс /api/v1 в дефолтное значение
const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// Вычисляем корень бэкенда для статики (удаляем /api/v1) -> http://127.0.0.1:8000
export const BACKEND_ROOT = API_URL.replace("/api/v1", "");

const getHeaders = (): Record<string, string> => {
  // Проверка на window для SSR
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

// Хелпер для получения полного URL картинки (исправляет битые ссылки)
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

  const res = await fetch(`${API_URL}/editor/process-image`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error("API Error:", text);
    throw new Error("Failed to process image");
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
  if (!res.ok) throw new Error("Failed to create sticker");
  return res.json();
};

export const checkStatus = async (taskId: string) => {
  const res = await fetch(`${API_URL}/editor/status/${taskId}`, {
    headers: getHeaders(),
  });
  return res.json();
};

// ДОБАВЛЕНО: Функция для простой загрузки (нужна для MaskEditor)
export const uploadTempFile = async (file: File) => {
    // Используем тот же эндпоинт, что и для удаления фона, 
    // но с прозрачным PNG это сработает как обычная загрузка + чистка
    return processImage(file, 'remove_bg');
};