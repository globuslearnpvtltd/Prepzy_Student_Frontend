'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { userMessage } from '@/shared/lib/errors';
import type { Profile } from '../api';
import { useClassOptions, useUpdateProfile } from '../hooks';
import { profileSchema } from '../schemas';
import { inputClass, ProfileField, SolidButton } from './kit';

type Values = z.input<typeof profileSchema>;

export function PersonalInfoForm({ profile }: { profile: Profile }) {
  const classes = useClassOptions();
  const update = useUpdateProfile();
  const form = useForm<Values>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      dateOfBirth: profile.dateOfBirth,
      address: profile.address,
      city: profile.city,
      gender: profile.gender,
      classId: profile.classId,
      school: profile.school,
    },
  });
  const { errors } = form.formState;

  // The class <select> only has its options once the class list arrives; re-apply the saved class then.
  useEffect(() => {
    if (classes.data && !form.getFieldState('classId').isDirty) form.setValue('classId', profile.classId);
  }, [classes.data, form, profile.classId]);
  const today = new Date().toISOString().slice(0, 10);

  const submit = form.handleSubmit(
    (values) =>
      update.mutate(
        { ...values, email: values.email ?? '' },
        {
          onSuccess: () => toast.success('Your profile has been updated successfully.'),
          onError: (error) => toast.error(userMessage(error)),
        },
      ),
    () => toast.error('Please fill in all required fields correctly'),
  );

  return (
    <div className="w-full p-5 md:p-10">
      <h2 className="mb-6 text-[16px] leading-[22px] font-bold text-neutral-900">Personal Info</h2>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ProfileField id="first_name" label="First Name" required error={errors.firstName?.message}>
            <input id="first_name" className={inputClass(!!errors.firstName)} {...form.register('firstName')} />
          </ProfileField>
          <ProfileField id="last_name" label="Last Name" required error={errors.lastName?.message}>
            <input id="last_name" className={inputClass(!!errors.lastName)} {...form.register('lastName')} />
          </ProfileField>
          <ProfileField id="email" label="Email" error={errors.email?.message}>
            <input id="email" type="email" className={inputClass(!!errors.email)} {...form.register('email')} />
          </ProfileField>
          <ProfileField id="date_of_birth" label="Date of Birth">
            <input id="date_of_birth" type="date" max={today} className={inputClass()} {...form.register('dateOfBirth')} />
          </ProfileField>
          <ProfileField id="phone" label="Phone Number">
            <input id="phone" type="tel" disabled value={profile.phone} className={inputClass()} />
          </ProfileField>
          <ProfileField id="student_class" label="Class" required error={errors.classId?.message}>
            <select id="student_class" className={inputClass(!!errors.classId)} {...form.register('classId')}>
              <option value="">Select Class</option>
              {(classes.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </ProfileField>
          <ProfileField id="address" label="Address">
            <input id="address" className={inputClass()} {...form.register('address')} />
          </ProfileField>
          <ProfileField id="city" label="City">
            <input id="city" className={inputClass()} {...form.register('city')} />
          </ProfileField>
          <ProfileField id="gender" label="Gender">
            <select id="gender" className={inputClass()} {...form.register('gender')}>
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </ProfileField>
          <ProfileField id="school" label="School">
            <input id="school" className={inputClass()} {...form.register('school')} />
          </ProfileField>
        </div>
        <SolidButton type="submit" busy={update.isPending} className="mt-6">
          Update
        </SolidButton>
      </form>
    </div>
  );
}
