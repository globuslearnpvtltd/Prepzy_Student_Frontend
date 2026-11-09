'use client';

import type { ChangeEvent } from 'react';
import { toast } from 'sonner';
import { userMessage } from '@/shared/lib/errors';
import { useUploadPhoto } from '../hooks';

const ALLOWED = ['image/jpeg', 'image/png'];

export function UploadPhoto() {
  const upload = useUploadPhoto();

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      toast.error('Only JPG or PNG is allowed');
      return;
    }
    upload.mutate(file, {
      onSuccess: () => toast.success('Image uploaded successfully'),
      onError: (error) => toast.error(userMessage(error, 'Error uploading image')),
    });
  };

  return (
    <div className="flex flex-col gap-3 text-[16px] font-semibold text-neutral-400">
      <label
        htmlFor="upload-avatar"
        className="border-info-600 text-info-600 w-[60%] cursor-pointer rounded-md border-2 px-2 py-2 text-center text-[14px] font-semibold hover:opacity-80 md:w-[70%] md:px-3 md:text-[16px]"
      >
        {upload.isPending ? 'Uploading…' : 'Upload New Photo'}
      </label>
      <input id="upload-avatar" type="file" accept="image/png,image/jpeg" className="hidden" onChange={onChange} />
      <span className="leading-5 font-normal">
        At least 800 x 800 px recomended. <br /> JPG or PNG is allowed.
      </span>
    </div>
  );
}
