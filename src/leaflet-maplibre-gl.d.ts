// Copyright (c) 2021 MapLibre contributors

// Copyright (c) 2014, Mapbox

// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.

// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

import type * as L from 'leaflet';
import type { Map as LibreGLMap, MapOptions as LibreGLMapOptions } from 'maplibre-gl';

declare module 'leaflet' {
    type LeafletMaplibreGLOptions = Omit<LibreGLMapOptions, "container">;

    class MaplibreGL extends L.Layer {
        constructor(options: LeafletMaplibreGLOptions);
        getMaplibreMap(): LibreGLMap
        getCanvas(): HTMLCanvasElement
        getSize(): L.Point
        getBounds(): L.LatLngBounds
        getContainer(): HTMLDivElement
        getPaneName(): string
    }

    function maplibreGL(options: LeafletMaplibreGLOptions): MaplibreGL;

}

/**
 * Initializes the Leaflet-MapLibre GL integration by defining L.MaplibreGL and L.maplibreGL.
 * @param L The Leaflet instance.
 * @param maplibregl The MapLibre GL JS import.
 */
export declare function initLeafletMaplibreGL(
    L: typeof import('leaflet'),
    maplibregl: typeof import('maplibre-gl')
): void;
