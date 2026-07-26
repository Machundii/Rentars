export const CANONICAL_AMENITIES = [
  'wifi',
  'parking',
  'pool',
  'gym',
  'air_conditioning',
  'heating',
  'kitchen',
  'washer',
  'dryer',
  'tv',
  'workspace',
  'elevator',
  'hot_tub',
  'bbq_grill',
  'fireplace',
  'beach_access',
  'ski_access',
  'pet_friendly',
  'smoking_allowed',
  'wheelchair_accessible',
] as const;

export type Amenity = (typeof CANONICAL_AMENITIES)[number];
