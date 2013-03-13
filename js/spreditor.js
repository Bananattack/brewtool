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

    var inputCanvas = null;
    var outputCanvas = null;
    var inputContext = null;
    var outputContext = null;
    var palPicker = null;
    var chrPicker = null;
    var sprPicker = null;
    var saveButton = null;
    var addSpriteButton = null;
    var conversionTable = null;
    var spriteTable = null;
    var palettes = [];
    var currentFile = null;

    self.init = function(config) {
        var div = document.createElement('div');
        div.className = 'section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Input'));
        div.appendChild(h2);
        var wrap = document.createElement('div');
            var span = document.createElement('span');
            span.className = 'format';
            span.appendChild(document.createTextNode('Palette (.pal):'));
            wrap.appendChild(span);
            palPicker = document.createElement('input');
            palPicker.setAttribute('type', 'file');
            palPicker.addEventListener('change', createFileChangeHandler(loaders['pal']));
            wrap.appendChild(palPicker);
        div.appendChild(wrap);
        var wrap = document.createElement('div');
            var span = document.createElement('span');
            span.className = 'format';
            span.appendChild(document.createTextNode('Tileset (.chr):'));
            wrap.appendChild(span);
            chrPicker = document.createElement('input');
            chrPicker.setAttribute('type', 'file');
            chrPicker.addEventListener('change', createFileChangeHandler(loaders['chr']));
            wrap.appendChild(chrPicker);
        div.appendChild(wrap);
        var wrap = document.createElement('div');
            var span = document.createElement('span');
            span.className = 'format';
            span.appendChild(document.createTextNode('Sprite (.spr):'));
            wrap.appendChild(span);
            sprPicker = document.createElement('input');
            sprPicker.setAttribute('type', 'file');
            sprPicker.addEventListener('change', createFileChangeHandler(loaders['spr']));
            wrap.appendChild(sprPicker);
        div.appendChild(wrap);
        config.element.appendChild(div);

        var div = document.createElement('div');
        div.className = 'tileset section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Tileset'));
        div.appendChild(h2);
        inputCanvas = document.createElement('canvas');
        inputCanvas.appendChild(document.createTextNode('This application requires HTML5 support.'));
        inputCanvas.width = 0;
        inputCanvas.height = 0;
        div.appendChild(inputCanvas);
        config.element.appendChild(div);

        var div = document.createElement('div');
        div.className = 'conversion_table section';
        conversionTable = div;
        config.element.appendChild(div);

        var div = document.createElement('div');
        div.className = 'sprites section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Sprites'));
        div.appendChild(h2);
        var table = document.createElement('table');
        spriteTable = table;
        div.appendChild(table);
        var span = document.createElement('span');
        span.className = 'format';
        span.appendChild(document.createTextNode(''));
        div.appendChild(span);
        addSpriteButton = document.createElement('input');
        addSpriteButton.setAttribute('type', 'button');
        addSpriteButton.setAttribute('value', 'Add Sprite');
        addSpriteButton.addEventListener('click', function() { self.addSprite(); });
        div.appendChild(addSpriteButton);
        config.element.appendChild(div);

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
        span.appendChild(document.createTextNode('Output Sprite:'));
        div.appendChild(span);
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
        document.ondrop = self.dropFiles;
    }

    var createFileLoader = function(extension, onload) {
        return function(file) {
            if(file.name.split('.').pop() == extension) {
                var reader = new FileReader();
                reader.onload = function(event) {
                    onload(file, event.target.result);
                };
                reader.readAsBinaryString(file);
            }
        }
    }

    var createFileChangeHandler = function(loader) {
        return function(event) {
            event.preventDefault();

            var files = event.target.files;
            if(files.length) {
                loader(files[0]);
            }

            chrPicker.value = '';
            palPicker.value = '';
            sprPicker.value = '';

            return false;
        }
    }

    var loaders = {
        'pal': createFileLoader('pal',
            function(file, bytes) {
                palettes = brewtool.loadPalettes(bytes);
                self.setupPalette();
            }
        ),
        'chr': createFileLoader('chr',
            function(file, bytes) {
                brewtool.loadTileset(bytes, inputCanvas, 'GB', brewtool.getGreyscalePalette());
                inputCanvas.style.display = 'block';
                document.querySelector('.tileset').style.display = 'block';
                self.recalculate();
            }
        ),
        'spr': createFileLoader('spr',
            function(file, bytes) {
                var sprites = brewtool.loadSprites(bytes);
                var spriteRows = spriteTable.querySelectorAll('tr'); 
                for(var i = 0; i < spriteRows.length; i++) {
                    spriteTable.removeChild(spriteRows[i]);
                }
                for(var i = 0; i < sprites.length; i++) {
                    self.addSprite(sprites[i]);
                }
                currentFile = file;
            }
        ),
    }

    self.dropFiles = function(event) {
        event.preventDefault();

        var files = event.dataTransfer.files;
        for(var i = 0 ; i < files.length; i++) {
            for(loader in loaders) {
                loaders[loader](files[i]);
            }
        }
        return false;
    };

    self.saveFile = function(event) {
        event.preventDefault();

        var parts = ['untitled'];
        if(currentFile !== null) {
            parts = currentFile.name.split('.');
            parts.pop();
        }

        var spriteRows = spriteTable.querySelectorAll('tr');
        var sprites = [];
        for(var i = 0; i < spriteRows.length; i++) {
            var row = spriteRows[i];
            sprites.push({
                x: Math.min(Math.max(parseInt(row.querySelector('.x').value) || 0, 0), 255),
                y: Math.min(Math.max(parseInt(row.querySelector('.y').value) || 0, 0), 255),
                tile: Math.min(Math.max(parseInt(row.querySelector('.tile').value) || 0, 0), inputCanvas ? Math.min(Math.floor(inputCanvas.width / 8) * Math.floor(inputCanvas.height / 8) - 1,  255) : 255),
                pal: Math.min(Math.max(parseInt(row.querySelector('.pal').value) || 0, 0), palettes.length ? Math.min(palettes.length, 7) : 7),
                hflip: row.querySelector('.hflip').checked,
                vflip: row.querySelector('.vflip').checked,
                behind: row.querySelector('.behind').checked
            });
        }

        brewtool.saveSprites(sprites, function(blob) {
            saveAs(blob, parts.join('.') + '.spr');
        });

        return false;
    };

    self.setupPalette = function() {
        while(conversionTable.hasChildNodes()) {
            conversionTable.removeChild(conversionTable.lastChild);
        }

        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Palettes'));
        conversionTable.appendChild(h2);

        var table = document.createElement('table');
        for(var i = 0; i < palettes.length; i++) {
            var palette = palettes[i];

            var tr = document.createElement('tr');
            tr.className = 'source_palette';
            var th = document.createElement('th');
            th.appendChild(document.createTextNode(i));
            tr.appendChild(th);
            for(var j = 0; j < palette.length; j++) {
                var td = document.createElement('td');
                var div = document.createElement('div');
                div.className = 'color';
                div.style.backgroundColor = 'rgb(' + palette[j].join(',') + ')';
                td.appendChild(div);
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }

        conversionTable.style.display = 'block';
        conversionTable.appendChild(table);

        self.recalculate();
    }

    self.addSprite = function(data) {
        if(spriteTable.querySelectorAll('tr').length >= 40) {
            return;
        }
        data = data || {};
        var tr = document.createElement('tr');
        tr.className = 'fields';
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'text';
        input.value = data.x || 8;
        input.className = 'x';
        td.appendChild(document.createTextNode('X:'));
        td.appendChild(input);
        tr.appendChild(td);
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'text';
        input.value = data.y || 16;
        input.className = 'y';
        td.appendChild(document.createTextNode('Y:'));
        td.appendChild(input);
        tr.appendChild(td);
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'text';
        input.value = data.tile || 0;
        input.className = 'tile';
        td.appendChild(document.createTextNode('Tile:'));
        td.appendChild(input);
        tr.appendChild(td);
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'text';
        input.value = data.pal || 0;
        input.className = 'pal';
        td.appendChild(document.createTextNode('Pal:'));
        td.appendChild(input);
        tr.appendChild(td);
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.value = '1';
        input.className = 'hflip';
        input.checked = data.hflip || false;
        td.appendChild(input);
        td.appendChild(document.createTextNode('HFlip'));
        tr.appendChild(td);
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.value = '1';
        input.className = 'vflip';
        input.checked = data.vflip || false;
        td.appendChild(input);
        td.appendChild(document.createTextNode('VFlip'));
        tr.appendChild(td);
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.value = '1';
        input.className = 'behind';
        input.checked = data.behind || false;
        td.appendChild(input);
        td.appendChild(document.createTextNode('Behind BG'));
        tr.appendChild(td);
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.type = 'button';
        input.value = 'Delete';
        input.className = 'delete';
        input.addEventListener('click', function() {
            spriteTable.removeChild(tr);
            self.recalculate();
        });
        td.appendChild(input);
        tr.appendChild(td);

        var inputs = tr.querySelectorAll('input[type=checkbox],input[type=text]');
        for(var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener('keyup', self.recalculate);
            inputs[i].addEventListener('change', self.recalculate);
        }

        spriteTable.appendChild(tr);
        self.recalculate();
    };

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

    self.recalculate = function() {
        if(inputCanvas.width > 0 && palettes.length > 0) {
            outputCanvas.width = 160;
            outputCanvas.height = 144;
            outputCanvas.style.display = 'block';
            document.querySelector('.preview').style.display = 'block';

            var inputPixels = inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height);
            var outputPixels = outputContext.getImageData(0, 0, outputCanvas.width, outputCanvas.height);

            
            for(var j = 0; j < outputPixels.height; j++) {
                for(var i = 0; i < outputPixels.width; i++) {
                    var p = (j * outputPixels.width + i) * 4
                    var c = (Math.floor(j / 8) + Math.floor(i / 8)) % 2 == 0 ? 0x66 : 0x77;
                    outputPixels.data[p + 0] = c;
                    outputPixels.data[p + 1] = c;
                    outputPixels.data[p + 2] = c;
                    outputPixels.data[p + 3] = 0xFF;
                }
            }

            var indices = self.getPixelIndices(inputPixels, brewtool.getGreyscalePalette());

            var spriteRows = spriteTable.querySelectorAll('tr');
            for(var i = 0; i < spriteRows.length; i++) {
                var row = spriteRows[i];
                var dx = Math.min(Math.max(parseInt(row.querySelector('.x').value) || 0, 0), 255) - 8;
                var dy = Math.min(Math.max(parseInt(row.querySelector('.y').value) || 0, 0), 255) - 16;
                var tile = Math.min(Math.max(parseInt(row.querySelector('.tile').value) || 0, 0), Math.min(Math.floor(inputCanvas.width / 8) * Math.floor(inputCanvas.height / 8) - 1,  255));
                var pal = Math.min(Math.max(parseInt(row.querySelector('.pal').value) || 0, 0), Math.min(palettes.length, 7));
                var hflip = row.querySelector('.hflip').checked;
                var vflip = row.querySelector('.vflip').checked;

                var sx = tile * 8 % inputCanvas.width;
                var sy = Math.floor(tile * 8 / inputCanvas.width) * 8;
                for(var y = 0; y < 8; y++) {
                    for(var x = 0; x < 8; x++) {
                        if(dx + x < 0 || dx + x >= outputCanvas.width || dy + y < 0 || dy + y >= outputCanvas.height) continue;

                        var s = (sy + (vflip ? 7 - y : y)) * inputCanvas.width + (sx + (hflip ? 7 - x : x));
                        var d = ((dy + y) * outputCanvas.width + (dx + x)) * 4;
                        if(indices[s]) {
                            var c = palettes[pal][indices[s]];

                            outputPixels.data[d] = c[0];
                            outputPixels.data[d + 1] = c[1];
                            outputPixels.data[d + 2] = c[2];
                        }
                    }
                }

                row.querySelector('.x').value = dx + 8;
                row.querySelector('.y').value = dy + 16;
                row.querySelector('.tile').value = tile;
                row.querySelector('.pal').value = pal;
            }

            outputContext.putImageData(outputPixels, 0, 0);
        }
    };

    return self;
})({});
 

