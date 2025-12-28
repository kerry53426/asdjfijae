export interface Coord {
  lat: number;
  lng: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export interface CalibrationPoint {
  id: number;
  pixel_x: number;
  pixel_y: number;
  lat: number;
  lng: number;
}

export interface Spot {
  id: string;
  name: string;
  desc: string;
  speech_text?: string;
  pixel_x: number;
  pixel_y: number;
  has_mission: boolean;
  type: 'facility' | 'scenery' | 'tent';
}

export interface AppData {
  calibration_points: CalibrationPoint[];
  spots: Spot[];
}

export enum AppMode {
  USER = 'USER',
  ADMIN_CALIBRATE = 'ADMIN_CALIBRATE',
  ADMIN_ADD_SPOT = 'ADMIN_ADD_SPOT'
}