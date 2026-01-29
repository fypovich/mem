export type LayerType = 'text' | 'image' | 'video';

export interface Position {
  x: number | string; // pixels or 'center'
  y: number | string;
}

export interface Layer {
  id: string;
  type: LayerType;
  content?: string; // Текст или путь к файлу
  path?: string;    // Путь на сервере
  start: number;    // Время начала (сек)
  duration: number; // Длительность (сек)
  pos: Position;
  fontsize?: number;
  color?: string;
  scale?: number;
  width?: number;
}

export interface ProjectData {
  base_video: string; 
  trim?: {
    start: number;
    end: number;
  };
  layers: Layer[];
}