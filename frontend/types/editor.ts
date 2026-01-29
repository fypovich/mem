export type LayerType = 'text' | 'image' | 'video';

export interface Position {
  x: number | string; // pixels or 'center'
  y: number | string;
}

export interface LayerFilters {
  brightness?: number; // 1.0 is default
  grayscale?: boolean;
  fadein?: number; // seconds
  fadeout?: number;
}

export interface Layer {
  id: string;
  type: LayerType;
  content?: string; // Текст или название
  path?: string;    // Путь на сервере
  start: number;    // Время начала (сек)
  duration: number; // Длительность (сек)
  pos: Position;
  
  // Text properties
  fontsize?: number;
  color?: string;
  
  // Image properties
  scale?: number;
  width?: number;
  animation?: 'none' | 'zoom_in'; 
  
  // Common
  filters?: LayerFilters;
}

export interface ProjectData {
  base_video: string; 
  trim?: {
    start: number;
    end?: number; // <--- ВАЖНО: Добавлен знак вопроса (Optional)
  };
  format?: 'original' | '9:16'; // <--- Добавлено
  layers: Layer[];
  filters?: LayerFilters; // <--- Добавлено
}