/**
 * Created by thomas on 9/01/14.
 *
 * (c) www.geocento.com
 * www.metaaps.com
 *
 */

var CesiumMaps = (function() {

    // static variables
    var ellipsoid = Cesium.Ellipsoid.WGS84;

    // constructor
    function _() {
    }

    // static methods
    _.createMap = function(lat, lng, zoom, mapId, div, callback, failure) {
        if(div == undefined) {
            if(failure) {
                failure("No valid div element provided");
            }
        }
        if(Cesium) {
            var globe = new _.Globe(div, lat, lng, zoom, mapId);
            callback(globe);
        } else {
            failure();
        }
    }

    _.Globe = function(container, lat, lng, zoom, mapId, callback, failure) {

        container.innerHTML = "";
        container.style.position = 'relative';
        container.style.width = '100%';
        container.style.height = '100%';
        var frameDiv = document.createElement('div');
        frameDiv.style.width = "100%";
        frameDiv.style.height = "100%";
        container.appendChild(frameDiv);
        var controlDiv = document.createElement('div');
        controlDiv.style.position = "absolute";
        controlDiv.style.right = "0px";
        controlDiv.style.top = "0px";
        container.appendChild(controlDiv);

        var hasKey = mapsConfig != undefined && mapsConfig.bingMapsAPIKey != undefined;
        if(!hasKey) {
            alert("Missing Bing Maps API key");
        }
        var bingMapsAPI = hasKey ? mapsConfig.bingMapsAPIKey : undefined;
        var mapsIds = {
            "Bing Satellite Maps":
                new Cesium.BingMapsImageryProvider({
                    url : 'https://dev.virtualearth.net',
                    key : bingMapsAPI,
                    mapStyle : Cesium.BingMapsStyle.AERIAL
                }),
            "Bing Road Maps": new Cesium.BingMapsImageryProvider({
                url : 'https://dev.virtualearth.net',
                key : bingMapsAPI,
                mapStyle : Cesium.BingMapsStyle.ROAD
            })
        };

        var cesiumWidget = new Cesium.CesiumWidget(frameDiv, {
            imageryProvider: mapsIds[mapId ? mapId : "Bing Satellite Maps"],
            scene3DOnly: true
        });

        var scene = cesiumWidget.scene;
        this._scene = scene;

        // add terrain elevation
        var cesiumTerrainProviderHeightmaps = new Cesium.CesiumTerrainProvider({
            url : '//assets.agi.com/stk-terrain/world',
            credit : 'Terrain data courtesy Analytical Graphics, Inc.'
        });

        scene.terrainProvider = cesiumTerrainProviderHeightmaps;

        // start the draw helper to enable shape creation and editing
        var drawHelper = new DrawHelper(cesiumWidget);
        this._drawHelper = drawHelper;

        var infoWindow = new InfoWindow({}, cesiumWidget);
        scene.primitives.add(infoWindow);

        var overlays = [];

        var imageryLayers = cesiumWidget.scene.imageryLayers;

        function getCameraCartographicPosition() {
            return ellipsoid.cartesianToCartographic(scene.camera.position);
        }

        var gl = this;

        gl.setCenter = function(lat, lng) {
            scene.camera.setPositionCartographic(Cesium.Cartographic.fromDegrees(lng, lat, getHeight()));
        }

        gl.getCenter = function() {
            scene.camera.lookDown();
            return _.convertPath([scene.camera.position]);
        }

        gl.setZoomLevel = function(level) {
            var position = getCameraCartographicPosition();
            position.height = convertFromZoom(level);
            scene.camera.setPositionCartographic(position);
        }

        gl.getZoomLevel = function() {
            return convertToZoom(getCameraCartographicPosition().height);
        }

        gl.getBounds = function() {
            var controller = scene.camera; //Cesium.clone(scene.camera, true);
            controller.lookDown();
            var canvas = scene.canvas;
            var corners = [
                controller.pickEllipsoid(new Cesium.Cartesian2(0, 0), ellipsoid),
                controller.pickEllipsoid(new Cesium.Cartesian2(canvas.width, 0), ellipsoid),
                controller.pickEllipsoid(new Cesium.Cartesian2(0, canvas.height), ellipsoid),
                controller.pickEllipsoid(new Cesium.Cartesian2(canvas.width, canvas.height), ellipsoid)
            ];
            for(var index = 0; index < 4; index++) {
                if(corners[index] === undefined) {
                    var center = ellipsoid.cartesianToCartographic(controller.position);
                    return _.convertBounds(Cesium.Rectangle.fromCartographicArray([
                        new Cesium.Cartographic(center.longitude - Math.PI / 2, Math.PI / 2, 0),
                        new Cesium.Cartographic(center.longitude + Math.PI / 2, Math.PI / 2, 0),
                        new Cesium.Cartographic(center.longitude + Math.PI / 2, -Math.PI / 2, 0),
                        new Cesium.Cartographic(center.longitude - Math.PI / 2, -Math.PI / 2, 0)
                    ]));
                }
            }
            return _.convertBounds(Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(corners)));
        }

        gl.setBounds = function(swLat, swLng, neLat, neLng) {
            scene.camera.viewRectangle(Cesium.Rectangle.fromDegrees(swLng, swLat, neLng, neLat), ellipsoid);
        }

        gl.getMapTypeIds = function() {
            var mapId, mapTypeIds = [];
            for(mapId in mapsIds) {
                mapTypeIds.push(mapId);
            }
            return mapTypeIds;
        }

        gl.getMapId = function() {
            return this._selectedMapId || "Bing Satellite Maps";
        }

        gl.setMapId = function(mapTypeId) {
            // TODO - need to check the mapTypeId exists in the list of map type ids available
            if(mapTypeId && mapsIds[mapTypeId]) {
                this._selectedMapId = mapTypeId;
                imageryLayers.remove(imageryLayers.get(0), false);
                imageryLayers.add(new Cesium.ImageryLayer(mapsIds[mapTypeId]));
                /*
                 imageryLayers.remove(imageryLayers.get(0), false);
                 imageryLayers.add(new Cesium.ImageryLayer(mapsIds[mapTypeId]), 0);
                 */
            }
        }

        /*
         * add a map type to the list of map types
         * the map tiles are expected to be provided using TMS
         *
         */
        gl.addMapType = function(mapName, mapId, baseURL, copyright, yFlip, minZoom, maxZoom) {
            var newMapType = new _.TMSLayer(baseURL, copyright, yFlip);
            mapsIds[mapId] = newMapType;
        }

        gl.addWMSMapType = function(mapName, mapId, baseURL, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng, minZoom, maxZoom) {
            mapsIds[mapId] = createWMSProvider(this, baseURL, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng);
        }

        gl.addImageryLayer = function(layer) {
            imageryLayers.add(layer);
        }

        gl.removeImageryLayer = function(layer, destroy) {
            imageryLayers.remove(layer, destroy);
        }

        gl.moveLayerToBottom = function(layer) {
            imageryLayers.lowerToBottom(layer);
            imageryLayers.raise(layer);
        }

        gl.moveLayerToTop = function(layer) {
            imageryLayers.raiseToTop(layer);
        }

        gl.moveLayer = function(layer, zIndex) {
            var index, layers = imageryLayers, delta;
            index = layers.indexOf(layer);
            delta = zIndex - index;
            if(delta > 0) {
                for(index = 0; index < delta; index++) {
                    layers.raise(layer);
                }
            } else {
                for(index = 0; index < -delta; index++) {
                    layers.lower(layer);
                }
            }
        }

        gl.getLayerIndex = function(layer) {
            imageryLayers.indexOf(layer);
        }

        gl.addControl = function(control, position) {
            // TODO - handle positions
            controlDiv.appendChild(control);
        }

        gl.displayCoordinates = function(display) {

            if(this.coordinatesOverlay == undefined) {
                var _self = this;
                var latLngOverlay = function(frameDiv) {
                    var div = document.createElement('DIV');
                    div.innerHTML = "";
                    div.style.position = 'absolute';
                    div.style.bottom = '50px';
                    div.style.left = '0px';
                    div.style.background = 'white';
                    div.style.padding = "10px";
                    div.style.margin = "10px";
                    this.div_ = div;
                    // add to frame div and display coordinates
                    frameDiv.appendChild(div);
                    var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                    handler.setInputAction(
                        function (movement) {
                            var cartesian = scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                            if (cartesian) {
                                var cartographic = ellipsoid.cartesianToCartographic(cartesian);
                                div.innerHTML = "Position: (long: " + Cesium.Math.toDegrees(cartographic.longitude).toFixed(5) + ", lat: " + Cesium.Math.toDegrees(cartographic.latitude).toFixed(5) + ")";
                            } else {
                                div.innerHTML = "Position: ";
                            }
                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                }

                latLngOverlay.prototype.show = function() {
                    this.div_.style.display = 'block';
                }

                latLngOverlay.prototype.hide = function() {
                    this.div_.style.display = 'none';
                }
                this.coordinatesOverlay = new latLngOverlay(container);
                this.coordinatesOverlay.hide();
            }
            if(display) {
                this.coordinatesOverlay.show();
            } else {
                this.coordinatesOverlay.hide();
            }
        }

        gl.addZoomOnShift = function(callback) {
            var globe = this;
            var map = this.map;
            container.parentElement.addEventListener("mousedown", function(event) {
                if(event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    var cartesian = scene.camera.pickEllipsoid(new Cesium.Cartesian2(event.clientX, event.clientY), ellipsoid);
                    if(cartesian) {
                        dragging = true;
                        drawHelper.startDrawingZoomExtent(ellipsoid.cartesianToCartographic(cartesian),
                            {strokeColor: "#ff0000",
                                strokeOpacity: 0.9,
                                strokeThickness: 1,
                                fillColor: "#ffffff",
                                fillOpacity: 0.1,
                                callback: function(extent) {
                                    callback(Cesium.Math.toDegrees(extent.south), Cesium.Math.toDegrees(extent.west), Cesium.Math.toDegrees(extent.north), Cesium.Math.toDegrees(extent.east));
                                }

                            });
                    }
                }
            }, true);
        }

        gl.openInfoWindow = function(lat, lng, content) {
            infoWindow.showAt(lng, lat, '<div>' + content + '</div>');
        }

        gl.openInfoWindowWidget = function(lat, lng, element) {
            infoWindow.showAt(lng, lat, element);
        }

        gl.closeInfoWindow = function() {
            infoWindow.hide();
        }

        gl.removeMapType = function(mapId) {

        }

        gl.triggerResize = function() {

        }

        gl.setVisible = function(visible) {

        }

        function findPos(obj) {
            var curleft = 0;
            var curtop = 0;
            if (obj.offsetParent) {
                do {
                    curleft += obj.offsetLeft;
                    curtop += obj.offsetTop;
                } while (obj = obj.offsetParent);
            }
            return {x: curleft, y:curtop};
        }

        gl.convertScreenPositionToEOLatLng = function(clientX, clientY) {
            var offset = findPos(container);
            return convertScreenPositionToLatLng(clientX - offset.x, clientY - offset.y);
        }

        gl.convertLatLngToScreenPosition = function(lat, lng) {
            // TODO - get the screen position based on lat lng coordinates
            var offset = findPos(container);
        }

        gl.displayRuler = function(display) {
        }

        gl.displayRulerAltitude = function(display) {
        }

        gl.displayCoordinatesGrid = function(display) {
            if(display && !this._gridOverlay) {
                var graticule = new Graticule({
                    tileWidth: 512,
                    tileHeight: 512,
                    numLines: 10
                }, scene);
                imageryLayers.addImageryProvider(graticule);
                this._gridOverlay = graticule;
            }
            if(this._gridOverlay) {
                this._gridOverlay.setVisible(display);
            }
        }

        gl.setTooltip = function(primitive, tooltip) {
            drawHelper.setListener(primitive, 'mouseMove', function(position) {
                drawHelper._tooltip.showAt(position, tooltip);
            });
        }

        gl.setOnTop = function(surface) {
            scene.primitives.raiseToTop(surface);
        }

        gl.sendToBack = function(surface) {
            scene.primitives.lowerToBottom(surface);
        }

        gl.getIndex = function(surface) {
            var index = 0;
            for(; index < scene.primitives._primitives.length && scene.primitives._primitives[index] !== surface; index++);
            return index;
        }

        gl.cleanUp = function() {
            // check for cleanUp first
            drawHelper.disableAllEditMode();

            if(overlays) {
                for (var index =  0; index < overlays.length; index++) {
                    var overlay = overlays[index];
                    if(overlay.remove) {
                        overlay.remove();
                    }
                }
            }
            overlays = [];

            this.closeInfoWindow();

        }

        gl.addOverlay = function(overlay) {
            overlays.push(overlay);
        }

        gl.removeOverlay = function(overlay) {
            for (var index =  0; index < overlays.length && overlays[index] != overlay; index++);
            if(index != overlays.length) {
                overlays.splice(index, 1);
                if(overlay.remove) {
                    overlay.remove();
                }
            }
        }

        function convertScreenPositionToLatLng(posX, posY) {
            var cartesian = scene.camera.pickEllipsoid(new Cesium.Cartesian2(posX, posY), ellipsoid);
            if (cartesian) {
                return convertToLatLngZoom(cartesian);
            } else {
                return null;
            }
        }

        gl.setListener = function(element, eventName, callback) {
            element[eventName] = callback;
        }

        function getHeight() {
            return ellipsoid.cartesianToCartographic(scene.camera.position).height;
        }

        function convertToLatLngZoom(cartesian) {
            var cartographic = ellipsoid.cartesianToCartographic(cartesian);
            return {lng: Cesium.Math.toDegrees(cartographic.longitude), lat: Cesium.Math.toDegrees(cartographic.latitude), zoom: convertToZoom(cartographic.height)};
        }

        var heightConversion = 360000000.0;
        function convertToZoom(height) {
            return Math.floor(Math.log(heightConversion / height) / Math.log(2));
        }

        function convertFromZoom(zoomLevel) {
            return heightConversion / Math.exp(zoomLevel * Math.log(2));
        }

    };

    _.convertBounds = function(extent) {
        return {
            swLat: Cesium.Math.toDegrees(extent.south),
            swLng: Cesium.Math.toDegrees(extent.west),
            neLat: Cesium.Math.toDegrees(extent.north),
            neLng: Cesium.Math.toDegrees(extent.east)
        }
    }

    _.convertPath = function(positions) {
        var path = [], index;
        var latLngs = ellipsoid.cartesianArrayToCartographicArray(positions);
        for(index = 0; index < latLngs.length; index++) {
            path.push(Cesium.Math.toDegrees(latLngs[index].latitude));
            path.push(Cesium.Math.toDegrees(latLngs[index].longitude));
        }
        return path;
    }

    _.generatePath = function(coordinates) {
        // generate path from array of doubles
        var path = [];
        for(i = 0; i < coordinates.length;) {
            path.push(Cesium.Cartographic.fromDegrees(coordinates[i + 1], coordinates[i], 0));
            i = i + 2;
        }

        return ellipsoid.cartographicArrayToCartesianArray(path);
    }

    _.getPathArea = function(path) {
        return 0;
    }

    _.getPathLength = function(path) {
        return 0;
    }

    // add a marker to the map and return it
    _.uniMarker = function(globe, lat, lng, mapIconUrl, shiftX, shiftY) {

        this.globe = globe;
        // create billboard
        var b = new Cesium.BillboardCollection();
        globe._scene.primitives.add(b);
        var billboard = b.add({
            show : true,
            position : ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(lng, lat, 10)),
            pixelOffset : new Cesium.Cartesian2(shiftX ? shiftX : 0, shiftY ? -shiftY : 0),
            eyeOffset : new Cesium.Cartesian3(0.0, 0.0, 0.0),
            horizontalOrigin : Cesium.HorizontalOrigin.RIGHT,
            verticalOrigin : Cesium.VerticalOrigin.TOP,
            scale : 1.0,
            image : mapIconUrl,
            color : new Cesium.Color(1.0, 1.0, 1.0, 1.0)
        });
        this.marker = billboard;
        globe.addOverlay(this);

        this.remove = function() {
            if(!b.isDestroyed()) {
                globe._scene.primitives.remove(b);
            }
        }
    }

    _.uniMarker.prototype.setDraggable = function(callback) {
        this.marker.setEditable();
        var marker = this;
        // check the event names
        this.marker.addListener('dragEnd', function() {callback(marker)});
    }

    _.uniMarker.prototype.setListener = function(eventName, callback) {
        this.marker.setEditable();
        var marker = this;
        // check the event names
        this.marker.addListener(eventName, function() {callback(marker)});
    }

    _.uniMarker.prototype.setClickHandler = function(callback) {
        var marker = this;
        this.globe._drawHelper.setListener(this.marker, 'leftClick', function(position) {callback(marker.getLat(), marker.getLng())});
    }

    _.uniMarker.prototype.setVisible = function(visible) {
        this.marker.show = visible;
    }

    _.uniMarker.prototype._getPosition = function() {
        return ellipsoid.cartesianToCartographic(this.marker.position);
    }

    _.uniMarker.prototype.getLat = function() {
        return Cesium.Math.toDegrees(this._getPosition().latitude);
    }

    _.uniMarker.prototype.getLng = function() {
        return Cesium.Math.toDegrees(this._getPosition().longitude);
    }

    _.uniMarker.prototype.setTitle = function(title) {
    }

    _.uniMarker.prototype.setPosition = function(lat, lng) {
        return this.marker.position = ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(lng, lat, 0));
    }

    _.createPoint = function(globe, callback) {
        globe._drawHelper.startDrawingMarker({
            callback: function(position) {
                callback(_.convertPath([position]));
            }
        });
    }

    _.createPolygon = function(globe, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {
        globe._drawHelper.startDrawingPolygon({
            strokeColor: color,
            strokeThickness: thickness,
            strokeOpacity: opacity,
            fillColor: fillcolor,
            fillOpacity: fillopacity,
            callback: function(positions) {
                callback(_.convertPath(positions));
            }
        });
    }

    // polygon implementation
    _.uniPolygon = function(globe, polygonCoordinates, options) { //}, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, editCallback) {

        this.globe = globe;

        // handle case where constructor is empty
        if(polygonCoordinates == undefined || polygonCoordinates.length == undefined || polygonCoordinates.length < 6) {
            return;
        }

        var material = Cesium.Material.fromType(Cesium.Material.ColorType);
        var surface = new DrawHelper.PolygonPrimitive({
            positions: _.generatePath(polygonCoordinates),
            material: material
        });

        var editCallback = options.callback;

        globe._scene.primitives.add(surface);
        globe.addOverlay(this);
        var _self = this;
        this.remove = function() {
            if(!surface.isDestroyed()) {
                surface.setHighlighted && surface.setHighlighted(false);
                globe._scene.primitives.remove(surface);
            }
        }

        if(typeof editCallback == "function") {
            surface.setEditable();
            surface.addListener('onEdited', function(event) {
                editCallback(_.convertPath(event.positions));
            });
        }

        this.setVisible = function(visible) {
            surface.show = visible;
            surface.setEditMode && surface.setEditMode(false);
        }

        this.updatePositions = function(coordinates) {
            surface.setPositions(_.generatePath(coordinates));
        }

        this.getPositions = function() {
            return _.convertPath(surface.getPositions());
        }

        this.getEOBounds = function() {
            return _.convertBounds(Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(surface.getPositions())));
        }

        this.getArea = function() {
            return 0;
        }

        this.setClickHandler = function(callback) {
            globe._drawHelper.setListener(surface, 'leftClick', function(position) {
                var cartesian = globe._scene.camera.pickEllipsoid(position, ellipsoid);
                if(cartesian) {
                    var latLng = _.convertPath([cartesian]);
                    callback(latLng[0], latLng[1]);
                }
            });
        }

        this.setEditable = function(editable) {
            surface.setEditable();
        }

        this.setTooltip = function(tooltip) {
            globe.setTooltip(surface, tooltip);
        }

        this.setStrokeStyle = function(color, opacity, thickness) {
            color = Cesium.Color.fromCssColorString(color);
            color.alpha = opacity;
            this._strokeColor = color;
            this._strokeThickness = thickness;
            surface.setStrokeStyle(color, thickness);
        }

        this.setFillColor = function(color) {
            var newColor = Cesium.Color.fromCssColorString(color);
            if(!surface.material.uniforms.color.equals(newColor)) {
                surface.material.uniforms.color = newColor;
            }
        }

        this.setFillOpacity = function(opacity) {
            if(surface.material.uniforms.color.alpha != opacity) {
                surface.material.uniforms.color.alpha = Math.max(0.004, opacity);
            }
        }

        this.sendToBack = function() {
            globe.sendToBack(surface);
        }

        this.setOnTop = function() {
            globe.setOnTop(surface);
        }

        this.setOnTop = function() {
            globe.getIndex(surface);
        }

        this._getCenter = function() {
            return Cesium.Rectangle.center(Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(surface.getPositions())));
        }

        this.getCenter = function() {
            var center = this._getCenter();
            return [Cesium.Math.toDegrees(center.latitude), Cesium.Math.toDegrees(center.longitude)];
        }

        this.setCenter = function(lat, lng) {
            surface.setEditMode && surface.setEditMode(false);
            var center = this._getCenter();
            var deltaLat = Cesium.Math.toRadians(lat) - center.latitude;
            var deltaLng = Cesium.Math.toRadians(lng) - center.longitude;
            // update polygon
            var index, latLng, path = ellipsoid.cartesianArrayToCartographicArray(surface.getPositions());
            // avoid going over the poles
            for(index = 0; index < path.length; index++) {
                if(Math.abs(path[index].latitude + deltaLat) > Math.PI / 2) return false;
            }
            for(index = 0; index < path.length; index++) {
                latLng = path[index];
                path[index] = new Cesium.Cartographic(latLng.longitude + deltaLng, latLng.latitude + deltaLat, 0);
            }
            surface.setPositions(ellipsoid.cartographicArrayToCartesianArray(path));

            return true;
        }

        this.setHighlighted = function(highlighted) {
            if(this._highlighted && this._highlighted == highlighted) {
                return;
            }
            if(highlighted) {
                surface.setStrokeStyle(Cesium.Color.fromCssColorString('white'), this._strokeThickness);
            } else {
                surface.setStrokeStyle(this._strokeColor, this._strokeThickness);
            }
        }

        this.forceSouthPole = function() {

        }

        this.setStrokeStyle(options.color || '#ffffff', options.opacity == undefined ? 1.0 : options.opacity, options.thickness || 2);
        this.setFillColor(options.fillColor || '#888888');
        this.setFillOpacity(options.fillOpacity == undefined ? 0.7 : options.fillOpacity);

    }

    _.createCircle = function(globe, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {
        globe._drawHelper.startDrawingCircle({
            strokeColor: color,
            strokeThickness: thickness,
            strokeOpacity: opacity,
            fillColor: fillcolor,
            fillOpacity: fillopacity,
            callback: function(center, radius) {
                var center = ellipsoid.cartesianToCartographic(center);
                callback(Cesium.Math.toDegrees(center.latitude), Cesium.Math.toDegrees(center.longitude), radius);
            }
        });
    }

    _.uniCircle = function(globe, centerLat, centerLng, radius, options) {

        var material = Cesium.Material.fromType(Cesium.Material.ColorType);
        var surface = new DrawHelper.CirclePrimitive({
            center: ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(centerLng, centerLat)),
            radius: radius,
            material: material
        });
        globe._scene.primitives.add(surface);
        globe.addOverlay(this);
        this.remove = function() {
            if(!surface.isDestroyed()) {
                surface.setHighlighted && surface.setHighlighted(false);
                globe._scene.primitives.remove(surface);
            }
        }

        var callback = options.callback;
        if(callback != null && typeof callback == "function") {
            surface.setEditable();
            surface.addListener('onEdited', function(event) {
                var center = ellipsoid.cartesianToCartographic(event.center);
                callback(Cesium.Math.toDegrees(center.latitude), Cesium.Math.toDegrees(center.longitude), event.radius);
            });
        }

        this.getRadius = function() {
            return surface.getRadius();
        }

        this.setRadius = function(radius) {
            return surface.setRadius(radius);
        }

        function getExtent() {
            return Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(surface.getCircleCartesianCoordinates(Cesium.Math.PI_OVER_SIX)));
        }

        this.getEOBounds = function() {
            return _.convertBounds(getExtent());
        }

        this.getArea = function() {
            return 0;
        }

        this.getCenter = function() {
            return _.convertPath([surface.getCenter()]);
        }

        this.setCenter = function(lat, lng) {
            surface.setEditMode && surface.setEditMode(false);
            surface.setCenter(_.generatePath([lat, lng])[0]);
            return true;
        }

        this.setClickHandler = function(callback) {
            globe._drawHelper.setListener(surface, 'leftClick', function(position) {
                var cartesian = globe._scene.camera.pickEllipsoid(position, ellipsoid);
                if(cartesian) {
                    var latLng = _.convertPath([cartesian]);
                    callback(latLng[0], latLng[1]);
                }
            });
        }

        this.setEditable = function(editable) {
            surface.setEditable();
        }

        this.setTooltip = function(tooltip) {
            globe.setTooltip(surface, tooltip);
        }

        this.setStrokeStyle = function(color, opacity, thickness) {
            color = Cesium.Color.fromCssColorString(color);
            color.alpha = opacity;
            surface.setStrokeStyle(color, thickness);
        }

        this.setFillColor = function(color) {
            surface.material.uniforms.color = Cesium.Color.fromCssColorString(color);
        }

        this.setFillOpacity = function(opacity) {
            if(surface.material.uniforms.color.alpha != opacity) {
                surface.material.uniforms.color.alpha = Math.max(0.004, opacity);
            }
        }

        this.setVisible = function(visible) {
            surface.show = visible;
            surface.setEditMode && surface.setEditMode(false);
        }

        this.sendToBack = function() {
            globe.sendToBack(surface);
        }

        this.setOnTop = function() {
            globe.setOnTop(surface);
        }

        this.setStrokeStyle(options.color || '#ffffff', options.opacity == undefined ? 1.0 : options.opacity, options.thickness || 2);
        this.setFillColor(options.fillColor || '#888888');
        this.setFillOpacity(options.fillOpacity == undefined ? 0.7 : options.fillOpacity);

    }

    _.createRectangle = function(globe, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {
        globe._drawHelper.startDrawingExtent({
            strokeColor: color,
            strokeThickness: thickness,
            strokeOpacity: opacity,
            fillColor: fillcolor,
            fillOpacity: fillopacity,
            callback: function(extent) {
                callback(Cesium.Math.toDegrees(extent.south), Cesium.Math.toDegrees(extent.west), Cesium.Math.toDegrees(extent.north), Cesium.Math.toDegrees(extent.east));
            }
        });
    }

    //editable rectangle
    _.uniRectangle = function(globe, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, options) {

        var material = Cesium.Material.fromType(Cesium.Material.ColorType);
        var surface = new DrawHelper.ExtentPrimitive({
            extent: Cesium.Rectangle.fromCartographicArray([Cesium.Cartographic.fromDegrees(topLeftLng, topLeftLat), Cesium.Cartographic.fromDegrees(bottomRightLng, bottomRightLat)]),
            material: material
        });
        globe._scene.primitives.add(surface);
        globe.addOverlay(this);
        this.remove = function() {
            if(!surface.isDestroyed()) {
                surface.setHighlighted && surface.setHighlighted(false);
                globe._scene.primitives.remove(surface);
            }
        }

        var callback = options.callback;
        if(callback != null && typeof callback == "function") {
            surface.setEditable();
            surface.addListener('onEdited', function(event) {callback(Cesium.Math.toDegrees(event.extent.south), Cesium.Math.toDegrees(event.extent.west), Cesium.Math.toDegrees(event.extent.north), Cesium.Math.toDegrees(event.extent.east))});
        }

        globe.addOverlay(this);

        this.getEOBounds = function() {
            return _.convertBounds(surface.extent);
        }

        this.getArea = function() {
            return 0;
        }

        this.getCenter = function() {
            var center = Cesium.Rectangle.center(surface.extent);
            return [Cesium.Math.toDegrees(center.latitude), Cesium.Math.toDegrees(center.longitude)];
        }

        this.setCenter = function(lat, lng) {
            surface.setEditMode && surface.setEditMode(false);
            var extent = surface.extent;
            var center = Cesium.Rectangle.center(extent);
            var deltaLat = Cesium.Math.toRadians(lat) - center.latitude;
            var deltaLng = Cesium.Math.toRadians(lng) - center.longitude;
            extent.west += deltaLng;
            extent.east += deltaLng;
            extent.south += deltaLat;
            extent.north += deltaLat;
            surface.extent = extent;

            return true;
        }

        this.setClickHandler = function(callback) {
            globe._drawHelper.setListener(surface, 'leftClick', function(position) {
                var cartesian = globe._scene.camera.pickEllipsoid(position, ellipsoid);
                if(cartesian) {
                    var latLng = _.convertPath([cartesian]);
                    callback(latLng[0], latLng[1]);
                }
            });
        }

        this.setEditable = function(editable) {
            surface.setEditable();
        }

        this.setTooltip = function(tooltip) {
            globe.setTooltip(surface, tooltip);
        }

        this.setStrokeStyle = function(color, opacity, thickness) {
            color = Cesium.Color.fromCssColorString(color);
            color.alpha = opacity;
            surface.setStrokeStyle(color, thickness);
        }

        this.setFillColor = function(color) {
            surface.material.uniforms.color = Cesium.Color.fromCssColorString(color);
        }

        this.setFillOpacity = function(opacity) {
            if(surface.material.uniforms.color.alpha != opacity) {
                surface.material.uniforms.color.alpha = Math.max(0.004, opacity);
            }
        }

        this.sendToBack = function() {
            globe.sendToBack(surface);
        }

        this.setOnTop = function() {
            globe.setOnTop(surface);
        }

        this.setBounds = function(neLat, neLng, swLat, swLng) {
            surface.extent.north = Cesium.Math.toRadians(neLat);
            surface.extent.west = Cesium.Math.toRadians(swLng);
            surface.extent.south = Cesium.Math.toRadians(swLat);
            surface.extent.east = Cesium.Math.toRadians(neLng);
        }

        this.setVisible = function(visible) {
            surface.show = visible;
            surface.setEditMode && surface.setEditMode(false);
        }

        this.setStrokeStyle(options.color || '#ffffff', options.opacity == undefined ? 1.0 : options.opacity, options.thickness || 2);
        this.setFillColor(options.fillColor || '#888888');
        this.setFillOpacity(options.fillOpacity == undefined ? 0.7 : options.fillOpacity);

    }

    _.createPolyline = function(globe, color, thickness, opacity, clickable, geodesic, callback, initialLat, initialLng, dragMarkerIcon) {
        globe._drawHelper.startDrawingPolyline({
            strokeColor: color,
            strokeThickness: thickness,
            strokeOpacity: opacity,
            callback: function(positions) {
                callback(_.convertPath(positions));
            }
        });
    }

    //derive polyline implementation from polygon one
    _.uniPolyline = function(globe, polylineCoordinates, color, thickness, opacity, clickable, geodesic, editCallback, editMarkerCallback, dragMarkerIcon, editMarkerIcon) {

        // handle case where constructor is empty
        if(polylineCoordinates == undefined || polylineCoordinates.length == undefined || polylineCoordinates.length < 6) {
            return;
        }

        var surface = new DrawHelper.PolylinePrimitive({
            positions: _.generatePath(polylineCoordinates),
            width: thickness
        });
        globe._scene.primitives.add(surface);

        if(typeof editCallback == "function") {
            surface.setEditable();
            surface.addListener('onEdited', function(event){editCallback(_.convertPath(event.positions))});
        }

        globe.addOverlay(this);

        this.remove = function() {
            if(!surface.isDestroyed()) {
                surface.setHighlighted && surface.setHighlighted(false);
                globe._scene.primitives.remove(surface);
            }
        }

        this.getLength = function() {
            return 0;
        }

        this.setVisible = function(visible) {
            surface.show = visible;
            surface.setEditMode && surface.setEditMode(false);
        }

        this.updatePositions = function(coordinates) {
            surface.setPositions(_.generatePath(coordinates));
        }

        this.getPositions = function() {
            return _.convertPath(surface.getPositions());
        }

        this.getEOBounds = function() {
            return _.convertBounds(Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(surface.getPositions())));
        }

        this.setClickHandler = function(callback) {
            globe._drawHelper.setListener(surface, 'leftClick', function(position) {
                var cartesian = globe._scene.camera.pickEllipsoid(position, ellipsoid);
                if(cartesian) {
                    var latLng = _.convertPath([cartesian]);
                    callback(latLng[0], latLng[1]);
                }
            });
        }

        this.setEditable = function(editable) {
            surface.setEditable();
        }

        this.setTooltip = function(tooltip) {
            globe.setTooltip(surface, tooltip);
        }

        this.setStrokeStyle = function(color, opacity, thickness) {
            surface.setWidth(thickness);
            surface.appearance.material.uniforms.color = Cesium.Color.fromCssColorString(color);
            surface.appearance.material.uniforms.color.alpha = opacity;
        }

        this.sendToBack = function() {
            globe.sendToBack(surface);
        }

        this.setOnTop = function() {
            globe.setOnTop(surface);
        }

        this._getCenter = function() {
            return Cesium.Rectangle.center(Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(surface.getPositions())));
        }

        this.getCenter = function() {
            var center = this._getCenter();
            return [Cesium.Math.toDegrees(center.latitude), Cesium.Math.toDegrees(center.longitude)];
        }

        this.setHighlighted = function(highlight) {
            surface.setHighlighted(highlight);
        }

        this.setCenter = function(lat, lng) {
            surface.setEditMode && surface.setEditMode(false);
            var center = this._getCenter();
            var deltaLat = Cesium.Math.toRadians(lat) - center.latitude;
            var deltaLng = Cesium.Math.toRadians(lng) - center.longitude;
            // update polygon
            var index, latLng, path = ellipsoid.cartesianArrayToCartographicArray(surface.getPositions());
            for(index = 0; index < path.length; index++) {
                latLng = path[index];
                path[index] = new Cesium.Cartographic(latLng.longitude + deltaLng, latLng.latitude + deltaLat, 0);
            }
            surface.setPositions(ellipsoid.cartographicArrayToCartesianArray(path));

            return true;
        }

        this.setStrokeStyle(color, opacity, thickness);

    }

    _.uniRuler = function(globe, polylineCoordinates, color, thickness, opacity, editCallback, dragMarkerIcon, editMarkerIcon) {

        // handle case where constructor is empty
        if(polylineCoordinates == undefined || polylineCoordinates.length == undefined || polylineCoordinates.length < 4) {
            return;
        }

        var surface = new DrawHelper.PolylinePrimitive({
            positions: _.generatePath(polylineCoordinates),
            width: thickness
        });
        globe._scene.primitives.add(surface);

        surface.setEditable();
        surface.setEditMode(true);
        surface.addListener('onEdited', function(event){
            // keep edited
            editCallback(_.convertPath(event.positions));
            surface.setEditMode(true);
        });

        // force edit to true
        var parentEditMode = surface.setEditMode;
        surface.setEditMode = function() {
            parentEditMode(true);
        }

        globe.addOverlay(this);

        this.remove = function() {
            if(!surface.isDestroyed()) {
                surface.setHighlighted && surface.setHighlighted(false);
                globe._scene.primitives.remove(surface);
            }
        }

        this.setVisible = function(visible) {
            surface.show = visible;
            surface.setEditMode && surface.setEditMode(false);
        }

        this.updatePositions = function(coordinates) {
            surface.setPositions(_.generatePath(coordinates));
        }

        this.getPositions = function() {
            return _.convertPath(surface.getPositions());
        }

        this.getEOBounds = function() {
            return _.convertBounds(Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(surface.getPositions())));
        }

        this.setEditable = function(editable) {
            surface.setEditable();
        }

        this.setTooltip = function(tooltip) {
            globe.setTooltip(surface, tooltip);
        }

        this.setStrokeStyle = function(color, opacity, thickness) {
            surface.setWidth(thickness);
            surface.appearance.material.uniforms.color = Cesium.Color.fromCssColorString(color);
            surface.appearance.material.uniforms.color.alpha = opacity;
        }

        this.sendToBack = function() {
            globe.sendToBack(surface);
        }

        this.setOnTop = function() {
            globe.setOnTop(surface);
        }

        this._getCenter = function() {
            return Cesium.Rectangle.center(Cesium.Rectangle.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(surface.getPositions())));
        }

        this.getCenter = function() {
            var center = this._getCenter();
            return [Cesium.Math.toDegrees(center.latitude), Cesium.Math.toDegrees(center.longitude)];
        }

    }

    _.uniLayer = function() {
        this.layer = {};
    }

    _.uniLayer.prototype.setVisible = function (visible) {
        this.layer.show = visible;
    }

    _.uniLayer.prototype.remove = function() {
        this.globe.removeImageryLayer(this.layer, true);
    }

    _.uniLayer.prototype.setOpacity = function(opacity) {
        this.layer.alpha = opacity;
    }

    _.uniLayer.prototype.getOpacity = function() {
        return this.layer.alpha;
    }

    _.uniLayer.prototype.setToBottom = function() {
        this.globe.moveLayerToBottom(this.layer);
    }

    _.uniLayer.prototype.setOnTop = function() {
        this.globe.moveLayerToTop(this.layer);
    }

    _.uniLayer.prototype.setZIndex = function(zIndex) {
        // shift all layers index by one because the base layer has index 0
        this.globe.moveLayer(this.layer, zIndex + 1);
    }

    _.uniLayer.prototype.getZIndex = function() {
        return this.globe.getLayerIndex(this.layer);
    }

    _.Proxy = function(testUrl) {
        if(!testUrl) {
            return;
        }
        // check for URL
        // check if relative path or same domain
        this.directURL = /^(?:[a-z]+:)?\/\//i.test(testUrl) ||
            (testUrl.indexOf(window.location.protocol + "//" + window.location.host) == 0);
        // check for CORS support on both sides
        if(!this.directURL) {
            var _self = this;
            // Create the XHR object.
            function createCORSRequest(method, url) {
                var xhr = new XMLHttpRequest();
                if ("withCredentials" in xhr) {
                    // XHR for Chrome/Firefox/Opera/Safari.
                    xhr.open(method, url, true);
                } else if (typeof XDomainRequest != "undefined") {
                    // XDomainRequest for IE.
                    xhr = new XDomainRequest();
                    xhr.open(method, url);
                } else {
                    // CORS not supported.
                    xhr = null;
                }
                return xhr;
            }

            var xhr = createCORSRequest('GET', testUrl);
            if (!xhr) {
                return;
            }

            // Response handlers.
            xhr.onload = function() {
                _self.directURL = true; //xhr.getResponseHeader('Access-Control-Allow-Origin') != null;
            };

            xhr.onerror = function() {
                _self.directURL = false;
            };

            xhr.send();
        }
    }

    _.Proxy.prototype.getURL = function(resource) {
        if(this.directURL) {
            return resource;
        } else {
            return '/proxy/?targetURL=' + encodeURIComponent(resource);
        }
    }

    _.TMSLayer = function(baseUrl, copyright, yFlip, swLat, swLng, neLat, neLng) {

        if(baseUrl.indexOf("$z") == -1) {
            baseUrl = baseUrl + "/$z/$x/$y.png";
        }

        this._url = baseUrl;

        this._yFlip = yFlip;

        this._proxy = new _.Proxy(this.formatUrl(0, 0, 0));

        this._tileDiscardPolicy = undefined;

        this._errorEvent = new Cesium.Event();

        this._credit = copyright && copyright.length > 0 ? new Cesium.Credit(copyright) : undefined;

        this._tileWidth = 256;
        this._tileHeight = 256;
        this._minimumLevel = 0;
        this._maximumLevel = 18;
        this._tilingScheme = new Cesium.WebMercatorTilingScheme();
        if(swLat && swLng && neLat && neLng) {
            var extent = new Cesium.Rectangle(Cesium.Math.toRadians(swLng), Cesium.Math.toRadians(swLat), Cesium.Math.toRadians(neLng), Cesium.Math.toRadians(neLat));
            extent = Cesium.Rectangle.contains(this._tilingScheme.rectangle, extent) ? extent : this._tilingScheme.rectangle;
            this._rectangle = extent;
        } else {
            this._rectangle = this._tilingScheme.rectangle;
        }
        this._ready = true;

    }

    _.TMSLayer.prototype = new Cesium.TileMapServiceImageryProvider();

    _.TMSLayer.prototype.formatUrl = function(x, y, level) {
        return this._url.replace("$z", level).replace("$y", this._yFlip ? y : (1 << level) - y - 1).replace("$x", x);
    }

    // rewrite the requestImage method to use the baseUrl pattern
    _.TMSLayer.prototype.requestImage = function(x, y, level) {
        return Cesium.ImageryProvider.loadImage(this, this._proxy.getURL(this.formatUrl(x, y, level)));
    };

    _.uniTMSLayer = function(globe, baseUrl, copyright, yFlip, swLat, swLng, neLat, neLng) {
        var provider = new _.TMSLayer(baseUrl, copyright, yFlip, swLat, swLng, neLat, neLng);
        this.layer = new Cesium.ImageryLayer(provider);
        globe.addImageryLayer(this.layer);
        this.globe = globe;
        this.globe.addOverlay(this);
    }

    _.uniTMSLayer.prototype = new _.uniLayer;

    function createWMSProvider(globe, baseUrl, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng) {

        if(copyright == null || copyright == undefined) {
            copyright = "";
        }
        var provider = new Cesium.WebMapServiceImageryProvider({
            url: baseUrl,
            layers: layers,
            extent: new Cesium.Rectangle(Cesium.Math.toRadians(swLng), Cesium.Math.toRadians(swLat), Cesium.Math.toRadians(neLng), Cesium.Math.toRadians(neLat)),
            credit: copyright,
            enablePickFeatures: false
        });
        srs = "EPSG:4326";
        var version3 = version.indexOf("1.3") == 0;
        var tileSize = 256;
        var lURL = baseUrl;
        lURL += "REQUEST=GetMap";
        lURL += "&SERVICE=WMS";
        lURL += "&VERSION=" + version;
        lURL += "&LAYERS=" + layers;
        lURL += "&width=" + tileSize;
        lURL += "&height=" + tileSize;
        lURL += "&" + (version3 == true ? "crs" : "srs") + "=" + srs;
        lURL += "&TRANSPARENT=TRUE";
        if (styles) {
            lURL += "&styles=" + styles;
        }
        lURL += "&format=image/png";
        // for the projections that require axis inversion under version 3
        var invertAxisOrder = version3 == true && srs == "EPSG:4326";

        // rewrite the requestImage to handle WMS 1.3.0
        var proxy = new _.Proxy(lURL + "&BBOX=");
        provider.requestImage = function (x, y, level) {
            //create the Bounding box string
            // handles 1.3.0 wms by ordering lat, lng instead of lng, lat
            var bbox;
            var nativeExtent = this._tilingScheme.tileXYToNativeRectangle(x, y, level);
            if (invertAxisOrder) {
                bbox = nativeExtent.south + "," + nativeExtent.west + "," + nativeExtent.north + "," + nativeExtent.east;
            } else {
                bbox = nativeExtent.west + "," + nativeExtent.south + "," + nativeExtent.east + "," + nativeExtent.north;
            }
            //base WMS URL
            return Cesium.ImageryProvider.loadImage(this, proxy.getURL(lURL + "&BBOX=" + bbox)); // set bounding box
        }
        return provider;
    }

    _.uniWMSLayer = function(globe, baseUrl, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng) {
        this.globe = globe;
        this.layer = new Cesium.ImageryLayer(createWMSProvider(globe, baseUrl, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng));
        globe.addImageryLayer(this.layer);
        // keep a record for the clean up
        this.globe.addOverlay(this);
    }

    _.uniWMSLayer.prototype = new _.uniLayer;

    return _;
})();
