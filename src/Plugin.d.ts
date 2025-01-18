import type L from 'leaflet';

export default abstract class Plugin {
  protected name: string;
  protected map: L.Map;
  protected options: any;

  constructor(map: L.Map, name: string, options: object) {
    this.map = map;
    this.name = name;
    this.options = options;
  }

  init(): void;
  abstract renderMap(): void;
  update(): void;
  abstract destroy(): void;

}
