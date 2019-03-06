#!/usr/bin/env python

import os

try:
    from html.parser import HTMLParser 
except ImportError:
    from HTMLParser import HTMLParser

import glob

class StandaloneHTMLExporter(HTMLParser):
    def __init__(self, path):
        HTMLParser.__init__(self)
        self.path = path
        self.buffer = []

    def __write(self, data):
        self.buffer.append(data)

    def handle_decl(self, decl):
        self.__write('<!' + decl + '>')

    def handle_starttag(self, tag, attrs):
        expanded_data = ''

        if tag == 'link':
            if len([a for a in attrs if a[0] == 'rel' and a[1] == 'stylesheet']):
                tag = 'style'
                expanded_data = '\n' + open(os.path.join(os.path.dirname(self.path), [a for a in attrs if a[0] == 'href'][0][1])).read() + '\n</style>'
        elif tag == 'script':
            for a in attrs:
                if a[0] == 'src':
                    expanded_data = '\n' + open(os.path.join(os.path.dirname(self.path), a[1])).read() + '\n'
                    attrs.remove(a)
                    break

        self.__write('<' + tag + (' ' + ' '.join([a[0] + '="' + a[1] + '"' for a in attrs]) if len(attrs) else '') + '>' + expanded_data)

    def handle_endtag(self, tag):
        self.__write('</' + tag + '>')

    def handle_data(self, data):
        self.__write(data)

    def handle_entityref(self, name):
        self.__write('&' + name + ';')

    def export(self, output_directory):
        with open(self.path) as source:
            self.feed(source.read())
            with open(os.path.join(output_directory, os.path.basename(os.path.dirname(self.path)) + '.html'), 'w') as output:
                output.write(''.join(self.buffer))

def export(output_directory):
    if not os.path.isdir(output_directory):
        os.mkdir(output_directory)

    paths = [path for path in glob.glob('**/index.html') if not os.path.abspath(os.path.dirname(path)) == os.path.abspath(output_directory)]

    for path in paths:
        exporter = StandaloneHTMLExporter(path)
        exporter.export(output_directory)

if __name__ == '__main__':
    import sys
    export(sys.argv[0] if len(sys.argv) > 1 else 'standalone')