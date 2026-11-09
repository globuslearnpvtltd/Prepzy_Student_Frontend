'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authKeys, forgetExam } from '@/features/auth';
import { routes } from '@/shared/config/routes';
import { profileApi, type ProfileUpdate } from './api';

export const profileKeys = {
  profile: ['profile', 'account'] as const,
  classes: ['profile', 'classes'] as const,
  parent: ['profile', 'parent'] as const,
};

export function useProfile() {
  return useQuery({ queryKey: profileKeys.profile, queryFn: profileApi.get });
}

export function useClassOptions() {
  return useQuery({ queryKey: profileKeys.classes, queryFn: profileApi.classes, staleTime: 60 * 60_000 });
}

/** Saving refreshes both the profile and the session user (header name, initials). */
function useRefreshAccount() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: profileKeys.profile }),
      queryClient.invalidateQueries({ queryKey: authKeys.me }),
    ]);
}

export function useUpdateProfile() {
  const refresh = useRefreshAccount();
  return useMutation({ mutationFn: (values: ProfileUpdate) => profileApi.update(values), onSuccess: refresh });
}

export function useUploadPhoto() {
  const refresh = useRefreshAccount();
  return useMutation({ mutationFn: (file: File) => profileApi.uploadPhoto(file), onSuccess: refresh });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      profileApi.changePassword(oldPassword, newPassword),
  });
}

/** Deletes the account, then signs the student out locally (the session no longer exists). */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (accountId: number) => profileApi.deleteAccount(accountId),
    onSuccess: () => {
      forgetExam();
      try {
        sessionStorage.clear();
      } catch {
        // Storage blocked: nothing to clear.
      }
      queryClient.clear();
      router.replace(routes.login());
    },
  });
}

export function useParent() {
  return useQuery({ queryKey: profileKeys.parent, queryFn: profileApi.parent });
}
