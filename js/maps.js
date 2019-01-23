
// javascript implementation for Google Maps API v3 of the MapPanel functions

var googleMapsV3 = (function() {

    var gm, gme;

    // constructor
    function _() {
    }

    // static methods
    // static methods cannot use the gm and gme variables as they might not have been instantiated yet
    _.createMap = function(lat, lng, zoom, mapId, div, callback, failure) {
        if(div == undefined) {
            if(failure) {
                failure("No valid div element provided");
            }
        }
        if(google && google.maps) {
            gm = google.maps;
            gme = gm.event;
            new _.map2D(div, lat, lng, zoom, mapId, callback, failure);
        } else {
            if(failure) {
                failure("Could not load google maps library.");
            }
        }
    }

    _.setListener = function(object, type, callback) {
        if(callback == null) {
            google.maps.event.clearListeners(object, type);
        } else {
            google.maps.event.addListener(object, type, callback);
        }
    }

    _.interpolateJSNI = function(lat1, lng1, lat2, lng2, slope, geodesic) {
        return _.interpolate(new google.maps.LatLng(lat1, lng1), new google.maps.LatLng(lat2, lng2), slope, geodesic);
    }

    _.interpolate = function(latlng, latlngTo, slope, geodesic) {
        if(geodesic == false) {
            var lat = (latlng.lat() + latlngTo.lat()) / slope;
            var lng = latlng.lng() - latlngTo.lng();      // Distance between

            // To control the problem with +-180 degrees.
            if (lng <= 180 && lng >= -180) {
                lng = (latlng.lng() + latlngTo.lng()) / slope;
            } else {
                lng = (latlng.lng() + latlngTo.lng() + 360) / slope;
            }
            return new google.maps.LatLng(lat, lng);
        } else {
            return google.maps.geometry.spherical.interpolate(latlng, latlngTo, slope);
        }
    }

    _.halfWayTo = function(latlng, latlngTo, geodesic) {
        return _.interpolate(latlng, latlngTo, 0.5, geodesic);
    }

    _.roundDistance = function(distance) {
        if (distance > 1000) return Math.round(distance / 1000) + "km";
        else if (distance <= 1000) return Math.round(distance) + "m";
        return distance;
    }

    _.convertBounds = function(bounds) {
        return {
            swLat: bounds.getSouthWest().lat(),
            swLng: bounds.getSouthWest().lng(),
            neLat: bounds.getNorthEast().lat(),
            neLng: bounds.getNorthEast().lng()
        }
    }

    _._getMarkersBounds = function(markers) {
        var bounds = new google.maps.LatLngBounds();
        var i;
        for(i = 0; i < markers.length; i++) {
            bounds.extend(markers[i].getPosition());
        }
        return bounds;
    }

    // returns the center as an LatLng
    _._getMarkersCenter = function(markers) {
        var bounds = _._getMarkersBounds(markers);
        return bounds.getCenter();
    }

    _._getPathBounds = function(path) {
        var bounds = new google.maps.LatLngBounds();
        var i;
        path.forEach(function(latLng, i){bounds.extend(latLng)});
        return bounds;
    }

    // returns the center as an LatLng
    _._getPathCenter = function(path) {
        return _._getPathBounds(path).getCenter();
    }

    _.generatePath = function(polylineCoordinates) {
        // generate path from array of doubles
        var path = new google.maps.MVCArray;
        for(i = 0; i < polylineCoordinates.length;) {
            path.insertAt(path.getLength(), new google.maps.LatLng(polylineCoordinates[i], polylineCoordinates[i + 1]));
            i = i + 2;
        }

        return path;
    }

    _.convertPath = function(path) {
        var coordinates = [];
        path.forEach(function(latLng, i){
                coordinates.push(latLng.lat());
                coordinates.push(latLng.lng());
            }
        );
        return coordinates;
    }

    _.getPathLength = function(latLngPath) {
        return google.maps.geometry.spherical.computeLength(_.generatePath(latLngPath));
    }

    _.getPathArea = function(latLngPath) {
        return google.maps.geometry.spherical.computeArea(_.generatePath(latLngPath));
    }

    _.defaultDragMarker = {
        url: "./img/dragIcon.png",
        shiftX: 5,
        shiftY: 5
    }

    _.defaultEditMarker = {
        url: "./img/dragIconLight.png",
        shiftX: 5,
        shiftY: 5
    }

    function createGlassOverlay(map) {

        function glassOverlay(map) {
            gm.Rectangle.call(this, {
                bounds: new gm.LatLngBounds(new gm.LatLng(-89.9, -179.99999), new gm.LatLng(89.9, 179.99999)),
                map: map,
                strokeOpacity: 0.0,
                fillOpacity: 0.0,
                zIndex: 10000
            });
        }

        glassOverlay.prototype = new gm.Rectangle();

        return new glassOverlay(map);
    }

    _.map2D = (function() {

        function m(div, lat, lng, zoom, mapId, callback, failure) {
            var latlng = new gm.LatLng(lat, lng);
            this.mapTypeIds = [gm.MapTypeId.ROADMAP, gm.MapTypeId.HYBRID, gm.MapTypeId.SATELLITE, gm.MapTypeId.TERRAIN];
            // check map id
            if(!mapId || this.mapTypeIds.indexOf(mapId) == -1) {
                mapId = gm.MapTypeId.HYBRID;
            }
            var myOptions = {
                zoom: zoom,
                minZoom: 1,
                center: latlng,
                streetViewControl: false,
                panControl: false,
                zoomControl: true,
                zoomControlOptions: {
                    position: google.maps.ControlPosition.TOP_LEFT
                },
                mapTypeControlOptions: {
                    mapTypeIds: this.mapTypeIds,
                    style: gm.MapTypeControlStyle.DROPDOWN_MENU
                },
                mapTypeControl: false,
                scaleControl: true,
                scaleControlOptions: {
                    position: gm.ControlPosition.BOTTOM_LEFT
                },
                rotateControl: true,
                fullscreenControl: false,
                mapTypeId: mapId ? mapId : gm.MapTypeId.HYBRID
            };
            var map = new gm.Map(div, myOptions);
            map.setTilt(0);
            // create infoWindow
            this.infoWindow = new gm.InfoWindow({
                content: "Not Initialised!",
                maxWidth: 400
            });
            // add projection hack to the map to be able to convert screen positions to lat lng coordinates
            initProjectionHack(map);
            enableKeyDragZoom(map);
            this.geocoder = new gm.Geocoder();
            this.overlaysArray = [];
            this.theTooltip = createTooltip(map);
            this.zIndex = 0;
            this.map = map;
            // now do the callback
            callback(this);
        }

        function createTooltip(map) {

            function eiTooltip(map) {
                this.div_ = null;
                this.setMap(map);
            }

            eiTooltip.prototype = new gm.OverlayView();

            eiTooltip.prototype.onAdd = function() {

                var div = document.createElement('DIV');
                div.className = "twipsy below";
                div.style.width = "120px";
                div.style.fontSize = "9px";
                this.div_ = div;

                var arrow = document.createElement('DIV');
                arrow.className = "twipsy-arrow";
                div.appendChild(arrow);

                var title = document.createElement('DIV');
                title.className = "twipsy-inner";
                div.appendChild(title);
                this.title_ = title;

                // We add an overlay to a map via one of the map's panes.
                // We'll add this overlay to the overlayImage pane.
                var panes = this.getPanes();
                panes.overlayImage.appendChild(div);

                this.hide();
            }

            eiTooltip.prototype.draw = function() {

            }

            eiTooltip.prototype.show = function(latlng, text) {
                if(this.div_ == null) {
                    return;
                }
                var overlayProjection = this.getProjection();
                var position = overlayProjection.fromLatLngToDivPixel(latlng);

                // Resize the image's DIV to fit the indicated dimensions.
                this.title_.innerHTML = text;
                var div = this.div_;
                div.style.left = position.x - 60 + 'px';
                div.style.top = position.y + 20 + 'px';
                div.style.display = 'block';
            }

            eiTooltip.prototype.hide = function() {
                this.div_.style.display = 'none';
            }

            eiTooltip.prototype.onRemove = function() {
                this.div_.parentNode.removeChild(this.div_);
                this.div_ = null;
            }

            return new eiTooltip(map);
        }

        function enableKeyDragZoom(map) {

        }

        // function to add a couple of functions to the map API for screen positions calculations
        function initProjectionHack(map) {
            // dummy overlay from http://code.google.com/p/gmaps-api-issues/issues/detail?id=2879
            function DummyOverlay(map) {this.setMap(map);}
            DummyOverlay.prototype = new gm.OverlayView;
            DummyOverlay.prototype.onAdd = function(){};
            DummyOverlay.prototype.onRemove = function(){};
            DummyOverlay.prototype.draw = function(){ };

            if(!map.dummyCanvas) {
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
                map.dummyCanvas = new DummyOverlay(map);
                map.getMapCanvasProjection = function() {return this.dummyCanvas.getProjection()};
                map.convertScreenPositionToLatLng = function(posX, posY) {
                    var mapDiv = map.getDiv();
                    var offset = findPos(mapDiv);
                    var latLng = map.getMapCanvasProjection().fromContainerPixelToLatLng(new gm.Point(posX - offset.x, posY - offset.y));
                    return latLng;
                }
                map.convertLatLngToScreenPosition = function(lat, lng) {
                    var mapDiv = map.getDiv();
                    var offset = findPos(mapDiv);
                    var point = map.getMapCanvasProjection().fromLatLngToContainerPixel(new gm.LatLng(lat, lng));
                    point.x += offset.x;
                    point.y += offset.y;
                    return point;
                }
            }
        }

        m.prototype.addZoomOnShift = function(callback) {
            var map2D = this;
            var map = this.map;
            map.getDiv().parentElement.addEventListener("mousedown", function(event) {
                if(event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    // create glassOverlay for handling mouse events
                    var overlay = createGlassOverlay(map);

                    gme.clearInstanceListeners(overlay);
                    var point = map.convertScreenPositionToLatLng(event.clientX, event.clientY);
                    // create the rectangle
                    var rectangle = new gm.Polygon({
                        map: map,
                        strokeColor: "#ff0000",
                        strokeWeight: 1,
                        strokeOpacity: 1.0,
                        fillColor: "#ffffff",
                        fillOpacity: 0.0
                    });
                    var path = new gm.MVCArray;
                    rectangle.setPaths(new gm.MVCArray([path]));

                    function setRectangle(topLeft, bottomRight) {
                        _.uniRectangle.refreshPath(path, topLeft, bottomRight);
                    }

                    function updateBounds(event) {
                        // rearrange bounds so that they fit the rectangle bounds format
                        var topLeft = event.latLng;
                        var bottomRight = point;
                        setRectangle(topLeft, bottomRight);
                        map2D.theTooltip.show(event.latLng, "<p>Position: " + event.latLng.toUrlValue(4) + "</p><p>Release to zoom to extent</p>");
                    }

                    function complete(event) {
                        // callback first before removing markers and circle

                        var swLat = 90;
                        var swLng = 180;
                        var neLat = -90;
                        var neLng = -180;

                        //iterate over the paths
                        rectangle.getPaths().forEach(function(path){

                            //iterate over the points in the path
                            path.getArray().forEach(function(latLng){

                                if(latLng.lat() < swLat)
                                    swLat = latLng.lat();

                                if(latLng.lat() > neLat)
                                    neLat = latLng.lat();

                                if(latLng.lng() < swLng)
                                    swLng = latLng.lng();

                                if(latLng.lng() > neLng)
                                    neLng = latLng.lng();
                            });

                        });

                        callback(swLat, swLng, neLat, neLng);

                        cleanUp();
                    }

                    function cleanUp() {
                        rectangle.setMap(null);
                        gme.clearInstanceListeners(overlay);
                        overlay.setMap(null);
                        delete overlay;
                        map2D.theTooltip.hide();
                        map2D.editCleanUp = null;
                    }

                    // to handle cancel edit events
                    map2D.editCleanUp = cleanUp;

                    setRectangle(point, point);

                    gme.addListener(overlay, 'mousemove', updateBounds);
                    gme.addListener(overlay, 'mouseup', complete);
                }
            }, true);
        }

        m.prototype.displayCopyright = function(copyright, display) {
            if(!copyright || copyright == null || copyright.length == 0) return;
            if(!this.copyrightHolder) {
                var div = document.createElement("div");
                div.className = "eiCopyrightHolder";
                this.map.controls[gm.ControlPosition.BOTTOM_RIGHT].push(div);
                this.copyrightHolder = div;
            }
            if(display) {
                var empty = !this.copyrightHolder.innerHTML || this.copyrightHolder.innerHTML.length == 0;
                if(empty || this.copyrightHolder.innerHTML.indexOf(copyright) == -1) {
                    this.copyrightHolder.innerHTML += (empty ? "" : ", ") + copyright;
                }
            } else {
                var firstItem = this.copyrightHolder.innerHTML.indexOf(copyright) == 0;
                this.copyrightHolder.innerHTML = this.copyrightHolder.innerHTML.replace((firstItem ? "" : ", ") + copyright, "");
            }
        }

        m.prototype.convertScreenPositionToLatLng = function(posX, posY) {
            var latLng = this.map.convertScreenPositionToLatLng(posX, posY);
            return {lat: latLng.lat(), lng: latLng.lng()};
        }

        m.prototype.convertLatLngToScreenPosition = function(lat, lng) {
            return this.map.convertLatLngToScreenPosition(lat, lng);
        }

        m.prototype.disableAllEditMode = function() {
            var i;
            for(i = 0; i < this.overlaysArray.length; i++) {
                if(typeof this.overlaysArray[i].setEditMode == "function" && this.overlaysArray[i].isEditable() === true) {
                    this.overlaysArray[i].setEditMode(false);
                }
            }
        }

        m.prototype.triggerResize = function() {
            gme.trigger(this.map, 'resize');
        }

        m.prototype.showOverview = function(overview) {
            this.map.setOptions({"overviewMapControl": overview});
        }

        m.prototype.showFullscreen = function(enable) {
            var booleanValue2 = (enable == "true");
            this.map.setOptions({"fullscreenControl":booleanValue2});
        }

        m.prototype.showZoom = function(enable) {
            var booleanValue2 = (enable == "true");
            this.map.setOptions({"zoomControl":booleanValue2});
        }

        m.prototype.setCenter = function(lat, lng) {
            this.map.setCenter(new gm.LatLng(lat, lng));
        }

        m.prototype.getCenter = function() {
            var center = this.map.getCenter();
            return [center.lat(), center.lng()];
        }

        m.prototype.setZoomLevel = function(level) {
            this.map.setZoom(level);
        }

        m.prototype.getZoomLevel = function() {
            return this.map.getZoom();
        }

        m.prototype.addControl = function(control, position) {
            var mapPosition = gm.ControlPosition.TOP_RIGHT;
            if(position) {
                if(position == 'topLeft') {//should be TOP_LEFT, change it if it not used
                    mapPosition = gm.ControlPosition.LEFT_TOP;
                }
                if(position == 'leftCenter') {
                    mapPosition = gm.ControlPosition.LEFT_CENTER;
                }
                if(position == 'bottomLeft') { //should be BOTTOM_LEFT, change it if it not used
                    mapPosition = gm.ControlPosition.LEFT_BOTTOM;
                }
                if(position == 'bottomCenter') {
                    mapPosition = gm.ControlPosition.BOTTOM_CENTER;
                }
                if(position == 'bottomRight') {
                    mapPosition = gm.ControlPosition.BOTTOM_RIGHT;
                }
                if(position == 'rightBottom') {
                    mapPosition = gm.ControlPosition.RIGHT_BOTTOM;
                }
                if(position == 'rightCenter') {
                    mapPosition = gm.ControlPosition.RIGHT_CENTER;
                }
                if(position == 'rightTop') {
                    mapPosition = gm.ControlPosition.RIGHT_TOP;
                }
                if(position == 'topRight') {
                    mapPosition = gm.ControlPosition.TOP_RIGHT;
                }
                if(position == 'topCenter') {
                    mapPosition = gm.ControlPosition.TOP_CENTER;
                }
            }
            this.map.controls[mapPosition].push(control);
        }


        m.prototype.setBounds = function(swLat, swLng, neLat, neLng) {
            this.map.fitBounds(new gm.LatLngBounds(new gm.LatLng(swLat, swLng), new gm.LatLng(neLat, neLng)));
        }

        m.prototype.getMapId = function() {
            return this.map.getMapTypeId();
        }

        m.prototype.setClickListener = function(callback) {
            if(callback != null) {
                _.setListener(this.map, "click", function(e) {callback(e.latLng.lat(), e.latLng.lng())});
            } else {
                _.setListener(this.map, "click", null);
            }
        }

        m.prototype.setMapId = function(mapTypeId) {
            // TODO - need to check the mapTypeId exists in the list of map type ids available
            if(mapTypeId && mapTypeId != "" && mapTypeId != null && this.map.mapTypes.get(mapTypeId)) {
                // remove copyright first
                var oldMapId = this.map.getMapTypeId();
                if(oldMapId) {
                    var oldMap = this.map.mapTypes.get(oldMapId);
                    if(oldMap && oldMap.displayCopyright) {
                        oldMap.displayCopyright(false);
                    }
                }
                // switch map type
                this.map.setMapTypeId(mapTypeId);
                // display copyright
                var newMap = this.map.mapTypes.get(mapTypeId);
                if(newMap.displayCopyright) {
                    newMap.displayCopyright(true);
                }
            } else {
                this.map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
            }
        }

        m.prototype.cleanUp = function() {
            if(this.overlaysArray) {
                var index;
                for (index =  0; index < this.overlaysArray.length; index++) {
                    this.removeOverlay(this.overlaysArray[index]);
                }
            }
            this.overlaysArray = [];

            this.closeInfoWindow();

            // check for cleanUp first
            if(this.editCleanUp) {
                this.editCleanUp();
            }

        }

        /*
         * add a map type to the list of map types
         * the map tiles are expected to be provided using TMS
         *
         */
        m.prototype.addMapType = function(mapName, mapId, baseURL, copyright, yFlip, minZoom, maxZoom) {
            var newMapType;
            newMapType = (new _.uniTMSLayer(this, baseURL, copyright, yFlip, -90.0, -180.0, 90.0, 180.0, true))._layer;
            newMapType.minZoom = minZoom;
            newMapType.maxZoom = maxZoom;
            newMapType.name = mapName;
            newMapType.alt = mapName;
            this.mapTypeIds.push(mapId);
            this.map.mapTypes.set(mapId, newMapType);
        }

        m.prototype.addWMSMapType = function(mapName, mapId, baseURL, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng, minZoom, maxZoom) {
            var newMapType;
            newMapType = (new _.uniWMSLayer(this, baseURL, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng, true))._layer;
            newMapType.minZoom = minZoom == undefined ? 0 : minZoom;
            newMapType.maxZoom = maxZoom == undefined ? 15 : maxZoom;
            newMapType.name = mapName;
            newMapType.alt = mapName;
            this.mapTypeIds.push(mapId);
            this.map.mapTypes.set(mapId, newMapType);
        }

        m.prototype.getMapTypeIds = function() {
            return this.mapTypeIds;
        }

        m.prototype.openInfoWindow = function(lat, lng, content) {
            this.infoWindow.setContent(content);
            this.infoWindow.open(this.map);
            this.infoWindow.setPosition(new gm.LatLng(lat, lng));
        }

        m.prototype.openInfoWindowWidget = function(lat, lng, element) {
            this.infoWindow.setContent(element);
            this.infoWindow.open(this.map);
            this.infoWindow.setPosition(new gm.LatLng(lat, lng));
        }

        m.prototype.closeInfoWindow = function() {
            this.infoWindow.close();
        }

        m.prototype.removeOverlay = function(overlay) {
            if(overlay.remove) {
                overlay.remove();
            }
            if(overlay.setMap) {
                overlay.setMap(null);
            }
        }

        m.prototype.getBounds = function() {
            var bounds = this.map.getBounds();
            return _.convertBounds(bounds);
        }

        m.prototype.displayCoordinates = function(display) {
            // initialise if required
            if(this.latLngOverlay == undefined) {
                var latLngOverlay = function(map) {
                    var div = document.createElement('DIV');
                    div.innerHTML = "Position: ";
                    div.className = "ei-latLngOverlay";
                    map.controls[gm.ControlPosition.BOTTOM_LEFT].push(div);
                    var mapDiv = map.getDiv();
                    gme.addDomListener(mapDiv, "mousemove", function(event) {
                        var latLng = map.convertScreenPositionToLatLng(event.clientX, event.clientY);
                        div.innerHTML = "Position: long " + latLng.lng().toFixed(4) + " deg, lat " + latLng.lat().toFixed(4) + " deg";
                    });
                    this.div_ = div;
                }
                latLngOverlay.prototype.show = function() {
                    this.div_.style.display = 'block';
                }
                latLngOverlay.prototype.hide = function() {
                    this.div_.style.display = 'none';
                }
                // create the overlay
                this.latLngOverlay = new latLngOverlay(this.map);
            }
            // display or hide
            if(display) {
                this.latLngOverlay.show();
            } else {
                this.latLngOverlay.hide();
            }
        }

        m.prototype.displayCoordinatesGrid = function(display) {
            if(!this.graticule) {
                this.graticule = new Graticule(this.map);
                this.graticule.draw();
            }
            if(display) {
                this.graticule.show();
            } else {
                this.graticule.hide();
            }
        }

        return m;
    })();

    _.createMarker = function(map, position, markerIcon) {
        // create marker
        return new gm.Marker({
            map: map,
            position: position,
            icon: new gm.MarkerImage(markerIcon.url,
                undefined,
                new gm.Point(0,0),
                new gm.Point(markerIcon.shiftX, markerIcon.shiftY)),
            flat: true
        });
    }

    // add a marker to the map and return it
    _.uniMarker = function(map2D, lat, lng, mapIconUrl, shiftX, shiftY) {

        this.map2D = map2D;
        // create icon
        this.marker = _.createMarker(map2D.map, new gm.LatLng(lat, lng), {url: mapIconUrl, shiftX: shiftX, shiftY: shiftY});
        map2D.overlaysArray.push(this);
    }

    _.uniMarker.prototype.setTitle = function(title) {
        this.marker.setTitle(title);
    }

    _.uniMarker.prototype.setListener = function(eventName, callback) {
        var marker = this;
        _.setListener(this.marker, eventName, function() {callback(marker)});
    }

    _.uniMarker.prototype.setDraggable = function(callback) {
        this.marker.setDraggable(true);
        var marker = this;
        _.setListener(this.marker, 'dragend', function() {callback(marker)});
    }

    _.uniMarker.prototype.setClickHandler = function(callback) {
        var marker = this;
        _.setListener(this.marker, 'click', function(event) {callback(event.latLng.lat(), event.latLng.lng())});
    }

    _.uniMarker.prototype.setDblClickHandler = function(callback) {
        var marker = this;
        _.setListener(this.marker, 'dblclick', function() {callback(marker)});
    }

    _.uniMarker.prototype.setOnDragHandler = function(callback) {
        this.marker.setDraggable(true);
        var marker = this;
        _.setListener(this.marker, 'drag', function() {callback(marker)});
    }

    _.uniMarker.prototype.setVisible = function(visible) {
        return this.marker.setVisible(visible);
    }

    _.uniMarker.prototype.getPosition = function() {
        return this.marker.getPosition();
    }

    _.uniMarker.prototype.getLat = function() {
        return this.marker.getPosition().lat();
    }

    _.uniMarker.prototype.getLng = function() {
        return this.marker.getPosition().lng();
    }

    _.uniMarker.prototype.setTitle = function(title) {
        return this.marker.setTitle(title);
    }

    _.uniMarker.prototype.setPosition = function(lat, lng) {
        return this.marker.setPosition(new gm.LatLng(lat, lng));
    }

    _.uniMarker.prototype.remove = function() {
        this.marker.setMap(null);
    }

    // returns a LatLng coordinates between the two markers
    _.uniMarker.prototype.halfWayTo = function(marker, geodesic) {
        return _.halfWayTo(this.getPosition(), marker.getPosition(), geodesic);
    }

    _.createPoint = function(map2D, callback) {

        // check for cleanUp first
        if(map2D.editCleanUp) {
            map2D.editCleanUp();
        }

        var map = map2D.map;

        // create glassOverlay for handling mouse events
        var overlay = createGlassOverlay(map);

        // change cursor
        map.setOptions({"draggableCursor" : "crosshair"});

        gme.addListener(overlay, 'click', createPoint);
        gme.addListener(overlay, 'mousemove', function(event) {
            map2D.theTooltip.show(event.latLng, "<p>Click to create point at (" + event.latLng.toUrlValue(4) + ")</p>");
        });

        function createPoint(event) {
            cleanUp();
            callback(event.latLng.lat(), event.latLng.lng());
        }

        function cleanUp() {
            gme.clearInstanceListeners(overlay);
            overlay.setMap(null);
            delete overlay;
            map.setOptions({"draggableCursor" : "auto"});
            map2D.theTooltip.hide();
            map2D.editCleanUp = null;
        }
        // to handle cancel edit events
        map2D.editCleanUp = cleanUp;

    }

    // uniSurface is a base class for objects using a surface like Polygon, rectangle and Circle
    _.uniSurface = function(map2D) {
        this.map2D = map2D;
        this.surface = [];
    }

    _.uniSurface.prototype.setClickHandler = function(callback) {
        _.setListener(this.surface, 'click', function(event) {callback(event.latLng.lat(), event.latLng.lng())});
    }

    _.uniSurface.prototype.setMouseOverHandler = function(callback) {
        var surface = this;
        _.setListener(this.surface, 'mouseover',
            function(event) {
                var position = surface.map2D.getProjection().fromLatLngToContainerPixel(event.latLng);
                callback(position.x, position.y);
            });
    }

    _.uniSurface.prototype.setMouseOutHandler = function(callback) {
        var surface = this;
        _.setListener(this.surface, 'mouseout', function() {callback(surface)});
    }

    _.uniSurface.prototype.setTooltip = function(tooltip) {
        var _self = this;
        _.setListener(this.surface, 'mousemove', function(event) {
            _self.map2D.theTooltip.show(event.latLng, tooltip);
        });
        _.setListener(this.surface, 'mouseout', function() {
            _self.map2D.theTooltip.hide();
            _self.surface.setOptions({strokeWeight: _self.weight});
        });
        _.setListener(this.surface, 'mouseover', function() {
            _self.surface.setOptions({strokeWeight: _self.weight * 2});
        });
    }

    _.uniSurface.prototype.setVisible = function(visible) {
        this.surface.setVisible(visible);
        this.setEditMode(false);
    }

    _.uniSurface.prototype.setFillColor = function(color) {
        this.surface.setOptions({
            fillColor: color
        });
    }

    _.uniSurface.prototype.setFillOpacity = function(opacity) {
        this.fillopacity = opacity;
        this.surface.setOptions({
            fillOpacity: opacity
        });
    }

    _.uniSurface.prototype.setStrokeStyle = function(color, opacity, thickness) {
        this.color = color;
        this.opacity = opacity;
        this.weight = thickness;
        this.surface.setOptions({
            strokeColor: color,
            strokeWeight: thickness,
            strokeOpacity: opacity
        });
    }

    _.uniSurface.prototype.setHighlighted = function(highlighted) {
        if(highlighted && !this.isHighlighted) {
            this.surface.setOptions({
                strokeColor: "#ffffff",
                strokeWeight: this.weight * 2
            });
            this.isHighlighted = true;
            this.setOnTop();
        } else if(!highlighted && this.isHighlighted) {
            this.surface.setOptions({
                strokeColor: this.color,
                strokeWeight: this.weight
            });
            this.isHighlighted = false;
        }
    }

    _.uniSurface.prototype.setOnTop = function() {
        this.surface.setOptions({
            zIndex: this.map2D.zIndex++
        });
    }

    _.uniSurface.prototype.sendToBack = function() {
        this.surface.setOptions({
            zIndex: 0
        });
    }

    // method to enable a surface to be editable
    // automatically adds the tooltip and click handler to toggle the edit mode of a surface
    // the method expects the setEditMode method to be available
    _.uniSurface.prototype.configureEditable = function(tooltip) {
        var _self = this;
        this.edit = undefined;
        this.editable = true;
        this.setEditMode(false);
        _.setListener(this.surface, 'mouseover', function() {
            if(_self.edit != true && _self.editable == true) {
                _self.setHighlighted(true);
            } else {
                _self.setHighlighted(false);
            }
        });
        _.setListener(this.surface, 'mousemove', function(event) {
            if(_self.edit != true && _self.editable == true) {
                _self.map2D.theTooltip.show(event.latLng, "<p>" + tooltip + "</p>");
            }
        });
        _.setListener(this.surface, 'mouseout', function() {
            _self.setHighlighted(false);
            _self.map2D.theTooltip.hide();
        });
        _.setListener(this.surface, 'click', function() {
            if(_self.editable == true) {
                // remove all edit modes first
                _self.map2D.disableAllEditMode();
                // remove highlighting
                _self.setHighlighted(false);
                // set this surface in edit mode
                _self.setEditMode(true);
                // disable edit mode if the user clicks in the map
                gme.addListener(_self.map2D.map, 'click', function(event){_self.setEditMode(false)});
                // hide tooltip
                _self.map2D.theTooltip.hide();
            }
        });
    }

    _.uniSurface.prototype.setEditable = function(editable) {
        this.editable = editable;
        this.setEditMode(editable);
    }

    _.uniSurface.prototype.isEditable = function() {
        return this.editable;
    }

    _.uniSurface.prototype.setCenter = function(lat, lng) {
        return this._setCenter(new gm.LatLng(lat, lng));
    }

    _.uniSurface.prototype.getZIndex = function() {
        return this.surface.get('zIndex');
    }

    // get the center of the surface using the _getCenter method of the class
    // returns [lat, lng] value
    _.uniSurface.prototype.getCenter = function() {
        var center = this._getCenter();
        return [center.lat(), center.lng()];
    }

    _.uniSurface.prototype.setContextMenu = function(callback) {
        _.setListener(this.surface, 'rightclick', function(e) {
            callback(e.latLng.lat(), e.latLng.lng());
        });
    }

    _.createPolypoints = function(map2D, options, callback, initialLat, initialLng) {

        // check for cleanUp first
        if(map2D.editCleanUp) {
            map2D.editCleanUp();
        }

        map2D.disableAllEditMode();

        var map = map2D.map;
        var poly;
        var minPoints;
        if(options.polygon) {
            poly = new gm.Polygon({
                map: map,
                strokeColor: options.color,
                strokeWeight: options.thickness,
                strokeOpacity: options.opacity,
                fillColor: options.fillcolor,
                fillOpacity: options.fillopacity,
                geodesic: options.geodesic
            });
            minPoints = 3;
        } else {
            poly = new gm.Polyline({
                map: map,
                strokeColor: options.color,
                strokeWeight: options.thickness,
                strokeOpacity: options.opacity,
                geodesic: options.geodesic
            });
            minPoints = 2;
        }
        poly.setMap(map);
        var path = poly.getPath();

        // create glassOverlay for handling mouse events
        var overlay = createGlassOverlay(map);

        var markerIcon = options.dragMarkerIcon ? options.dragMarkerIcon : _.defaultDragMarker;
        var icon = new gm.MarkerImage(markerIcon.url, undefined, undefined, new gm.Point(markerIcon.shiftX, markerIcon.shiftY));
        // var icon = new gm.MarkerImage("./img/dragIcon.png", undefined, undefined, new gm.Point(5, 5));
        var markers = [];
        var update_timeout = null;
        function addMarker(latLng) {

            var marker = new gm.Marker({
                animation: false,
                flat: true,
                icon: icon,
                raiseOnDrag: false,
                position: latLng,
                map: map
            });
            markers.push(marker);

            gme.addListenerOnce(marker, 'click', handleClick);
        }

        function complete(event) {
            event.stop();
            clearTimeout(update_timeout);
            // filter double points
            if(path.getAt(path.getLength() - 2).equals(path.getAt(path.getLength() - 1))) {
                path.pop();
            }
            if(path.getLength() >= minPoints) {
                // create unipolygon
                callback(_.convertPath(path));
                cleanUp();
            }
        }

        function cleanUp() {
            poly.setMap(null);
            var i;
            for(i = 0; i < markers.length; i++) {
                markers[i].setMap(null);
            }
            map2D.theTooltip.hide();
            gme.clearInstanceListeners(overlay);
            overlay.setMap(null);
            delete overlay;
            map2D.editCleanUp = null;
            markers = [];
            overlay = null;
        }
        // to handle cancel edit events
        map2D.editCleanUp = cleanUp;

        var handleClick = function(event) {
            var latLng = event.latLng;
            if(path.getLength() == 0) {
                path.push(latLng);
                addMarker(latLng);
                path.push(latLng);
            } else {
                path.push(latLng);
                // add marker with a delay
                update_timeout = setTimeout(function(){
                    addMarker(latLng);
                }, 300);
            }
            if(path.getLength() == minPoints) {
                gme.addListenerOnce(overlay, 'dblclick', complete);
            }
        }
        gme.addListener(overlay, 'click', handleClick);

        gme.addListener(overlay, 'mousemove', function(event) {
            if(path.getLength() == 0) {
                map2D.theTooltip.show(event.latLng, "<p>Click to add first point</p>");
            } else {
                path.setAt(path.length - 1, event.latLng);
                if(path.getLength() < minPoints) {
                    map2D.theTooltip.show(event.latLng, "<p>Click to add one point</p>");
                } else {
                    map2D.theTooltip.show(event.latLng, "<p>Double click to finish this shape</p>");
                }
            }
        });

        if(initialLat != undefined && initialLng != undefined) {
            handleClick({latLng: new gm.LatLng(initialLat, initialLng)});
        }

    }

    _.createPolygon = function(map2D, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {
        _.createPolypoints(map2D, {polygon: true, color: color, thickness: thickness, opacity: opacity, fillcolor: fillcolor, fillopacity: fillopacity, clickable: clickable, geodesic: geodesic}, callback, initialLat, initialLng);
    }

    // polygon implementation
    _.uniPolygon = function(map2D, polygonCoordinates, options) { //color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, editCallback, editMarkerCallback) {

        this.map2D = map2D;

        // handle case where constructor is empty
        if(polygonCoordinates == undefined || polygonCoordinates.length == undefined || polygonCoordinates.length < 6) {
            return;
        }

        this.color = options.color || '#ffffff';
        this.weight = options.thickness || 2;
        this.opacity = options.opacity == undefined ? 1.0 : options.opacity;
        this.fillopacity = options.fillOpacity == undefined ? 0.7 : options.fillOpacity;
        this.geodesic = options.geodesic == undefined ? true : options.geodesic;
        this.surface = new gm.Polygon({
            map: this.map2D.map,
            path: _.generatePath(polygonCoordinates),
            strokeColor: this.color,
            strokeWeight: this.weight,
            strokeOpacity: this.opacity,
            fillColor: options.fillColor || '#888888',
            fillOpacity: this.fillopacity,
            clickable: true,
            geodesic: this.geodesic,
            zIndex: this.map2D.zIndex++
        });
        this.isHighlighted = false;
        this.path = this.surface.getPath();
        // a polygon is a closed shape
        this.closed = true;
        this.minPoints = 3;

        this.map2D.overlaysArray.push(this);

        if(typeof options.callback == "function") {
            this.editCallback = options.callback;
            this.markers = [];
            this.editmarkers = [];
            if(options.constraint) {
                this.constraintPath = new gm.Polygon({path: _.generatePath(options.constraint)});
            }
            this.configureEditable("Click to graphically edit the points of this polygon");
        } else {
            this.editable = false;
        }

    }

    _.uniPolygon.prototype = new _.uniSurface();

    _.uniPolygon.prototype.getArea = function() {
        return gm.geometry.spherical.computeArea(this.path);
    }

    // methods for editing
    _.uniPolygon.prototype.addPoint = function(latLng, position) {
        var path = this.path;
        var pos = position ? position : path.length;
        path.insertAt(pos, latLng);
        this.addMarkerPoint(pos, latLng);
    }

    _.uniPolygon.prototype.addMarkerPoint = function(pos, latLng) {
        var path = this.path;
        // add marker
        var _this = this;
        // create marker
        var marker = _.createMarker(this.map2D.map, new gm.LatLng(latLng.lat(), latLng.lng()), this.dragMarker ? this.dragMarker : _.defaultDragMarker);
        marker.setDraggable(true);
        _.setListener(marker, "drag", function(latLng) {
            for (var i = 0, I = _this.markers.length; i < I && _this.markers[i] != marker; ++i);
            if(!_this.constraintPath || (_this.constraintPath && gm.geometry.poly.containsLocation(marker.getPosition(), _this.constraintPath))) {
                path.setAt(i, marker.getPosition());
                _this.updateEditMarkers(false);
            } else {
                marker.setPosition(path.getAt(i));
            }
        });
        _.setListener(marker, "dragend", function(latLng) {
            if(_this.constraintPath && !gm.geometry.poly.containsLocation(marker.getPosition(), _this.constraintPath)) {
                for (var i = 0, I = _this.markers.length; i < I && _this.markers[i] != marker; ++i);
                marker.setPosition(path.getAt(i));
            }
            _this.editCallback(_this.getPositions());
        });
        marker.setTitle("Double click to remove this point");
        _.setListener(marker, 'dblclick', function() {
            _this.removePoint(marker);
        });
        this.markers.splice(pos, 0, marker);
    }

    _.uniPolygon.prototype.removePoint = function(marker) {
        var path = this.path;
        if(path.length > this.minPoints) {
            for (var i = 0, I = this.markers.length; i < I && this.markers[i] != marker; ++i);
            this.markers[i].setMap(null);
            this.markers.splice(i, 1);
            path.removeAt(i);
            if(this.editCallback) {
                this.updateEditMarkers(true);
                this.editCallback(this.getPositions());
            }
        }
    }

    _.uniPolygon.prototype.setEditMode = function(edit) {
        this.edit = edit;
        if(this.editable) {
            if(edit && this.markers.length == 0) {
                this.createEditMarkers();
                this.createPointMarkers();
            }
            this.setMarkersVisibility(edit);
        }
    }

    _.uniPolygon.prototype.createPointMarkers = function() {
        // remove all point markers first
        if(this.markers) {
            var i;
            for(i = 0; i < this.markers.length; i++) {
                this.markers[i].setMap(null);
            }
        }
        var polygon = this;
        this.path.forEach(function(latLng, i){polygon.addMarkerPoint(i, latLng)});
    }

    _.uniPolygon.prototype.createEditMarkers = function() {
        // remove all edit markers first
        if(this.editmarkers) {
            var i;
            for(i = 0; i < this.editmarkers.length; i++) {
                this.editmarkers[i].setMap(null);
            }
        }

        this.editmarkers = [];
        var _this = this;
        var latLng;
        var length = this.closed ? this.path.getLength() : this.path.getLength() - 1;
        for(i = 0; i < length; i++) {
            latLng = _.halfWayTo(this.path.getAt(i), this.path.getAt(i + 1 < this.path.getLength() ? i + 1 : 0), this.geodesic);
            // create marker
            var editmarker = _.createMarker(this.map2D.map, new gm.LatLng(latLng.lat(), latLng.lng()), this.editMarker ? this.editMarker : _.defaultEditMarker);
            editmarker.setDraggable(true);
            (function(marker) {
                _.setListener(marker, "dragstart", function() {
                    _this.path.insertAt(marker.markerPos, marker.getPosition());
                });
                _.setListener(marker, "drag", function() {
                    if(!_this.constraintPath || (_this.constraintPath && gm.geometry.poly.containsLocation(marker.getPosition(), _this.constraintPath))) {
                        _this.path.setAt(marker.markerPos, marker.getPosition());
                    } else {
                        marker.setPosition(_this.path.getAt(marker.markerPos));
                    }
                });
                _.setListener(marker, "dragend", function() {
                    // force marker back into position if out of constraint
                    if(_this.constraintPath && !gm.geometry.poly.containsLocation(marker.getPosition(), _this.constraintPath)) {
                        marker.setPosition(_this.path.getAt(marker.markerPos));
                    }
                    _this.path.removeAt(marker.markerPos);
                    _this.addPoint(marker.getPosition(), marker.markerPos);
                    _this.updateEditMarkers(true);
                    _this.editCallback(_this.getPositions());
                });
            })(editmarker);
            editmarker.setTitle("Drag me to create a new point!");
            editmarker.markerPos = i + 1;
            this.editmarkers.push(editmarker);
        }
    }

    _.uniPolygon.prototype.updateMarkers = function(create) {
        var i;
        for(i = 0; i < this.markers.length; i++) {
            this.markers[i].setPosition(this.path.getAt(i));
        }
        this.updateEditMarkers(create);
    }

    _.uniPolygon.prototype.updateEditMarkers = function(create) {
        if(create == true) {
            this.createEditMarkers();
        } else {
            var latLng, i;
            // udpate markers positions
            for(i = 0; i < this.editmarkers.length; i++) {
                latLng = _.halfWayTo(this.markers[i].getPosition(), this.markers[i + 1 < this.markers.length ? i + 1 : 0].getPosition(), this.geodesic);
                this.editmarkers[i].setPosition(latLng);
            }
        }
    }

    _.uniPolygon.prototype.setMarkersVisibility = function(visible) {
        var i;
        for(i = 0; i < this.markers.length; i++) {
            this.markers[i].setVisible(visible);
        }
        for(i = 0; i < this.editmarkers.length; i++) {
            this.editmarkers[i].setVisible(visible);
        }
    }

    // returns and arry of lat long positions of the polygon
    _.uniPolygon.prototype.getPositions = function() {
        return _.convertPath(this.path);
    }

    //fix to force the polygon to be oriented towards the south pole
    _.uniPolygon.prototype.forceSouthPole = function() {
        var path = this.surface.getPath().getArray();
        var southPole = [new gm.LatLng(-89.99,180), new gm.LatLng(-89.99,-120),
            new gm.LatLng(-89.99,-60), new gm.LatLng(-89.99,0),
            new gm.LatLng(-89.99,60), new gm.LatLng(-89.99,120),
            new gm.LatLng(-89.99,180)];
        this.surface.setPaths([path, southPole]);
    }

    // remove all markers, clear path and create new points based on the new positions
    _.uniPolygon.prototype.updatePositions = function(polygonCoordinates) {
        this.path.clear();
        if(this.edit == true) {
            var i;
            for(i = 0; i < this.markers.length; i++) {
                this.markers[i].setMap(null);
            }
            this.markers = [];
            for(i = 0; i < polygonCoordinates.length;) {
                this.addPoint(new gm.LatLng(polygonCoordinates[i], polygonCoordinates[i + 1]));
                i = i + 2;
            }
            this.updateEditMarkers(true);
        } else {
            for(i = 0; i < polygonCoordinates.length;) {
                this.path.push(new gm.LatLng(polygonCoordinates[i], polygonCoordinates[i + 1]));
                i = i + 2;
            }
        }
    }

    _.uniPolygon.prototype.getEOBounds = function() {
        var bounds = _._getPathBounds(this.surface.getPath());
        return _.convertBounds(bounds);
    }

    _.uniPolygon.prototype._getCenter = function() {
        return _._getPathCenter(this.surface.getPath());
    }

    _.uniPolygon.prototype._setCenter = function(newCenter) {
        var center = this._getCenter();
        var deltaLat = newCenter.lat() - center.lat();
        var deltaLng = newCenter.lng() - center.lng();
        // update polygon
        var index;
        for(index = 0; index < this.path.getLength(); index++) {
            if(Math.abs(this.path.getAt(index).lat() + deltaLat) > 90) return false;
        }
        var latLng;
        for(index = 0; index < this.path.getLength(); index++) {
            latLng = this.path.getAt(index);
            this.path.setAt(index, new gm.LatLng(latLng.lat() + deltaLat, latLng.lng() + deltaLng));
        }
        // refresh all markers
        if(this.editable) {
            this.updateMarkers(false);
        }
        return true;
    }

    _.uniPolygon.prototype.remove = function() {
        this.surface.setMap(null);
        if(this.markers) {
            for (var i = 0, I = this.markers.length; i < I; i++) {
                this.markers[i].setMap(null);
            }
        }
        if(this.editmarkers) {
            for (i = 0, I = this.editmarkers.length; i < I; i++) {
                this.editmarkers[i].setMap(null);
            }
        }
    }

    _.createCircle = function(map2D, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {

        // check for cleanUp first
        if(map2D.editCleanUp) {
            map2D.editCleanUp();
        }

        var map = map2D.map;

        // create glassOverlay for handling mouse events
        var overlay = createGlassOverlay(map);

        // change cursor
        map.setOptions({"draggableCursor" : "crosshair"});

        gme.addListener(overlay, 'click', createCircle);
        gme.addListener(overlay, 'mousemove', function(event) {
            map2D.theTooltip.show(event.latLng, "<p>Click to create center for circle</p>");
        });

        function createCircle(event) {
            gme.clearInstanceListeners(overlay);
            var center = event.latLng;
            // create marker for center
            var icon = new gm.MarkerImage("./img/dragIcon.png", undefined, undefined, new gm.Point(5, 5));
            var marker = new gm.Marker({
                animation: false,
                flat: true,
                icon: icon,
                raiseOnDrag: false,
                position: event.latLng,
                map: map
            });
            // create the circle
            var circle = new gm.Circle({
                map: map,
                center: center,
                radius: 1,
                strokeColor: color,
                strokeWeight: thickness,
                strokeOpacity: opacity,
                fillColor: fillcolor,
                fillOpacity: fillopacity,
                geodesic: geodesic
            });
            var polyline = new gm.Polyline({
                map: map,
                path: [center, center],
                strokeColor: color,
                strokeWeight: thickness,
                strokeOpacity: 0.0,
                geodesic: true
            });

            function updateRadius(event) {
                var radius = gm.geometry.spherical.computeDistanceBetween(center, event.latLng);
                circle.setRadius(radius);
                polyline.getPath().setAt(1, event.latLng);
                polyline.setOptions({strokeOpacity: 1.0});
                map2D.theTooltip.show(_.halfWayTo(event.latLng, center), "<p>Radius is: " + _.roundDistance(radius) + "</p><p>Click to finalise</p>");
            }

            function complete(event) {
                // calculate circle radius first before removing markers and circle
                var radius = gm.geometry.spherical.computeDistanceBetween(center, event.latLng);
                cleanUp();
                callback(center.lat(), center.lng(), radius);
            }
            var mousemoveListener2 = gme.addListener(overlay, 'mousemove', updateRadius);
            var clickListener2 = gme.addListener(overlay, 'click', complete);

            function cleanUp() {
                gme.clearInstanceListeners(overlay);
                overlay.setMap(null);
                delete overlay;
                map.setOptions({"draggableCursor" : "auto"});
                circle.setMap(null);
                polyline.setMap(null);
                marker.setMap(null);
                map2D.theTooltip.hide();
                map2D.editCleanUp = null;
            }
            // to handle cancel edit events
            map2D.editCleanUp = cleanUp;

        }

        // to handle cancel edit events
        function firstCleanUp() {
            map.setOptions({"draggableCursor" : "auto"});
            gme.clearInstanceListeners(overlay);
            overlay.setMap(null);
            delete overlay;
            map2D.editCleanUp = null;
        }
        // to handle cancel edit events
        map2D.editCleanUp = firstCleanUp;

        if(initialLat != undefined && initialLng != undefined) {
            createCircle({latLng: new gm.LatLng(initialLat, initialLng)});
        }

    }

    _.uniCircle = function(map2D, centerLat, centerLng, radius, options) { //color, thickness, opacity, fillColor, fillOpacity, clickable, callback) {

        this.map2D = map2D;

        var center = new gm.LatLng(centerLat, centerLng);
        this.color = options.color || '#ffffff';
        this.weight = options.thickness || 2;
        this.opacity = options.opacity == undefined ? 1.0 : options.opacity;
        this.fillopacity = options.fillOpacity == undefined ? 0.7 : options.fillOpacity;
        this.surface = new gm.Circle({
            map: map2D.map,
            center: center,
            radius: radius,
            strokeColor: this.color,
            strokeWeight: this.weight,
            strokeOpacity: this.opacity,
            fillColor: options.fillColor || '#888888',
            fillOpacity: this.fillopacity,
            clickable: options.clickable
        });
        this.isHighlighted = false;
        this.editable = false;

        this.callback = options.callback;

        if(this.callback != null && typeof this.callback == "function") {
            // head north to define the marker
            var position = gm.geometry.spherical.computeOffset(center, radius, 90.0);

            if(options.constraint) {
                this.constraintPath = new gm.Polygon({path: _.generatePath(options.constraint)});
            }

            var radiusMarker = _.createMarker(map2D.map, new gm.LatLng(position.lat(), position.lng()), _.defaultDragMarker);
            radiusMarker.setDraggable(true);
            var _self = this;
            _.setListener(radiusMarker, 'dragend', function() {
                _self.refreshCircle(false);
                _self.callback(_self.center.lat(), _self.center.lng(), _self.getRadius());
            });
            _.setListener(radiusMarker, 'drag', function() {
                // check circle is within the constraints
                if(!_self.constraintPath || (_self.constraintPath && gm.geometry.poly.containsLocation(radiusMarker.getPosition(), _self.constraintPath))) {

                }
                _self.refreshCircle(true);
            });

            // create polyline from center to radius marker
            this.polyline = new gm.Polyline({
                map: map2D.map,
                path: [center, position],
                strokeColor: this.color,
                strokeWeight: this.weight,
                strokeOpacity: 0,
                geodesic: true
            });


            this.center = center;
            this.radius = radius;
            this.radiusMarker = radiusMarker;

            this.configureEditable("Click to graphically edit the center and radius of this circle");
        }

        map2D.overlaysArray.push(this);

    }

    _.uniCircle.prototype = new _.uniSurface();

    _.uniCircle.prototype.setEditMode = function(edit) {
        this.edit = edit;
        if(this.radiusMarker) {
            if(edit) {
                // update edit elements
                var position = gm.geometry.spherical.computeOffset(this.center, this.radius, 90.0);
                this.radiusMarker.setPosition(position);
                this.polyline.setPath([this.center, position]);
            }
            this.radiusMarker.setVisible(edit);
        }
    }

    _.uniCircle.prototype.refreshCircle = function(displayTooltip) {
        var radius = this.getRadius();
        this.radius = radius;
        this.surface.setRadius(radius);
        if(displayTooltip == true) {
            this.polyline.getPath().setAt(1, this.radiusMarker.getPosition());
            this.polyline.setOptions({strokeOpacity: 1.0});
            this.map2D.theTooltip.show(_.halfWayTo(this.radiusMarker.getPosition(), this.center), "<p>Radius is: " + _.roundDistance(radius) + "</p>");
        } else {
            this.polyline.setOptions({strokeOpacity: 0.0});
            this.map2D.theTooltip.hide();
        }
    }

    _.uniCircle.prototype.getRadius = function() {
        return gm.geometry.spherical.computeDistanceBetween(this.radiusMarker.getPosition(), this.center);
    }

    _.uniCircle.prototype.getEOBounds = function() {
        var bounds = this.surface.getBounds();
        return _.convertBounds(bounds);
    }

    _.uniCircle.prototype.getArea = function() {
        return 0;
    }

    _.uniCircle.prototype._getCenter = function() {
        return this.surface.getCenter();
    }

    _.uniCircle.prototype._setCenter = function(latLng) {
        this.surface.setCenter(latLng);
        this.center = latLng;
        this.setEditMode(false);
        return true;
    }

    _.uniCircle.prototype.setRadius = function(radius) {
        this.surface.setRadius(radius);
        this.radius = radius;
        this.setEditMode(false);
        return true;
    }

    _.uniCircle.prototype.remove = function() {
        this.surface.setMap(null);
        if(this.polyline) {
            this.polyline.setMap(null);
            this.radiusMarker.setMap(null);
        }
        this.map2D.theTooltip.hide();
    }

    _.createRectangle = function(map2D, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {

        // check for cleanUp first
        if(map2D.editCleanUp) {
            map2D.editCleanUp();
        }

        var map = map2D.map;

        // change cursor
        map.setOptions({"draggableCursor" : "crosshair"});

        // create glassOverlay for handling mouse events
        var overlay = createGlassOverlay(map);

        function createRectangle(event) {
            gme.clearInstanceListeners(overlay);
            var point = event.latLng;
            // create the rectangle
            var rectangle = new gm.Polygon({
                map: map,
                strokeColor: color,
                strokeWeight: thickness,
                strokeOpacity: opacity,
                fillColor: fillcolor,
                fillOpacity: fillopacity
            });
            var path = new gm.MVCArray;
            rectangle.setPaths(new gm.MVCArray([path]));

            var topLeftMarker = new _.uniMarker(map2D, point.lat(), point.lng(), './img/dragIcon.png', 5, 5);
            var bottomRightMarker = new _.uniMarker(map2D, point.lat(), point.lng(), './img/dragIcon.png', 5, 5);
            var topRightMarker = new _.uniMarker(map2D, point.lat(), point.lng(), './img/dragIcon.png', 5, 5);
            var bottomLeftMarker = new _.uniMarker(map2D, point.lat(), point.lng(), './img/dragIcon.png', 5, 5);
            setRectangle(point, point);

            function setRectangle(topLeft, bottomRight) {
                _.uniRectangle.refreshPath(path, topLeft, bottomRight);
                topLeftMarker.setPosition(topLeft.lat(), topLeft.lng());
                bottomRightMarker.setPosition(bottomRight.lat(), bottomRight.lng());
                topRightMarker.setPosition(topLeft.lat(), bottomRight.lng());
                bottomLeftMarker.setPosition(bottomRight.lat(), topLeft.lng());
            }

            function updateBounds(event) {
                // rearrange bounds so that they fit the rectangle bounds format
                var topLeft = event.latLng;
                var bottomRight = point;
                var longitude = Math.abs(topLeft.lng() - bottomRight.lng());
                //change for SEDAS for the rectangle not to be over 180
                if(longitude < 180) {
                    setRectangle(topLeft, bottomRight);
                    map2D.theTooltip.show(event.latLng, "<p>Position: " + event.latLng.toUrlValue(4) + "</p><p>Click to complete</p>");
                }
                else
                    complete();
            }

            function complete(event) {
                // callback first before removing markers and circle
                var bounds = new google.maps.LatLngBounds();
                bounds.extend(topLeftMarker.getPosition());
                bounds.extend(bottomRightMarker.getPosition());
                callback(bounds.getNorthEast().lat(), bounds.getSouthWest().lng(), bounds.getSouthWest().lat(), bounds.getNorthEast().lng());
                cleanUp();
            }

            function cleanUp() {
                topLeftMarker.remove();
                bottomRightMarker.remove();
                topRightMarker.remove();
                bottomLeftMarker.remove();
                map.setOptions({"draggableCursor" : "auto"});
                rectangle.setMap(null);
                gme.clearInstanceListeners(overlay);
                overlay.setMap(null);
                delete overlay;
                map2D.theTooltip.hide();
                map2D.editCleanUp = null;
            }
            // to handle cancel edit events
            map2D.editCleanUp = cleanUp;

            gme.addListener(overlay, 'mousemove', updateBounds);
            gme.addListener(overlay, 'click', complete);
            bottomRightMarker.setListener('click', complete);
            topRightMarker.setListener('click', complete);
            bottomLeftMarker.setListener('click', complete);
            topLeftMarker.setListener('click', complete);
        }

        gme.addListener(overlay, 'click', createRectangle);
        gme.addListener(overlay, 'mousemove', function(event) {
            map2D.theTooltip.show(event.latLng, "<p>Click to create the Rectangle</p>");
        });

        // to handle cancel edit events
        function firstCleanUp() {
            gme.clearInstanceListeners(overlay);
            overlay.setMap(null);
            delete overlay;
            map.setOptions({"draggableCursor" : "auto"});
            map2D.editCleanUp = null;
        }
        // to handle cancel edit events
        map2D.editCleanUp = firstCleanUp;

        if(initialLat != undefined && initialLng != undefined) {
            createRectangle({latLng: new gm.LatLng(initialLat, initialLng)});
        }

    }

    _.createZoomRectangle = function(map2D, color, thickness, opacity, fillcolor, fillopacity, callback, initialLat, initialLng) {

        // check for cleanUp first
        if(map2D.editCleanUp) {
            map2D.editCleanUp();
        }

        var map = map2D.map;

        // create glassOverlay for handling mouse events
        var overlay = createGlassOverlay(map);

        function createRectangle(event) {
            gme.clearInstanceListeners(overlay);
            var point = event.latLng;
            // create the rectangle
            var rectangle = new gm.Polygon({
                map: map,
                strokeColor: color,
                strokeWeight: thickness,
                strokeOpacity: opacity,
                fillColor: fillcolor,
                fillOpacity: fillopacity
            });
            var path = new gm.MVCArray;
            rectangle.setPaths(new gm.MVCArray([path]));

            setRectangle(point, point);

            function setRectangle(topLeft, bottomRight) {
                _.uniRectangle.refreshPath(path, topLeft, bottomRight);
            }

            function updateBounds(event) {
                // rearrange bounds so that they fit the rectangle bounds format
                var topLeft = event.latLng;
                var bottomRight = point;
                setRectangle(topLeft, bottomRight);
                map2D.theTooltip.show(event.latLng, "<p>Position: " + event.latLng.toUrlValue(4) + "</p><p>Click to zoom to extent</p>");
            }

            function complete(event) {
                // callback first before removing markers and circle
                var topLeft = path.getAt(1);
                var bottomRight = path.getAt(3);
                callback(topLeft.lat(), topLeft.lng(), bottomRight.lat(), bottomRight.lng());
                cleanUp();
            }

            function cleanUp() {
                rectangle.setMap(null);
                gme.clearInstanceListeners(overlay);
                overlay.setMap(null);
                delete overlay;
                map2D.theTooltip.hide();
                map2D.editCleanUp = null;
            }
            // to handle cancel edit events
            map2D.editCleanUp = cleanUp;

            gme.addListener(overlay, 'mousemove', updateBounds);
            gme.addListener(overlay, 'click', complete);
        }

        gme.addListener(overlay, 'click', createRectangle);
        gme.addListener(overlay, 'mousemove', function(event) {
            map2D.theTooltip.show(event.latLng, "<p>Click to start defining zoom area</p>");
        });

        // to handle cancel edit events
        function firstCleanUp() {
            gme.clearInstanceListeners(overlay);
            overlay.setMap(null);
            delete overlay;
            map.setOptions({"draggableCursor" : "auto"});
            map2D.editCleanUp = null;
        }
        // to handle cancel edit events
        map2D.editCleanUp = firstCleanUp;

        if(initialLat != undefined && initialLng != undefined) {
            createRectangle({latLng: new gm.LatLng(initialLat, initialLng)});
        }

    }

    //editable rectangle
    _.uniRectangle = function(map2D, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng,  options) { //color, thickness, opacity, fillColor, fillOpacity, clickable, callback) {

        this.map2D = map2D;

        var latLngBounds = new gm.LatLngBounds(new gm.LatLng(bottomRightLat, topLeftLng), new gm.LatLng(topLeftLat, bottomRightLng));

        this.color = options.color || '#ffffff';
        this.weight = options.thickness || 2;
        this.opacity = options.opacity == undefined ? 1.0 : options.opacity;
        this.fillopacity = options.fillOpacity == undefined ? 0.7 : options.fillOpacity;

        this.surface = new gm.Polygon({
            map: map2D.map,
            path: [],
            strokeColor: this.color,
            strokeWeight: this.weight,
            strokeOpacity: this.opacity,
            fillColor: options.fillColor || '#888888',
            fillOpacity: this.fillopacity,
            clickable: true
        });
        this.isHighlighted = false;
        this.editable = false;

        this.path = this.surface.getPath();

        if(options.callback != null && typeof options.callback == "function") {
            this.callback = options.callback;

            var _self = this;

            function markerDragged() {
                var bounds = new google.maps.LatLngBounds();
                bounds.extend(topLeftMarker.getPosition());
                bounds.extend(bottomRightMarker.getPosition());
                _self.callback(bounds.getNorthEast().lat(), bounds.getSouthWest().lng(), bounds.getSouthWest().lat(), bounds.getNorthEast().lng());
/*
                _self.callback(topLeftMarker.getPosition().lat(), topLeftMarker.getPosition().lng(), bottomRightMarker.getPosition().lat(), bottomRightMarker.getPosition().lng());
*/
                map2D.theTooltip.hide();
            }

            function markerDrag(marker, corner) {
                // update markers positions first
                if(corner) {
                    bottomLeftMarker.setPosition(new gm.LatLng(bottomRightMarker.getPosition().lat(), topLeftMarker.getPosition().lng()));
                    topRightMarker.setPosition(new gm.LatLng(topLeftMarker.getPosition().lat(), bottomRightMarker.getPosition().lng()));
                } else {
                    topLeftMarker.setPosition(new gm.LatLng(topRightMarker.getPosition().lat(), bottomLeftMarker.getPosition().lng()));
                    bottomRightMarker.setPosition(new gm.LatLng(bottomLeftMarker.getPosition().lat(), topRightMarker.getPosition().lng()));
                }
                // redraw rectangle
                _self.refreshRectangle();
                var position = marker.getPosition();
                map2D.theTooltip.show(position, "<p>Position: " + position.toUrlValue(4) + "</p>");
            }

            function addMarker(latLng, corner) {
                var marker = _.createMarker(map2D.map, latLng, _.defaultDragMarker);
                marker.setDraggable(true);
                _.setListener(marker, 'dragend', markerDragged);
                _.setListener(marker, 'drag', function() {
                    markerDrag(marker, corner);
                });
                return marker;
            }

            var topLeftMarker = addMarker(new gm.LatLng(latLngBounds.getNorthEast().lat(), latLngBounds.getSouthWest().lng()), true);
            var bottomRightMarker = addMarker(new gm.LatLng(latLngBounds.getSouthWest().lat(), latLngBounds.getNorthEast().lng()), true);
            var topRightMarker = addMarker(latLngBounds.getNorthEast(), false);
            var bottomLeftMarker = addMarker(latLngBounds.getSouthWest(), false);

            this.topLeftMarker = topLeftMarker;
            this.bottomRightMarker = bottomRightMarker;
            this.topRightMarker = topRightMarker;
            this.bottomLeftMarker = bottomLeftMarker;

            this.configureEditable("Click to graphically edit the corners of this Rectangle");

            this.refreshRectangle();
        } else {
            _.uniRectangle.refreshPath(this.path, new gm.LatLng(topLeftLat, topLeftLng), new gm.LatLng(bottomRightLat, bottomRightLng));
        }

        map2D.overlaysArray.push(this);

    }

    _.uniRectangle.prototype = new _.uniSurface();

    _.uniRectangle.refreshPath = function(path, topLeft, bottomRight) {
        // check the difference in longitude is below 180 degrees
        path.setAt(0, topLeft);
        var topRight = new gm.LatLng(topLeft.lat(), bottomRight.lng());
        path.setAt(1, topRight);
        path.setAt(2, bottomRight);
        var bottomLeft = new gm.LatLng(bottomRight.lat(), topLeft.lng());
        path.setAt(3, bottomLeft);
    }

    _.uniRectangle.prototype.refreshRectangle = function() {
        var topLeft = this.topLeftMarker.getPosition();
        var bottomRight = this.bottomRightMarker.getPosition();

        // refresh markers
        this.topRightMarker.setPosition(new gm.LatLng(topLeft.lat(), bottomRight.lng()));
        this.bottomLeftMarker.setPosition(new gm.LatLng(bottomRight.lat(), topLeft.lng()));

        // refresh the path
        _.uniRectangle.refreshPath(this.surface.getPath(), this.topLeftMarker.getPosition(), this.bottomRightMarker.getPosition());
    }

    _.uniRectangle.prototype.refreshMarkers = function() {
        var bounds = _._getPathBounds(this.surface.getPath());
        var northEast = bounds.getNorthEast();
        var southWest = bounds.getSouthWest();
        this.topLeftMarker.setPosition(new gm.LatLng(northEast.lat(), southWest.lng()));
        this.topRightMarker.setPosition(northEast);
        this.bottomRightMarker.setPosition(new gm.LatLng(southWest.lat(), northEast.lng()));
        this.bottomLeftMarker.setPosition(southWest);
    }

    _.uniRectangle.prototype._getBounds = function() {
        return _._getPathBounds(this.surface.getPath());
    }

    _.uniRectangle.prototype.getEOBounds = function() {
        return _.convertBounds(this._getBounds());
    }

    _.uniRectangle.prototype.setBounds = function(neLat, neLng, swLat, swLng) {
        _.uniRectangle.refreshPath(this.surface.getPath(), new gm.LatLng(swLat, swLng), new gm.LatLng(neLat, neLng));
        if(this.editable) {
            this.refreshMarkers();
        }
    }

    _.uniRectangle.prototype.getArea = function() {
        return gm.geometry.spherical.computeArea(this.surface.getPath());
    }

    _.uniRectangle.prototype._getCenter = function() {
        return this._getBounds().getCenter();
    }

    _.uniRectangle.prototype._setCenter = function(newCenter) {
        var center = this._getCenter();
        var deltaLat = newCenter.lat() - center.lat();
        var deltaLng = newCenter.lng() - center.lng();
        // update the markers first
        var topLeft = this.topLeftMarker.getPosition();
        var bottomRight = this.bottomRightMarker.getPosition();
        if(Math.abs(topLeft.lat() + deltaLat) >= 90.0 || Math.abs(bottomRight.lat() + deltaLat) >= 90.0) {
            return false;
        }
        this.topLeftMarker.setPosition(new gm.LatLng(topLeft.lat() + deltaLat, topLeft.lng() + deltaLng));
        this.bottomRightMarker.setPosition(new gm.LatLng(bottomRight.lat() + deltaLat, bottomRight.lng() + deltaLng));
        // update the rectangle
        this.refreshRectangle();
        return true;
    }

    _.uniRectangle.prototype.setEditMode = function(edit) {
        this.edit = edit;
        if(this.topLeftMarker) {
            this.topLeftMarker.setVisible(edit);
            this.bottomRightMarker.setVisible(edit);
            this.topRightMarker.setVisible(edit);
            this.bottomLeftMarker.setVisible(edit);
        }
    }

    _.uniRectangle.prototype.remove = function() {
        this.surface.setMap(null);
        if(this.topLeftMarker) {
            this.topLeftMarker.setMap(null);
            this.bottomRightMarker.setMap(null);
            this.bottomLeftMarker.setMap(null);
            this.topRightMarker.setMap(null);
        }
        this.map2D.theTooltip.hide();
    }

    _.createPolyline = function(map2D, color, thickness, opacity, clickable, geodesic, callback, initialLat, initialLng, dragMarkerIcon) {
        _.createPolypoints(map2D, {polygon: false, color: color, thickness: thickness, opacity: opacity, clickable: clickable, geodesic: geodesic, dragMarkerIcon: dragMarkerIcon}, callback, initialLat, initialLng);
    }

    //derive polyline implementation from polygon one
    _.uniPolyline = function(map2D, polylineCoordinates, color, thickness, opacity, clickable, geodesic, editCallback, editMarkerCallback, dragMarkerIcon, editMarkerIcon) {

        this.map2D = map2D;

        this.markers = [];
        this.editmarkers = [];
        this.editCallback = editCallback;
        this.editMarkerCallback = editMarkerCallback;

        this.surface = new gm.Polyline({
            map: map2D.map,
            path: _.generatePath(polylineCoordinates),
            strokeColor: color,
            strokeWeight: thickness,
            strokeOpacity: opacity,
            clickable: true,
            geodesic: geodesic
        });
        this.color = color;
        this.weight = thickness;
        this.opacity = opacity;
        this.geodesic = geodesic;
        this.isHighlighted = false;
        this.path = this.surface.getPath();
        this.editable = false;
        this.dragMarker = dragMarkerIcon;
        this.editMarker = editMarkerIcon;
        map2D.overlaysArray.push(this);
        this.minPoints = 2;

        if(typeof editCallback == "function") {
            this.editCallback = editCallback;
            this.editMarkerCallback = editMarkerCallback;
            this.markers = [];
            this.editmarkers = [];
            this.configureEditable("Click to graphically edit the points of this line");
        } else {
            this.editable = false;
        }

//		 var i;
//		 for(i = 0; i < polylineCoordinates.length;) {
//		     this.addPoint(new gm.LatLng(polylineCoordinates[i], polylineCoordinates[i + 1]));
//		     i = i + 2;
//		 }
//		 if(typeof this.editCallback == "function") {
//			this.updateEditMarkers(true);
//		 	this.configureEditable("Click to graphically edit the points");
//		 }

    }

    _.uniPolyline.prototype = new _.uniPolygon();

    _.uniPolyline.prototype.getLength = function() {
        return gm.geometry.spherical.computeLength(this.surface.getPath());
    }

    _.uniRuler = function(map2D, coordinates, color, thickness, opacity, editCallback, dragMarkerIcon, editMarkerIcon) {

        this.map2D = map2D;

        this.markers = [];
        this.editmarkers = [];
        this.editCallback = editCallback;

        this.surface = new gm.Polyline({
            map: map2D.map,
            path: _.generatePath(coordinates),
            strokeColor: color,
            strokeWeight: thickness,
            strokeOpacity: opacity,
            clickable: true,
            geodesic: true
        });
        this.color = color;
        this.weight = thickness;
        this.opacity = opacity;
        this.geodesic = true;
        this.isHighlighted = false;
        this.path = this.surface.getPath();
        this.editable = true;
        this.dragMarker = dragMarkerIcon;
        this.editMarker = editMarkerIcon;
        map2D.overlaysArray.push(this);
        this.minPoints = 2;

        this.configureEditable("Click on the grey circles to add a point to the ruler's path  or drag the markers");
        this.setEditMode(true);

    }

    _.uniRuler.prototype = new _.uniPolygon();

    _.uniRuler.prototype.configureEditable = function(tooltip) {
        var _self = this;
        this.edit = undefined;
        this.editable = true;
        _.setListener(this.surface, 'mousemove', function(event) {
            _self.map2D.theTooltip.show(event.latLng, "<p>" + tooltip + "</p>");
        });
        _.setListener(this.surface, 'mouseout', function() {
            _self.map2D.theTooltip.hide();
        });
    }

    //override the markers visibility to always keep the markers visible
    _.uniRuler.prototype.setMarkersVisibility = function(visible) {
        var i;
        for(i = 0; i < this.markers.length; i++) {
            this.markers[i].setVisible(true);
        }
        for(i = 0; i < this.editmarkers.length; i++) {
            this.editmarkers[i].setVisible(true);
        }
    }

    _.constrainedFrame = function(map2D, constraintCoords, bottomPercent, topPercent) {
        var map = map2D.map;
        var constraintPath = _.generatePath(constraintCoords);

        // find the corners

        var cal = gm.geometry.spherical;

        // calculate the different useful constraint variable
        var startPointA = constraintPath.getAt(0);
        var endPointA = constraintPath.getAt(1);
        var startPointB = constraintPath.getAt(3);
        var endPointB = constraintPath.getAt(2);

        var distanceA = cal.computeDistanceBetween(startPointA, endPointA);
        var headingA = cal.computeHeading(startPointA, endPointA);
        var headingB = cal.computeHeading(startPointB, endPointB);

        // calculate frame percentage and number of frames
        var framePercentage = cal.computeDistanceBetween(startPointA, new gm.LatLng(frameCoords[0], frameCoords[1])) / distanceA;
        var numberOfFrames = Math.round(cal.computeDistanceBetween(new gm.LatLng(frameCoords[0], frameCoords[1]), new gm.LatLng(frameCoords[2], frameCoords[3])) / frameLength);

        // generate inside path based on parameters passed
        var insidePath = new gm.MVCArray([cal.interpolate(startPointA, endPointA, framePercentage),
            cal.interpolate(startPointA, endPointA, framePercentage + (numberOfFrames * frameLength) / distanceA),
            cal.interpolate(startPointB, endPointB, framePercentage + (numberOfFrames * frameLength) / distanceA),
            cal.interpolate(startPointB, endPointB, framePercentage)
        ]);
        insidePath.setAt(4, insidePath.getAt(0));

        // Construct the polygon
        var polygon = new gm.Polygon({
            paths: insidePath,
            strokeColor: editable ? '#00FF00' : "#fff",
            strokeOpacity: 0.8,
            strokeWeight: editable ? 2 : 1,
            fillColor: '#eef',
            fillOpacity: editable ? 0.0 : 0.35,
            geodesic: true
        });
        polygon.setMap(map);
        this.surface = polygon;

        var insideDistanceA = cal.computeDistanceBetween(insidePath.getAt(0), insidePath.getAt(1));
        var insideDistanceB = cal.computeDistanceBetween(insidePath.getAt(3), insidePath.getAt(2));

        // draw the frames
        var polylines = [];
        var percentage = 1 / numberOfFrames;
        function drawFrames() {
            for(var index = 0; index < numberOfFrames + 1; index++) {
                var sideACoords = cal.interpolate(insidePath.getAt(0), insidePath.getAt(1), index * percentage);
                var sideBCoords = cal.interpolate(insidePath.getAt(3), insidePath.getAt(2), index * percentage);

                if(!polylines[index]) {
                    polylines[index] = new gm.Polyline({
                        map: map,
                        strokeColor: "#fff",
                        strokeWeight: 1,
                        strokeOpacity: index == 0 || index == numberOfFrames ? 0.0 : 0.5,
                        geodesic: true
                    });
                }
                polylines[index].setPath([sideACoords, sideBCoords]);
            }
        }
        drawFrames();

        if(editable) {

            function stopEditing() {
                map.setOptions({draggable: true});
            }

            // shifts a polygon following from to lat lng values
            function shiftConstrained(fromLatLng, toLatLng) {
                // calculate shift
                var deltaLat = toLatLng.lat() - fromLatLng.lat();
                var deltaLng = toLatLng.lng() - fromLatLng.lng();
                // calculate the heading
                var headingShift = cal.computeHeading(fromLatLng, toLatLng);
                // calculate the actual distance shift by projecting the shift against the side of the polygon, using the polygon heading angle
                // Headings are expressed in degrees clockwise from North within the range [-180,180)
                var distanceShift = cal.computeDistanceBetween(fromLatLng, toLatLng) * Math.cos(Math.PI * (headingShift - headingA) / 180.0);
                // calculate the shift percentage offset
                var percentage = (cal.computeDistanceBetween(startPointA, insidePath.getAt(0)) + distanceShift) / distanceA;
                var percentageConstrained = (cal.computeDistanceBetween(startPointA, insidePath.getAt(0)) + distanceShift + insideDistanceA) / distanceA;
                if(percentage > 0.0 && percentage < 1.0 && percentageConstrained > 0.0 && percentageConstrained < 1.0) {
                    // move the facing point by the percent amount
                    insidePath.setAt(0, cal.interpolate(startPointA, endPointA, percentage));
                    insidePath.setAt(3, cal.interpolate(startPointB, endPointB, percentage));
                    insidePath.setAt(4, insidePath.getAt(0));
                    // now apply constraint on next set of points
                    // use initial distances as the constraint
                    insidePath.setAt(1, cal.interpolate(startPointA, endPointA, percentageConstrained)); //cal.computeOffset(startPointA, insideDistanceA, headingA));
                    insidePath.setAt(2, cal.interpolate(startPointB, endPointB, percentageConstrained)); //cal.computeOffset(insidePath.getAt(3), insideDistanceB, headingB));
                }
                drawFrames();
            }

            // drag position
            var position = null;

        }

        this.polygon = polygon;
        this.polylines = polylines;
        this.insidePath = insidePath;
    }

    _.constrainedFrame.prototype = new _.uniPolygon();

    function mod(number, modulus) {
        return ((number % modulus) + modulus) % modulus;
    }

    _.uniTMSLayer = (function() {
        function t(map2D, baseUrlPattern, copyright, yFlip, swLat, swLng, neLat, neLng, isBaseLayer) {
            var _map = map2D.map;
            var bounds = null;
            if(swLat && neLat) {
                bounds = new gm.LatLngBounds(new gm.LatLng(swLat, swLng), new gm.LatLng(neLat, neLng));
            }

            var layer = new gm.ImageMapType({
                getTileUrl: function(coord, zoom){
                    var proj = _map.getProjection();
                    var zfactor = Math.pow(2, zoom);
                    // get Long Lat coordinates
                    var swCoord = proj.fromPointToLatLng(new gm.Point(coord.x * 256 / zfactor, (coord.y + 1) * 256 / zfactor));
                    var neCoord = proj.fromPointToLatLng(new gm.Point((coord.x + 1) * 256 / zfactor, coord.y * 256 / zfactor));
                    if(bounds) {
                        var tileLatLng = new gm.LatLngBounds(swCoord, neCoord);
                        if(!tileLatLng.intersects(bounds)) {
                            return "http://maps.gstatic.com/intl/en_us/mapfiles/transparent.png";
                        }
                    }
                    return baseUrlPattern.replace("$z", zoom).replace("$y", yFlip ? coord.y : (1 << zoom) - coord.y - 1).replace("$x", mod(coord.x, (1 << zoom)));
                },
                tileSize: new gm.Size(256,256),
                isPng:true
            });
            this._map = _map;
            this._layer = layer;
            this._layer.displayCopyright = function(display) {
                map2D.displayCopyright(copyright, display);
            }
            if(!isBaseLayer) {
                map2D.overlaysArray.push(this);
            }
        }

        t.prototype.setVisible = function (visible) {
            var overlayMaps = this._map.overlayMapTypes;
            // find the layer
            for (var i = 0, I = overlayMaps.length; i < I && overlayMaps.getAt(i) != this._layer; ++i);
            if(visible) {
                // add if the map was not already added
                if(i == overlayMaps.length) {
                    overlayMaps.push(this._layer);
                }
                this._layer.displayCopyright(true);
            } else {
                // remove if the map was added
                if(i < overlayMaps.length) {
                    overlayMaps.removeAt(i);
                }
                this._layer.displayCopyright(false);
            }
        }

        t.prototype.remove = function() {
            this.setVisible(false);
        }

        t.prototype.setOpacity = function(opacity) {
            if(this._layer) {
                this._layer.setOpacity(opacity);
            }
        }

        t.prototype.getOpacity = function() {
            if(this._layer) {
                return this._layer.getOpacity();
            } else {
                return 1.0;
            }
        }

        t.prototype.setToBottom = function() {
            this.setZIndex(0);
        }

        t.prototype.setOnTop = function() {
            this.setZIndex(overlayMaps.length);
        }

        t.prototype.setZIndex = function(zIndex) {
            var i = this.getZIndex();
            if(i == -1) {
                return;
            }
            var overlayMaps = this._map.overlayMapTypes;
            overlayMaps.removeAt(i);
            overlayMaps.insertAt(zIndex, this._layer);
        }

        t.prototype.getZIndex = function() {
            var overlayMaps = this._map.overlayMapTypes;
            for (var i = 0, I = overlayMaps.length; i < I && overlayMaps.getAt(i) != this._layer; ++i);
            return i == overlayMaps.length ? -1 : i;
        }

        return t;
    })();

    var srsConversions = {
        "EPSG:4326": function(latLng) {return {lat: latLng.lat(), lng: latLng.lng()}},
        "EPSG:3857": function(latLng) {
            if ((Math.abs(latLng.lng()) > 180 || Math.abs(latLng.lat()) > 90))
                return;

            var num = latLng.lng() * 0.017453292519943295;
            var x = 6378137.0 * num;
            var a = latLng.lat() * 0.017453292519943295;

            return {lng: x, lat: 3189068.5 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)))};
        }
    }
    // copy similar transforms
    srsConversions["CRS:84"] = srsConversions["EPSG:4326"];
    srsConversions["EPSG:102100"] = srsConversions["EPSG:3857"];
    srsConversions["EPSG:900913"] = srsConversions["EPSG:3857"];

/*
    _.uniWMSLayer = (function() {
        function w(map2D, baseUrl, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng, isBaseLayer) {
            var _map = map2D.map;
            srs = srs || "EPSG:4326";
            if(!srsConversions[srs]) {
                srs = "EPSG:4326";
            }
            var bounds = null;
            if(swLat && neLat) {
                bounds = new gm.LatLngBounds(new gm.LatLng(swLat, swLng), new gm.LatLng(neLat, neLng));
            }

            var version3 = version.indexOf("1.3") == 0;

            var tileSize = 512;
            var lURL = baseUrl;
            lURL += "REQUEST=GetMap";
            lURL += "&SERVICE=WMS";
            lURL += "&VERSION=" + version;
            lURL += "&LAYERS=" + layers;
            lURL += "&width=" + tileSize;
            lURL += "&height=" + tileSize;
            lURL += "&" + (version3 == true ? "crs" : "srs") + "=" + srs;
            lURL += "&TRANSPARENT=TRUE";
            if(styles) {
                lURL += "&styles=" + styles;
            }
            lURL += "&format=image/png";
            var srsConversion = srsConversions[srs];
            // for the projections that require axis inversion under version 3
            var invertAxisOrder = version3 == true && srs == "EPSG:4326";

            var layer = new gm.ImageMapType({
                getTileUrl: function (coord, zoom) {
                    var proj = _map.getProjection();
                    var zfactor = Math.pow(2, zoom);
                    var tileRange = 1 << (zoom - 1);
                    // get tile coordinates
                    // make sure coord.x is in the right range
                    var first = coord.x;
                    if (first < 0 || first >= tileRange) {
                        first = (first % tileRange + tileRange) % tileRange;
                    }
                    var swCoord = proj.fromPointToLatLng(new gm.Point(first * tileSize / zfactor, (coord.y + 1) * tileSize / zfactor));
                    var neCoord = proj.fromPointToLatLng(new gm.Point((first + 1) * tileSize / zfactor, coord.y * tileSize / zfactor));
                    if(bounds) {
                        var tileLatLng = new gm.LatLngBounds(new gm.LatLng(Math.min(swCoord.lat(), neCoord.lat()), Math.min(swCoord.lng(), neCoord.lng())),
                            new gm.LatLng(Math.max(swCoord.lat(), neCoord.lat()), Math.max(swCoord.lng(), neCoord.lng())));
                        // check the tile is within the bounds
                        if(!tileLatLng.intersects(bounds)) {
                            return "http://maps.gstatic.com/intl/en_us/mapfiles/transparent.png";
                        }
                    }
                    // convert from wgs84 lat,lng to new srs coordinates
                    var swConverted = srsConversion(new gm.LatLng(Math.min(swCoord.lat(), neCoord.lat()), Math.min(swCoord.lng(), neCoord.lng())));
                    var neConverted = srsConversion(new gm.LatLng(Math.max(swCoord.lat(), neCoord.lat()), Math.max(swCoord.lng(), neCoord.lng())));
                    //create the Bounding box string
                    // handles 1.3.0 wms by ordering lat, lng instead of lng, lat
                    // Bounding box for map extent. Value is minx,miny,maxx,maxy in units of the SRS.
                    var bbox;
                    if(invertAxisOrder) {
                        bbox = swConverted.lat + "," + swConverted.lng + "," + neConverted.lat + "," + neConverted.lng;
                    } else {
                        bbox = swConverted.lng + "," + swConverted.lat + "," + neConverted.lng + "," + neConverted.lat;
                    }
                    //base WMS URL
                    var url = lURL + "&BBOX=" + bbox; // set bounding box
                    return url; // return URL for the tile
                },
                isPng: true,
                tileSize: new gm.Size(tileSize, tileSize)
            });
            this._map = _map;
            this._layer = layer;
            this._layer.displayCopyright = function(display) {
                map2D.displayCopyright(copyright, display);
            }
            if(!isBaseLayer) {
                map2D.overlaysArray.push(this);
            }
        }

        w.prototype.setVisible = function (visible) {
            var overlayMaps = this._map.overlayMapTypes;
            // find the layer
            for (var i = 0, I = overlayMaps.length; i < I && overlayMaps.getAt(i) != this._layer; ++i);
            if(visible) {
                // add if the map was not already added
                if(i == overlayMaps.length) {
                    overlayMaps.push(this._layer);
                    this._layer.displayCopyright(true);
                }
            } else {
                // remove if the map was added
                if(i < overlayMaps.length) {
                    overlayMaps.removeAt(i);
                }
                this._layer.displayCopyright(false);
            }
        }

        w.prototype.remove = function() {
            this.setVisible(false);
        }

        w.prototype.setOpacity = function(opacity) {
            if(this._layer) {
                this._layer.setOpacity(opacity);
            }
        }

        w.prototype.getOpacity = function() {
            if(this._layer) {
                return this._layer.getOpacity();
            } else {
                return 1.0;
            }
        }

        w.prototype.setToBottom = function() {
            this.setZIndex(0);
        }

        w.prototype.setOnTop = function() {
            this.setZIndex(overlayMaps.length);
        }

        w.prototype.setZIndex = function(zIndex) {
            var i = this.getZIndex();
            if(i == -1) {
                return;
            }
            var overlayMaps = this._map.overlayMapTypes;
            overlayMaps.removeAt(i);
            overlayMaps.insertAt(zIndex, this._layer);
        }

        w.prototype.getZIndex = function() {
            var overlayMaps = this._map.overlayMapTypes;
            for (var i = 0, I = overlayMaps.length; i < I && overlayMaps.getAt(i) != this._layer; ++i);
            return i == overlayMaps.length ? -1 : i;
        }

        return w;
    })();
*/

    _.uniWMSLayer = (function() {
        function w(map2D, baseUrl, version, layers, copyright, styles, srs, swLat, swLng, neLat, neLng, isBaseLayer) {
            var _map = map2D.map;
            srs = srs || "EPSG:4326";
            if(!srsConversions[srs]) {
                srs = "EPSG:4326";
            }
            var bounds = new gm.LatLngBounds(new gm.LatLng(swLat ? swLat : -90.0, swLng ? swLng : -179.99999),
                new gm.LatLng(neLat ? neLat : 90.0, neLng ? neLng : 179.99999));

            var version3 = version.indexOf("1.3") == 0;

            var tileSize = 512;
            var lURL = baseUrl;
            lURL += "REQUEST=GetMap";
            lURL += "&SERVICE=WMS";
            lURL += "&VERSION=" + version;
            lURL += "&LAYERS=" + layers;
            lURL += "&width=" + tileSize;
            lURL += "&height=" + tileSize;
            lURL += "&" + (version3 == true ? "crs" : "srs") + "=" + srs;
            lURL += "&TRANSPARENT=TRUE";
            if(styles) {
                lURL += "&styles=" + styles;
            }
            lURL += "&format=image/png";
            var srsConversion = srsConversions[srs];
            // for the projections that require axis inversion under version 3
            var invertAxisOrder = version3 == true && srs == "EPSG:4326";

            function boundsIncluded(firstBound, secondBound) {
                return firstBound.contains(secondBound.getSouthWest()) && firstBound.contains(secondBound.getNorthEast());
            }

            function WMSLayerClipped(tileSize) {
                this.tileSize = tileSize;
                this.tiles = [];
                this.opacity = 1.0;
                this.mapListener = [];
                var _self = this;
                this.mapListener.push(google.maps.event.addListener(_map, 'bounds_changed', function(e) {_self.updateMarker();}));
            }

            WMSLayerClipped.prototype.activateClipping = function(activate) {
                if(activate) {
                    // initialise clip bounds
                    this.clipBounds = new gm.LatLngBounds(bounds.getSouthWest(),
                        new gm.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng() +
                            (bounds.getNorthEast().lng() - bounds.getSouthWest().lng())));
                    this.marker = _.createMarker(map2D.map, this.getMarkerPosition(this.clipBounds.getNorthEast().lng()), {
                        url: "./img/dragClipIcon.png",
                        shiftX: 12,
                        shiftY: 12
                    });
                    this.marker.setDraggable(true);
                    var _self = this;
                    google.maps.event.addListener(this.marker, "drag", function(e) {_self.markerUpdated(e);});
                    google.maps.event.addListener(this.marker, "dragend", function(e) {_self.markerUpdated(e);});
                    this.marker.setTitle("Drag to move bounds for overlay");
                } else {
                    if(this.marker) {
                        this.marker.setMap(null);
                        this.marker = null;
                    }
                    this.clipBounds = null;
                }
                this.updateTiles();
            }

            WMSLayerClipped.prototype.markerUpdated = function(e) {
                var clipBounds = this.clipBounds;
                var latLng = e.latLng;
                // make sure the marker stays within the boundaries of the layer
                var lng = Math.max(Math.min(latLng.lng(), bounds.getNorthEast().lng()), bounds.getSouthWest().lng());
                var swCorner = new gm.LatLng(clipBounds.getSouthWest().lat(), clipBounds.getSouthWest().lng());
                var neCorner = new gm.LatLng(clipBounds.getNorthEast().lat(), lng);
                this.clipBounds = new gm.LatLngBounds(
                    swCorner,
                    neCorner);
                this.updateTiles();
                // force marker position
                this.updateMarker();
            }

            WMSLayerClipped.prototype.getMarkerPosition = function(lng) {
                var clipBounds = this.clipBounds;
                var mapBounds = _map.getBounds();
                // position the marker to be vertically centered of the layer bounds as well as the map bounds which ever is smaller
                var lat;
                if(!mapBounds.intersects(clipBounds) || boundsIncluded(mapBounds, clipBounds)) {
                    lat = clipBounds.getSouthWest().lat() +
                        (clipBounds.getNorthEast().lat() - clipBounds.getSouthWest().lat()) / 2;
                } else {
                    if(mapBounds.getNorthEast().lat() < clipBounds.getNorthEast().lat() &&
                        mapBounds.getSouthWest().lat() > clipBounds.getSouthWest().lat()) {
                        lat = mapBounds.getSouthWest().lat() +
                            (mapBounds.getNorthEast().lat() - mapBounds.getSouthWest().lat()) / 2;
                    } else if(mapBounds.getNorthEast().lat() < clipBounds.getNorthEast().lat()) {
                        lat = clipBounds.getSouthWest().lat() +
                            (mapBounds.getNorthEast().lat() - clipBounds.getSouthWest().lat()) / 2;
                    } else {
                        lat = mapBounds.getSouthWest().lat() +
                            (clipBounds.getNorthEast().lat() - mapBounds.getSouthWest().lat()) / 2;
                    }
                }
                // if the image is visible but the marker is outside the map bounds, make sure it appears on the east side
                if(mapBounds.intersects(clipBounds) && lng > mapBounds.getNorthEast().lng()) {
                    lng = mapBounds.getNorthEast().lng()
                }
                return new gm.LatLng(lat, lng);
            }

            WMSLayerClipped.prototype.updateMarker = function() {
                if(this.marker) {
                    this.marker.setPosition(this.getMarkerPosition(this.clipBounds.getNorthEast().lng()));
                }
            }

            WMSLayerClipped.prototype.maxZoom = 19;
            WMSLayerClipped.prototype.name = 'Tile #s';
            WMSLayerClipped.prototype.alt = 'Tile Coordinate Map Type';

            WMSLayerClipped.prototype.getTile = function(coord, zoom, ownerDocument) {
                var proj = _map.getProjection();
                var zfactor = Math.pow(2, zoom);
                var tileRange = 1 << (zoom - 1);
                // get tile coordinates
                // make sure coord.x is in the right range
                var first = coord.x;
                if (first < 0 || first >= tileRange) {
                    first = (first % tileRange + tileRange) % tileRange;
                }
                var swCoord = proj.fromPointToLatLng(new gm.Point(first * tileSize / zfactor, (coord.y + 1) * tileSize / zfactor));
                var neCoord = proj.fromPointToLatLng(new gm.Point((first + 1) * tileSize / zfactor, coord.y * tileSize / zfactor));
                var tileLatLng = new gm.LatLngBounds(new gm.LatLng(Math.min(swCoord.lat(), neCoord.lat()), Math.min(swCoord.lng(), neCoord.lng())),
                    new gm.LatLng(Math.max(swCoord.lat(), neCoord.lat()), Math.max(swCoord.lng(), neCoord.lng())));
                var containerDiv = ownerDocument.createElement('div');
                containerDiv.style.background = 'none';
                containerDiv.style.backgroundSize = 'cover';
                // containerDiv.style.border = '1px solid white';
                var div = document.createElement('div');
                div.style.position = 'relative';
                div.style.background = 'none';
                div.style.backgroundSize = 'cover';
                containerDiv.appendChild(div);
                var _self = this;
                containerDiv.updateClip = function() {
                    // remove border by default
                    if(div.border) {
                        div.removeChild(div.border);
                        delete div.border;
                    }
                    var clipBounds = _self.clipBounds;
                    if(!clipBounds) {
                        clipBounds = bounds;
                    }
                    var isClipping = clipBounds != bounds;
                    var width = tileSize, height = tileSize;
                    // check the tile is within the bounds
                    if(!tileLatLng.intersects(clipBounds)) {
                        url = "http://maps.gstatic.com/intl/en_us/mapfiles/transparent.png";
                    } else {
                        // convert from wgs84 lat,lng to new srs coordinates
                        var swConverted = srsConversion(new gm.LatLng(Math.min(swCoord.lat(), neCoord.lat()), Math.min(swCoord.lng(), neCoord.lng())));
                        var neConverted = srsConversion(new gm.LatLng(Math.max(swCoord.lat(), neCoord.lat()), Math.max(swCoord.lng(), neCoord.lng())));
                        //create the Bounding box string
                        // handles 1.3.0 wms by ordering lat, lng instead of lng, lat
                        // Bounding box for map extent. Value is minx,miny,maxx,maxy in units of the SRS.
                        var bbox;
                        if(invertAxisOrder) {
                            bbox = swConverted.lat + "," + swConverted.lng + "," + neConverted.lat + "," + neConverted.lng;
                        } else {
                            bbox = swConverted.lng + "," + swConverted.lat + "," + neConverted.lng + "," + neConverted.lat;
                        }
                        //base WMS URL
                        url = lURL + "&BBOX=" + bbox; // set bounding box
                        if(isClipping) {
                            // update width and height if necessary
                            var edge = tileLatLng.getSouthWest().lng() < clipBounds.getNorthEast().lng() &&
                                tileLatLng.getNorthEast().lng() > clipBounds.getNorthEast().lng();
                            if(edge) {
                                // calculate width
                                width = tileSize *
                                    (clipBounds.getNorthEast().lng() - tileLatLng.getSouthWest().lng()) /
                                    (tileLatLng.getNorthEast().lng() - tileLatLng.getSouthWest().lng());
                                // add a border
                                var tileHeight = tileLatLng.getNorthEast().lat() - tileLatLng.getSouthWest().lat();
                                // check position of tile
                                var border = document.createElement('div');
                                border.style.position = 'absolute';
                                border.style.width = '0px';
                                border.style.background = 'none';
                                border.style.right = '0px';
                                // we are on the top tile
                                var topCorner = clipBounds.getNorthEast().lat() < tileLatLng.getNorthEast().lat();
                                var bottomCorner = clipBounds.getSouthWest().lat() > tileLatLng.getSouthWest().lat();
                                var bottom = 0, heightBorder = tileSize;
                                if(topCorner) {
                                    if(bottomCorner) {
                                        // fully contained within the tile
                                        bottom = (tileSize *
                                            (clipBounds.getSouthWest().lat() - tileLatLng.getSouthWest().lat()) /
                                            tileHeight);
                                        heightBorder = tileSize *
                                            (clipBounds.getNorthEast().lat() - clipBounds.getSouthWest().lat()) /
                                            tileHeight;
                                    } else {
                                        bottom = 0;
                                        heightBorder = tileSize *
                                            (clipBounds.getNorthEast().lat() - tileLatLng.getSouthWest().lat()) /
                                            tileHeight;
                                    }
                                } else if(bottomCorner) {
                                    heightBorder = (tileSize *
                                        (tileLatLng.getNorthEast().lat() - clipBounds.getSouthWest().lat()) /
                                        tileHeight);
                                    bottom = tileSize - heightBorder;
                                } else {
                                    // full tile
                                }
                                border.style.bottom = bottom + 'px';
                                border.style.height = heightBorder + 'px';
                                border.style.borderRight = 'solid 2px #FFFFFF';
                                div.appendChild(border);
                                div.border = border;
                            }
                        }
                    }
                    div.style.backgroundImage = "url('" + url + "')";
                    div.style.width = Math.floor(width) + 'px';
                    div.style.height = height + 'px';
                }
                containerDiv.updateClip();
                updateOpacity(containerDiv, this.opacity);
                this.tiles.push(containerDiv);
                return containerDiv;
            };

            WMSLayerClipped.prototype.releaseTile = function(node) {
                var index = this.tiles.indexOf(node);
                if(index > -1) {
                    this.tiles.splice(index, 1);
                }
            }

            WMSLayerClipped.prototype.setClip = function(width) {
                width = Math.min(Math.max(width, 0.0), 1.0);
                // calculate new bounds
                this.clipBounds = new gm.LatLngBounds(bounds.getSouthWest(),
                    new gm.LatLng(bounds.getNorthEast().lat(), bounds.getSouthWest().lng() +
                        (bounds.getNorthEast().lng() - bounds.getSouthWest().lng()) * width));
                this.updateTiles();
                this.updateMarker();
            }

            WMSLayerClipped.prototype.updateTiles = function() {
                // update tiles width
                var index;
                for(index = 0; index < this.tiles.length; index++) {
                    this.tiles[index].updateClip();
                }
            }

            function updateOpacity(div, opacity) {
                opacity = Math.max(0, Math.min(opacity, 1.0));
                div.style.opacity = opacity;
                div.style.filter = 'alpha(opacity=' + (opacity * 100) + ")";
            }

            WMSLayerClipped.prototype.setOpacity = function(opacity) {
                this.opacity = opacity;
                // update tiles width
                var index;
                for(index = 0; index < this.tiles.length; index++) {
                    updateOpacity(this.tiles[index], this.opacity);
                }
            }

            WMSLayerClipped.prototype.getOpacity = function() {
                return this.opacity;
            }

            this._map = _map;
            this._layer = new WMSLayerClipped(new gm.Size(tileSize, tileSize));
            this._layer.displayCopyright = function(display) {
                map2D.displayCopyright(copyright, display);
            }
            if(!isBaseLayer) {
                map2D.overlaysArray.push(this);
            }
        }

        w.prototype.setClippedWidth = function (widthPercent) {
            this._layer.setClip(widthPercent / 100.0);
        }

        w.prototype.setVisible = function (visible) {
            var overlayMaps = this._map.overlayMapTypes;
            // find the layer
            var i = this.getMapIndex(this._layer);
            if(visible) {
                // add if the map was not already added
                if(i == -1) {
                    insertLayerInMap(overlayMaps, this._layer);
                    this._layer.displayCopyright(true);
                }
            } else {
                // remove if the map was added
                if(i != -1) {
                    overlayMaps.removeAt(i);
                }
                this._layer.displayCopyright(false);
            }
        }

        w.prototype.remove = function() {
            this.setVisible(false);
        }

        w.prototype.activateClipping = function(activate) {
            this._layer.activateClipping(activate);
        }

        w.prototype.setOpacity = function(opacity) {
            if(this._layer) {
                this._layer.setOpacity(opacity);
            }
        }

        w.prototype.getOpacity = function() {
            if(this._layer) {
                return this._layer.getOpacity();
            } else {
                return 1.0;
            }
        }

        w.prototype.setToBottom = function() {
            this.setZIndex(0);
        }

        w.prototype.setOnTop = function() {
            var overlayMaps = this._map.overlayMapTypes;
            this.setZIndex(overlayMaps.length);
        }

        w.prototype.setZIndex = function(zIndex) {
            this._layer.zIndex = zIndex;
            var i = this.getMapIndex(this._layer);
            if(i == - 1) {
                return;
            }
            var overlayMaps = this._map.overlayMapTypes;
            overlayMaps.removeAt(i);
            insertLayerInMap(overlayMaps, this._layer);
        }

        w.prototype.getMapIndex = function(layer) {
            var overlayMaps = this._map.overlayMapTypes;
            for (var i = 0, I = overlayMaps.length; i < I && overlayMaps.getAt(i) != this._layer; ++i);
            return i == overlayMaps.length ? -1 : i;
        }

        w.prototype.getZIndex = function() {
            return this._layer.zIndex;
        }

        return w;
    })();

    _.uniWFSLayer = (function() {
        function w(map2D, baseUrl, version, typeNames, copyright, style,
                   count, idPropertyName, featureID, propertyName,  sortBy) {

            var _map = map2D.map;

            var version2 = version.indexOf("2.0.0") == 0;
            if(!count)
                count=100;

            var lURL = baseUrl;
            lURL += "SERVICE=WFS";
            lURL += "&REQUEST=GetFeature";
            lURL += "&VERSION=" + version;
            lURL += "&" + (version2 == true ? "typeNames" : "typeName") + "=" + typeNames;
            lURL += "&outputFormat=application/json";
            lURL += "&" + (version2 == true ? "count" : "maxFeatures") + "=" + count;

            if(featureID)
                lURL += "&featureID=" + featureID;
            if(propertyName)
                lURL += "&propertyName=" + propertyName;
            if(sortBy)
                lURL += "&sortBy=" + sortBy;
            lURL += "&srsName=EPSG:4326";

            this._bbox = _map.getBounds().getSouthWest().lng() + "," +
                         _map.getBounds().getSouthWest().lat() + "," +
                _map.getBounds().getNorthEast().lng() + "," +
                _map.getBounds().getNorthEast().lat();

            this._url = lURL;
            this._map = _map;
            this._features = null;
            this._idPropertyName = idPropertyName;
            this._featureID = featureID;
            this._visible;
            //google.maps.Data.StyleOptions object specification
            this._styleOptions = JSON.parse(style);
            this._styleFunction;

            that = this;
            gme.addListener(_map, 'idle', function() {

                that._bbox = _map.getBounds().getSouthWest().lng() + "," +
                    _map.getBounds().getSouthWest().lat() + "," +
                    _map.getBounds().getNorthEast().lng() + "," +
                    _map.getBounds().getNorthEast().lat();

                if(that._visible) {
                    that.update();
                }

            });

            this.displayCopyright = function(display) {
                map2D.displayCopyright(copyright, display);
            }
        }

        w.prototype.setVisible = function (visible) {
            this._visible = visible;

            if (visible) {
                this.update();
                this.displayCopyright(true);

            } else {
                // remove if the map was added
                this.removeAll();
                this.displayCopyright(false);
            }
        }

        w.prototype.removeAll = function() {
            if (this._features != null) {
                for (var i=0; i < this._features.length; i++)
                    this._map.data.remove(this._features[i]);
            }
        }

        w.prototype.update = function() {
            // add if the map was not already added
            bbox = "";
            if (!this._featureID)
                bbox = "&bbox=" + this._bbox;
            url = this._url + bbox;
            that = this;
            /*this._map.data.loadGeoJson(url, {idPropertyName: this._idPropertyName}, function (features) {
                that._features = features;
                that.applyStyle();
            });*/

            var xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onload = function() {
                var response = JSON.parse(xhr.responseText);
                that.removeAll();
                that._features = that._map.data.addGeoJson(response, {idPropertyName: that._idPropertyName});
                //that._features = response.features;
                that.applyStyle();
            };
            xhr.send();
        }

        w.prototype.setFillOpacity = function(opacity) {

            if(this._styleOptions) {
                this._styleOptions.fillOpacity = opacity;
            }

            //this._map.data.revertStyle();
            this.applyStyle();

        }

        w.prototype.setStrokeOpacity = function(opacity) {
            if(this._styleOptions) {
                this._styleOptions.strokeOpacity = opacity;
            }

            //this._map.data.revertStyle();
            this.applyStyle();
        }

        w.prototype.getStrokeOpacity = function() {
            if(this._styleOptions) {
                return this._styleOptions.strokeOpacity;
            } else {
                return 1.0;
            }
        }

        w.prototype.getFillOpacity = function() {
            if(this._styleOptions) {
                return this._styleOptions.fillOpacity;
            } else {
                return 1.0;
            }
        }

        w.prototype.setToBottom = function() {
            this.setZIndex(0);
        }

        w.prototype.setOnTop = function() {
            var overlayMaps = this._map.overlayMapTypes;
            this.setZIndex(overlayMaps.length);
        }

        w.prototype.setZIndex = function(zIndex) {

            if(this._styleOptions) {
                this._styleOptions.zIndex = zIndex;
            }

            //this._map.data.revertStyle();
            this.applyStyle();

        }

        w.prototype.getZIndex = function() {

            if(this._styleOptions) {
                this._styleOptions.zIndex = zIndex;
            }

            return this._styleOptions.zIndex;
        }

        w.prototype.setStyleFunction = function(styleFunction){
            this._styleFunction = styleFunction;
            this._map.data.setStyle( this._styleFunction);
            this._styleOptions = null;
        }

        w.prototype.applyStyle = function(){
            if(this._features && this._styleOptions)
            {
                for (var i=0; i < this._features.length; i++)
                    this._map.data.overrideStyle(this._features [i], this._styleOptions);
            }

        }


        return w;
    })();

    function insertLayerInMap(overlayMaps, _layer) {
        // insert where zIndex is higher than the others
        var i;
        for(i = 0; i < overlayMaps.length; i++) {
            var layer = overlayMaps.getAt(i);
            if(layer.zIndex && layer.zIndex > _layer.zIndex) {
                overlayMaps.insertAt(i, _layer);
                return;
            }
        }
        // if not found, add at the end
        overlayMaps.push(_layer);
    }

    _.codeAddress = function(address, callback) {
        if(!this.geocoder) {
            this.geocoder = new gm.Geocoder();
        }
        this.geocoder.geocode( {'address': address, 'partialmatch': true}, function(results, status) {
            if(status == gm.GeocoderStatus.OK) {
                var result = [];
                for(var index = 0; index < results.length; index++) {
                    var value = results[index];
                    var bounds = value.geometry.bounds;
                    if(!bounds) {
                        bounds = value.geometry.viewport;
                    }
                    result[index] = {placeName: value.formatted_address,
                        lat: value.geometry.location.lat(), lng: value.geometry.location.lng(),
                        swlat: bounds.getSouthWest().lat(), swlng: bounds.getSouthWest().lng(), nelat: bounds.getNorthEast().lat(), nelng: bounds.getNorthEast().lng()};
                }
                callback(result, status);
            } else {
                callback(null, "" + status);
            }
        });
    }

    _.getElevations = function(coordinates, samples, callback) {
        if(!this.elevationService) {
            this.elevationService = new gm.ElevationService();
        }
        var i;
        var latLngs = [];
        for(i = 0; i < coordinates.length;) {
            latLngs.push(new gm.LatLng(coordinates[i], coordinates[i + 1]));
            i = i + 2;
        }
        this.elevationService.getElevationAlongPath({path: latLngs, samples: samples},
            function(results) {
                if(results == null) {
                    callback(null);
                } else {
                    var result = [];
                    for(var index = 0; index < results.length; index++) {
                        result[index] = {lat: results[index].location.lat(), lng: results[index].location.lng(), elevation: results[index].elevation};
                    }
                    callback(result);
                }
            }
        );
    }

    // Graticule for google.maps v3
    //
    // Adapted from Bill Chadwick 2006 http://www.bdcc.co.uk/Gmaps/BdccGmapBits.htm
    // which is free for any use.
    //
    // This work is licensed under the Creative Commons Attribution 3.0 Unported
    // License. To view a copy of this license, visit
    // http://creativecommons.org/licenses/by/3.0/ or send a letter to Creative
    // Commons, 171 Second Street, Suite 300, San Francisco, California, 94105,
    // USA.
    //
    // Matthew Shen 2011
    //
    // Reworked some more by Bill Chadwick ...
    //
    var Graticule = (function() {
        function _(map, sexagesimal) {
            // default to decimal intervals
            this.sex_ = sexagesimal || false;
            this.set('container', document.createElement('DIV'));
            this.setMap(map);
        }
        _.prototype = new google.maps.OverlayView();
        _.prototype.addDiv = function(div) {
            this.get('container').appendChild(div);
        },
            _.prototype.decToSex = function(d) {
                var degs = Math.floor(d);
                var mins = ((Math.abs(d) - degs) * 60.0).toFixed(2);
                if (mins == "60.00") { degs += 1.0; mins = "0.00"; }
                return [degs, ":", mins].join('');
            };
        _.prototype.onAdd = function() {
            var self = this;
            this.getPanes().mapPane.appendChild(this.get('container'));
            function redraw() {
                self.draw();
            }
            this.idleHandler_ = google.maps.event.addListener(this.getMap(), 'idle', redraw);
            function changeColor() {
                self.draw();
            }
            changeColor();
            this.typeHandler_ = google.maps.event.addListener(this.getMap(), 'maptypeid_changed', changeColor);
        };
        _.prototype.clear = function() {
            var container = this.get('container');
            while (container.hasChildNodes()) {
                container.removeChild(container.firstChild);
            }
        };
        _.prototype.onRemove = function() {
            this.get('container').parentNode.removeChild(this.get('container'));
            this.set('container', null);
            google.maps.event.removeListener(this.idleHandler_);
            google.maps.event.removeListener(this.typeHandler_);
        };
        _.prototype.show = function() {
            this.get('container').style.visibility = 'visible';
        };
        _.prototype.hide = function() {
            this.get('container').style.visibility = 'hidden';
        };
        function _bestTextColor(overlay) {
            var type = overlay.getMap().getMapTypeId();
            var GMM = google.maps.MapTypeId;
            if (type === GMM.HYBRID) return '#fff';
            if (type === GMM.ROADMAP) return '#000';
            if (type === GMM.SATELLITE) return '#fff';
            if (type === GMM.TERRAIN) return '#000';
            var mt = overlay.getMap().mapTypes[type];
            return (mt.textColor) ? mt.textColor : '#fff'; //ported legacy V2 map layers may have a textColor property
        };
        function gridPrecision(dDeg) {
            if (dDeg < 0.01) return 3;
            if (dDeg < 0.1) return 2;
            if (dDeg < 1) return 1;
            return 0;
        }
        function leThenReturn(x, l, d) {
            for (var i = 0; i < l.length; i += 1) {
                if (x <= l[i]) {
                    return l[i];
                }
            }
            return d;
        }
        var numLines = 10;
        var decmins = [
            0.06, // 0.001 degrees
            0.12, // 0.002 degrees
            0.3, // 0.005 degrees
            0.6, // 0.01 degrees
            1.2, // 0.02 degrees
            3, // 0.05 degrees
            6, // 0.1 degrees
            12, // 0.2 degrees
            30, // 0.5
            60, // 1
                60 * 2,
                60 * 5,
                60 * 10,
                60 * 20,
                60 * 30
        ];
        var sexmins = [
            0.01, // minutes
            0.02,
            0.05,
            0.1,
            0.2,
            0.5,
            1.0,
            3, // 0.05 degrees
            6, // 0.1 degrees
            12, // 0.2 degrees
            30, // 0.5
            60, // 1
                60 * 2,
                60 * 5,
                60 * 10,
                60 * 20,
                60 * 30
        ];
        function mins_list(overlay) {
            if (overlay.sex_) return sexmins;
            return decmins;
        }
        function latLngToPixel(overlay, lat, lng) {
            return overlay.getProjection().fromLatLngToDivPixel(
                new google.maps.LatLng(lat, lng));
        };
        // calculate rounded graticule interval in decimals of degrees for supplied
        // lat/lon span return is in minutes
        function gridInterval(dDeg, mins) {
            return leThenReturn(Math.ceil(dDeg / numLines * 6000) / 100, mins,
                    60 * 45) / 60;
        }
        function npx(n) {
            return n.toString() + 'px';
        }
        function makeLabel(color, x, y, text) {
            var d = document.createElement('DIV');
            var s = d.style;
            s.position = 'absolute';
            s.left = npx(x);
            s.top = npx(y);
            s.color = color;
            s.width = '3em';
            s.fontSize = '1.0em';
            s.whiteSpace = 'nowrap';
            d.innerHTML = text;
            return d;
        };
        function createLine(x, y, w, h, color) {
            var d = document.createElement('DIV');
            var s = d.style;
            s.position = 'absolute';
            s.overflow = 'hidden';
            s.backgroundColor = color;
            s.opacity = 0.3;
            var s = d.style;
            s.left = npx(x);
            s.top = npx(y);
            s.width = npx(w);
            s.height = npx(h);
            return d;
        };
        var span = 50000;
        function meridian(px, color) {
            return createLine(px, -span, 1, 2 * span, color);
        }
        function parallel(py, color) {
            return createLine(-span, py, 2 * span, 1, color);
        }
        function eqE(a, b, e) {
            if (!e) {
                e = Math.pow(10, -6);
            }
            if (Math.abs(a - b) < e) {
                return true;
            }
            return false;
        }
        // Redraw the graticule based on the current projection and zoom level
        _.prototype.draw = function() {
            var color = _bestTextColor(this);
            this.clear();
            if (this.get('container').style.visibility != 'visible') {
                return;
            }
            // determine graticule interval
            var bnds = this.getMap().getBounds();
            if (!bnds) {
                // The map is not ready yet.
                return;
            }
            var sw = bnds.getSouthWest(),
                ne = bnds.getNorthEast();
            var l = sw.lng(),
                b = sw.lat(),
                r = ne.lng(),
                t = ne.lat();
            if (l == r) { l = -180.0; r = 180.0; }
            if (t == b) { b = -90.0; t = 90.0; }
            // grid interval in degrees
            var mins = mins_list(this);
            var dLat = gridInterval(t - b, mins);
            var dLng = gridInterval(r > l ? r - l : ((180 - l) + (r + 180)), mins);
            // round iteration limits to the computed grid interval
            l = Math.floor(l / dLng) * dLng;
            b = Math.floor(b / dLat) * dLat;
            t = Math.ceil(t / dLat) * dLat;
            r = Math.ceil(r / dLng) * dLng;
            if (r == l) l += dLng;
            if (r < l) r += 360.0;
            // lngs
            var crosslng = l + 2 * dLng;
            // labels on second column to avoid peripheral controls
            var y = latLngToPixel(this, b + 2 * dLat, l).y + 2;
            // lo<r to skip printing 180/-180
            for (var lo = l; lo < r; lo += dLng) {
                if (lo > 180.0) {
                    r -= 360.0;
                    lo -= 360.0;
                }
                var px = latLngToPixel(this, b, lo).x;
                this.addDiv(meridian(px, color));
                var atcross = eqE(lo, crosslng);
                this.addDiv(makeLabel(color,
                        px + (atcross ? 17 : 3), y - (atcross ? 3 : 0),
                    (this.sex_ ? this.decToSex(lo) : lo.toFixed(gridPrecision(dLng)))));
            }
            // lats
            var crosslat = b + 2 * dLat;
            // labels on second row to avoid controls
            var x = latLngToPixel(this, b, l + 2 * dLng).x + 3;
            for (; b <= t; b += dLat) {
                var py = latLngToPixel(this, b, l).y;
                this.addDiv(parallel(py, color));
                this.addDiv(makeLabel(color,
                    x, py + (eqE(b, crosslat) ? 7 : 2),
                    (this.sex_ ? this.decToSex(b) : b.toFixed(gridPrecision(dLat)))));
            }
        };
        return _;
    })();

    return _;
})();

