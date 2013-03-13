var brewtool = (function(self) {
    var calculateTilesetSize = function(bytes) {
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

        return [rows, columns];
    };

    var getPixelIndices = function(pixels, palette) {
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
    };

    self.getGreyscalePalette = function() {
        return [
            [0x00, 0x00, 0x00],
            [0x60, 0x60, 0x60],
            [0xC0, 0xC0, 0xC0],
            [0xFF, 0xFF, 0xFF]
        ];
    };

    self.loadTileset = function(bytes, canvas, format, palette) {
        if(format != 'NES'
        && format != 'GB') {
            return;
        }

        var size = calculateTilesetSize(bytes);
        var rows = size[0];
        var columns = size[1];

        canvas.width = columns * 8;
        canvas.height = rows * 8;
        var pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);

        if(format == 'NES') {
            for(var row = 0; row < rows; row++) {
                for(var col = 0; col < columns; col++) {
                    for(var j = 0; j < 8; j++) {
                        var low = bytes.charCodeAt((row * columns + col) * 16 + j);
                        var high = bytes.charCodeAt((row * columns + col) * 16 + j + 8);
                        for(var i = 0; i < 8; i++) {
                            var p = ((row * 8 + j) * columns * 8 + (col * 8 + i)) * 4;
                            var c = palette[((high & (1 << (7 - i))) ? 2 : 0) | ((low & (1 << (7 - i))) ? 1 : 0)]
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
                            var c = palette[((high & (1 << (7 - i))) ? 2 : 0) | ((low & (1 << (7 - i))) ? 1 : 0)]

                            pixels.data[p + 0] = c[0];
                            pixels.data[p + 1] = c[1];
                            pixels.data[p + 2] = c[2];
                            pixels.data[p + 3] = 0xFF;
                        }
                    }
                }
            }
        }
        canvas.getContext('2d').putImageData(pixels, 0, 0);
    };

    self.saveTileset = function(canvas, format, palette, callback) {
        if(format != 'NES'
        && format != 'GB'
        && format != 'PNG') {
            return;
        }

        var bytes = [];
        var pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var indices = getPixelIndices(pixels, palette);
        if(format == 'NES') {
            for(var y = 0, h = canvas.height; y < h; y += 8) {
                for(var x = 0, w = canvas.width; x < w; x += 8) {
                    for(var j = 0; j < 8; j++) {
                        var low = 0;
                        for(var i = 0; i < 8; i++) {
                            var color = indices[(y + j) * canvas.width + x + i];
                            low = (low << 1) | (color & 0x1);
                        }
                        bytes.push(low);
                    }
                    for(var j = 0; j < 8; j++) {
                        var high = 0;
                        for(var i = 0; i < 8; i++) {
                            var c = indices[(y + j) * canvas.width + x + i];
                            high = (high << 1) | ((c & 0x2) >> 1);
                        }
                        bytes.push(high);
                    }
                }
            }
        } else {
            for(var y = 0, h = canvas.height; y < h; y += 8) {
                for(var x = 0, w = canvas.width; x < w; x += 8) {
                    for(var j = 0; j < 8; j++) {
                        var low = 0;
                        var high = 0;
                        for(var i = 0; i < 8; i++) {
                            var color = indices[(y + j) * canvas.width + x + i];
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

        callback(new Blob([buffer], {type: "application/octet-stream"}));
    };

    self.loadPalettes = function(bytes) {
        var palettes = [];
        var count = Math.floor(bytes.length / 8);
        for(var i = 0; i < count; i++) {
            var palette = [];
            for(var j = 0; j < 4; j++) {
                var v = bytes.charCodeAt(i * 8 + j * 2) | (bytes.charCodeAt(i * 8 + j * 2 + 1) << 8)
                palette.push([
                    (v & 0x1F) << 3,
                    ((v >> 5) & 0x1F) << 3,
                    ((v >> 10) & 0x1F) << 3,
                ]);
            }
            palettes.push(palette);
        }
        return palettes;
    }

    self.savePalettes = function(palettes, callback) {
        var bytes = [];
        for(var i = 0; i < palettes.length; i++) {
            var palette = palettes[i];
            for(var j = 0; j < palette.length; j++) {
                var r = Math.floor(palette[j][0] * 32 / 256);
                var g = Math.floor(palette[j][1] * 32 / 256);
                var b = Math.floor(palette[j][2] * 32 / 256);
                var c = (r | g << 5 | b << 10);

                bytes.push(c & 0xFF);
                bytes.push((c >> 8) & 0xFF);
            }
        }

        var buffer = new Uint8Array(new ArrayBuffer(bytes.length));
        for(var i = 0; i < bytes.length; i++) {
            buffer[i] = bytes[i];
        }
        callback(new Blob([buffer], {type: "application/octet-stream"}));
    }

    self.loadSprites = function(bytes) {
        var sprites = [];
        var count = Math.floor(bytes.length / 4);
        for(var i = 0; i < count; i++) {
            sprites.push({
                x: bytes.charCodeAt(i * 4),
                y: bytes.charCodeAt(i * 4 + 1),
                tile: bytes.charCodeAt(i * 4 + 2),
                pal: bytes.charCodeAt(i * 4 + 3) & 0x07,
                hflip: !!(bytes.charCodeAt(i * 4 + 3) & 0x20),
                vflip: !!(bytes.charCodeAt(i * 4 + 3) & 0x40),
                behind: !!(bytes.charCodeAt(i * 4 + 3) & 0x80)
            });
        }
        return sprites;
    }

    self.saveSprites = function(sprites, callback) {
        var bytes = [];
        for(var i = 0; i < sprites.length; i++) {
            var sprite = sprites[i];
            bytes.push(sprite.x & 0xFF);
            bytes.push(sprite.y & 0xFF);
            bytes.push(sprite.tile & 0xFF);
            bytes.push((sprite.pal & 0x07) | (sprite.hflip ? 0x20 : 0x00) | (sprite.vflip ? 0x40 : 0x00) | (sprite.behind ? 0x80 : 0x00));
        }

        var buffer = new Uint8Array(new ArrayBuffer(bytes.length));
        for(var i = 0; i < bytes.length; i++) {
            buffer[i] = bytes[i];
        }
        callback(new Blob([buffer], {type: "application/octet-stream"}));
    }

    return self;
})({})