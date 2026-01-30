const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
// Корень бэкенда для картинок (убираем /api/v1)
export const BACKEND_ROOT = API_URL.replace(/\/api\/v1\/?$/, "");

const getHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

// Хелпер: Добавляет хост бэкенда, если путь относительный (/static/...)
export const getFullUrl = (path: string | null | undefined) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
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
  
  if (!res.ok) throw new Error("Failed to process image");
  return res.json();
};

export const createSticker = async (imagePath: string, animation: string) => {
  const res = await fetch(`${API_URL}/editor/create-sticker`, {
    method: "POST",
    headers: {
      ...getHeaders(),
      "Content-Type": "application/json"
    },
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

// Простая загрузка файла (нужна для сохранения отредактированной маски)
export const uploadTempFile = async (file: File) => {
    // В текущей реализации API у нас нет отдельного роута upload-temp,
    // но мы можем использовать process-image с фиктивной операцией или просто remove_bg,
    // так как для прозрачного PNG remove_bg ничего не сломает (фон уже удален).
    return processImage(file, 'remove_bg');
};