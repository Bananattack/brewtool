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
    var inputContext = null;
    var filePicker = null;
    var saveButton = null;
    var conversionTable = null;
    var palettes = [];
    var currentFile = null;

    self.init = function(config) {
        var div = document.createElement('div');
        div.className = 'section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Input'));
        div.appendChild(h2);
        var p = document.createElement('p');
        p.appendChild(document.createTextNode('Source file may be .pal, .png or .gif. You can drag and drop files here.'));
        div.appendChild(p);
        var span = document.createElement('span');
        span.className = 'format';
        span.appendChild(document.createTextNode('Input Image:'));
        div.appendChild(span);
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
        div.className = 'section';
        var h2 = document.createElement('h2');
        h2.appendChild(document.createTextNode('Output'));
        div.appendChild(h2);
        var span = document.createElement('span');
        span.className = 'format';
        span.appendChild(document.createTextNode('Output Palette:'));
        div.appendChild(span);
        saveButton = document.createElement('input');
        saveButton.setAttribute('type', 'button');
        saveButton.setAttribute('value', 'Save File');
        saveButton.addEventListener('click', self.saveFile);
        div.appendChild(saveButton);
        config.element.appendChild(div);

        inputContext = inputCanvas.getContext('2d');

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
        filePicker.value = '';
        if(file.type === 'image/png' || file.type === 'image/gif') {
            var image = new Image;
            image.onload = function() {
                inputCanvas.width = image.width;
                inputCanvas.height = image.height;
                inputContext.drawImage(image, 0, 0);

                try {
                    palettes = self.getPalettes(inputContext.getImageData(0, 0, inputCanvas.width, inputCanvas.height));
                } catch(e) {
                    alert(e);
                }
                self.setup();
            };
            image.src = URL.createObjectURL(file);
        } else {
            var extension = file.name.split('.').pop();
            if(extension == 'pal') {
                var reader = new FileReader();
                reader.onload = function(event) {
                    palettes = brewtool.loadPalettes(event.target.result);
                    self.setup();
                };
                reader.readAsBinaryString(file);
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

        brewtool.savePalettes(palettes, function(blob) {
            saveAs(blob, parts.join('.') + '.pal');
        });

        return false;
    };

    self.getPalettes = function(pixels) {
        // RGB Image containing rows of colors.
        // Treat each unique row as a palette.
        var palettes = [];
        var rows = {}
        for(y = 0; y < pixels.height; y++) {
            var row = []
            var prev = null;
            for(x = 0; x < pixels.width; x++) {
                var i = (y * pixels.width + x) * 4;
                var color = [
                    pixels.data[i],
                    pixels.data[i + 1],
                    pixels.data[i + 2]
                ];
                if(prev != color.join(',')) {
                    prev = color.join(',')
                    row.push(prev);
                }
            }
            
            var N = 4;
            while(row.length < N) {
                row.unshift(row[0]);
            }
            while(row.length > N) {
                row.pop();
            }

            row = row.join(':');
            if(!rows[row]) {
                rows[row] = true;
                var items = row.split(':');
                var pal = [];
                for(var i = 0; i < items.length; i++) {
                    pal.push(items[i].split(','));
                }

                palettes.push(pal);
                if(palettes.length > 16) {
                    throw 'That is a lot of palettes. You might be doing this wrong.';
                }
            }
        }
        return palettes;
    }

    self.setup = function() {
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
            for(var j = 0; j < palette.length; j++) {
                var td = document.createElement('td');
                var div = document.createElement('div');
                div.className = 'color';
                div.style.backgroundColor = 'rgb(' + palette[j].join(',') + ')';
                td.appendChild(div);
                tr.appendChild(td);
            }
            table.appendChild(tr);

            var tr = document.createElement('tr');
            tr.className = 'hex';
            for(var j = 0; j < palette.length; j++) {
                (function() {
                    var td = document.createElement('td');

                    var r = Math.floor(palette[j][0] * 32 / 256);
                    var g = Math.floor(palette[j][1] * 32 / 256);
                    var b = Math.floor(palette[j][2] * 32 / 256);

                    td.appendChild(document.createTextNode('0x' + (r | g << 5 | b << 10 | 1 << 16).toString(16).substring(1).toUpperCase()));
                    tr.appendChild(td);
                })();
            }
            table.appendChild(tr);
        }

        conversionTable.style.display = 'block';
        conversionTable.appendChild(table);
    }

    return self;
})({});
 

