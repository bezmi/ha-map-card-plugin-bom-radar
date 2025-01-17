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

Below is an example Lovelace YAML configuration.

```yaml
type: custom:map-card
x: -25.3744
y: 133.7751
zoom: 4
plugins:
  - name: bom
    url: /local/bom-plugin.js # if the plugin is the www folder, this is the url to use
    options:
      cycle_interval: 250
      fetch_interval: 30000
```
- **name**: a name for the plugin instance
- **url**: location where `bom-plugin.js` can be found. If it's in the `www` folder, then use `local/bom-plugin.js`

### Plugin configuration
- **cycle_interval**: Time in milliseconds between radar image frames cycling (default: 250).  
- **fetch_interval**: Time in milliseconds between each data retrieval from BoM (default: 30000).  
- **alternate_labels**: `true` to enable alternate labels for place names.
Useful as they draw over the radar. Use a [blank basemap](https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png) if you enable this option.
- **layer_control**: `true` if you want checkbox to allow enabling/disable the radar overlay.
- **labels_zIndex**: zIndex property for the labels (doesn't work properly yet).
- **radar_zIndex**: zIndex property for the radar overlay (doesn't work properly yet).

---

## Contributing

If you find any issues or have suggestions, feel free to open an issue or submit a pull request on the [GitHub repository](https://github.com/bezmi/ha-map-card-plugin-bom-radar). Contributions welcome :)
More features (scrollable timeline, select time range of data) are on their way.

---

## License

See [LICENSE](LICENSE).
