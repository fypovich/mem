export type LayerType = 'text' | 'image' | 'video';

export interface Position {
  x: number | string; // pixels or 'center'
  y: number | string;
}

export interface LayerFilters {
  brightness?: number; // 1.0 is default
  grayscale?: boolean;
  fadein?: number; // seconds
}

export interface Layer {
  id: string;
  type: LayerType;
  content?: string; 
  path?: string;    
  start: number;    
  duration: number; 
  pos: Position;
  fontsize?: number;
  color?: string;
  scale?: number;
  width?: number;
  // Новые поля
  animation?: 'none' | 'zoom_in'; 
  filters?: LayerFilters;
}

export interface ProjectData {
  base_video: string; 
  trim?: {
    start: number;
    end: number;
  };
  format?: 'original' | '9:16';
  layers: Layer[];
  filters?: LayerFilters; // Фильтры для базового видео
}