var editor = (function(self) {
    var saveAs =
        window.webkitSaveAs
        || window.mozSaveAs
        || window.msSaveAs
        || window.navigator.msSaveBlob && function(blob, name) {
                    return window.navigator.msSaveBlob(blob, name);
            }
        || function(blob, name) {
            var click = document.createEvent("MouseEvent");
            click.initMouseEvent("click", true, true, window, 0, 
                event.screenX, event.screenY, event.clientX, event.clientY, 
                event.ctrlKey, event.altKey, event.shiftKey, event.metaKey, 
                0, null);
            var a = document.createElement('a');
            a.setAttribute('href', URL.createObjectURL(blob));
            a.setAttribute('download', name);
            a.dispatchEvent(click);
        };

    var dataUrlToBlob = function(url) {
        var parts = url.split(',');
        var contentType = parts[0].split(':')[1].split(';');
        var mimeType = contentType[0];
        var encoding = contentType[1];
        var data = parts[1];

        if (encoding == 'base64') {
            var bytes = window.atob(data);
            var buffer = new Uint8Array(bytes.length);
            for (var i = 0; i < bytes.length; i++) {
                buffer[i] = bytes.charCodeAt(i);
            }
            return new Blob([buffer], {type: mimeType});
        } else {
            return new Blob([data], {type: mimeType});
        }
    }

    var canvasToBlob = function(canvas, callback) {
        if(canvas.toBlob) {
            canvas.toBlob(callback);
        } else {
            callback(dataUrlToBlob(canvas.toDataURL()));
        }
    }

    var inputCanvas = null;
    var filePicker = null;
    var currentFile = null;
    var tilesetContainer = null;
    var paletteContainer = null;
    var mapContainer = null;
    var removeDuplicatesCheckbox = null;
    var tileLimitField = null;

    var restrictions = {
        tiles: {
            width: 8,
            height: 8,
            max: 256,
            removeDuplicates: true
        },
        attributes: {
            width: 8,
            height: 8
        },
        colors: {
            max: 4
        },
        palettes: {
            max: 8,
            combineIncompleteEntries: true
        }
    }
    var currentMap = null;


    self.init = function(config) {
        var div = document.createElement('div');
        div.className = 'section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Input'));
        div.appendChild(h2);
        var p = document.createElement('p');
        p.appendChild(document.createTextNode('Source file may be .png or .gif. You can drag and drop files here.'));
        div.appendChild(p);
        var p = document.createElement('p');
        p.appendChild(document.createTextNode('Tile limit: '));
        tileLimitField = document.createElement('input');
        tileLimitField.setAttribute('type', 'text');
        tileLimitField.setAttribute('value', '256');
        p.appendChild(tileLimitField);
        p.appendChild(document.createTextNode('\u00A0\u00A0\u00A0\u00A0'));
        removeDuplicatesCheckbox = document.createElement('input');
        removeDuplicatesCheckbox.setAttribute('type', 'checkbox');
        removeDuplicatesCheckbox.setAttribute('value', '');
        removeDuplicatesCheckbox.setAttribute('checked', 'checked');
        p.appendChild(removeDuplicatesCheckbox);
        p.appendChild(document.createTextNode('Remove Duplicate Tiles'));
        div.appendChild(p);
        var fileContainer = document.createElement('div');
        fileContainer.className = 'file_picker';
        var p = document.createElement('p');
        p.appendChild(document.createTextNode('Browse...'));
        fileContainer.appendChild(p);
        filePicker = document.createElement('input');
        filePicker.setAttribute('type', 'file');
        filePicker.addEventListener('change', self.changeFile);
        fileContainer.appendChild(filePicker);
        div.appendChild(fileContainer);
        inputCanvas = document.createElement('canvas');
        inputCanvas.appendChild(document.createTextNode('This application requires HTML5 support.'));
        inputCanvas.width = 0;
        inputCanvas.height = 0;
        div.appendChild(inputCanvas);
        config.element.appendChild(div);

        tilesetContainer = document.createElement('div');
        tilesetContainer.className = 'hidden';
        config.element.appendChild(tilesetContainer);

        paletteContainer = document.createElement('div');
        paletteContainer.className = 'hidden';
        config.element.appendChild(paletteContainer);

        mapContainer = document.createElement('div');
        mapContainer.className = 'hidden';
        config.element.appendChild(mapContainer);

        document.ondragover = function() { return false; };
        document.ondragend = function() { return false; };
        document.ondrop = self.changeFile;
    }

    self.changeFile = function(event) {
        event.preventDefault();

        var files = (event.dataTransfer ? event.dataTransfer : event.target).files;
        if(files.length) {
            var file = files[0];
            currentFile = file;
            inputCanvas.style.display = 'none';
            tilesetContainer.className = 'hidden';
            paletteContainer.className = 'hidden';
            self.loadFile(file);
        }
        return false;
    };

    self.saveCHR = function(event) {
        event.preventDefault();

        if(currentFile === null) {
            return false;
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        brewtool.saveTileset(currentMap.tileMap.tileCanvas, 'GB', brewtool.getGreyscalePalette(),
            function(blob) {
                saveAs(blob, parts.join('.') + '.chr');
            }
        );

        return false;
    };

    self.saveTilePNG = function(event) {
        event.preventDefault();

        if(currentFile === null) {
            return false;
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        canvasToBlob(currentMap.tileMap.tileCanvas,
            function(blob) {
                saveAs(blob, parts.join('.') + '.tiles.png');
            }
        );

        return false;
    };

    self.saveCombinedPNG = function(event) {
        event.preventDefault();

        if(currentFile === null) {
            return false;
        }


        var palettes = currentMap.attributeMap.palettes;

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d')
        canvas.width = currentMap.tileMap.tileCanvas.width;
        canvas.height = currentMap.tileMap.tileCanvas.height * palettes.length;
        console.log(currentMap.tileMap.tileCanvas.height, canvas.height);
        for(var i = 0; i < palettes.length; i++) {
            var ts = createTilesetImage(currentMap.tileMap.tiles, palettes[i].colors.values);            
            context.drawImage(ts, 0, i * currentMap.tileMap.tileCanvas.height);
            console.log(canvas, 0, i * currentMap.tileMap.tileCanvas.height)
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        canvasToBlob(canvas,
            function(blob) {
                saveAs(blob, parts.join('.') + '.combined.png');
            }
        );

        return false;
    };

    self.savePal = function(event) {
        event.preventDefault();

        if(currentFile === null) {
            return false;
        }

        var out = [];
        var palettes = currentMap.attributeMap.palettes;
        for(var i = 0; i < palettes.length; i++) {
            var palette = palettes[i].colors.values;
            if(palette.length < 4) {
                palette.push([0, 0, 0]);
            }
            out.push(palette)
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        brewtool.savePalettes(out, function(blob) {
            saveAs(blob, parts.join('.') + '.pal');
        });

        return false;
    };

    self.saveAttrPNG = function(event) {
        event.preventDefault();

        if(currentFile === null) {
            return false;
        }

        var canvas = document.createElement('canvas');
        var palettes = currentMap.attributeMap.palettes;

        canvas.width = restrictions.attributes.width;
        canvas.height = restrictions.attributes.height * palettes.length;
        var out = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var p = 0;
        for(var i = 0; i < palettes.length; i++) {
            var palette = palettes[i].colors.values;
            for(var j = 0; j < restrictions.attributes.width * restrictions.attributes.height; j++) {
                var k = Math.floor((j % restrictions.attributes.width) * palette.length / restrictions.attributes.width);
                var c = palette[k] || [0, 0, 0, 0];

                out.data[p++] = c[0];
                out.data[p++] = c[1];
                out.data[p++] = c[2];
                out.data[p++] = c[3];
            }
        }
        canvas.getContext('2d').putImageData(out, 0, 0);

        var parts = currentFile.name.split('.');
        parts.pop();
        canvasToBlob(canvas,
            function(blob) {
                saveAs(blob, parts.join('.') + '.attributes.png');
            }
        );

        return false;
    };

    self.saveTileMapCSV = function(event) {
        event.preventDefault();

        var rows = [];
        var tileMap = currentMap.tileMap;
        for(var j = 0; j < tileMap.height; j++) {
            var row = [];
            for(var i = 0; i < tileMap.width; i++) {
                row.push(tileMap.data[j * tileMap.width + i]);
            }
            rows.push(row.join(','));
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        saveAs(new Blob([rows.join('\n')], {type: "application/octet-stream"}), parts.join('.') + '.tiles.csv');

        return false;
    }


    self.saveAttrMapCSV = function(event) {
        event.preventDefault();

        var rows = [];
        var attributeMap = currentMap.attributeMap;
        for(var j = 0; j < attributeMap.height; j++) {
            var row = [];
            for(var i = 0; i < attributeMap.width; i++) {
                row.push(attributeMap.data[j * attributeMap.width + i]);
            }
            rows.push(row.join(','));
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        saveAs(new Blob([rows.join('\n')], {type: "application/octet-stream"}), parts.join('.') + '.attributes.csv');

        return false;
    }

    self.saveTileMapDat = function(event) {
        event.preventDefault();

        var tileMap = currentMap.tileMap;
        var bytes = [
            tileMap.width & 0xFF, (tileMap.width >> 8) & 0xFF,
            tileMap.height & 0xFF, (tileMap.height >> 8) & 0xFF,
        ];
        for(var j = 0; j < tileMap.height; j++) {
            for(var i = 0; i < tileMap.width; i++) {
                bytes.push(tileMap.data[j * tileMap.width + i]);
            }
        }

        var buffer = new Uint8Array(new ArrayBuffer(bytes.length));
        for(var i = 0; i < bytes.length; i++) {
            buffer[i] = bytes[i];
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        saveAs(new Blob([buffer], {type: "application/octet-stream"}), parts.join('.') + '.tiles.dat');

        return false;
    }


    self.saveAttrMapDat = function(event) {
        event.preventDefault();

        var attributeMap = currentMap.attributeMap;
        var bytes = [
            attributeMap.width & 0xFF, (attributeMap.width >> 8) & 0xFF,
            attributeMap.height & 0xFF, (attributeMap.height >> 8) & 0xFF,
        ];
        for(var j = 0; j < attributeMap.height; j++) {
            for(var i = 0; i < attributeMap.width; i++) {
                bytes.push(attributeMap.data[j * attributeMap.width + i]);
            }
        }

        var buffer = new Uint8Array(new ArrayBuffer(bytes.length));
        for(var i = 0; i < bytes.length; i++) {
            buffer[i] = bytes[i];
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        saveAs(new Blob([buffer], {type: "application/octet-stream"}), parts.join('.') + '.attributes.dat');

        return false;
    }

    self.saveCombinedMapCSV = function(event) {
        event.preventDefault();

        if(restrictions.attributes.width % restrictions.tiles.width != 0 || restrictions.attributes.height % restrictions.tiles.height != 0) {
            alert('Attribute size ' + restrictions.attributes.width + 'x' + restrictions.attributes.height + ' is not divisble by tile size of ' + restrictions.tiles.width + 'x' + restrictions.tiles.height);
        }

        var rows = [];
        var tileMap = currentMap.tileMap;
        var attributeMap = currentMap.attributeMap;
        var attrColPerTile = restrictions.attributes.width / restrictions.tiles.width;
        var attrRowPerTile = restrictions.attributes.height / restrictions.tiles.height;
        var tilesPerTileset = Math.ceil(currentMap.tileMap.tiles.length / 16) * 16;

        for(var j = 0; j < tileMap.height; j++) {
            var row = [];
            for(var i = 0; i < tileMap.width; i++) {
                var attr = attributeMap.data[Math.floor(j / attrRowPerTile) * attributeMap.width + Math.floor(i / attrColPerTile)]
                var tile = tileMap.data[j * tileMap.width + i];
                row.push(attr * tilesPerTileset + tile);
            }
            rows.push(row.join(','));
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        saveAs(new Blob([rows.join('\n')], {type: "application/octet-stream"}), parts.join('.') + '.combined.csv');

        return false;
    }

    self.saveCombinedMapTiled = function(event) {
        event.preventDefault();

        if(restrictions.attributes.width % restrictions.tiles.width != 0 || restrictions.attributes.height % restrictions.tiles.height != 0) {
            alert('Attribute size ' + restrictions.attributes.width + 'x' + restrictions.attributes.height + ' is not divisble by tile size of ' + restrictions.tiles.width + 'x' + restrictions.tiles.height);
        }

        var rows = [];
        var tileMap = currentMap.tileMap;
        var attributeMap = currentMap.attributeMap;
        var attrColPerTile = restrictions.attributes.width / restrictions.tiles.width;
        var attrRowPerTile = restrictions.attributes.height / restrictions.tiles.height;
        var tilesPerTileset = Math.ceil(currentMap.tileMap.tiles.length / 16) * 16;

        for(var j = 0; j < tileMap.height; j++) {
            var row = [];
            for(var i = 0; i < tileMap.width; i++) {
                var attr = attributeMap.data[Math.floor(j / attrRowPerTile) * attributeMap.width + Math.floor(i / attrColPerTile)]
                var tile = tileMap.data[j * tileMap.width + i];
                row.push(attr * tilesPerTileset + tile + 1);
            }
            rows.push(row.join(','));
        }

        var parts = currentFile.name.split('.');
        parts.pop();

        var text = '<?xml version="1.0" encoding="UTF-8"?>\n'
            + '<map version="1.0" orientation="orthogonal" width="' + tileMap.width + '" '
            + 'height="' + tileMap.height + '" '
            + 'tilewidth="' + restrictions.tiles.width + '" '
            + 'tileheight="' + restrictions.tiles.height + '">\n'
            + '<tileset firstgid="1" name="tiles" tilewidth="' + restrictions.tiles.width + '" '
            + 'tileheight="' + restrictions.tiles.height + '">\n'
            + '<image source="' + parts.join('.') + '.combined.png" />\n'
            + '</tileset>\n'
            + '<layer name="bg" width="' + tileMap.width + '" '
            + 'height="' + tileMap.height + '">\n'
            + '<data encoding="csv">\n'
            + rows.join(',\n') + '\n'
            + '</data>\n'
            + '</layer>\n'
            + '</map>\n';

        saveAs(new Blob([text], {type: "application/octet-stream"}), parts.join('.') + '.combined.tmx');

        return false;
    }

    self.loadFile = function(file) {
        filePicker.value = '';

        if(file.type === 'image/png' || file.type === 'image/gif') {
            var image = new Image;
            image.onload = function() {
                if(image.width % restrictions.attributes.width != 0 || image.height % restrictions.attributes.height != 0) {
                    throw 'Image "' + file.name + '" has dimensions of '
                        + image.width + 'x' + image.height + ', which ' 
                        + 'are not divisible by the tile attribute size of '
                        + restrictions.attributes.width + 'x' + restrictions.attributes.height + '!';
                    return;
                }

                inputCanvas.width = image.width;
                inputCanvas.height = image.height;
                inputCanvas.style.display = 'block';

                var context = inputCanvas.getContext('2d')
                context.drawImage(image, 0, 0);

                restrictions.tiles.max = +tileLimitField.value;
                restrictions.tiles.removeDuplicates = removeDuplicatesCheckbox.checked;

                var pixels = context.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
                var attributeMap = generateAttributeMap(pixels);
                var tileMap = generateTileMap(pixels, attributeMap);
                var paletteTable = generatePaletteTable(attributeMap.palettes);

                tilesetContainer.innerHTML = '';
                tileMap.tileCanvas.style.display = 'block';
                var h2 = document.createElement('h2');
                h2.appendChild(document.createTextNode('Tileset'));
                tilesetContainer.appendChild(h2);
                var p = document.createElement('p');
                p.appendChild(document.createTextNode(tileMap.tiles.length + ' tile(s) of ' + restrictions.tiles.width + ' x ' + restrictions.tiles.height + ' pixels'));
                tilesetContainer.appendChild(p);
                tilesetContainer.appendChild(tileMap.tileCanvas);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveCHR;
                a.appendChild(document.createTextNode('Save raw GB tileset (.chr)...'));
                p.appendChild(a);
                tilesetContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveTilePNG;
                a.appendChild(document.createTextNode('Save tile set (.tiles.png)...'));
                p.appendChild(a);
                tilesetContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveCombinedPNG;
                a.appendChild(document.createTextNode('Save combined tile set (.combined.png)...'));
                p.appendChild(a);
                tilesetContainer.appendChild(p);

                paletteContainer.innerHTML = '';
                var h2 = document.createElement('h2');
                h2.appendChild(document.createTextNode('Palettes'));
                paletteContainer.appendChild(h2);
                var p = document.createElement('p');
                p.appendChild(document.createTextNode(attributeMap.palettes.length + ' palette(s) of ' + restrictions.colors.max + ' colors'));
                paletteContainer.appendChild(p);
                paletteContainer.appendChild(paletteTable);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.savePal;
                a.appendChild(document.createTextNode('Save raw 15-bit palette (.pal)...'));
                p.appendChild(a);
                paletteContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveAttrPNG;
                a.appendChild(document.createTextNode('Save attribute set (.attributes.png)...'));
                p.appendChild(a);
                paletteContainer.appendChild(p);

                mapContainer.innerHTML = '';
                var h2 = document.createElement('h2');
                h2.appendChild(document.createTextNode('Map'));
                mapContainer.appendChild(h2);
                var p = document.createElement('p');
                p.appendChild(document.createTextNode('Attribute Map: ' + attributeMap.width + ' x ' + attributeMap.height));
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                p.appendChild(document.createTextNode('Tile Map: ' + tileMap.width + ' x ' + tileMap.height));
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveTileMapCSV;
                a.appendChild(document.createTextNode('Save tile map (.tiles.csv)...'));
                p.appendChild(a);
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveAttrMapCSV;
                a.appendChild(document.createTextNode('Save attribute map (.attributes.csv)...'));
                p.appendChild(a);
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveCombinedMapCSV;
                a.appendChild(document.createTextNode('Save combined map (.combined.csv)...'));
                p.appendChild(a);
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveCombinedMapTiled;
                a.appendChild(document.createTextNode('Save combined tiled map (.combined.tmx)...'));
                p.appendChild(a);
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                p.appendChild(document.createTextNode('Binary formats have the following layout: width : uint16, height : uint16, data : uint8[width * height]'));
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveTileMapDat;
                a.appendChild(document.createTextNode('Save binary tile map (.tiles.dat)...'));
                p.appendChild(a);
                mapContainer.appendChild(p);
                var p = document.createElement('p');
                var a = document.createElement('a');
                a.onclick = self.saveAttrMapDat;
                a.appendChild(document.createTextNode('Save binary attribute map (.attributes.dat)...'));
                p.appendChild(a);
                mapContainer.appendChild(p);

                tilesetContainer.className = 'section tileset';
                paletteContainer.className = 'section palettes';
                mapContainer.className = 'section map';

                currentMap = {
                    tileMap: tileMap,
                    attributeMap: attributeMap,
                };
            };
            image.src = URL.createObjectURL(file);
        }
    };

    var generatePaletteTable = function(palettes) {
        var table = document.createElement('table');        
        for(var i = 0; i < palettes.length; i++) {
            var palette = palettes[i].colors.values;

            var tr = document.createElement('tr');
            tr.className = 'source_palette';
            for(var j = 0; j < palette.length; j++) {
                var td = document.createElement('td');
                var div = document.createElement('div');
                div.className = 'color';
                div.style.backgroundColor = 'rgba(' + palette[j].join(',') + ')';
                td.appendChild(div);
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        return table;
    }    

    var calculateColorSet = function(pixels, x, y) {
        var colors = {_size: 0};
        var width = pixels.width;
        var data = pixels.data;
        for(j = 0; j < restrictions.attributes.height; j++) {
            for(i = 0; i < restrictions.attributes.width; i++) {
                var p = ((y + j) * width + (x + i)) * 4;
                var c = [data[p], data[p + 1], data[p + 2], data[p + 3]];
                var k = c.join(',');
                if(!colors[k]) {
                    colors[k] = c;
                    colors._size++;

                    if(colors._size > restrictions.colors.max) {
                        throw 'too many colors';
                    }
                }
            }
        }
        return colors;
    }

    var sortedColorSet = function(colors) {
        var array = [];
        for(var k in colors) {
            if(k != '_size') {
                array.push([k, colors[k]]);
            }
        }

        // Sort the colors by naive greyscale brightness, followed by RGBA.
        array.sort(function(v, v2) {
            var a = v[1];
            var b = v2[1];
            var grey = (a[0] + a[1] + a[2]) / 3
            var grey2 = (b[0] + b[1] + b[2]) / 3
            if(grey != grey2) {
                return grey - grey2;
            } else if(a[0] != b[0]) {
                return a[0] - b[0];
            } else if(a[1] != b[1]) {
                return a[1] - b[1];
            } else if(a[2] != b[2]) {
                return a[2] - b[2];
            } else if(a[3] != b[3]) {
                return a[3] - b[3];
            } else {
                return 0;
            }
        });

        var ordering = {};
        var values = [];
        for(var i = 0; i < array.length; i++) {
            var item = array[i];
            ordering[item[0]] = values.length;
            values.push(item[1]);
        }

        return {ordering: ordering, values: values};
    }

    var keysToString = function(o) {
        var keys = [];
        for(var k in o) {
            keys.push(k);
        }
        return keys.sort().join(':');
    }

    var isSubset = function(o, o2) {
        for(var k in o) {
            if(k != '_size' && !o2[k]) {
                return false;
            }
        }
        return true;
    }

    var generateAttributeMap = function(pixels) {
        var map = {
            width: pixels.width / restrictions.attributes.width,
            height: pixels.height / restrictions.attributes.height,
            data: [],
            palettes: []
        }

        var palettes = {};
        var index = 0;
        for(var y = 0; y < pixels.height; y += restrictions.attributes.height)  {
            for(var x = 0; x < pixels.width; x += restrictions.attributes.width)  {
                var colors = calculateColorSet(pixels, x, y);
                var k = keysToString(colors);
                if(!palettes[k]) {
                    palettes[k] = {
                        colors: colors,
                        index: index
                    }
                    index++;
                }
                map.data.push(palettes[k].index);
            }
        }

        var reductions = {};
        for(var k in palettes) {
            var index = palettes[k].index;
            reductions[index] = palettes[k];
        }

        var changed = false;
        do {
            changed = false;
            // Merge palettes which are strict subsets of others.
            for(var k in palettes) {
                for(var k2 in palettes) {
                    if(k != k2) {
                        var p = palettes[k];
                        var p2 = palettes[k2];
                        if(isSubset(p.colors, p2.colors)) {
                            reductions[p.index] = reductions[p2.index];
                            delete palettes[k];
                            changed = true;
                            break;
                        }
                    }
                }
            }

            if(restrictions.palettes.combineIncompleteEntries) {
                // Merge palettes when they can fit together within the color limit.
                for(k in palettes) {
                    for(k2 in palettes) {
                        if(k != k2) {
                            var p = palettes[k];
                            var p2 = palettes[k2];
                            if(p.colors._size + p2.colors._size <= restrictions.colors.max) {
                                p.colors._size = p.colors._size + p2.colors._size;
                                for(k in p2.colors) {
                                    if(k != '_size') {
                                        p.colors[k] = p2.colors[k];
                                    }
                                }

                                reductions[p2.index] = reductions[p.index];

                                delete palettes[k2];
                                changed = true;
                                break;
                            }
                        }
                    }
                }
            }
        } while(changed);

        for(var k in reductions) {
            while(reductions[k] != reductions[reductions[k].index]) {
                reductions[k] = reductions[reductions[k].index];
            }
        }

        for(var k in palettes) {
            palettes[k].colors = sortedColorSet(palettes[k].colors);
            palettes[k].index = map.palettes.length;
            map.palettes.push(palettes[k]);
        }

        if(map.palettes.length > restrictions.palettes.max) {
            throw 'too many palettes';
        }

        for(var y = 0; y < map.height; y++) {
            for(var x = 0; x < map.width; x++) {
                map.data[y * map.width + x] = reductions[map.data[y * map.width + x]].index;
            }
        }

        return map;
    };

    var calculateTilePattern = function(pixels, attributeMap, x, y) {
        var pattern = [];
        var width = pixels.width;
        var data = pixels.data;
        for(j = 0; j < restrictions.tiles.height; j++) {
            for(i = 0; i < restrictions.tiles.width; i++) {
                var p = ((y + j) * width + (x + i)) * 4;
                var c = [data[p], data[p + 1], data[p + 2], data[p + 3]];
                var k = c.join(',');
                var colors = attributeMap.palettes[attributeMap.data[
                    Math.floor((y + j) / restrictions.attributes.height) * attributeMap.width
                    + Math.floor((x + i) / restrictions.attributes.width)]].colors;
                pattern.push(colors.ordering[k]);
            }
        }
        return pattern;
    }

    var createTilesetImage = function(tiles, palette) {
        var canvas = document.createElement('canvas');

        // Try to fit this in a nice rectangular region, so it's easier to view.
        var columns = Math.min(tiles.length, 16);
        var rows = Math.ceil(tiles.length / 16);

        canvas.width = columns * restrictions.tiles.width;
        canvas.height = rows * restrictions.tiles.height;
        var out = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        for(var i = 0; i < tiles.length; i++) {
            for(var y = 0; y < restrictions.tiles.height; y++) {
                for(var x = 0; x < restrictions.tiles.width; x++) {
                    var p = ((Math.floor(i / columns) * restrictions.tiles.height + y) * canvas.width
                        + (i % columns) * restrictions.tiles.width + x) * 4;
                    var c = palette[tiles[i].pattern[y * restrictions.tiles.width + x]];
                    out.data[p + 0] = c[0];
                    out.data[p + 1] = c[1];
                    out.data[p + 2] = c[2];
                    out.data[p + 3] = 255;
                }
            }
        }
        canvas.getContext('2d').putImageData(out, 0, 0);
        return canvas;
    }

    var generateTileMap = function(pixels, attributeMap) {
        var map = {
            width: pixels.width / restrictions.tiles.width,
            height: pixels.height / restrictions.tiles.height,
            tiles: [],
            data: []
        }

        var tiles = {};
        var index = 0;
        for(var y = 0; y < pixels.height; y += restrictions.attributes.height)  {
            for(var x = 0; x < pixels.width; x += restrictions.attributes.width)  {
                var t = calculateTilePattern(pixels, attributeMap, x, y);
                var k = t.join(',');
                if(!restrictions.tiles.removeDuplicates) {
                    k = index;
                }
                if(!tiles[k]) {
                    tiles[k] = {
                        pattern: t,
                        index: index
                    }
                    map.tiles.push(tiles[k]);
                    index++;
                }

                map.data.push(tiles[k].index);
            }
        }

        tiles = map.tiles;
        if(tiles.length > restrictions.tiles.max) {
            throw 'too many tiles';
        }

        var canvas = createTilesetImage(tiles, brewtool.getGreyscalePalette());

        map.tileCanvas = canvas;

        return map;
    }

    return self;
})({});
 

