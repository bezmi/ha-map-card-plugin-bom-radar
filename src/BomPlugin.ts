import type L from 'leaflet';
import maplibregl from 'maplibre-gl';
import maplibreglstyles from 'maplibre-gl/dist/maplibre-gl.css';
import noUiSliderStyles from 'nouislider/dist/nouislider.css';
import * as labelStyle from './labelStyle.json';
import { initLeafletMaplibreGL } from './leaflet-maplibre-gl.js';
import type Plugin from './Plugin';
import styles from './styles.css';
import { RainData, RainLayer, RainLayerId, RainSourceLayerMap } from './types';
import { BomSlider } from './Control';

export default function(LL: typeof L, pluginBase: typeof Plugin, Logger: any) {

  initLeafletMaplibreGL(LL, maplibregl)

  class Textbox extends LL.Control {
    onAdd() {
      var text = LL.DomUtil.create('div');
      text.id = 'date-text';
      text.innerHTML = '';
      return text;
    }
    updateText(text: string) {
      const container = (this as any as L.Control).getContainer();
      if (!container) return;
      container.innerText = text;
    }
  }


  return class BomPlugin extends pluginBase {
    private rainSourceLayerMap: RainSourceLayerMap = new Map();
    private rainLayers: RainLayer[] = [];
    private currentIndex: number = 0;
    private updateActive: boolean = false;
    private cycleTimeInterval: number;
    private updateFetchInterval: number;
    private fetchTimeoutHandler: number | undefined;
    private radarZIndex: number;
    private labelsZIndex: number;
    private markersZIndex: number;
    private cycleTimeoutHandler: number | undefined = undefined;
    private labelsLayerGroup: L.LayerGroup | undefined;
    private radarLayerGroup: L.LayerGroup = LL.layerGroup();
    private gl_map: maplibregl.Map | undefined = undefined;
    private gl: L.MaplibreGL | undefined = undefined;
    private enableAlternateLabels: boolean = false;
    private enableLayerControl: boolean = true;
    private radarPane: HTMLElement | undefined;
    private labelsPane: HTMLElement | undefined;
    private layerControl: L.Control.Layers | undefined;
    private datetimeTextbox: Textbox | undefined = undefined;
    private slider: BomSlider | undefined;
    private enableSlider: boolean = true;
    private sliderTimeout: number = 5000;
    private sliderHandleColor: string = "#FFF";

    constructor(map: L.Map, name: string, options: object) {
      super(map, name, options);
      this.labelsZIndex = this.options["labels_zIndex"] ?? 501;

      this.radarZIndex = this.options["radar_zIndex"] ?? 201;

      this.markersZIndex = this.options["markers_zIndex"] ?? 401;

      this.cycleTimeInterval = this.options["cycle_interval"] ?? 500;
      this.updateFetchInterval = this.options["fetch_interval"] ?? 60000;

      this.enableAlternateLabels = this.options["alternate_labels"] ?? false;

      this.enableLayerControl = this.options["layer_control"] ?? true

      this.labelsLayerGroup = this.enableAlternateLabels
        ? LL.layerGroup() : undefined

      this.radarPane = this.map.createPane('radar');
      this.labelsPane = this.map.createPane('labels');

      this.labelsLayerGroup?.addTo(this.map);
      this.radarLayerGroup.addTo(this.map);

      this.enableSlider = this.options["enable_slider"] ?? true;

      this.sliderTimeout = this.options["slider_timeout"] ?? 5000;

      this.sliderHandleColor = this.options["slider_handle_color"] ?? "#FFF";


      this.debug(`Successfully invoked constructor of plugin ${this.name} with options: ${this.options}`);
    }

    debug(...message: any[]) {
      Logger.debug(`[HAMapCard][Plugin][${this.name}]`, ...message);
    }

    injectStyles() {
      // Retrieve the map container
      const container = this.map.getContainer();

      // Check if the styles are already injected
      if (container.querySelector('style[maplibre-gl-styles]')) return;

      // Create a style element and set its content to the imported CSS
      const style = LL.DomUtil.create('style', '', container);
      style.setAttribute('maplibre-gl-styles', 'true');

      // The ha-map-card styling sets the .leaflet-pane z-index to 0 !important
      // so if we want to change the marker (or any other pane) z-index,
      // we must use a more specific rule and also the !important flag.
      let leafletStyle = `.leaflet-pane .leaflet-marker-pane { z-index: ${this.markersZIndex} !important; }`
      leafletStyle += `.leaflet-pane .leaflet-labels-pane { z-index: ${this.labelsZIndex} !important; }`
      leafletStyle += `.leaflet-pane .leaflet-radar-pane { z-index: ${this.radarZIndex} !important; }`

      let customSliderStyle = `.noUi-handle { background: ${this.sliderHandleColor}; }`

      style.textContent = maplibreglstyles + leafletStyle + noUiSliderStyles + styles + customSliderStyle;
    }

    createDatetimeTextbox(): Textbox {
      const textbox = new Textbox(
        { position: 'bottomleft' }).addTo(this.map);

      return textbox;
    };

    handleOverlayRemove = (e: L.LayersControlEvent) => {
      if (e.name === "Rainfall") {
        this.debug("stopping radar service");
        if (this.datetimeTextbox !== undefined) {
          this.datetimeTextbox?.remove();
        }
        clearTimeout(this.cycleTimeoutHandler);
        clearTimeout(this.fetchTimeoutHandler);
        this.rainSourceLayerMap.clear();
        this.rainLayers = [];

        if (this.slider !== undefined) {
          this.slider?.destroy();
          this.slider = undefined;
        }

        this.currentIndex = 0;
      }
    }

    handleOverlayAdd = (e: L.LayersControlEvent) => {
      if (e.name === "Rainfall") {
        this.debug("starting radar service");
        this.initGL();
        this.updateAndStartCycle();
      }

    }

    async init() {
      this.debug("Injecting styles");
      this.injectStyles();
    }

    async initGL() {
      if (!this.enableSlider) {
        this.datetimeTextbox = this.createDatetimeTextbox();
      }

      this.gl_map = this.gl?.getMaplibreMap();
      await this.gl_map?.once('load');
    }

    updateSlider(value: string | number) {
      if (this.rainLayers.length == 0) return;

      let currLayer = this.rainLayers[this.currentIndex];
      this.setRainLayerOpacity(currLayer.id, 0.0);
      this.currentIndex = Math.round(value as number);
      currLayer = this.rainLayers[this.currentIndex];
      this.setRainLayerOpacity(currLayer.id, 0.8);
      if (this.datetimeTextbox !== undefined) {
        this.datetimeTextbox?.updateText(currLayer.time.toLocaleTimeString());
      }
    }

    async renderMap() {

      if (this.enableLayerControl === true) {
        this.layerControl = LL.control.layers(
          null,
          {
            "Rainfall": this.radarLayerGroup
          }).addTo(this.map);
      }

      if (this.enableAlternateLabels) {
        let glLabels = LL.maplibreGL({
          style: labelStyle as any,
          pane: 'labels',
        }).addTo(this.map);
        this.labelsLayerGroup?.addLayer(glLabels);
      }

      this.gl = LL.maplibreGL({
        style: { version: 8, sources: {}, layers: [] },
        pane: 'radar',
      }).addTo(this.map);

      this.radarLayerGroup.addLayer(this.gl as L.Layer);
      await this.initGL();
      this.map.on('overlayremove', this.handleOverlayRemove);
      this.map.on('overlayadd', this.handleOverlayAdd);
      this.debug("Called render()");
      await this.updateAndStartCycle();
    }

    async updateAndStartCycle() {
      this.debug("Updating data");
      if (this.gl_map === undefined) {
        await this.initGL();
      }

      this.updateActive = true

      this.rainSourceLayerMap.forEach((rainLayers, sourceId) => {
        rainLayers.forEach((rainLayer) => {
          if (this.gl_map !== undefined) {
            this.debug("Removing layer:", rainLayer.id);
            this.gl_map.removeLayer(rainLayer.id);
          }
        });

        if (this.gl_map !== undefined && this.gl_map.getSource(sourceId) !== undefined) {
          this.debug("Removing source:", sourceId);
          this.gl_map.removeSource(sourceId);
        }
        this.rainSourceLayerMap.delete(sourceId);
      });

      const rainData = await this.fetchRainData();

      await this.loadRainLayers(rainData);


      this.updateActive = false;

      const currLayer = this.rainLayers[this.currentIndex];

      this.setRainLayerOpacity(currLayer.id, 0.8);
      if (this.datetimeTextbox !== undefined) {
        this.datetimeTextbox?.updateText(currLayer.time.toLocaleTimeString());
      }

      if (this.enableSlider) {
        if (this.slider === undefined) {
          this.slider = new BomSlider(LL, this.map, this.rainLayers.length - 1, (value) => {
            this.updateSlider(value);
          }, this.rainLayers, this.sliderTimeout);
        } else {
          this.slider?.setData(this.rainLayers);
        }
      } else {
        this.cycleRainLayer();
      }

      this.fetchTimeoutHandler = setTimeout(() => { this.updateAndStartCycle(); }, this.updateFetchInterval)
    }


    setRainLayerOpacity(id: RainLayerId, opacity: number) {
      if (this.gl_map?.getLayer(id) === undefined) {
        this.debug("Can't set opacity of layer: ", id, "doesn't exist on map!");
        return;
      }
      this.gl_map.setPaintProperty(id, 'fill-opacity', opacity);
    }

    cycleRainLayer() {
      if (this.rainLayers.length == 0) return;
      if (this.updateActive) {
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
      if (this.datetimeTextbox !== undefined) {
        this.datetimeTextbox?.updateText(currLayer.time.toLocaleTimeString());
      }
      this.cycleTimeoutHandler = setTimeout(() => {
        this.cycleRainLayer()
      }, this.cycleTimeInterval);
    }

    async fetchRainData(): Promise<RainData[]> {
      this.debug("Fetching data");
      try {
        const response = await fetch('https://api.weather.bom.gov.au/v1/radar/capabilities');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status} `);
        }
        const data = await response.json();
        return data.data.rain || [];
      } catch (error) {
        Logger.error('Error fetching JSON:', error);
      }
      return [];
    }

    waitForSourceLoaded(sourceId: string): Promise<void> {
      return new Promise((resolve) => {
        const onSourceDataEvent = (e: maplibregl.MapSourceDataEvent) => {
          if (e.sourceId === sourceId && e.isSourceLoaded) {
            this.gl_map?.off('sourcedata', onSourceDataEvent)
            resolve();
          }
        }
        this.gl_map?.on('sourcedata', onSourceDataEvent);
      });
    }

    async loadRainLayers(rainData: RainData[]) {
      this.debug("Processing data");
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

        if (this.gl_map?.getSource(source_id) === undefined) {
          this.debug("adding source: ", source_id);
          this.gl_map?.addSource(source_id, { type: 'vector', url: source_url })
          await this.waitForSourceLoaded(source_id);
        }


        if (this.gl_map?.getLayer(source_layer_name) === undefined) {
          this.debug("adding gl layer: ", source_layer_name);
          this.gl_map?.addLayer({
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
                'step',
                [
                  'get',
                  'value'
                ],
                'rgb(245,245,255)',
                2.0,
                'rgb(180,180,255)',
                3.0,
                'rgb(120,120,255)',
                5.0,
                'rgb(20,20,255)',
                7.0,
                'rgb(0,216,195)',
                10.0,
                'rgb(0,150,144)',
                15.0,
                'rgb(0,102,102)',
                25.0,
                'rgb(255,255,0)',
                35.0,
                'rgb(255,200,0)',
                55.0,
                'rgb(255,150,0)',
                80.0,
                'rgb(255,100,0)',
                120.0,
                'rgb(255,0,0)',
                180.0,
                'rgb(200,0,0)',
                270.0,
                'rgb(120,0,0)',
                400,
                'rgb(40,0,0)',
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

    destroy() {
      this.debug("Called destroy() of plugin:", this.name);
      clearTimeout(this.fetchTimeoutHandler);
      clearTimeout(this.cycleTimeoutHandler);
      if (this.slider !== undefined) {
        this.slider?.destroy();
      }
    }

  }

}
