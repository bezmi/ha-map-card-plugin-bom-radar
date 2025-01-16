import maplibregl from 'maplibre-gl';
import type L from 'leaflet'
import { RainData, RainSourceId, RainLayerId, RainLayer, RainSourceLayerMap } from './types';
import { initLeafletMaplibreGL } from './leaflet-maplibre-gl.js'
import 'maplibre-gl/dist/maplibre-gl.css';
import * as labelStyle from './labelStyle.json';

const LL = (window as any).L;


export default function(pluginBase: any) {
  initLeafletMaplibreGL(LL, maplibregl)


  return class BomPlugin extends pluginBase {
    private rainData: RainData[] = [];
    private rainSourceLayerMap: RainSourceLayerMap = new Map();
    private rainLayers: RainLayer[] = [];
    private currentIndex: number = 0;
    private updateActive: boolean = false;
    private cycleTimeInterval: number;
    private updateFetchInterval: number;
    private fetchIntervalHandler: number | undefined;
    private radarZIndex: number;
    private labelsZIndex: number;
    private cycleTimeoutHandler: number | undefined = undefined;


    constructor(map: L.Map, name: string, options: object) {
      super(map, name, options)
      this.labelsZIndex = this.options["labels_zIndex"] ? this.options["labels_zIndex"] : 501;
      this.radarZIndex = this.options["radar_zIndex"] ? this.options["radar_zIndex"] : 201;
      this.cycleTimeInterval = this.options["cycle_interval"];
      this.updateFetchInterval = this.options["fetch_interval"];
      this.map.createPane('radar');
      this.map.createPane('labels');

      console.debug("[HaMapCard] [BomPlugin] Successfully invoked constructor of plugin:", this.name, "with options:", this.options);
    }

    createDateTextBox(map?: L.Map): L.Control {
      const TextBox = LL.Control.extend({
        onAdd: function() {
          var text = LL.DomUtil.create('div');
          text.id = 'date-text';
          text.innerHTML = '<strong>text that changes</strong>';
          return text;
        },
        updateText: function(text: string) {
          const container = (this as any as L.Control).getContainer();
          if (!container) return;
          container.innerText = text;
        },
      });
      const textbox = new TextBox({ position: 'bottomleft' });
      if (map) {
        textbox.addTo(map);
      }
      return textbox;
    };


    init() {
      this.initGL();
      console.debug("[HaMapCard] [BomPlugin] Called init() of plugin:", this.name);
      this.textbox = this.createDateTextBox(this.map);
      this.map.on('overlayremove', this.handleOverlayRemove);
      this.map.on('overlayadd', this.handleOverlayAdd);
    }
    initGL() {
      if (this.gl_map === undefined) {

        let gl1 = LL.maplibreGL({
          style: labelStyle,
          pane: 'labels',
        });

        this.labelsLayerGroup = LL.layerGroup([gl1]);
        this.labelsLayerGroup.addTo(this.map);
        this.labelsLayerGroup.setZIndex(this.labelsZIndex);

        let gl = LL.maplibreGL({
          style: { version: 8, sources: {}, layers: [] },
          pane: 'radar',
        });

        this.radarLayerGroup = LL.layerGroup([gl]);
        this.radarLayerGroup.addTo(this.map);
        this.gl_map = gl.getMaplibreMap();
        this.gl_map.once('load').then(() => {
          this.radarLayerGroup.setZIndex(this.radarZIndex);
          let overlays = { "Labels": this.labelsLayerGroup, "Rainfall": this.radarLayerGroup };
          this.layerControl = LL.control.layers(null, overlays).addTo(this.map);
        });

      }

    }

    async renderMap() {
      console.debug("[HaMapCard] [BomPlugin] Called render() of Plugin:", this.name);
      await this.updateAndStartCycle();
      this.fetchIntervalHandler = setInterval(() => { this.updateAndStartCycle(); }, this.updateFetchInterval)
    }
    startUpdateTimer() {
    }

    handleOverlayRemove = (e: L.LayersControlEvent) => {
      if (e.name === "Rainfall") {
        console.log("stopping radar service");
        clearTimeout(this.cycleTimeoutHandler);
        clearInterval(this.fetchIntervalHandler);
        this.rainSourceLayerMap.clear();
      }
    }

    handleOverlayAdd = (e: L.LayersControlEvent) => {
      if (e.name === "Rainfall") {
        console.log("starting radar service");
        this.fetchIntervalHandler = setInterval(() => { this.updateAndStartCycle(); }, this.updateFetchInterval);
      }
    }
    async updateAndStartCycle() {
      if (this.gl_map === undefined) {
        this.initGL();
      }
      console.log("0", this);

      console.log("glmap: m", this.gl_map)
      console.log(this.map);
      this.updateActive = true

      this.rainSourceLayerMap.forEach((rainLayers, sourceId) => {
        console.log("1", this);
        console.log(rainLayers, sourceId);
        rainLayers.forEach((rainLayer) => {
          console.log("2", this);
          if (this.gl_map !== undefined) {
            this.gl_map.removeLayer(rainLayer.id);
          }
        });

        if (this.gl_map !== undefined && this.gl_map.getSource(sourceId) !== undefined) {
          this.gl_map.removeSource(sourceId);
        }
        this.rainSourceLayerMap.delete(sourceId);
      });

      const rainData = await this.fetchRainData();
      console.log("3", this);
      await this.loadRainLayers(rainData);
      // console.log("rainLayers:", this.rainLayers);

      this.updateActive = false;

      const currLayer = this.rainLayers[this.currentIndex];

      this.setRainLayerOpacity(currLayer.id, 0.8);
      this.textbox.updateText(currLayer.time.toLocaleString());

      this.cycleTimeoutHandler = setTimeout(() => {
        this.cycleRainLayer();
      }, this.cycleTimeInterval);
    }


    setRainLayerOpacity(id: RainLayerId, opacity: number) {
      if (this.gl_map.getLayer(id) === undefined) {
        // console.log("Can't set opacity of layer: ", id, "doesn't exist on map!");
        return;
      }
      this.gl_map.setPaintProperty(id, 'fill-opacity', opacity);
    }

    cycleRainLayer() {
      // console.log(this.rainLayers);
      if (this.rainLayers.length == 0) return;
      if (this.updateActive) {
        // console.log("aborting, data is locked");
        clearTimeout(this.cycleTimeoutHandler);
        return;
      }

      let currLayer = this.rainLayers[this.currentIndex];
      this.setRainLayerOpacity(currLayer.id, 0.0);
      this.currentIndex === this.rainLayers.length - 1 ?
        this.currentIndex = 0 :
        this.currentIndex++;
      currLayer = this.rainLayers[this.currentIndex];
      this.setRainLayerOpacity(currLayer.id, 0.8);
      this.textbox.updateText(currLayer.time.toLocaleString());
      this.cycleTimeoutHandler = setTimeout(() => {
        this.cycleRainLayer()
      }, this.cycleTimeInterval);

    }

    update() {
    }

    async fetchRainData(): Promise<RainData[]> {
      try {
        const response = await fetch('https://api.weather.bom.gov.au/v1/radar/capabilities');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.data.rain || [];
      } catch (error) {
        console.error('Error fetching JSON:', error);
      }
      return [];
    }

    waitForSourceLoaded(sourceId: string): Promise<void> {
      return new Promise((resolve) => {
        const onSourceDataEvent = (e: maplibregl.MapSourceDataEvent) => {
          if (e.sourceId === sourceId && e.isSourceLoaded) {
            this.gl_map.off('sourcedata', onSourceDataEvent)
            resolve();
          }
        }
        this.gl_map.on('sourcedata', onSourceDataEvent);
      });
    }

    async loadRainLayers(rainData: RainData[]) {
      console.log("4", this);
      const rainLayers: RainLayer[] = [];
      for (const entry in rainData) {
        let source_timestamp = rainData[entry].time;
        const source_layer_name = rainData[entry].layer.name;
        const source_id = rainData[entry].url.replace('mapbox://', '');
        const l = source_id.length;

        // extract the concatenated timestamp
        const source_time = source_id.slice(l - 12, l);

        const access_token = 'pk.eyJ1IjoiYm9tLWRjLXByb2QiLCJhIjoiY2w4dHA5ZHE3MDlsejN3bnFwZW5vZ2xxdyJ9.KQjQkhGAu78U2Lu5Rxxh4w'
        const source_url = 'https://api.mapbox.com/v4/' + source_id + '.json?secure&access_token=' + access_token;

        if (this.gl_map.getSource(source_id) === undefined) {
          this.gl_map.addSource(source_id, { type: 'vector', url: source_url })
          await this.waitForSourceLoaded(source_id);
        }


        if (this.gl_map.getLayer(source_layer_name) === undefined) {
          this.gl_map.addLayer({
            'id': source_layer_name, // Layer ID
            'type': 'fill',
            'source': source_id,
            // Source has several layers. We visualize the one with name 'sequence'.
            'source-layer': source_layer_name,
            'layout': {
              'visibility': 'visible'
            },
            'paint': {
              'fill-opacity': 0.0,
              // 'fill-opacity-transition': { 'duration': 5, 'delay': 0 },
              'fill-color': [
                'interpolate',
                [
                  'exponential', 10
                ],
                [
                  'get',
                  'value'
                ],
                0.5,
                '#f5f5ff',
                2.5,
                '#b4b4ff',
                4.0,
                '#7878ff',
                6.0,
                '#1414ff',
                8.5,
                '#00d8c3',
                13,
                '#009690',
                20.0,
                '#006666',
                30.0,
                '#ffff00',
                45.0,
                '#ffc800',
                67.5,
                '#ff9600',
                100.0,
                '#ff6400',
                150.0,
                '#ff0000',
                225.0,
                '#c80000',
                335.0,
                '#780000',
                400,
                '#280000'
              ]
            },
          });


          const rainLayer = { id: source_layer_name, time: new Date(source_timestamp) };

          rainLayers.push(rainLayer);

          this.rainSourceLayerMap.has(source_id) ?
            this.rainSourceLayerMap.get(source_id)!.push(rainLayer) :
            this.rainSourceLayerMap.set(source_id, [rainLayer]);
        }
        this.rainLayers = rainLayers;
        this.currentIndex = 0;
      }

    }



  }
}
