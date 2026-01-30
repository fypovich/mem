// Гарантируем, что URL всегда заканчивается на /api/v1
// Приоритет: INTERNAL -> NEXT_PUBLIC -> Localhost
const RAW_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const API_URL = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

// Вычисляем корень бэкенда (для статики)
export const BACKEND_ROOT = API_URL.replace("/api/v1", "");

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

  const res = await fetch(`${API_URL}/editor/process-image`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error("API Error processImage:", res.status, text);
    throw new Error("Failed to process image");
  }
  return res.json();
};

export const createSticker = async (imagePath: string, animation: string, options?: any) => {
  const headers: Record<string, string> = {
    ...getHeaders(),
    "Content-Type": "application/json"
  };

  const body = { 
      image_path: imagePath, 
      animation,
      outline_color: options?.outline_color,
      text: options?.text,
      text_color: options?.text_color
  };

  const res = await fetch(`${API_URL}/editor/create-sticker`, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
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

// Функция для загрузки временного файла (маски)
export const uploadTempFile = async (file: File) => {
    // Используем тот же эндпоинт, так как он принимает файл и возвращает путь
    // remove_bg на прозрачном фоне (маске) безопасен
    return processImage(file, 'remove_bg');
};