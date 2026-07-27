'use client';

import { useState } from 'react';
import ImageUploader from '@/components/features/properties/ImageUploader';
import type { ListingFormData } from '../types';

interface PhotosStepProps {
  formData: Partial<ListingFormData>;
  setFormData: (data: Partial<ListingFormData>) => void;
  errors: Record<string, string>;
  onUploadStatusChange?: (inProgress: boolean) => void;
}

export default function PhotosStep({ formData, setFormData, errors, onUploadStatusChange }: PhotosStepProps) {
  const [uploadsInProgress, setUploadsInProgress] = useState(false);

  const handleUploadStatusChange = (inProgress: boolean) => {
    setUploadsInProgress(inProgress);
    onUploadStatusChange?.(inProgress);
  };

  return (
    <div className="space-y-6">
      <ImageUploader
        onChange={(images) =>
          setFormData({ ...formData, images: images.map((img) => img.file!).filter(Boolean) })
        }
        onUploadStatusChange={handleUploadStatusChange}
        maxImages={10}
      />
      {uploadsInProgress && (
        <p className="text-sm text-blue-600">Uploads in progress. Please wait...</p>
      )}
      {errors.images && <p className="text-sm text-red-600 mt-1">{errors.images}</p>}
    </div>
  );
}
