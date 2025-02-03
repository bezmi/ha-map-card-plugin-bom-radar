# ha-map-card-plugin-bom-radar

A plugin for [ha-map-card](https://github.com/nathan-gs/ha-map-card) that displays the Australian BoM (Bureau of Meteorology) radar precipitation data.

> If you'd like to support my work, you can [donate on ko-fi](https://ko-fi.com/bezmi) or [github sponsors](https://github.com/sponsors/bezmi).

![an example of the map with rain radar shown](/images/screenshot.png)

## Installation
Make sure you have [ha-map-card](https://github.com/nathan-gs/ha-map-card) installed.

### via HACS

Click the badge below.

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=bezmi&repository=ha-map-card-plugin-bom-radar&category=plugin)

#### Manually adding the repository to HACS
1. Click the three dots on the top right of the HACS panel in home assistant, select `custom repositories`.
2. Paste `https://github.com/bezmi/ha-map-card-plugin-bom-radar`, select `Dashboard` as the type.
3. Now you can search for `map-card-plugin-bom-radar` and install it.

### Manual installation
#### Github releases
[Download the latest release]("https://github.com/bezmi/ha-map-card-plugin-bom-radar/releases/latest")
and place it in your homeassistant `www` folder.

#### From source (advanced)
1. Clone or download this repository.
2. Install the plugin dependencies: `npm install`
3. Build: `npm run build`
4. Copy `dist/bom-plugin.js` to the `www` folder of homeassistant.

---

## Configuration

Below is an example Lovelace YAML configuration that I like to use.

If you installed manually and put it into the `www` folder, then use `/local/bom-plugin.js` for the url config parameter.

If installed via HACS, then use the `hacs` config parameters `module` and `file`. This has the benefit of caching and faster plugin loading.

```yaml
type: custom:map-card
x: -25.3744
y: 133.7751
zoom: 4
tile_layer_url: https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png
plugins:
  - name: bom # a friendly name for this plugin instance
    ## only use url if installed manually
    # url: /local/bom-plugin.js
    hacs:
      module: ha-map-card-plugin-bom-radar
      file: bom-plugin.js
    options:
      alternate_labels: true
```

### Plugin configuration

| Property             | Default  | Description                                                                                                                                                                                        |
|----------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `cycle_interval`   | 250      | Time in milliseconds between radar image frames cycling.                                                                                                                                           |
| `fetch_interval`   | 30000    | Time in milliseconds between each data retrieval from BoM.                                                                                                                                          |
| `alternate_labels` | `false`    | Enable alternate labels for place names. Useful as they draw over the radar. Use a [blank basemap](https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png) if you enable this option. |
| `layer_control`    | `true`     | Enable checkbox to allow showing/hiding the radar overlay and slider (if enabled).                                                                                                                 |
| `enable_slider`    | `true`     | Enable the interactive slider if `true`. Make sure you read the [slider section below](#using-the-slider) so you know how it works! Setting this to false will disable the slider and instead cycle the radar layers through time automatically, and a timestamp will be shown in the bottom left corner. |
| `slider_timeout`   | 5000     | After this many milliseconds without interaction, the slider will return to the neutral (center position).                                                                                         |
| `slider_handle_color` | `#FFF`  | The color for the slider handle. You can use any format of color string that works with CSS.                                                                                                       |
| `{something}_zIndex` | see below      | [See z-index section below](#z-index)                                                                                                                                                              |

#### z-index
Setting these integer values in the configuration will alter how the different layers of the map are ordered.
The lower the value, the lower the layer will be in the stack.
With the current defaults, the order (lowest to highest) is radar -> markers -> labels, which works well.
For the labels setting to do anything, you must have the `alternate_labels` option set to `true`.

| Property          | Default | Description                                     |
|-------------------|---------|-------------------------------------------------|
| `labels_zIndex` | 501     | zIndex property for the alternate labels (if enabled)                  |
| `radar_zIndex`  | 201     | zIndex property for the radar overlay           |
| `marker_zIndex` | 401     | zIndex property for the markers that you have on your map. By default, they show below the alternate place labels but above the radar overlay|

### Using the Slider
It's simple.
1. Click or tap anywhere on the slider, other than the handle to set the 'return point'
2. Drag the handle somewhere and let it go. It will slowly move to the return point, animating the radar overlay as it does so.
3. After `slider_timeout` (default `5000`) milliseconds of no user interaction, the handle will re-center.

---

## Contributing

If you find any issues or have suggestions, feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/bezmi/ha-map-card-plugin-bom-radar). Contributions welcome :)
More features (scrollable timeline, select time range of data) are on their way.

### Developing
[Follow the instructions for building from source](#from-source-advanced).

---

## Thanks
* @nathan-gs for [ha-map-card](https://github.com/nathan-gs/ha-map-card).
* The Bureau of Meteorology for the data.

---

## License

See [LICENSE](LICENSE).
