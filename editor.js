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


    var FourColors = [
        [0x00, 0x00, 0x00],
        [0x60, 0x60, 0x60],
        [0xC0, 0xC0, 0xC0],
        [0xFF, 0xFF, 0xFF]
    ];

    var inputCanvas = null;
    var outputCanvas = null;
    var inputContext = null;
    var outputContext = null;
    var inputFormatDropdown = null;
    var outputFormatDropdown = null;
    var filePicker = null;
    var saveButton = null;
    var paddingOption = null;
    var conversionTable = null;
    var palette = FourColors.slice();
    var currentFile = null;

    self.init = function(config) {
        var div = document.createElement('div');
        div.className = 'section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Input'));
        div.appendChild(h2);
        var p = document.createElement('p');
        p.appendChild(document.createTextNode('Source file may be .chr, .png or .gif.'));
        div.appendChild(p);
        var span = document.createElement('span');
        span.className = 'format';
        span.appendChild(document.createTextNode('Format:'));
        div.appendChild(span);
        inputFormatDropdown = document.createElement('select');
        inputFormatDropdown.addEventListener('change', function() {
            if(currentFile && currentFile.name.split('.').pop() == 'chr') {
                self.loadFile(currentFile) 
            }
        });
            var option = document.createElement('option');
            option.appendChild(document.createTextNode('Game Boy'));
            option.setAttribute('selected', 'selected');
            inputFormatDropdown.appendChild(option);

            var option = document.createElement('option');
            option.appendChild(document.createTextNode('NES'));
            inputFormatDropdown.appendChild(option);
        div.appendChild(inputFormatDropdown);
        paddingOption = document.createElement('input');
        paddingOption.setAttribute('id', 'padding');
        paddingOption.setAttribute('type', 'checkbox');
        paddingOption.setAttribute('value', '1');
        paddingOption.setAttribute('checked', 'checked');
        paddingOption.addEventListener('change', self.changePadding);
        div.appendChild(paddingOption);
        var label = document.createElement('label');
        label.setAttribute('for', 'padding');
        label.appendChild(document.createTextNode('Padding'));
        div.appendChild(label);
        filePicker = document.createElement('input');
        filePicker.setAttribute('type', 'file');
        filePicker.addEventListener('change', self.changeFile);
        div.appendChild(filePicker);
        inputCanvas = document.createElement('canvas');
        inputCanvas.appendChild(document.createTextNode('This application requires HTML5 support.'));
        inputCanvas.width = 0;
        inputCanvas.height = 0;
        div.appendChild(inputCanvas);
        config.element.appendChild(div);

        var div = document.createElement('div');
        div.className = 'conversion_table section';
        conversionTable = div;
        config.element.appendChild(conversionTable);

        var div = document.createElement('div');
        div.className = 'preview section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Preview'));
        div.appendChild(h2);
        outputCanvas = document.createElement('canvas');
        outputCanvas.appendChild(document.createTextNode('This application requires HTML5 support.'));
        outputCanvas.width = 0;
        outputCanvas.height = 0;
        div.appendChild(outputCanvas);
        config.element.appendChild(div);

        var div = document.createElement('div');
        div.className = 'section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Output'));
        div.appendChild(h2);
        var span = document.createElement('span');
        span.className = 'format';
        span.appendChild(document.createTextNode('Format:'));
        div.appendChild(span);
        outputFormatDropdown = document.createElement('select');
            var option = document.createElement('option');
            option.appendChild(document.createTextNode('Game Boy'));
            option.setAttribute('selected', 'selected');
            outputFormatDropdown.appendChild(option);

            var option = document.createElement('option');
            option.appendChild(document.createTextNode('NES'));
            outputFormatDropdown.appendChild(option);
        div.appendChild(outputFormatDropdown);
        saveButton = document.createElement('input');
        saveButton.setAttribute('type', 'button');
        saveButton.setAttribute('value', 'Save File');
        saveButton.addEventListener('click', self.saveFile);
        div.appendChild(saveButton);
        config.element.appendChild(div);

        inputContext = inputCanvas.getContext('2d');
        outputContext = outputCanvas.getContext('2d');

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
            self.loadFile(file);
        }
        return false;
    };

    self.loadFile = function(file) {    
        if(file.type === 'image/png' || file.type === 'image/gif') {
            var image = new Image;
            image.onload = function() {
                inputCanvas.width = image.width;
                inputCanvas.height = image.height;
                inputCanvas.style.display = 'block';
                inputContext.drawImage(image, 0, 0);

                try {
                    palette = self.getPalette(inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height));
                } catch (e) {
                    alert(e);
                }
                self.setupImage();
            };
            image.src = URL.createObjectURL(file);
        } else {
            var extension = file.name.split('.').pop();
            if(extension == 'chr') {
                var reader = new FileReader();
                reader.onload = function(event) {
                    self.readCHR(event.target.result);
                    inputCanvas.style.display = 'block';

                    palette = FourColors.slice();
                    self.setupImage();
                };
                reader.readAsBinaryString(file);
            } else {
                inputCanvas.style.display = 'none';
                inputCanvas.width = 0;
                inputCanvas.height = 0;
            }
        }
    };

    self.saveFile = function(event) {
        event.preventDefault();

        if(currentFile === null) {
            return false;
        }

        var parts = currentFile.name.split('.');
        parts.pop();
        parts.push('chr');
        var filename = parts.join('.');

        var fields = conversionTable.querySelectorAll('.fields input');
        var colors = conversionTable.querySelectorAll('.dest_palette .color');
        var conversions = [];
        for(var i = 0; i < fields.length; i++) {
            var index = Math.min(Math.max(parseInt(fields[i].value) || 0, 0), 3);
            fields[i].value = index;
            colors[i].style.backgroundColor = 'rgb(' + FourColors[index].join(',') + ')';
            conversions.push(index);
        }

        var bytes = [];
        var outputPixels = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
        var indices = self.getPixelIndices(outputPixels, FourColors);
        if(outputFormatDropdown.value == 'NES') {
            for(var y = 0, h = outputCanvas.height; y < h; y += 8) {
                for(var x = 0, w = outputCanvas.width; x < w; x += 8) {
                    for(var j = 0; j < 8; j++) {
                        var low = 0;
                        for(var i = 0; i < 8; i++) {
                            var color = indices[(y + j) * outputCanvas.width + x + i];
                            low = (low << 1) | (color & 0x1);
                        }
                        bytes.push(low);
                    }
                    for(var j = 0; j < 8; j++) {
                        var high = 0;
                        for(var i = 0; i < 8; i++) {
                            var c = indices[(y + j) * outputCanvas.width + x + i];
                            high = (high << 1) | ((c & 0x2) >> 1);
                        }
                        bytes.push(high);
                    }
                }
            }
        } else {
            for(var y = 0, h = outputCanvas.height; y < h; y += 8) {
                for(var x = 0, w = outputCanvas.width; x < w; x += 8) {
                    for(var j = 0; j < 8; j++) {
                        var low = 0;
                        var high = 0;
                        for(var i = 0; i < 8; i++) {
                            var color = indices[(y + j) * outputCanvas.width + x + i];
                            low = (low << 1) | (color & 0x1);
                            high = (high << 1) | ((color & 0x2) >> 1);
                        }
                        bytes.push(low);
                        bytes.push(high);
                    }
                }
            }
        }

        var buffer = new Uint8Array(new ArrayBuffer(bytes.length));
        for(var i = 0; i < bytes.length; i++) {
            buffer[i] = bytes[i];
        }
        saveAs(new Blob([buffer], {type: "application/octet-stream"}), filename);

        return false;
    };

    self.changePadding = function(event) {
        self.autoDetectPalette();
        self.recalculate();
    };

    self.changeConversion = function(event) {
        self.recalculate();
    };

    self.readCHR = function(bytes) {
        var tiles = bytes.length / 16;
        if(tiles == 0) {
            return;
        }

        // Try to fit this in a nice rectangular region, so it's easier to view.
        var columns = 0;
        var rows = 0;
        for(var i = 16; i != 1; i /= 2) {
            if(tiles % i == 0) {
                if(i >= 8) {
                    columns = i;
                    rows = tiles / i;
                }
                else {
                    rows = i;
                    columns = tiles / i;
                }
                break;
            }
        }
        if(columns == 0) {
            columns = tiles;
            rows = 1;
        }

        inputCanvas.width = columns * 8;
        inputCanvas.height = rows * 8;
        var pixels = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);

        if(inputFormatDropdown.value == 'NES') {
            for(var row = 0; row < rows; row++) {
                for(var col = 0; col < columns; col++) {
                    for(var j = 0; j < 8; j++) {
                        var low = bytes.charCodeAt((row * columns + col) * 16 + j);
                        for(var i = 0; i < 8; i++) {
                            var p = ((row * 8 + j) * columns * 8 + (col * 8 + i)) * 4;
                            pixels.data[p] = (low & (1 << (7 - i))) ? 1 : 0;
                        }
                    }
                    for(var j = 0; j < 8; j++) {
                        var high = bytes.charCodeAt((row * columns + col) * 16 + j + 8);
                        for(var i = 0; i < 8; i++) {
                            var p = ((row * 8 + j) * columns * 8 + (col * 8 + i)) * 4;
                            var c = FourColors[pixels.data[p] | (high & (1 << (7 - i)) ? 2 : 0)]
                            pixels.data[p + 0] = c[0];
                            pixels.data[p + 1] = c[1];
                            pixels.data[p + 2] = c[2];
                            pixels.data[p + 3] = 0xFF;
                        }
                    }
                }
            }
        } else {
            for(var row = 0; row < rows; row++) {
                for(var col = 0; col < columns; col++) {
                    for(var j = 0; j < 8; j++) {
                        var index = ((row * columns + col) * 8 + j) * 2;
                        var low = bytes.charCodeAt(index);
                        var high = bytes.charCodeAt(index + 1);
                        for(var i = 0; i < 8; i++) {
                            var p = ((row * 8 + j) * columns * 8 + (col * 8 + i)) * 4;
                            var c = FourColors[((high & (1 << (7 - i))) ? 2 : 0) | ((low & (1 << (7 - i))) ? 1 : 0)]

                            pixels.data[p + 0] = c[0];
                            pixels.data[p + 1] = c[1];
                            pixels.data[p + 2] = c[2];
                            pixels.data[p + 3] = 0xFF;
                        }
                    }
                }
            }
        }
        inputContext.putImageData(pixels, 0, 0);
        paddingOption.checked = false;
    }

    self.getPalette = function(pixels) {
        var set = {};
        var palette = [];
        for(var i = 0; i < pixels.width * pixels.height * 4; i += 4) {
            var color = [
                pixels.data[i],
                pixels.data[i + 1],
                pixels.data[i + 2]
            ];
            if(!set[color.join(',')]) {
                set[color] = true;
                palette.push(color);
                if(palette.length > 255) {
                    throw "This image has too many colors.";
                }
            }
        }
        return palette;
    }

    self.getPixelIndices = function(pixels, palette) {
        var table = {};
        for(var i = 0; i < palette.length; i++) {
            table[palette[i].join(',')] = i;
        }

        var result = new Array(pixels.width * pixels.height);
        for(var i = 0, j = 0; i < pixels.width * pixels.height * 4; i += 4, j++) {
            var color = [
                pixels.data[i],
                pixels.data[i + 1],
                pixels.data[i + 2]
            ];
            result[j] = table[color.join(',')];
        }
        return result;
    }

    self.getPixelIndex = function(pixels, x, y, palette) {
        var color = [
            pixels.data[(y * pixels.width + x) * 4],
            pixels.data[(y * pixels.width + x) * 4 + 1],
            pixels.data[(y * pixels.width + x) * 4 + 2]
        ];
        for(var i = 0; i < palette.length; i++) {
            if(palette[i].join(',') == color.join(',')) {
                return i;
            }
        }
    }

    self.setupImage = function() {
        while(conversionTable.hasChildNodes()) {
            conversionTable.removeChild(conversionTable.lastChild);
        }

        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Palette Conversion'));
        conversionTable.appendChild(h2);

        var table = document.createElement('table');
        var tr = document.createElement('tr');
        tr.className = 'source_palette';
        for(var i = 0; i < palette.length; i++) {
            var td = document.createElement('td');
            var div = document.createElement('div');
            div.className = 'color';
            div.style.backgroundColor = 'rgb(' + palette[i].join(',') + ')';
            td.appendChild(div);
            tr.appendChild(td);
        }
        table.appendChild(tr);

        var tr = document.createElement('tr');
        tr.className = 'fields';
        for(var i = 0; i < palette.length; i++) {
            (function() {
                var td = document.createElement('td');
                var input = document.createElement('input');
                input.setAttribute('type', 'text');
                input.setAttribute('value', '0');
                input.addEventListener('change', self.changeConversion);
                td.appendChild(input);
                td.addEventListener('click', function() { 
                    input.focus(); 
                    input.select(); 
                });
                tr.appendChild(td);
            })();
        }
        table.appendChild(tr);


        var tr = document.createElement('tr');
        tr.className = 'dest_palette';
        for(var i = 0; i < palette.length; i++) {
            var td = document.createElement('td');
            var div = document.createElement('div');
            div.className = 'color';
            div.style.backgroundColor = 'rgb(' + FourColors[0].join(',') + ')';
            td.appendChild(div);
            tr.appendChild(td);
        }
        table.appendChild(tr);

        conversionTable.style.display = 'block';
        conversionTable.appendChild(table);

        self.autoDetectPalette();
    }

    self.autoDetectPalette = function() {
        var ranks = [];
        for(var i = 0; i < palette.length; i++) {
            ranks[i] = i;
        }
        ranks.sort(function(a, b) {
            return (palette[a][0] + palette[a][1] + palette[a][2]) / 3 - (palette[b][0] + palette[b][1] + palette[b][2]) / 3;
        });

        var fields = conversionTable.querySelectorAll('.fields input');
        if(paddingOption.checked) {
            var pixels = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
            var index = self.getPixelIndex(pixels, 0, 0, palette)

            fields[index].value = 0;
            ranks.splice(index, 1);
        }

        // Remove 'transparent' color (fully-saturated colors).
        for(i = ranks.length - 1; i >= 0; i--) {
            var r = palette[ranks[i]][0];
            var g = palette[ranks[i]][1];
            var b = palette[ranks[i]][2];
            if((r == 0x00 || r == 0xFF)
                && (g == 0x00 || g == 0xFF)
                && (b == 0x00 || b == 0xFF)
                && !(r == 0x00 && g == 0x00 && b == 0x00)
                && !(r == 0xFF && g == 0xFF && b == 0xFF)) {
                fields[ranks[i]].value = 0;
                ranks.splice(i, 1);
            }
        }

        for(i = 0; i < ranks.length; i++) {
            fields[ranks[i]].value = Math.floor(i * 4 / ranks.length);
        }

        self.recalculate();
    }

    self.recalculate = function() {
        var fields = conversionTable.querySelectorAll('.fields input');
        var colors = conversionTable.querySelectorAll('.dest_palette .color');
        var conversions = [];
        for(var i = 0; i < fields.length; i++) {
            var index = Math.min(Math.max(parseInt(fields[i].value) || 0, 0), 3);
            fields[i].value = index;
            colors[i].style.backgroundColor = 'rgb(' + FourColors[index].join(',') + ')';
            conversions.push(index);
        }

        if(paddingOption.checked) {
            var TileSize = 8;

            var columns = Math.floor(inputCanvas.width / (TileSize + 1));
            var rows = Math.floor(inputCanvas.height / (TileSize + 1));

            outputCanvas.width = columns * TileSize;
            outputCanvas.height = rows * TileSize;
            outputCanvas.style.display = 'block';
            document.querySelector('.preview').style.display = 'block';

            var inputPixels = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
            var outputPixels = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);

            var indices = self.getPixelIndices(inputPixels, palette);

            for(var row = 0; row < rows; row++) {
                for(var col = 0; col < columns; col++) {
                    for(var y = 0; y < TileSize; y++) {
                        for(var x = 0; x < TileSize; x++) {
                            var src = (row * (TileSize + 1) + 1 + y) * inputCanvas.width + (col * (TileSize + 1) + 1 + x);
                            var dest = (row * TileSize + y) * outputCanvas.width + (col * TileSize + x);
                            var c = conversions[indices[src]];
                            outputPixels.data[dest * 4 + 0] = FourColors[c][0];
                            outputPixels.data[dest * 4 + 1] = FourColors[c][1];
                            outputPixels.data[dest * 4 + 2] = FourColors[c][2];
                            outputPixels.data[dest * 4 + 3] = 0xFF;
                        }
                    }
                }
            }

            outputContext.putImageData(outputPixels, 0, 0);
        } else {
            outputCanvas.width = inputCanvas.width;
            outputCanvas.height = inputCanvas.height;

            var inputPixels = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
            var outputPixels = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);

            var indices = self.getPixelIndices(inputPixels, palette)

            for(j = 0; j < outputPixels.height; j++) {
                for(i = 0; i < outputPixels.width; i++) {
                    var k = j * outputCanvas.width + i;
                    var c = conversions[indices[k]];
                    outputPixels.data[k * 4 + 0] = FourColors[c][0];
                    outputPixels.data[k * 4 + 1] = FourColors[c][1];
                    outputPixels.data[k * 4 + 2] = FourColors[c][2];
                    outputPixels.data[k * 4 + 3] = 0xFF;
                }
            }

            outputContext.putImageData(outputPixels, 0, 0);
        }


    }

    return self;
})({});
 

