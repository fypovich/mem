export type LayerType = 'text' | 'image' | 'video';

export interface LayerFilters {
  brightness?: number;
  grayscale?: boolean;
  opacity?: number;
}

export interface Layer {
  id: string;
  type: LayerType;
  content?: string; // Текст или название
  path?: string;    // Путь на сервере
  
  // Тайминг
  start: number;    
  duration: number; 
  
  // Позиция и размер (В ПРОЦЕНТАХ от 0 до 100)
  // Это решает проблему разных экранов
  x: number; 
  y: number;
  width: number; 
  height: number;
  rotation?: number; // Градусы

  // Свойства текста
  fontsize?: number; // Базовый размер, который скейлится
  color?: string;
  fontFamily?: string;
  
  // Свойства
  filters?: LayerFilters;
  animation?: 'none' | 'zoom_in' | 'fade_in'; 
}

export interface ProjectData {
  base_video: string; 
  trim?: {
    start: number;
    end?: number;
  };
  format?: 'original' | '9:16'; 
  layers: Layer[];
}