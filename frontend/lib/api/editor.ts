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
      outline_color: options?.outlineColor,
      outline_width: options?.outlineWidth, // Новое
      text: options?.text,
      text_color: options?.textColor,
      text_size: options?.textSize,        // Новое
      text_x: options?.textX,
      text_y: options?.textY,
      crop: options?.crop,
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

// Загрузка временного файла на сервер (маски, или файла для редактора)
export const uploadTempFile = async (file: File): Promise<{ server_path: string; url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/editor/temp/upload`, {
        method: "POST",
        headers: getHeaders(),
        body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload temp file");
    return res.json();
};

export async function uploadVideo(file: File): Promise<{ file_path: string; url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/editor/video/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: formData,
  });

  if (!res.ok) throw new Error("Video upload failed");
  return res.json();
}

export type { VideoProcessOptions } from '@/types/editor';

export async function processVideo(
  videoPath: string,
  options: import('@/types/editor').VideoProcessOptions,
  audioFile?: File
): Promise<{ task_id: string }> {
  const formData = new FormData();
  formData.append("video_path", videoPath);
  formData.append("options", JSON.stringify(options));
  if (audioFile) {
    formData.append("audio_file", audioFile);
  }

  const res = await fetch(`${API_URL}/editor/video/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: formData,
  });

  if (!res.ok) throw new Error("Video processing failed");
  return res.json();
}