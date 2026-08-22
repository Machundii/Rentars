/**
 * Test for EXIF metadata stripping and image re-encoding.
 *
 * Verifies that uploaded images containing EXIF/GPS metadata (e.g. location, camera model)
 * have all EXIF tags completely stripped during optimization and re-encoding.
 */

import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { optimizeImage } from '../config/supabase-storage.js';

describe('EXIF Metadata Stripping and Re-encoding', () => {
  it('strips EXIF and GPS metadata from uploaded image', async () => {
    // Generate a test JPEG image fixture containing EXIF metadata and GPS coordinates
    const inputWithExif = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .withMetadata({
        exif: {
          IFD0: {
            Make: 'TestCamera',
            Model: 'TestModel',
          },
          GPSInfo: {
            GPSLatitudeRef: 'N',
            GPSLatitude: [37, 46, 29],
            GPSLongitudeRef: 'W',
            GPSLongitude: [122, 25, 9],
          },
        },
      })
      .jpeg()
      .toBuffer();

    // Verify initial input fixture contains EXIF metadata
    const inputMetadata = await sharp(inputWithExif).metadata();
    expect(inputMetadata.exif).toBeDefined();
    expect(inputMetadata.exif!.length).toBeGreaterThan(0);

    // Process image through optimization pipeline (main image)
    const mainResult = await optimizeImage(inputWithExif, 'image/jpeg', {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 80,
    });

    // Process image through optimization pipeline (thumbnail variant)
    const thumbResult = await optimizeImage(inputWithExif, 'image/jpeg', {
      maxWidth: 800,
      maxHeight: 600,
      quality: 80,
    });

    // Verify output main image has zero EXIF/GPS metadata
    const mainMetadata = await sharp(mainResult.buffer).metadata();
    expect(mainMetadata.exif).toBeUndefined();

    // Verify output thumbnail variant has zero EXIF/GPS metadata
    const thumbMetadata = await sharp(thumbResult.buffer).metadata();
    expect(thumbMetadata.exif).toBeUndefined();
  });
});
