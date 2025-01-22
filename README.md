# ha-map-card-plugin-bom-radar

A plugin for [ha-map-card](https://github.com/nathan-gs/ha-map-card) that displays the Australian BoM (Bureau of Meteorology) radar precipitation data.

> If you'd like to support my work, you can [donate on ko-fi](https://ko-fi.com/bezmi) or [github sponsors](https://github.com/sponsors/bezmi).

![an example of the map with rain radar shown](/images/screenshot.png)

## Installation
Install `ha-map-card`. For now, this only works with an experimental version that has plugin support: https://github.com/nathan-gs/ha-map-card/pull/113

### Releases
[Download the latest release]("https://github.com/bezmi/ha-map-card-plugin-bom-radar/releases/latest")
and place it in your homeassistant `www` folder.

### From source (advanced)
1. Clone or download this repository.
2. Install the plugin dependencies: `npm install`
3. Build: `npm run build`
4. Copy `dist/bom-plugin.js` to the `www` folder of homeassistant.

---

## Configuration

Below is an example Lovelace YAML configuration that I like to use.

```yaml
type: custom:map-card
x: -25.3744
y: 133.7751
zoom: 4
tile_layer_url: https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png
plugins:
  - name: bom
    url: /local/bom-plugin.js # if the plugin is the www folder, this is the url to use
    options:
      alternate_labels: true
```
- **name**: a name for the plugin instance
- **url**: location where `bom-plugin.js` can be found. If it's in the `www` folder, then use `local/bom-plugin.js`

### Plugin configuration
- **cycle_interval**: (default 250) Time in milliseconds between radar image frames cycling.
- **fetch_interval**: (default 30000) Time in milliseconds between each data retrieval from BoM.
- **alternate_labels**: (default `false`) enable alternate labels for place names.
Useful as they draw over the radar. Use a [blank basemap](https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png) if you enable this option.
- **layer_control**: (default `true`) enable checkbox to allow showing/hiding the radar overlay and slider (if enabled).
- **enable_slider**: (default `true`) enable the interactive slider make sure you read the [slider section below](#using-the-slider) so you know how it works!
- **slider_timeout**: (default `5000`) after this many milliseconds without interaction, the slider will return to the neutral (center position).
- **{something}_zIndex**: [see z-index section below](#z-index)

#### z-index
Setting these integer values in the configuration will alter how the different layers of the map are ordered.
The lower the value, the lower the layer will be in the stack.
With the current defaults, the order (lowest to highest) is radar -> markers -> labels, which works well.
For the labels setting to do anything, you must have the `alternate_labels` option set to `true`.
- **labels_zIndex**: (default 501) zIndex property for the labels
- **radar_zIndex**: (default 201) zIndex property for the radar overlay
- **marker_zIndex**: (default 401) zIndex property for the markers that you have on your map

### Using the Slider
It's simple.
1. Click or tap anywhere on the slider, other than the handle to set the 'return point'
2. Drag the handle somewhere and let it go. It will slowly move to the return point, animating the radar overlay as it does so.
3. After `slider_timeout` (default `5000`) milliseconds of no user interaction, the handle will re-center.

---

## Contributing

If you find any issues or have suggestions, feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/bezmi/ha-map-card-plugin-bom-radar). Contributions welcome :)
More features (scrollable timeline, select time range of data) are on their way.

---

## License

See [LICENSE](LICENSE).
