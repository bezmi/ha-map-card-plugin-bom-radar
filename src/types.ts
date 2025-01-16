
export interface RainData {
  time : string;
  type: 'observation' | 'nowcast';
  is_duplicated: boolean;
  url: string;
  layer: {name: string};
}

export type RainSourceLayerMap = Map<RainSourceId, RainLayer[]>

export interface RainLayer {
  id: RainLayerId;
  time: Date;
}

export type RainSourceId = string;
export type RainLayerId = string;
