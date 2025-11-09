# App Icons

## Current Status
This directory contains a placeholder SVG icon (`icon.svg`) for the Adaptive Reader PWA.

## Generate PNG Icons

To generate the required PNG icons from the SVG, run:

```bash
# Using ImageMagick (install with: brew install imagemagick)
convert -background transparent icon.svg -resize 192x192 icon-192.png
convert -background transparent icon.svg -resize 512x512 icon-512.png
```

Or use an online tool:
- https://realfavicongenerator.net/
- https://www.favicon-generator.org/

## Required Icons
- `icon-192.png` - 192x192 pixels (for mobile home screen)
- `icon-512.png` - 512x512 pixels (for splash screen)

Both should have transparent backgrounds and work as maskable icons.

## Design Notes
The current placeholder shows:
- Dark background (#1A1A1A - theme color)
- Book icon in light blue (#E0F2FE)
- AI sparkle symbol (#0EA5E9 - sky blue)
- Simple, recognizable design for small sizes

For production, consider:
- Professional icon design
- Proper maskable icon safe zones
- Testing on various device backgrounds
