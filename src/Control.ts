import noUiSlider from 'nouislider';
import type L from 'leaflet';
import type { API } from 'nouislider';
import { RainLayer } from './types';


export class BomSlider {
  public slider: API;
  private sliderElement: HTMLElement;
  private onUpdate: (value: string | number) => void;
  private data: RainLayer[] = [];
  private targetPosition: number;
  private resetTimeoutHandler: number | undefined;
  private animateIntervalHandler: number | undefined;
  private defaultTargetPosition: number;
  private resetTimeout: number;
  private minTextElement: HTMLElement;
  private maxTextElement: HTMLElement;
  private sliderStep: number;
  private sliderAnimateTimeStep: number;

  constructor(LL: typeof L, map: L.Map, range: number, onUpdate: (value: string | number) => void, initialData: RainLayer[] = [], resetTimeout: number = 5000, defaultTargetPosition: number | undefined = undefined) {
    const mapContainer = map.getContainer();
    const sliderContainer = LL.DomUtil.create('div', 'slider-wrapper', mapContainer);
    this.sliderElement = LL.DomUtil.create('div', 'bom-slider', sliderContainer);
    this.minTextElement = LL.DomUtil.create('div', 'bom-time-label-max', sliderContainer)
    this.minTextElement.innerText = "+90min";
    this.maxTextElement = LL.DomUtil.create('div', 'bom-time-label-min', sliderContainer)
    this.maxTextElement.innerText = "-90min";
    this.onUpdate = onUpdate;
    this.defaultTargetPosition = defaultTargetPosition ?? Math.floor(range / 2);
    this.targetPosition = this.defaultTargetPosition;
    this.resetTimeout = resetTimeout;

    // TODO make these configurable?
    this.sliderStep = 0.1;
    this.sliderAnimateTimeStep = 1000 / 100;

    this.slider = noUiSlider.create(this.sliderElement, {
      start: this.defaultTargetPosition,
      connect: false,
      step: this.sliderStep,
      range: {
        'min': 0,
        'max': range
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
    this.data = initialData;
    this.slider.set(this.defaultTargetPosition);

    // call the supplied onUpdate function whenever the value changes
    this.slider.on('update', (values: (string | number)[]) => {
      const value = values[0];
      this.onUpdate(value);
    });

    // when the slider is tapped or clicked, set the maximum target position
    this.slider.on('change', this.onChangeSetRange.bind(this));

    // After the user stops dragging the slider, slowly move it back to the
    // user defined target position.
    this.slider.on('start', () => {
      clearTimeout(this.resetTimeoutHandler);
      // temporarily disable the change event so we can catch the 'end' event
      this.slider.off('change');
      this.slider.on('end', (values: (string | number)[]) => {
        this.slider.on('change', this.onChangeSetRange.bind(this));
        clearTimeout(this.animateIntervalHandler);
        const currentValue = values[0] as number;

        // No need to move if we're already at the target
        if (currentValue === this.targetPosition) return;

        // Determine the direction to move (increment or decrement)
        const direction = currentValue < this.targetPosition ? 1 : -1;

        // Use setInterval to "step" the slider value until it reaches the target
        this.animateIntervalHandler = setInterval(() => {
          let newValue = parseFloat(this.slider.get() as string) + direction * this.sliderStep;

          // If moving up and we've exceeded the target, or moving down and we've gone below, stop
          if ((direction > 0 && newValue >= this.targetPosition) ||
            (direction < 0 && newValue <= this.targetPosition)) {
            this.resetTimeoutHandler = setTimeout(() => { this.onReset() }, this.resetTimeout);
            newValue = this.targetPosition; // Clamp to target
            this.slider.set(newValue);
            clearInterval(this.animateIntervalHandler);
            this.slider.off("end");
          } else {
            this.slider.set(newValue);
          }
        }, this.sliderAnimateTimeStep); // TODO, make the time step configurable?
      });
    });
  }

  onChangeSetRange(values: (string | number)[]) {
    clearTimeout(this.resetTimeoutHandler);
    clearInterval(this.animateIntervalHandler); // cancel any existing animation
    const value = parseFloat(values[0] as string);
    this.targetPosition = Math.round(value);
    this.slider.set(this.targetPosition);
    this.resetTimeoutHandler = setTimeout(() => { this.onReset(); }, this.resetTimeout);
  }

  onReset() {
    this.targetPosition = this.defaultTargetPosition;
    this.slider.set(this.targetPosition);
  }

  setData(data: RainLayer[]) {
    this.data = data;
  }

  destroy() {
    this.sliderElement.remove();
    this.slider.destroy();
    this.minTextElement.remove();
    this.maxTextElement.remove();
  }
}
