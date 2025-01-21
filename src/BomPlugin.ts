import type L from 'leaflet';
import maplibregl from 'maplibre-gl';
import maplibreglstyles from 'maplibre-gl/dist/maplibre-gl.css';
import noUiSlider from 'nouislider';
import type { API } from 'nouislider';
import { PipsMode } from 'nouislider';
import noUiSliderStyles from 'nouislider/dist/nouislider.css';
import * as labelStyle from './labelStyle.json';
import { initLeafletMaplibreGL } from './leaflet-maplibre-gl.js';
import type Plugin from './Plugin';
import styles from './styles.css';
import { RainData, RainLayer, RainLayerId, RainSourceLayerMap } from './types';

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

  class BomSlider {
    public slider: API;
    private sliderElement: HTMLElement;
    private onUpdate: (value: string | number) => void;
    private data: RainLayer[] = [];
    private targetPosition: number = 18;
    private resetTimeout: number | undefined;

    constructor(map: L.Map, range: number, onUpdate: (value: string | number) => void, initialData: RainLayer[] = []) {
      console.error("creating slider");
      const mapContainer = map.getContainer();
      const sliderContainer = LL.DomUtil.create('div', 'slider-wrapper', mapContainer);
      this.sliderElement = LL.DomUtil.create('div', 'bom-slider', sliderContainer);
      this.sliderElement = LL.DomUtil.create('div', 'bom-slider', sliderContainer);
      this.onUpdate = onUpdate;


      this.slider = noUiSlider.create(this.sliderElement, {
        start: 18,
        connect: false,
        step: 0.1,
        range: {
          'min': 0,
          'max': range
        },
        pips: {
          mode: PipsMode.Values,
          values: [0, range],
          density: 4,
          stepped: true,
        },
        tooltips: [
          {
            to: (value: number) => {
              if (this.data.length == 0) return '';
              return this.data[Math.floor(value)].time.toLocaleTimeString();
            }
          },
        ],
        animate: false,
      });


      // Attach slider update event
      this.slider.on('update', (values: (string | number)[]) => {
        const value = values[0];
        this.onUpdate(value);
      });
      this.slider.on('change', (values: (string | number)[]) => {
        clearTimeout(this.resetTimeout);
        const value = parseFloat(values[0] as string);
        this.targetPosition = Math.round(value);
        this.resetTimeout = setTimeout(() => { this.targetPosition = 18; this.slider.set(this.targetPosition); }, 5000);
      });
      // On slider 'end' event, trigger the return animation
      // Called after the user finishes dragging the slider handle
      this.slider.on('start', () => {
        clearTimeout(this.resetTimeout);
        this.slider.off('change');
        this.slider.on('end', (values: (string | number)[]) => {
          const currentValue = values[0] as number;

          // No need to move if we're already at the target
          if (currentValue === this.targetPosition) return;

          // Determine the direction to move (increment or decrement)
          const direction = currentValue < this.targetPosition ? 1 : -1;

          // Use setInterval to "step" the slider value until it reaches the target
          const intervalId = setInterval(() => {
            let newValue = parseFloat(this.slider.get() as string) + direction * 0.1;

            // If moving up and we've exceeded the target, or moving down and we've gone below, stop
            if ((direction > 0 && newValue >= this.targetPosition) ||
              (direction < 0 && newValue <= this.targetPosition)) {
              this.resetTimeout = setTimeout(() => { this.targetPosition = 18; this.slider.set(this.targetPosition); }, 5000);
              newValue = this.targetPosition; // Clamp to target
              this.slider.set(newValue);
              clearInterval(intervalId);
              this.slider.off("end");
              this.slider.on('change', (values: (string | number)[]) => {
                clearTimeout(this.resetTimeout);
                const value = parseFloat(values[0] as string);
                this.targetPosition = Math.round(value);
                this.resetTimeout = setTimeout(() => { this.targetPosition = 18; this.slider.set(this.targetPosition); }, 5000);
              });
            } else {
              this.slider.set(newValue);
            }
          }, 1000 / 100);
        });
        // this.slider.off('end')``;
      });
    }

    setData(data: RainLayer[]) {
      this.data = data;
      console.error("DATA", data);
    }



    destroy() {
      console.error("removing slider");
      this.sliderElement.remove();
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

      style.textContent = maplibreglstyles + leafletStyle + noUiSliderStyles + styles;
    }

    createDatetimeTextbox(): Textbox {
      const textbox = new Textbox(
        { position: 'bottomleft' }).addTo(this.map);

      return textbox;
    };

    handleOverlayRemove = (e: L.LayersControlEvent) => {
      if (e.name === "Rainfall") {
        this.debug("stopping radar service");
        this.datetimeTextbox?.remove();
        clearTimeout(this.cycleTimeoutHandler);
        clearTimeout(this.fetchTimeoutHandler);
        this.rainSourceLayerMap.clear();
        this.rainLayers = [];
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
    // this.datetimeTextbox = this.createDatetimeTextbox();

      this.gl_map = this.gl?.getMaplibreMap();
      await this.gl_map?.once('load');
    }

    updateSlider(value: string | number) {
      if (this.rainLayers.length == 0) return;

      let currLayer = this.rainLayers[this.currentIndex];
      console.log(currLayer, value, this.rainLayers);
      this.setRainLayerOpacity(currLayer.id, 0.0);
      this.currentIndex = Math.round(value as number);
      currLayer = this.rainLayers[this.currentIndex];
      console.log(currLayer);
      this.setRainLayerOpacity(currLayer.id, 0.8);
      this.datetimeTextbox?.updateText(currLayer.time.toLocaleString());
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
      this.slider = new BomSlider(this.map, this.rainLayers.length - 1, (value) => {
        this.updateSlider(value);
      });
      this.slider.setData(this.rainLayers);
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
      this.slider?.setData(this.rainLayers);

      this.updateActive = false;

      const currLayer = this.rainLayers[this.currentIndex];

      this.setRainLayerOpacity(currLayer.id, 0.8);
      this.datetimeTextbox?.updateText(currLayer.time.toLocaleString());

      // this.debug("Beginning layer cycle");
      // this.cycleTimeoutHandler = setTimeout(() => {
      //   this.cycleRainLayer();
      // }, this.cycleTimeInterval);

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
      this.datetimeTextbox?.updateText(currLayer.time.toLocaleString());
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

    destroy() {
      this.debug("Called destroy() of plugin:", this.name);
      clearTimeout(this.fetchTimeoutHandler);
      clearTimeout(this.cycleTimeoutHandler);
      this.slider?.destroy();
    }

  }

}
