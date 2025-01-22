import noUiSlider from 'nouislider';
import type L from 'leaflet';
import type { API } from 'nouislider';
import { PipsMode } from 'nouislider';
import { RainLayer } from './types';


export class BomSlider {
  public slider: API;
  private sliderElement: HTMLElement;
  private onUpdate: (value: string | number) => void;
  private data: RainLayer[] = [];
  private targetPosition: number = 18;
  private resetTimeout: number | undefined;

  constructor(LL: typeof L, map: L.Map, range: number, onUpdate: (value: string | number) => void, initialData: RainLayer[] = []) {
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

export function bomslider(LL: typeof L) {
}

