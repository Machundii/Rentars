import { z } from 'zod';

export const listingFormSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100),
  description: z.string().min(20, 'Description must be at least 20 characters').max(2000),
  propertyType: z.enum(['apartment', 'house', 'villa', 'condo', 'studio']),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid zip code'),
  maxGuests: z.number().int().min(1, 'At least 1 guest required'),
  bedrooms: z.number().int().min(0, 'Bedrooms must be 0 or more'),
  bathrooms: z.number().int().min(0, 'Bathrooms must be 0 or more'),
  amenities: z.array(z.string()).min(1, 'Select at least one amenity'),
  images: z.array(z.instanceof(File)).min(1, 'Upload at least one image'),
  pricePerNight: z.number().min(10, 'Price must be at least $10'),
  cleaningFee: z.number().min(0),
  serviceFee: z.number().min(0),
  // House rules
  petsAllowed: z.boolean().default(false),
  smokingAllowed: z.boolean().default(false),
  eventsAllowed: z.boolean().default(false),
  quietHoursStart: z.string().default(''),
  quietHoursEnd: z.string().default(''),
  additionalRules: z.string().max(2000, 'Additional rules must be under 2000 characters').default(''),
  agreeToTerms: z.boolean().refine((val) => val === true, 'You must agree to terms'),
});

export type ListingFormSchema = z.infer<typeof listingFormSchema>;
