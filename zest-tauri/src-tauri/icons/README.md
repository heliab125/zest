# Zest Icons

This directory should contain the following icon files:

## Required Icons

- `icon.png` - Main icon (512x512 recommended)
- `icon.ico` - Windows icon
- `icon.icns` - macOS icon
- `32x32.png` - 32x32 icon
- `128x128.png` - 128x128 icon
- `128x128@2x.png` - 256x256 icon for Retina displays

## Generate Icons

You can use the `tauri icon` command to generate all required icons from a source PNG:

```bash
npx tauri icon ../public/zest-icon.svg
```

Or use online tools like:
- https://www.favicon-generator.org/
- https://iconifier.net/

## Source Icon

The source icon is at `../public/zest-icon.svg`. Convert it to a 1024x1024 PNG and use it to generate all platform-specific icons.
