'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { cx } from '@prepzy/design-system';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { userMessage } from '@/shared/lib/errors';
import { useChangePassword } from '../hooks';
import { changePasswordSchema } from '../schemas';
import { SolidButton } from './kit';

type Values = z.input<typeof changePasswordSchema>;

const FIELDS = [
  { name: 'oldPassword', id: 'old_password', label: 'Old Password' },
  { name: 'newPassword', id: 'new_password', label: 'New Password' },
  { name: 'confirmPassword', id: 'confirm_password', label: 'Confirm password' },
] as const;

export function ChangePasswordScreen() {
  const change = useChangePassword();
  const form = useForm<Values>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    change.mutate(values, {
      onSuccess: () => {
        toast.success('Password Successfully Updated!');
        form.reset();
      },
    }),
  );

  return (
    <div className="flex flex-col md:px-10">
      <h1 className="text-[20px] font-bold text-neutral-900">Change Password</h1>
      <section className="bg-surface mt-2 w-full rounded-xl p-6 shadow-sm sm:p-8">
        <form noValidate onSubmit={submit} className="mt-2 flex flex-col gap-4 md:gap-5 lg:mt-5">
          {FIELDS.map((field) => {
            const error = errors[field.name]?.message;
            return (
              <div key={field.name}>
                <label htmlFor={field.id} className="mb-2 block text-sm font-medium text-neutral-900">
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type="password"
                  placeholder={field.label === 'Confirm password' ? 'Confirm Password' : field.label}
                  className={cx(
                    'block w-full rounded-sm border bg-neutral-50 p-2.5 text-sm text-neutral-900 outline-none focus:border-info-600',
                    error ? 'border-danger' : 'border-neutral-300',
                  )}
                  {...form.register(field.name)}
                />
                {error && (
                  <p role="alert" className="text-danger mt-1 text-xs">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
          {change.isError && (
            <p role="alert" className="text-danger text-sm">
              {userMessage(change.error, 'Your old password is not correct.')}
            </p>
          )}
          <SolidButton type="submit" busy={change.isPending} className="mt-6 h-auto p-3">
            Update
          </SolidButton>
        </form>
      </section>
    </div>
  );
}
