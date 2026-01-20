#!/bin/bash
# Script para gerar ícones placeholder
# Em produção, use: npx tauri icon <seu-icone-1024x1024.png>

ICONS_DIR="src-tauri/icons"
mkdir -p "$ICONS_DIR"

# Criar um PNG placeholder simples usando ImageMagick ou sips (macOS)
if command -v sips &> /dev/null; then
    # macOS - usar sips para converter SVG não funciona, criar placeholder
    echo "Criando ícones placeholder..."
    
    # Criar um PNG azul simples como placeholder
    python3 << 'PYTHON'
import struct
import zlib

def create_png(width, height, color, filename):
    def make_chunk(chunk_type, data):
        chunk_len = struct.pack('>I', len(data))
        chunk_crc = struct.pack('>I', zlib.crc32(chunk_type + data) & 0xffffffff)
        return chunk_len + chunk_type + data + chunk_crc
    
    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = make_chunk(b'IHDR', ihdr_data)
    
    # IDAT chunk (image data)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            raw_data += bytes(color)
    
    compressed = zlib.compress(raw_data, 9)
    idat = make_chunk(b'IDAT', compressed)
    
    # IEND chunk
    iend = make_chunk(b'IEND', b'')
    
    with open(filename, 'wb') as f:
        f.write(signature + ihdr + idat + iend)

# Blue color (59, 130, 246)
color = [59, 130, 246]

create_png(32, 32, color, 'src-tauri/icons/32x32.png')
create_png(128, 128, color, 'src-tauri/icons/128x128.png')
create_png(256, 256, color, 'src-tauri/icons/128x128@2x.png')
create_png(512, 512, color, 'src-tauri/icons/icon.png')

print("Ícones PNG criados com sucesso!")
PYTHON

else
    echo "Instale Python3 para gerar os ícones"
fi
