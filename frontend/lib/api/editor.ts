const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const getHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem("token") : null;
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

export const processImage = async (file: File, operation: 'remove_bg') => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("operation", operation);

  const res = await fetch(`${API_URL}/editor/process-image`, {
    method: "POST",
    headers: getHeaders() as any, // Cast to avoid TS strictness issues with FormData
    body: formData,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

export const createSticker = async (imagePath: string, animation: string) => {
  const res = await fetch(`${API_URL}/editor/create-sticker`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
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