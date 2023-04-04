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
        var frameDivMap = document.createElement('div');
        frameDivMap.style.width = "100%";
        frameDivMap.style.height = "100%";
        container.appendChild(frameDivMap);
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

        var defaultMap = mapsIds["Bing Satellite Maps"]
        var imageryProvider = mapId ? mapsIds[mapId] : defaultMap;
        var imageryProvider = imageryProvider ? imageryProvider : defaultMap;
        var cesiumWidget = new Cesium.CesiumWidget(frameDivMap, {
            imageryProvider: imageryProvider,
            scene3DOnly: true
        });

        var scene = cesiumWidget.scene;
        this._scene = scene;

        // add terrain elevation
/*
        var cesiumTerrainProviderHeightmaps = new Cesium.CesiumTerrainProvider({
            url : '//assets.agi.com/stk-terrain/world',
            credit : 'Terrain data courtesy Analytical Graphics, Inc.'
        });
*/
        var cesiumTerrainProviderHeightmaps = Cesium.createWorldTerrain();

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
            scene.camera.setView({destination: Cesium.Cartesian3.fromDegrees(lng, lat, getHeight())});
        }

        gl.getCenter = function() {
            scene.camera.lookDown();
            return _.convertPath([scene.camera.position]);
        }

        gl.setZoomLevel = function(level) {
            var position = getCameraCartographicPosition();
            position.height = convertFromZoom(level);
            scene.camera.setView({destination: Cesium.Cartesian3.fromDegrees(position.longitude, position.latitude, getHeight())});
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
            scene.camera.setView({destination: Cesium.Rectangle.fromDegrees(swLng, swLat, neLng, neLat)});
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

            controlDiv.appendChild(control);

            var positionAlreadySet = control.style.top!="" || control.style.right!="" ||
                control.style.left!="" || control.style.bottom!="";

            if(position && !positionAlreadySet) {

                controlDiv.style.top="";
                controlDiv.style.right="";

                var verticalCenter = (frameDivMap.offsetHeight / 2) - (controlDiv.offsetHeight / 2);
                var horizontalCenter = (frameDivMap.offsetWidth / 2) - (controlDiv.offsetWidth / 2);

                if(position == 'topLeft') {//should be TOP_LEFT, change it if it not used
                    controlDiv.style.left = "0px";
                    controlDiv.style.top = "0px";
                }
                if(position == 'leftCenter') {
                    controlDiv.style.left = "0px";
                    controlDiv.style.top = verticalCenter + "px";
                }
                if(position == 'bottomLeft') { //should be BOTTOM_LEFT, change it if it not used
                    controlDiv.style.left = "0px";
                    controlDiv.style.bottom = "25px"; //should be calculated
                }
                if(position == 'bottomCenter') {
                    controlDiv.style.left = horizontalCenter + "px";
                    controlDiv.style.bottom = "0px";
                }
                if(position == 'bottomRight') {
                    controlDiv.style.right =  "400px"; //should be calculated
                    controlDiv.style.bottom = "0px";
                }
                if(position == 'rightBottom') {
                    controlDiv.style.right =  "0px";
                    controlDiv.style.bottom = "25px"; //should be calculated
                }
                if(position == 'rightCenter') {

                    controlDiv.style.right = "0px";
                    controlDiv.style.top = verticalCenter + "px";
                }
                if(position == 'rightTop') {
                    controlDiv.style.right = "0px";
                    controlDiv.style.top = "25px";//should be calculated
                }
                if(position == 'topRight') {
                    controlDiv.style.right = "0px";
                    controlDiv.style.top = "0px";
                }
                if(position == 'topCenter') {
                    controlDiv.style.left = horizontalCenter + "px";
                    controlDiv.style.top = "0px";
                }
            }
        }

        gl.displayCoordinates = function(display) {

            if(this.coordinatesOverlay == undefined) {
                var _self = this;
                var latLngOverlay = function(frameDivMap) {
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
                    frameDivMap.appendChild(div);
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
            return {x: 0, y: 0};
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
/*
                if(surface._markers != null) {
                    surface._markers.remove();
                    surface._editMarkers.remove();
                    surface._markers = null;
                    surface._editMarkers = null;
                    surface._globeClickhandler.destroy();
*/
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

    _.TMSLayer.prototype = Cesium.createTileMapServiceImageryProvider();

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
            var nativeExtent = this._tileProvider._tilingScheme.tileXYToNativeRectangle(x, y, level);
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

    _.uniWMSLayer.prototype.activateClipping = function(activate) {
        // do nothing as it is not supported yet
    }

    return _;
})();

/**
 * Created by thomas on 9/01/14.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * (c) www.geocento.com
 * www.metaaps.com
 *
 */

var DrawHelper = (function() {

    // static variables
    var ellipsoid = Cesium.Ellipsoid.WGS84;

    // constructor
    function _(cesiumWidget) {
        this._scene = cesiumWidget.scene;
        this._tooltip = createTooltip(cesiumWidget.container);
        this._surfaces = [];

        this.initialiseHandlers();

        this.enhancePrimitives();

    }

    _.prototype.initialiseHandlers = function() {
        var scene = this._scene;
        var _self = this;
        // scene events
        var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
        function callPrimitiveCallback(name, position) {
            if(_self._handlersMuted == true) return;
            var pickedObject = scene.pick(position);
            if(pickedObject && pickedObject.primitive && pickedObject.primitive[name]) {
                pickedObject.primitive[name](position);
            }
        }
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftClick', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftDoubleClick', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        var mouseOutObject;
        handler.setInputAction(
            function (movement) {
                if(_self._handlersMuted == true) return;
                var pickedObject = scene.pick(movement.endPosition);
                if(mouseOutObject && (!pickedObject || mouseOutObject != pickedObject.primitive)) {
                    !(mouseOutObject.isDestroyed && mouseOutObject.isDestroyed()) && mouseOutObject.mouseOut(movement.endPosition);
                    mouseOutObject = null;
                }
                if(pickedObject && pickedObject.primitive) {
                    pickedObject = pickedObject.primitive;
                    if(pickedObject.mouseOut) {
                        mouseOutObject = pickedObject;
                    }
                    if(pickedObject.mouseMove) {
                        pickedObject.mouseMove(movement.endPosition);
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftUp', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_UP);
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftDown', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    }

    _.prototype.setListener = function(primitive, type, callback) {
        primitive[type] = callback;
    }

    _.prototype.muteHandlers = function(muted) {
        this._handlersMuted = muted;
    }

    // register event handling for an editable shape
    // shape should implement setEditMode and setHighlighted
    _.prototype.registerEditableShape = function(surface) {
        var _self = this;

        // handlers for interactions
        // highlight polygon when mouse is entering
        setListener(surface, 'mouseMove', function(position) {
            surface.setHighlighted(true);
            if(!surface._editMode) {
                _self._tooltip.showAt(position, "Click to edit this shape");
            }
        });
        // hide the highlighting when mouse is leaving the polygon
        setListener(surface, 'mouseOut', function(position) {
            surface.setHighlighted(false);
            _self._tooltip.setVisible(false);
        });
        setListener(surface, 'leftClick', function(position) {
            surface.setEditMode(true);
        });
    }

    _.prototype.startDrawing = function(cleanUp) {
        // undo any current edit of shapes
        this.disableAllEditMode();
        // check for cleanUp first
        if(this.editCleanUp) {
            this.editCleanUp();
        }
        this.editCleanUp = cleanUp;
        this.muteHandlers(true);
    }

    _.prototype.stopDrawing = function() {
        // check for cleanUp first
        if(this.editCleanUp) {
            this.editCleanUp();
            this.editCleanUp = null;
        }
        this.muteHandlers(false);
    }

    // make sure only one shape is highlighted at a time
    _.prototype.disableAllHighlights = function() {
        this.setHighlighted(undefined);
    }

    _.prototype.setHighlighted = function(surface) {
        if(this._highlightedSurface && !this._highlightedSurface.isDestroyed() && this._highlightedSurface != surface) {
            this._highlightedSurface.setHighlighted(false);
        }
        this._highlightedSurface = surface;
    }

    _.prototype.disableAllEditMode = function() {
        this.setEdited(undefined);
    }

    _.prototype.setEdited = function(surface) {
        if(this._editedSurface && !this._editedSurface.isDestroyed()) {
            this._editedSurface.setEditMode(false);
        }
        this._editedSurface = surface;
    }

    var material = Cesium.Material.fromType(Cesium.Material.ColorType);
    material.uniforms.color = new Cesium.Color(1.0, 1.0, 0.0, 0.5);

    var defaultShapeOptions = {
        ellipsoid: Cesium.Ellipsoid.WGS84,
        textureRotationAngle: 0.0,
        height: 0.0,
        asynchronous: true,
        show: true,
        debugShowBoundingVolume: false
    }

    var defaultSurfaceOptions = copyOptions(defaultShapeOptions, {
        appearance: new Cesium.EllipsoidSurfaceAppearance({
            aboveGround : false
        }),
        material : material,
        granularity: Math.PI / 180.0
    });

    var defaultPolygonOptions = copyOptions(defaultShapeOptions, {});
    var defaultExtentOptions = copyOptions(defaultShapeOptions, {});
    var defaultCircleOptions = copyOptions(defaultShapeOptions, {});
    var defaultEllipseOptions = copyOptions(defaultSurfaceOptions, {rotation: 0});

    var defaultPolylineOptions = copyOptions(defaultShapeOptions, {
        width: 5,
        geodesic: true,
        granularity: 10000,
        appearance: new Cesium.PolylineMaterialAppearance({
            aboveGround : false
        }),
        material : material
    });

//    Cesium.Polygon.prototype.setStrokeStyle = setStrokeStyle;
//    
//    Cesium.Polygon.prototype.drawOutline = drawOutline;
//

    var ChangeablePrimitive = (function() {
        function _() {
        }

        _.prototype.initialiseOptions = function(options) {

            fillOptions(this, options);

            this._ellipsoid = undefined;
            this._granularity = undefined;
            this._height = undefined;
            this._textureRotationAngle = undefined;
            this._id = undefined;

            // set the flags to initiate a first drawing
            this._createPrimitive = true;
            this._primitive = undefined;
            this._outlinePolygon = undefined;

        }

        _.prototype.setAttribute = function(name, value) {
            this[name] = value;
            this._createPrimitive = true;
        };

        _.prototype.getAttribute = function(name) {
            return this[name];
        };

        /**
         * @private
         */
        _.prototype.update = function(context, frameState, commandList) {

            if (!Cesium.defined(this.ellipsoid)) {
                throw new Cesium.DeveloperError('this.ellipsoid must be defined.');
            }

            if (!Cesium.defined(this.appearance)) {
                throw new Cesium.DeveloperError('this.material must be defined.');
            }

            if (this.granularity < 0.0) {
                throw new Cesium.DeveloperError('this.granularity and scene2D/scene3D overrides must be greater than zero.');
            }

            if (!this.show) {
                return;
            }

            if (!this._createPrimitive && (!Cesium.defined(this._primitive))) {
                // No positions/hierarchy to draw
                return;
            }

            if (this._createPrimitive ||
                (this._ellipsoid !== this.ellipsoid) ||
                (this._granularity !== this.granularity) ||
                (this._height !== this.height) ||
                (this._textureRotationAngle !== this.textureRotationAngle) ||
                (this._id !== this.id)) {

                var geometry = this.getGeometry();
                if(!geometry) {
                    return;
                }

                this._createPrimitive = false;
                this._ellipsoid = this.ellipsoid;
                this._granularity = this.granularity;
                this._height = this.height;
                this._textureRotationAngle = this.textureRotationAngle;
                this._id = this.id;

                this._primitive = this._primitive && this._primitive.destroy();

                this._primitive = new Cesium.Primitive({
                    geometryInstances : new Cesium.GeometryInstance({
                        geometry : geometry,
                        id : this.id,
                        pickPrimitive : this
                    }),
                    appearance : this.appearance,
                    asynchronous : this.asynchronous
                });

                this._outlinePolygon = this._outlinePolygon && this._outlinePolygon.destroy();
                if(this.strokeColor && this.getOutlineGeometry) {
                    // create the highlighting frame
                    this._outlinePolygon = new Cesium.Primitive({
                        geometryInstances : new Cesium.GeometryInstance({
                            geometry : this.getOutlineGeometry(),
                            attributes : {
                                color : Cesium.ColorGeometryInstanceAttribute.fromColor(this.strokeColor)
                            }
                        }),
                        appearance : new Cesium.PerInstanceColorAppearance({
                            flat : true,
                            renderState : {
                                depthTest : {
                                    enabled : true
                                }
/*
                                lineWidth : Math.min(this.strokeWidth || 4.0, context._aliasedLineWidthRange[1])
*/
                            }
                        })
                    });
                }
            }

            var primitive = this._primitive;
            primitive.appearance.material = this.material;
            primitive.debugShowBoundingVolume = this.debugShowBoundingVolume;
            primitive.update(context, frameState, commandList);
            this._outlinePolygon && this._outlinePolygon.update(context, frameState, commandList);

        };

        _.prototype.isDestroyed = function() {
            return false;
        };

        _.prototype.destroy = function() {
            this._primitive = this._primitive && this._primitive.destroy();
            return Cesium.destroyObject(this);
        };

        _.prototype.setStrokeStyle = function(strokeColor, strokeWidth) {
            if(!this.strokeColor || !this.strokeColor.equals(strokeColor) || this.strokeWidth != strokeWidth) {
                this._createPrimitive = true;
                this.strokeColor = strokeColor;
                this.strokeWidth = strokeWidth;
            }
        }

        return _;
    })();

    _.ExtentPrimitive = (function() {
        function _(options) {

            if(!Cesium.defined(options.extent)) {
                throw new Cesium.DeveloperError('Extent is required');
            }

            options = copyOptions(options, defaultSurfaceOptions);

            this.initialiseOptions(options);

            this.setExtent(options.extent);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setExtent = function(extent) {
            this.setAttribute('extent', extent);
        };

        _.prototype.getExtent = function() {
            return this.getAttribute('extent');
        };

        _.prototype.getGeometry = function() {

            if (!Cesium.defined(this.extent)) {
                return;
            }

            return new Cesium.RectangleGeometry({
                rectangle : this.extent,
                height : this.height,
                vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation : this.textureRotationAngle,
                ellipsoid : this.ellipsoid,
                granularity : this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return new Cesium.RectangleOutlineGeometry({
                rectangle: this.extent
            });
        }

        return _;
    })();

    _.PolygonPrimitive = (function() {

        function _(options) {

            options = copyOptions(options, defaultSurfaceOptions);

            this.initialiseOptions(options);

            this.isPolygon = true;

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setPositions = function(positions) {
            this.setAttribute('positions', positions);
        };

        _.prototype.getPositions = function() {
            return this.getAttribute('positions');
        };

        _.prototype.getGeometry = function() {

            if (!Cesium.defined(this.positions) || this.positions.length < 3) {
                return;
            }

            return Cesium.PolygonGeometry.fromPositions({
                positions : this.positions,
                height : this.height,
                vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation : this.textureRotationAngle,
                ellipsoid : this.ellipsoid,
                granularity : this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return Cesium.PolygonOutlineGeometry.fromPositions({
                positions : this.getPositions()
            });
        }

        return _;
    })();

    _.CirclePrimitive = (function() {

        function _(options) {

            if(!(Cesium.defined(options.center) && Cesium.defined(options.radius))) {
                throw new Cesium.DeveloperError('Center and radius are required');
            }

            options = copyOptions(options, defaultSurfaceOptions);

            this.initialiseOptions(options);

            this.setRadius(options.radius);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setCenter = function(center) {
            this.setAttribute('center', center);
        };

        _.prototype.setRadius = function(radius) {
            this.setAttribute('radius', Math.max(0.1, radius));
        };

        _.prototype.getCenter = function() {
            return this.getAttribute('center');
        };

        _.prototype.getRadius = function() {
            return this.getAttribute('radius');
        };

        _.prototype.getGeometry = function() {

            if (!(Cesium.defined(this.center) && Cesium.defined(this.radius))) {
                return;
            }

            return new Cesium.CircleGeometry({
                center : this.center,
                radius : this.radius,
                height : this.height,
                vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation : this.textureRotationAngle,
                ellipsoid : this.ellipsoid,
                granularity : this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return new Cesium.CircleOutlineGeometry({
                center: this.getCenter(),
                radius: this.getRadius()
            });
        }

        return _;
    })();

    _.EllipsePrimitive = (function() {
        function _(options) {

            if(!(Cesium.defined(options.center) && Cesium.defined(options.semiMajorAxis) && Cesium.defined(options.semiMinorAxis))) {
                throw new Cesium.DeveloperError('Center and semi major and semi minor axis are required');
            }

            options = copyOptions(options, defaultEllipseOptions);

            this.initialiseOptions(options);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setCenter = function(center) {
            this.setAttribute('center', center);
        };

        _.prototype.setSemiMajorAxis = function(semiMajorAxis) {
            if(semiMajorAxis < this.getSemiMinorAxis()) return;
            this.setAttribute('semiMajorAxis', semiMajorAxis);
        };

        _.prototype.setSemiMinorAxis = function(semiMinorAxis) {
            if(semiMinorAxis > this.getSemiMajorAxis()) return;
            this.setAttribute('semiMinorAxis', semiMinorAxis);
        };

        _.prototype.setRotation = function(rotation) {
            return this.setAttribute('rotation', rotation);
        };

        _.prototype.getCenter = function() {
            return this.getAttribute('center');
        };

        _.prototype.getSemiMajorAxis = function() {
            return this.getAttribute('semiMajorAxis');
        };

        _.prototype.getSemiMinorAxis = function() {
            return this.getAttribute('semiMinorAxis');
        };

        _.prototype.getRotation = function() {
            return this.getAttribute('rotation');
        };

        _.prototype.getGeometry = function() {

            if(!(Cesium.defined(this.center) && Cesium.defined(this.semiMajorAxis) && Cesium.defined(this.semiMinorAxis))) {
                return;
            }

            return new Cesium.EllipseGeometry({
                ellipsoid : this.ellipsoid,
                center : this.center,
                semiMajorAxis : this.semiMajorAxis,
                semiMinorAxis : this.semiMinorAxis,
                rotation : this.rotation,
                height : this.height,
                vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation : this.textureRotationAngle,
                ellipsoid : this.ellipsoid,
                granularity : this.granularity
            });
        };

        _.prototype.getOutlineGeometry = function() {
            return new Cesium.EllipseOutlineGeometry({
                center: this.getCenter(),
                semiMajorAxis: this.getSemiMajorAxis(),
                semiMinorAxis: this.getSemiMinorAxis(),
                rotation: this.getRotation()
            });
        }

        return _;
    })();

    _.PolylinePrimitive = (function() {

        function _(options) {

            options = copyOptions(options, defaultPolylineOptions);

            this.initialiseOptions(options);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setPositions = function(positions) {
            this.setAttribute('positions', positions);
        };

        _.prototype.setWidth = function(width) {
            this.setAttribute('width', width);
        };

        _.prototype.setGeodesic = function(geodesic) {
            this.setAttribute('geodesic', geodesic);
        };

        _.prototype.getPositions = function() {
            return this.getAttribute('positions');
        };

        _.prototype.getWidth = function() {
            return this.getAttribute('width');
        };

        _.prototype.getGeodesic = function(geodesic) {
            return this.getAttribute('geodesic');
        };

        _.prototype.getGeometry = function() {

            if (!Cesium.defined(this.positions) || this.positions.length < 2) {
                return;
            }

            return new Cesium.PolylineGeometry({
                positions: this.positions,
                height : this.height,
                width: this.width < 1 ? 1 : this.width,
                vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                ellipsoid : this.ellipsoid
            });
        }

        return _;
    })();

    var defaultBillboard = {
        iconUrl: "./img/dragIcon.png",
        shiftX: 0,
        shiftY: 0
    }

    var dragBillboard = {
        iconUrl: "./img/dragIcon.png",
        shiftX: 0,
        shiftY: 0
    }

    var dragHalfBillboard = {
        iconUrl: "./img/dragIconLight.png",
        shiftX: 0,
        shiftY: 0
    }

    _.prototype.createBillboardGroup = function(points, options, callbacks) {
        var markers = new _.BillboardGroup(this, options);
        markers.addBillboards(points, callbacks);
        return markers;
    }

    _.BillboardGroup = function(drawHelper, options) {

        this._drawHelper = drawHelper;
        this._scene = drawHelper._scene;

        this._options = copyOptions(options, defaultBillboard);

        // create one common billboard collection for all billboards
        var b = new Cesium.BillboardCollection();
        this._scene.primitives.add(b);
        this._billboards = b;
        // keep an ordered list of billboards
        this._orderedBillboards = [];
    }

    _.BillboardGroup.prototype.createBillboard = function(position, callbacks) {

        var billboard = this._billboards.add({
            show : true,
            position : position,
            pixelOffset : new Cesium.Cartesian2(this._options.shiftX, this._options.shiftY),
            eyeOffset : new Cesium.Cartesian3(0.0, 0.0, 0.0),
            horizontalOrigin : Cesium.HorizontalOrigin.CENTER,
            verticalOrigin : Cesium.VerticalOrigin.CENTER,
            scale : 1.0,
            image: this._options.iconUrl,
            color : new Cesium.Color(1.0, 1.0, 1.0, 1.0)
        });

        // if editable
        if(callbacks) {
            var _self = this;
            var screenSpaceCameraController = this._scene.screenSpaceCameraController;
            function enableRotation(enable) {
                screenSpaceCameraController.enableRotate = enable;
            }
            function getIndex() {
                // find index
                for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                return i;
            }
            if(callbacks.dragHandlers) {
                var _self = this;
                setListener(billboard, 'leftDown', function(position) {
                    // TODO - start the drag handlers here
                    // create handlers for mouseOut and leftUp for the billboard and a mouseMove
                    function onDrag(position) {
                        billboard.position = position;
                        // find index
                        for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                        callbacks.dragHandlers.onDrag && callbacks.dragHandlers.onDrag(getIndex(), position);
                    }
                    function onDragEnd(position) {
                        handler.destroy();
                        enableRotation(true);
                        callbacks.dragHandlers.onDragEnd && callbacks.dragHandlers.onDragEnd(getIndex(), position);
                    }

                    var handler = new Cesium.ScreenSpaceEventHandler(_self._scene.canvas);

                    handler.setInputAction(function(movement) {
                        var cartesian = _self._scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                        if (cartesian) {
                            onDrag(cartesian);
                        } else {
                            onDragEnd(cartesian);
                        }
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                    handler.setInputAction(function(movement) {
                        onDragEnd(_self._scene.camera.pickEllipsoid(movement.position, ellipsoid));
                    }, Cesium.ScreenSpaceEventType.LEFT_UP);

                    enableRotation(false);

                    callbacks.dragHandlers.onDragStart && callbacks.dragHandlers.onDragStart(getIndex(), _self._scene.camera.pickEllipsoid(position, ellipsoid));
                });
            }
            if(callbacks.onDoubleClick) {
                setListener(billboard, 'leftDoubleClick', function(position) {
                    callbacks.onDoubleClick(getIndex());
                });
            }
            if(callbacks.onClick) {
                setListener(billboard, 'leftClick', function(position) {
                    callbacks.onClick(getIndex());
                });
            }
            if(callbacks.tooltip) {
                setListener(billboard, 'mouseMove', function(position) {
                    _self._drawHelper._tooltip.showAt(position, callbacks.tooltip());
                });
                setListener(billboard, 'mouseOut', function(position) {
                    _self._drawHelper._tooltip.setVisible(false);
                });
            }
        }

        return billboard;
    }

    _.BillboardGroup.prototype.insertBillboard = function(index, position, callbacks) {
        this._orderedBillboards.splice(index, 0, this.createBillboard(position, callbacks));
    }

    _.BillboardGroup.prototype.addBillboard = function(position, callbacks) {
        this._orderedBillboards.push(this.createBillboard(position, callbacks));
    }

    _.BillboardGroup.prototype.addBillboards = function(positions, callbacks) {
        var index =  0;
        for(; index < positions.length; index++) {
            this.addBillboard(positions[index], callbacks);
        }
    }

    _.BillboardGroup.prototype.updateBillboardsPositions = function(positions) {
        var index =  0;
        for(; index < positions.length; index++) {
            this.getBillboard(index).position = positions[index];
        }
    }

    _.BillboardGroup.prototype.countBillboards = function() {
        return this._orderedBillboards.length;
    }

    _.BillboardGroup.prototype.getBillboard = function(index) {
        return this._orderedBillboards[index];
    }

    _.BillboardGroup.prototype.removeBillboard = function(index) {
        this._billboards.remove(this.getBillboard(index));
        this._orderedBillboards.splice(index, 1);
    }

    _.BillboardGroup.prototype.remove = function() {
        this._billboards = this._billboards && this._billboards.removeAll() && this._billboards.destroy();
    }

    _.BillboardGroup.prototype.setOnTop = function() {
        this._scene.primitives.raiseToTop(this._billboards);
    }

    _.prototype.startDrawingMarker = function(options) {

        var options = copyOptions(options, defaultBillboard);

        this.startDrawing(
            function() {
                markers.remove();
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = scene.primitives;
        var tooltip = this._tooltip;

        var markers = new _.BillboardGroup(this, options);

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    markers.addBillboard(cartesian);
                    _self.stopDrawing();
                    options.callback(cartesian);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                if (cartesian) {
                    tooltip.showAt(position, "<p>Click to add your marker. Position is: </p>" + getDisplayLatLngString(ellipsoid.cartesianToCartographic(cartesian)));
                } else {
                    tooltip.showAt(position, "<p>Click on the globe to add your marker.</p>");
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    function copyDrawingOptions(options, defaultOptions) {
        var options = copyOptions(options, defaultOptions);
        if(options.fillColor) {
            options.material.uniforms.color = Cesium.Color.fromCssColorString(options.fillColor);
            options.material.uniforms.color.alpha = options.fillOpacity == undefined ? 0.5 : options.fillOpacity;
        }
        var color = Cesium.Color.fromCssColorString(options.strokeColor);
        color.alpha = options.strokeOpacity || 1.0;
        options.strokeColor = color;
        return options;
    }

    _.prototype.startDrawingPolygon = function(options) {
        var options = copyOptions(options, defaultSurfaceOptions);
        this.startDrawingPolyshape(true, options);
    }

    _.prototype.startDrawingPolyline = function(options) {
        var options = copyOptions(options, defaultPolylineOptions);
        this.startDrawingPolyshape(false, options);
    }

    _.prototype.startDrawingPolyshape = function(isPolygon, options) {

        var options = copyDrawingOptions(options, defaultShapeOptions);

        this.startDrawing(
            function() {
                primitives.remove(poly);
                markers.remove();
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = scene.primitives;
        var tooltip = this._tooltip;

        var minPoints = isPolygon ? 3 : 2;
        var poly;
        if(isPolygon) {
            poly = new DrawHelper.PolygonPrimitive(options);
        } else {
            poly = new DrawHelper.PolylinePrimitive(options);
        }
        poly.setStrokeStyle(options.strokeColor, options.strokeThickness || 2);
        poly.asynchronous = false;
        primitives.add(poly);

        var positions = [];
        var markers = new _.BillboardGroup(this, defaultBillboard);

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    // first click
                    if(positions.length == 0) {
                        positions.push(cartesian.clone());
                        markers.addBillboard(positions[0]);
                    }
                    if(positions.length >= minPoints) {
                        poly.positions = positions;
                        poly._createPrimitive = true;
                    }
                    // add new point to polygon
                    // this one will move with the mouse
                    positions.push(cartesian);
                    // add marker at the new position
                    markers.addBillboard(cartesian);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                if(positions.length == 0) {
                    tooltip.showAt(position, "<p>Click to add first point</p>");
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        positions.pop();
                        // make sure it is slightly different
                        cartesian.y += (1 + Math.random());
                        positions.push(cartesian);
                        if(positions.length >= minPoints) {
                            poly.positions = positions;
                            poly._createPrimitive = true;
                        }
                        // update marker
                        markers.getBillboard(positions.length - 1).position = cartesian;
                        // show tooltip
                        tooltip.showAt(position, "<p>Click to add new point (" + positions.length + ")</p>" + (positions.length > minPoints ? "<p>Double click to finish drawing</p>" : ""));
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.position;
            if(position != null) {
                if(positions.length < minPoints + 2) {
                    return;
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        _self.stopDrawing();
                        if(typeof options.callback == 'function') {
                            // remove overlapping ones
                            var index = positions.length - 1;
                            // TODO - calculate some epsilon based on the zoom level
                            var epsilon = Cesium.Math.EPSILON3;
                            for(; index > 0 && positions[index].equalsEpsilon(positions[index - 1], epsilon); index--) {}
                            options.callback(positions.splice(0, index + 1));
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    }

    function getExtentCorners(value) {
        return ellipsoid.cartographicArrayToCartesianArray([Cesium.Rectangle.northwest(value), Cesium.Rectangle.northeast(value), Cesium.Rectangle.southeast(value), Cesium.Rectangle.southwest(value)]);
    }

    _.prototype.startDrawingExtent = function(options) {

        var options = copyDrawingOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function() {
                if(extent != null) {
                    primitives.remove(extent);
                }
                markers.remove();
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.primitives;
        var tooltip = this._tooltip;

        var firstPoint = null;
        var extent = null;
        var markers = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        function updateExtent(value) {
            if(extent == null) {
                options.extent = value;
                extent = new DrawHelper.ExtentPrimitive(options);
                extent.setStrokeStyle(options.strokeColor, options.strokeThickness);
                extent.asynchronous = false;
                primitives.add(extent);
            }
            extent.setExtent(value);
            // update the markers
            var corners = getExtentCorners(value);
            // create if they do not yet exist
            if(markers == null) {
                markers = new _.BillboardGroup(_self, defaultBillboard);
                markers.addBillboards(corners);
            } else {
                markers.updateBillboardsPositions(corners);
            }
        }

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if(extent == null) {
                        // create the rectangle
                        firstPoint = ellipsoid.cartesianToCartographic(cartesian);
                        var value = getExtent(firstPoint, firstPoint);
                        updateExtent(value);
                    } else {
                        _self.stopDrawing();
                        if(typeof options.callback == 'function') {
                            options.callback(getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian)));
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                if(extent == null) {
                    tooltip.showAt(position, "<p>Click to start drawing rectangle</p>");
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        var value = getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian));
                        updateExtent(value);
                        tooltip.showAt(position, "<p>Drag to change rectangle extent</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    _.prototype.startDrawingZoomExtent = function(point, options) {

        var options = copyDrawingOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function() {
                if(extent != null) {
                    primitives.remove(extent);
                }
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.primitives;
        var tooltip = this._tooltip;

        var firstPoint = point;
        var extent = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        function updateExtent(value) {
            if(extent == null) {
                options.extent = value;
                extent = new DrawHelper.ExtentPrimitive(options);
                extent.setStrokeStyle(options.strokeColor, options.strokeThickness);
                extent.asynchronous = false;
                primitives.add(extent);
            }
            extent.setExtent(value);
        }

        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    _self.stopDrawing();
                    if(options.callback) {
                        options.callback(getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian)));
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_UP);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                if (cartesian) {
                    var value = getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian));
                    updateExtent(value);
                    tooltip.showAt(position, "<p>Drag to change zoom extent</p><p>Release to zoom</p>");
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        var value = getExtent(firstPoint, firstPoint);
        updateExtent(value);
    }

    _.prototype.startDrawingCircle = function(options) {

        var options = copyDrawingOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function cleanUp() {
                if(circle != null) {
                    primitives.remove(circle);
                }
                markers.remove();
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.primitives;
        var tooltip = this._tooltip;

        var circle = null;
        var markers = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.camera.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if(circle == null) {
                        // create the circle
                        circle = new _.CirclePrimitive({
                            center: cartesian,
                            radius: 0,
                            asynchronous: false,
                            material : options.material
                        });
                        circle.setStrokeStyle(options.strokeColor, options.strokeThickness);
                        primitives.add(circle);
                        markers = new _.BillboardGroup(_self, defaultBillboard);
                        markers.addBillboards([cartesian]);
                    } else {
                        if(typeof options.callback == 'function') {
                            options.callback(circle.getCenter(), circle.getRadius());
                        }
                        _self.stopDrawing();
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                if(circle == null) {
                    tooltip.showAt(position, "<p>Click to start drawing the circle</p>");
                } else {
                    var cartesian = scene.camera.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        circle.setRadius(Cesium.Cartesian3.distance(circle.getCenter(), cartesian));
                        markers.updateBillboardsPositions(cartesian);
                        tooltip.showAt(position, "<p>Move mouse to change circle radius</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    _.prototype.enhancePrimitives = function() {

        var drawHelper = this;

        Cesium.Billboard.prototype.setEditable = function() {

            if(this._editable) {
                return;
            }

            this._editable = true;

            var billboard = this;

            var _self = this;

            function enableRotation(enable) {
                drawHelper._scene.screenSpaceCameraController.enableRotate = enable;
            }

            setListener(billboard, 'leftDown', function(position) {
                // TODO - start the drag handlers here
                // create handlers for mouseOut and leftUp for the billboard and a mouseMove
                function onDrag(position) {
                    billboard.position = position;
                    _self.executeListeners({name: 'drag', positions: position});
                }
                function onDragEnd(position) {
                    handler.destroy();
                    enableRotation(true);
                    _self.executeListeners({name: 'dragEnd', positions: position});
                }

                var handler = new Cesium.ScreenSpaceEventHandler(drawHelper._scene.canvas);

                handler.setInputAction(function(movement) {
                    var cartesian = drawHelper._scene.camera.pickEllipsoid(movement.endPosition, ellipsoid);
                    if (cartesian) {
                        onDrag(cartesian);
                    } else {
                        onDragEnd(cartesian);
                    }
                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                handler.setInputAction(function(movement) {
                    onDragEnd(drawHelper._scene.camera.pickEllipsoid(movement.position, ellipsoid));
                }, Cesium.ScreenSpaceEventType.LEFT_UP);

                enableRotation(false);

            });

            enhanceWithListeners(billboard);

        }

        function setHighlighted(highlighted) {

            var scene = drawHelper._scene;

            // if no change
            // if already highlighted, the outline polygon will be available
            if(this._highlighted && this._highlighted == highlighted) {
                return;
            }
            // disable if already in edit mode
            if(this._editMode === true) {
                return;
            }
            this._highlighted = highlighted;
            // highlight by creating an outline polygon matching the polygon points
            if(highlighted) {
                // make sure all other shapes are not highlighted
                drawHelper.setHighlighted(this);
                this._strokeColor = this.strokeColor;
                this.setStrokeStyle(Cesium.Color.fromCssColorString('white'), this.strokeWidth);
            } else {
                if(this._strokeColor) {
                    this.setStrokeStyle(this._strokeColor, this.strokeWidth);
                } else {
                    this.setStrokeStyle(undefined, undefined);
                }
            }
        }

        function setEditMode(editMode) {
            // if no change
            if(this._editMode == editMode) {
                return;
            }
            // make sure all other shapes are not in edit mode before starting the editing of this shape
            drawHelper.disableAllHighlights();
            // display markers
            if(editMode) {
                drawHelper.setEdited(this);
                var scene = drawHelper._scene;
                var _self = this;
                // create the markers and handlers for the editing
                if(this._markers == null) {
                    var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                    var editMarkers = new _.BillboardGroup(drawHelper, dragHalfBillboard);
                    // function for updating the edit markers around a certain point
                    function updateHalfMarkers(index, positions) {
                        // update the half markers before and after the index
                        var editIndex = index - 1 < 0 ? positions.length - 1 : index - 1;
                        if(editIndex < editMarkers.countBillboards()) {
                            editMarkers.getBillboard(editIndex).position = calculateHalfMarkerPosition(editIndex);
                        }
                        editIndex = index;
                        if(editIndex < editMarkers.countBillboards()) {
                            editMarkers.getBillboard(editIndex).position = calculateHalfMarkerPosition(editIndex);
                        }
                    }
                    function onEdited() {
                        _self.executeListeners({name: 'onEdited', positions: _self.positions});
                    }
                    var handleMarkerChanges = {
                        dragHandlers: {
                            onDrag: function(index, position) {
                                _self.positions[index] = position;
                                updateHalfMarkers(index, _self.positions);
                                _self._createPrimitive = true;
                            },
                            onDragEnd: function(index, position) {
                                _self._createPrimitive = true;
                                onEdited();
                            }
                        },
                        onDoubleClick: function(index) {
                            if(_self.positions.length < 4) {
                                return;
                            }
                            // remove the point and the corresponding markers
                            _self.positions.splice(index, 1);
                            _self._createPrimitive = true;
                            markers.removeBillboard(index);
                            editMarkers.removeBillboard(index);
                            updateHalfMarkers(index, _self.positions);
                            onEdited();
                        },
                        tooltip: function() {
                            if(_self.positions.length > 3) {
                                return "Double click to remove this point";
                            }
                        }
                    };
                    // add billboards and keep an ordered list of them for the polygon edges
                    markers.addBillboards(_self.positions, handleMarkerChanges);
                    this._markers = markers;
                    function calculateHalfMarkerPosition(index) {
                        var positions = _self.positions;
                        return ellipsoid.cartographicToCartesian(
                            new Cesium.EllipsoidGeodesic(ellipsoid.cartesianToCartographic(positions[index]),
                                ellipsoid.cartesianToCartographic(positions[index < positions.length - 1 ? index + 1 : 0])).
                                interpolateUsingFraction(0.5)
                        );
                    }
                    var halfPositions = [];
                    var index = 0;
                    var length = _self.positions.length + (this.isPolygon ? 0 : -1);
                    for(; index < length; index++) {
                        halfPositions.push(calculateHalfMarkerPosition(index));
                    }
                    var handleEditMarkerChanges = {
                        dragHandlers: {
                            onDragStart: function(index, position) {
                                // add a new position to the polygon but not a new marker yet
                                this.index = index + 1;
                                _self.positions.splice(this.index, 0, position);
                                _self._createPrimitive = true;
                            },
                            onDrag: function(index, position) {
                                _self.positions[this.index] = position;
                                _self._createPrimitive = true;
                            },
                            onDragEnd: function(index, position) {
                                // create new sets of makers for editing
                                markers.insertBillboard(this.index, position, handleMarkerChanges);
                                editMarkers.getBillboard(this.index - 1).position = calculateHalfMarkerPosition(this.index - 1);
                                editMarkers.insertBillboard(this.index, calculateHalfMarkerPosition(this.index), handleEditMarkerChanges);
                                _self._createPrimitive = true;
                                onEdited();
                            }
                        },
                        tooltip: function() {
                            return "Drag to create a new point";
                        }
                    };
                    editMarkers.addBillboards(halfPositions, handleEditMarkerChanges);
                    this._editMarkers = editMarkers;
                    // add a handler for clicking in the globe
                    this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                    this._globeClickhandler.setInputAction(
                        function (movement) {
                            var pickedObject = scene.pick(movement.position);
                            if(!(pickedObject && pickedObject.primitive)) {
                                _self.setEditMode(false);
                            }
                        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                    // set on top of the polygon
                    markers.setOnTop();
                    editMarkers.setOnTop();
                }
                this._editMode = true;
            } else {
                if(this._markers != null) {
                    this._markers.remove();
                    this._editMarkers.remove();
                    this._markers = null;
                    this._editMarkers = null;
                    this._globeClickhandler.destroy();
                }
                this._editMode = false;
            }

        }

        DrawHelper.PolylinePrimitive.prototype.setEditable = function() {

            if(this.setEditMode) {
                return;
            }

/*
            this.dragBillboard = options && options.dragBillboard ? options.dragBillboard : dragBillboard;

*/
            var polyline = this;
            polyline.isPolygon = false;
            polyline.asynchronous = false;

            drawHelper.registerEditableShape(polyline);

            polyline.setEditMode = setEditMode;

            var originalWidth = this.width;

            polyline.setHighlighted = function(highlighted) {
                // disable if already in edit mode
                if(this._editMode === true) {
                    return;
                }
                if(highlighted) {
                    drawHelper.setHighlighted(this);
                    this.setWidth(originalWidth * 2);
                } else {
                    this.setWidth(originalWidth);
                }
            }

            polyline.getExtent = function() {
                return Cesium.Extent.fromCartographicArray(ellipsoid.cartesianArrayToCartographicArray(this.positions));
            }

            enhanceWithListeners(polyline);

            polyline.setEditMode(false);

        }

        DrawHelper.PolygonPrimitive.prototype.setEditable = function() {

            var polygon = this;
            polygon.asynchronous = false;

            var scene = drawHelper._scene;

            drawHelper.registerEditableShape(polygon);

            polygon.setEditMode = setEditMode;

            polygon.setHighlighted = setHighlighted;

            enhanceWithListeners(polygon);

            polygon.setEditMode(false);

        }

        DrawHelper.ExtentPrimitive.prototype.setEditable = function() {

            if(this.setEditMode) {
                return;
            }

            var extent = this;
            var scene = drawHelper._scene;

            drawHelper.registerEditableShape(extent);
            extent.asynchronous = false;

            extent.setEditMode = function(editMode) {
                // if no change
                if(this._editMode == editMode) {
                    return;
                }
                drawHelper.disableAllHighlights();
                // display markers
                if(editMode) {
                    // make sure all other shapes are not in edit mode before starting the editing of this shape
                    drawHelper.setEdited(this);
                    // create the markers and handlers for the editing
                    if(this._markers == null) {
                        var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                        function onEdited() {
                            extent.executeListeners({name: 'onEdited', extent: extent.extent});
                        }
                        var handleMarkerChanges = {
                            dragHandlers: {
                                onDrag: function(index, position) {
                                    var corner = markers.getBillboard((index + 2) % 4).position;
                                    extent.setExtent(getExtent(ellipsoid.cartesianToCartographic(corner), ellipsoid.cartesianToCartographic(position)));
                                    markers.updateBillboardsPositions(getExtentCorners(extent.extent));
                                },
                                onDragEnd: function(index, position) {
                                    onEdited();
                                }
                            },
                            tooltip: function() {
                                return "Drag to change the corners of this extent";
                            }
                        };
                        markers.addBillboards(getExtentCorners(extent.extent), handleMarkerChanges);
                        this._markers = markers;
                        // add a handler for clicking in the globe
                        this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                        this._globeClickhandler.setInputAction(
                            function (movement) {
                                var pickedObject = scene.pick(movement.position);
                                // disable edit if pickedobject is different or not an object
                                if(!(pickedObject && !pickedObject.isDestroyed() && pickedObject.primitive)) {
                                    extent.setEditMode(false);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                        // set on top of the polygon
                        markers.setOnTop();
                    }
                    this._editMode = true;
                } else {
                    if(this._markers != null) {
                        this._markers.remove();
                        this._markers = null;
                        this._globeClickhandler.destroy();
                    }
                    this._editMode = false;
                }
            }

            extent.setHighlighted = setHighlighted;

            enhanceWithListeners(extent);

            extent.setEditMode(false);

        }

        _.EllipsePrimitive.prototype.setEditable = function() {

            if(this.setEditMode) {
                return;
            }

            var ellipse = this;
            var scene = drawHelper._scene;

            ellipse.asynchronous = false;

            drawHelper.registerEditableShape(ellipse);

            ellipse.setEditMode = function(editMode) {
                // if no change
                if(this._editMode == editMode) {
                    return;
                }
                drawHelper.disableAllHighlights();
                // display markers
                if(editMode) {
                    // make sure all other shapes are not in edit mode before starting the editing of this shape
                    drawHelper.setEdited(this);
                    var _self = this;
                    // create the markers and handlers for the editing
                    if(this._markers == null) {
                        var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                        function getMarkerPositions() {
                            return Cesium.Shapes.computeEllipseBoundary(ellipsoid, ellipse.getCenter(), ellipse.getSemiMajorAxis(), ellipse.getSemiMinorAxis(), ellipse.getRotation() + Math.PI / 2, Math.PI / 2.0).splice(0, 4);
                        }
                        function onEdited() {
                            ellipse.executeListeners({name: 'onEdited', center: ellipse.getCenter(), semiMajorAxis: ellipse.getSemiMajorAxis(), semiMinorAxis: ellipse.getSemiMinorAxis(), rotation: 0});
                        }
                        var handleMarkerChanges = {
                            dragHandlers: {
                                onDrag: function(index, position) {
                                    var distance = Cesium.Cartesian3.distance(ellipse.getCenter(), position);
                                    if(index%2 == 0) {
                                        ellipse.setSemiMajorAxis(distance);
                                    } else {
                                        ellipse.setSemiMinorAxis(distance);
                                    }
                                    markers.updateBillboardsPositions(getMarkerPositions());
                                },
                                onDragEnd: function(index, position) {
                                    onEdited();
                                }
                            },
                            tooltip: function() {
                                return "Drag to change the excentricity and radius";
                            }
                        };
                        markers.addBillboards(getMarkerPositions(), handleMarkerChanges);
                        this._markers = markers;
                        // add a handler for clicking in the globe
                        this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                        this._globeClickhandler.setInputAction(
                            function (movement) {
                                var pickedObject = scene.pick(movement.position);
                                if(!(pickedObject && pickedObject.primitive)) {
                                    _self.setEditMode(false);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                        // set on top of the polygon
                        markers.setOnTop();
                    }
                    this._editMode = true;
                } else {
                    if(this._markers != null) {
                        this._markers.remove();
                        this._markers = null;
                        this._globeClickhandler.destroy();
                    }
                    this._editMode = false;
                }
            }

            ellipse.setHighlighted = setHighlighted;

            enhanceWithListeners(ellipse);

            ellipse.setEditMode(false);
        }

        _.CirclePrimitive.prototype.getCircleCartesianCoordinates = function (granularity) {
            var geometry = Cesium.CircleOutlineGeometry.createGeometry(new Cesium.CircleOutlineGeometry({ellipsoid: ellipsoid, center: this.getCenter(), radius: this.getRadius(), granularity: granularity}));
            var count = 0, value, values = [];
            for(; count < geometry.attributes.position.values.length; count+=3) {
                value = geometry.attributes.position.values;
                values.push(new Cesium.Cartesian3(value[count], value[count + 1], value[count + 2]));
            }
            return values;
        };

        _.CirclePrimitive.prototype.setEditable = function() {

            if(this.setEditMode) {
                return;
            }

            var circle = this;
            var scene = drawHelper._scene;

            circle.asynchronous = false;

            drawHelper.registerEditableShape(circle);

            circle.setEditMode = function(editMode) {
                // if no change
                if(this._editMode == editMode) {
                    return;
                }
                drawHelper.disableAllHighlights();
                // display markers
                if(editMode) {
                    // make sure all other shapes are not in edit mode before starting the editing of this shape
                    drawHelper.setEdited(this);
                    var _self = this;
                    // create the markers and handlers for the editing
                    if(this._markers == null) {
                        var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                        function getMarkerPositions() {
                            return _self.getCircleCartesianCoordinates(Cesium.Math.PI_OVER_TWO);
                        }
                        function onEdited() {
                            circle.executeListeners({name: 'onEdited', center: circle.getCenter(), radius: circle.getRadius()});
                        }
                        var handleMarkerChanges = {
                            dragHandlers: {
                                onDrag: function(index, position) {
                                    circle.setRadius(Cesium.Cartesian3.distance(circle.getCenter(), position));
                                    markers.updateBillboardsPositions(getMarkerPositions());
                                },
                                onDragEnd: function(index, position) {
                                    onEdited();
                                }
                            },
                            tooltip: function() {
                                return "Drag to change the radius";
                            }
                        };
                        markers.addBillboards(getMarkerPositions(), handleMarkerChanges);
                        this._markers = markers;
                        // add a handler for clicking in the globe
                        this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
                        this._globeClickhandler.setInputAction(
                            function (movement) {
                                var pickedObject = scene.pick(movement.position);
                                if(!(pickedObject && pickedObject.primitive)) {
                                    _self.setEditMode(false);
                                }
                            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                        // set on top of the polygon
                        markers.setOnTop();
                    }
                    this._editMode = true;
                } else {
                    if(this._markers != null) {
                        this._markers.remove();
                        this._markers = null;
                        this._globeClickhandler.destroy();
                    }
                    this._editMode = false;
                }
            }

            circle.setHighlighted = setHighlighted;

            enhanceWithListeners(circle);

            circle.setEditMode(false);
        }

    }

    _.DrawHelperWidget = (function() {

        // constructor
        function _(drawHelper, options) {

            // container must be specified
            if(!(Cesium.defined(options.container))) {
                throw new Cesium.DeveloperError('Container is required');
            }

            var drawOptions = {
                markerIcon: "./img/glyphicons_242_google_maps.png",
                polylineIcon: "./img/glyphicons_097_vector_path_line.png",
                polygonIcon: "./img/glyphicons_096_vector_path_polygon.png",
                circleIcon: "./img/glyphicons_095_vector_path_circle.png",
                extentIcon: "./img/glyphicons_094_vector_path_square.png",
                clearIcon: "./img/glyphicons_067_cleaning.png",
                polylineDrawingOptions: defaultPolylineOptions,
                polygonDrawingOptions: defaultPolygonOptions,
                extentDrawingOptions: defaultExtentOptions,
                circleDrawingOptions: defaultCircleOptions
            };

            fillOptions(options, drawOptions);

            var _self = this;

            var toolbar = document.createElement('DIV');
            toolbar.className = "toolbar";
            options.container.appendChild(toolbar);

            function addIcon(id, url, title, callback) {
                var div = document.createElement('DIV');
                div.className = 'button';
                div.title = title;
                toolbar.appendChild(div);
                div.onclick = callback;
                var span = document.createElement('SPAN');
                div.appendChild(span);
                var image = document.createElement('IMG');
                image.src = url;
                span.appendChild(image);
                return div;
            }

            var scene = drawHelper._scene;

            addIcon('marker', options.markerIcon, 'Click to start drawing a 2D marker', function() {
                drawHelper.startDrawingMarker({
                    callback: function(position) {
                        _self.executeListeners({name: 'markerCreated', position: position});
                    }
                });
            })

            addIcon('polyline', options.polylineIcon, 'Click to start drawing a 2D polyline', function() {
                drawHelper.startDrawingPolyline({
                    callback: function(positions) {
                        _self.executeListeners({name: 'polylineCreated', positions: positions});
                    }
                });
            })

            addIcon('polygon', options.polygonIcon, 'Click to start drawing a 2D polygon', function() {
                drawHelper.startDrawingPolygon({
                    callback: function(positions) {
                        _self.executeListeners({name: 'polygonCreated', positions: positions});
                    }
                });
            })

            addIcon('extent', options.extentIcon, 'Click to start drawing an Extent', function() {
                drawHelper.startDrawingExtent({
                    callback: function(extent) {
                        _self.executeListeners({name: 'extentCreated', extent: extent});
                    }
                });
            })

            addIcon('circle', options.circleIcon, 'Click to start drawing a Circle', function() {
                drawHelper.startDrawingCircle({
                    callback: function(center, radius) {
                        _self.executeListeners({name: 'circleCreated', center: center, radius: radius});
                    }
                });
            })

            // add a clear button at the end
            // add a divider first
            var div = document.createElement('DIV');
            div.className = 'divider';
            toolbar.appendChild(div);
            addIcon('clear', options.clearIcon, 'Remove all primitives', function() {
                scene.primitives.removeAll();
            });

            enhanceWithListeners(this);

        }

        return _;

    })();

    _.prototype.addToolbar = function(container, options) {
        options = copyOptions(options, {container: container});
        return new _.DrawHelperWidget(this, options);
    }

    function getExtent(mn, mx) {
        var e = new Cesium.Rectangle();

        // Re-order so west < east and south < north
        e.west = Math.min(mn.longitude, mx.longitude);
        e.east = Math.max(mn.longitude, mx.longitude);
        e.south = Math.min(mn.latitude, mx.latitude);
        e.north = Math.max(mn.latitude, mx.latitude);

        // Check for approx equal (shouldn't require abs due to re-order)
        var epsilon = Cesium.Math.EPSILON7;

        if ((e.east - e.west) < epsilon) {
            e.east += epsilon * 2.0;
        }

        if ((e.north - e.south) < epsilon) {
            e.north += epsilon * 2.0;
        }

        return e;
    };

    function createTooltip(frameDiv) {

        var tooltip = function(frameDiv) {

            var div = document.createElement('DIV');
            div.className = "twipsy right";

            var arrow = document.createElement('DIV');
            arrow.className = "twipsy-arrow";
            div.appendChild(arrow);

            var title = document.createElement('DIV');
            title.className = "twipsy-inner";
            div.appendChild(title);

            this._div = div;
            this._title = title;

            // add to frame div and display coordinates
            frameDiv.appendChild(div);
        }

        tooltip.prototype.setVisible = function(visible) {
            this._div.style.display = visible ? 'block' : 'none';
        }

        tooltip.prototype.showAt = function(position, message) {
            if(position && message) {
                this.setVisible(true);
                this._title.innerHTML = message;
                this._div.style.left = position.x + 10 + "px";
                this._div.style.top = (position.y - this._div.clientHeight / 2) + "px";
            }
        }

        return new tooltip(frameDiv);
    }

    function getDisplayLatLngString(cartographic, precision) {
        return cartographic.longitude.toFixed(precision || 3) + ", " + cartographic.latitude.toFixed(precision || 3);
    }

    function clone(from, to) {
        if (from == null || typeof from != "object") return from;
        if (from.constructor != Object && from.constructor != Array) return from;
        if (from.constructor == Date || from.constructor == RegExp || from.constructor == Function ||
            from.constructor == String || from.constructor == Number || from.constructor == Boolean)
            return new from.constructor(from);

        to = to || new from.constructor();

        for (var name in from) {
            to[name] = typeof to[name] == "undefined" ? clone(from[name], null) : to[name];
        }

        return to;
    }

    function fillOptions(options, defaultOptions) {
        options = options || {};
        var option;
        for(option in defaultOptions) {
            if(options[option] === undefined) {
                options[option] = clone(defaultOptions[option]);
            }
        }
    }

    // shallow copy
    function copyOptions(options, defaultOptions) {
        var newOptions = clone(options), option;
        for(option in defaultOptions) {
            if(newOptions[option] === undefined) {
                newOptions[option] = clone(defaultOptions[option]);
            }
        }
        return newOptions;
    }

    function setListener(primitive, type, callback) {
        primitive[type] = callback;
    }

    function enhanceWithListeners(element) {

        element._listeners = {};

        element.addListener = function(name, callback) {
            this._listeners[name] = (this._listeners[name] || []);
            this._listeners[name].push(callback);
            return this._listeners[name].length;
        }

        element.executeListeners = function(event, defaultCallback) {
            if(this._listeners[event.name] && this._listeners[event.name].length > 0) {
                var index = 0;
                for(;index < this._listeners[event.name].length; index++) {
                    this._listeners[event.name][index](event);
                }
            } else {
                if(defaultCallback) {
                    defaultCallback(event);
                }
            }
        }

    }

    return _;
})();


/**
 * Created by thomas on 27/01/14.
 */

var Graticule = (function() {

    function defaultValue(options, defaultOptions) {
        var newOptions = {}, option;
        for(option in options) {
            newOptions[option] = options[option];
        }
        for(option in defaultOptions) {
            if(newOptions[option] === undefined) {
                newOptions[option] = defaultOptions[option];
            }
        }
        return newOptions;
    }

    function _(description, scene) {

        description = description || {};

        this._tilingScheme = description.tilingScheme || new Cesium.GeographicTilingScheme();

        this._color = description.color || new Cesium.Color(1.0, 1.0, 1.0, 0.4);

        this._tileWidth = description.tileWidth || 256;
        this._tileHeight = description.tileHeight || 256;

        this._ready = true;

        // default to decimal intervals
        this._sexagesimal = description.sexagesimal || false;
        this._numLines = description.numLines || 50;

        this._scene = scene;
        this._labels = new Cesium.LabelCollection();
        scene.primitives.add(this._labels);
        this._polylines = new Cesium.PolylineCollection();
        scene.primitives.add(this._polylines);
        this._ellipsoid = scene.globe.ellipsoid;

        var canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        this._canvas = canvas;

    };

    var definePropertyWorks = (function() {
        try {
            return 'x' in Object.defineProperty({}, 'x', {});
        } catch (e) {
            return false;
        }
    })();

    /**
     * Defines properties on an object, using Object.defineProperties if available,
     * otherwise returns the object unchanged.  This function should be used in
     * setup code to prevent errors from completely halting JavaScript execution
     * in legacy browsers.
     *
     * @private
     *
     * @exports defineProperties
     */
    var defineProperties = Object.defineProperties;
    if (!definePropertyWorks || !defineProperties) {
        defineProperties = function(o) {
            return o;
        };
    }

    defineProperties(_.prototype, {
        url : {
            get : function() {
                return undefined;
            }
        },

        proxy : {
            get : function() {
                return undefined;
            }
        },

        tileWidth : {
            get : function() {
                return this._tileWidth;
            }
        },

        tileHeight: {
            get : function() {
                return this._tileHeight;
            }
        },

        maximumLevel : {
            get : function() {
                return 18;
            }
        },

        minimumLevel : {
            get : function() {
                return 0;
            }
        },
        tilingScheme : {
            get : function() {
                return this._tilingScheme;
            }
        },
        rectangle : {
            get : function() {
                return this._tilingScheme.rectangle;
            }
        },
        tileDiscardPolicy : {
            get : function() {
                return undefined;
            }
        },
        errorEvent : {
            get : function() {
                return this._errorEvent;
            }
        },
        ready : {
            get : function() {
                return this._ready;
            }
        },
        credit : {
            get : function() {
                return this._credit;
            }
        },
        hasAlphaChannel : {
            get : function() {
                return true;
            }
        }
    });

     _.prototype.makeLabel = function(lng, lat, text, top, color) {
        this._labels.add({
            position : this._ellipsoid.cartographicToCartesian(new Cesium.Cartographic(lng, lat, 10.0)),
            text : text,
            font : 'normal',
            fillColor : 'white',
            outlineColor : 'white',
            style : Cesium.LabelStyle.FILL,
            pixelOffset : new Cesium.Cartesian2(5, top ? 5 : -5),
            eyeOffset : Cesium.Cartesian3.ZERO,
            horizontalOrigin : Cesium.HorizontalOrigin.LEFT,
            verticalOrigin : top ? Cesium.VerticalOrigin.BOTTOM : Cesium.VerticalOrigin.TOP,
            scale : 1.0
        });
    };

    _.prototype._drawGrid = function(extent) {

        if(this._currentExtent && this._currentExtent.equals(extent)) {
            return;
        }
        this._currentExtent = extent;

        this._polylines.removeAll();
        this._labels.removeAll();

        var minPixel = 0;
        var maxPixel = this._canvasSize;

        var dLat = 0, dLng = 0, index;
        // get the nearest to the calculated value
        for(index = 0; index < mins.length && dLat < ((extent.north - extent.south) / 10); index++) {
            dLat = mins[index];
        }
        for(index = 0; index < mins.length && dLng < ((extent.east - extent.west) / 10); index++) {
            dLng = mins[index];
        }

        // round iteration limits to the computed grid interval
        var minLng = (extent.west < 0 ? Math.ceil(extent.west / dLng) : Math.floor(extent.west / dLng)) * dLng;
        var minLat = (extent.south < 0 ? Math.ceil(extent.south / dLat) : Math.floor(extent.south / dLat)) * dLat;
        var maxLng = (extent.east < 0 ? Math.ceil(extent.east / dLat) : Math.floor(extent.east / dLat)) * dLat;
        var maxLat = (extent.north < 0 ? Math.ceil(extent.north / dLng) : Math.floor(extent.north / dLng)) * dLng;

        // extend to make sure we cover for non refresh of tiles
        minLng = Math.max(minLng - 2 * dLng, -Math.PI);
        maxLng = Math.min(maxLng + 2 * dLng, Math.PI);
        minLat = Math.max(minLat - 2 * dLat, -Math.PI / 2);
        maxLat = Math.min(maxLat + 2 * dLng, Math.PI / 2);

        var ellipsoid = this._ellipsoid;
        var lat, lng, granularity = Cesium.Math.toRadians(1);

        // labels positions
        var latitudeText = minLat + Math.floor((maxLat - minLat) / dLat / 2) * dLat;
        for(lng = minLng; lng < maxLng; lng += dLng) {
            // draw meridian
            var path = [];
            for(lat = minLat; lat < maxLat; lat += granularity) {
                path.push(new Cesium.Cartographic(lng, lat))
            }
            path.push(new Cesium.Cartographic(lng, maxLat));
            this._polylines.add({
                positions : ellipsoid.cartographicArrayToCartesianArray(path),
                width: 1
            });
            var degLng = Cesium.Math.toDegrees(lng);
            this.makeLabel(lng, latitudeText, this._sexagesimal ? this._decToSex(degLng) : degLng.toFixed(gridPrecision(dLng)), false);
        }

        // lats
        var longitudeText = minLng + Math.floor((maxLng - minLng) / dLng / 2) * dLng;
        for(lat = minLat; lat < maxLat; lat += dLat) {
            // draw parallels
            var path = [];
            for(lng = minLng; lng < maxLng; lng += granularity) {
                path.push(new Cesium.Cartographic(lng, lat))
            }
            path.push(new Cesium.Cartographic(maxLng, lat));
            this._polylines.add({
                positions : ellipsoid.cartographicArrayToCartesianArray(path),
                width: 1
            });
            var degLat = Cesium.Math.toDegrees(lat);
            this.makeLabel(longitudeText, lat, this._sexagesimal ? this._decToSex(degLat) : degLat.toFixed(gridPrecision(dLat)), true);
        }
    };

    _.prototype.requestImage = function(x, y, level) {

        if(this._show) {
            this._drawGrid(this._getExtentView());
        }

        return this._canvas;
    };

    _.prototype.setVisible = function(visible) {
        this._show = visible;
        if(!visible) {
            this._polylines.removeAll();
            this._labels.removeAll();
        } else {
            this._currentExtent = null;
            this._drawGrid(this._getExtentView());
        }
    }

    _.prototype.isVisible = function() {
        return this._show;
    }

    _.prototype._decToSex = function(d) {
        var degs = Math.floor(d);
        var mins = ((Math.abs(d) - degs) * 60.0).toFixed(2);
        if (mins == "60.00") { degs += 1.0; mins = "0.00"; }
        return [degs, ":", mins].join('');
    };

    _.prototype._getExtentView = function(){
        var camera = this._scene.camera ;
        var canvas = this._scene.canvas;
        var corners = [
            camera.pickEllipsoid(new Cesium.Cartesian2(0, 0), this._ellipsoid),
            camera.pickEllipsoid(new Cesium.Cartesian2(canvas.width, 0), this._ellipsoid),
            camera.pickEllipsoid(new Cesium.Cartesian2(0, canvas.height), this._ellipsoid),
            camera.pickEllipsoid(new Cesium.Cartesian2(canvas.width, canvas.height), this._ellipsoid)
        ];
        for(var index = 0; index < 4; index++) {
            if(corners[index] === undefined) {
                return Cesium.Rectangle.MAX_VALUE;
/*
                var center = this._ellipsoid.cartesianToCartographic(camera.position);
                return Cesium.Rectangle.fromCartographicArray([
                    new Cesium.Cartographic(center.longitude - Math.PI / 2, Math.PI / 2, 0),
                    new Cesium.Cartographic(center.longitude + Math.PI / 2, Math.PI / 2, 0),
                    new Cesium.Cartographic(center.longitude + Math.PI / 2, -Math.PI / 2, 0),
                    new Cesium.Cartographic(center.longitude - Math.PI / 2, -Math.PI / 2, 0)
                ]);
*/
            }
        }
        return Cesium.Rectangle.fromCartographicArray(this._ellipsoid.cartesianArrayToCartographicArray(corners));
    }

    function gridPrecision(dDeg) {
        if (dDeg < 0.01) return 3;
        if (dDeg < 0.1) return 2;
        if (dDeg < 1) return 1;
        return 0;
    }

    var mins = [
        Cesium.Math.toRadians(0.05),
        Cesium.Math.toRadians(0.1),
        Cesium.Math.toRadians(0.2),
        Cesium.Math.toRadians(0.5),
        Cesium.Math.toRadians(1.0),
        Cesium.Math.toRadians(2.0),
        Cesium.Math.toRadians(5.0),
        Cesium.Math.toRadians(10.0)
    ];

    function loggingMessage(message) {
        var logging = document.getElementById('logging');
        logging.innerHTML += message;
    }

    return _;

})();

/**
 * Created by thomas on 27/01/14.
 */

var InfoWindow = (function() {

    function defaultValue(options, defaultOptions) {
        var newOptions = {}, option;
        for(option in options) {
            newOptions[option] = options[option];
        }
        for(option in defaultOptions) {
            if(newOptions[option] === undefined) {
                newOptions[option] = defaultOptions[option];
            }
        }
        return newOptions;
    }

    function _(description, cesiumWidget) {

        description = description || {};

        this._scene = cesiumWidget.scene;

        var div = document.createElement('div');
        div.className = 'infoWindow';
        this._div = div;
        var frame = document.createElement('div');
        frame.className = 'frame';
        this._div.appendChild(frame)
        var close = document.createElement('span');
        close.innerHTML = 'x';
        close.className = 'close';
        frame.appendChild(close);
        var content = document.createElement('div');
        content.className = 'content';
        frame.appendChild(content)
        var arrow = document.createElement('span');
        arrow.className = 'arrow';
        div.appendChild(arrow);
        cesiumWidget.container.appendChild(div);
        this._content = content;
        this._close = close;
        var _self = this;
        this._close.onclick = function() {
            _self.setVisible(false);
        }

        this.setVisible(true);

    };

    _.prototype.setVisible = function(visible) {
        this._visible = visible;
        this._div.style.display = visible ? 'block' : 'none';
    }

    _.prototype.setContent = function(content) {
        if(typeof content == 'string') {
            this._content.innerHTML = content;
        } else {
            while(this._content.firstChild) {
                this._content.removeChild(this._content.firstChild);
            }
            this._content.appendChild(content);
        }
    }

    _.prototype.setPosition = function(lat, lng) {
        this._position = this._scene.globe.ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(lat, lng, 0));
    }

    _.prototype.showAt = function(lat, lng, content) {
        this.setPosition(lat, lng);
        this.setContent(content);
        this.setVisible(true);
    }

    _.prototype.hide = function() {
        this.setVisible(false);
    }

/*
    var viewProjection, viewPosition, coordinates;
    var viewport = new Cesium.BoundingRectangle();
    var viewportTransform = new Cesium.Matrix4();

    _.prototype.update = function(context, frameState, commandList) {
        if(!this._visible || !this._position) {
            return;
        }
        // get the position on the globe as screen coordinates
        viewProjection = this._scene.context.getUniformState().getViewProjection();
        viewPosition = Cesium.Matrix4.multiplyByVector(viewProjection, Cesium.Cartesian4.fromElements(this._position.x, this._position.y, this._position.z, 1));
        // Perspective divide to transform from clip coordinates to normalized device coordinates
        Cesium.Cartesian3.divideByScalar(viewPosition, viewPosition.w, viewPosition);
        // Assuming viewport takes up the entire canvas...
        viewport.width = context.getDrawingBufferWidth();
        viewport.height = context.getDrawingBufferHeight();
        Cesium.Matrix4.computeViewportTransformation(viewport, 0.0, 1.0, viewportTransform);
        // Viewport transform to transform from clip coordinates to drawing buffer coordinates
        coordinates = Cesium.Matrix4.multiplyByPoint(viewportTransform, viewPosition);
        if(coordinates) {
            this._div.style.left = (Math.floor(coordinates.x) - this._div.clientWidth / 2) + "px";
            this._div.style.bottom = (Math.floor(coordinates.y) + 8) + "px";
        } else {
            this._div.style.left = '-1000px';
        }
    }

*/

    _.prototype.update = function(context, frameState, commandList) {
        if(!this._visible || !this._position) {
            return;
        }
        // get the position on the globe as screen coordinates
        var coordinates = Cesium.SceneTransforms.wgs84ToWindowCoordinates(this._scene, this._position);
        if(coordinates) {
            this._div.style.left = (Math.floor(coordinates.x) - this._div.clientWidth / 2) + "px";
            this._div.style.top = (Math.floor(coordinates.y) - 8 - this._div.clientHeight) + "px";
        }
    }

    _.prototype.destroy = function() {
        this._div.parentNode.removeChild(this._div);
    }

    function loggingMessage(message) {
        var logging = document.getElementById('logging');
        logging.innerHTML = message;
    }

    return _;

})();

