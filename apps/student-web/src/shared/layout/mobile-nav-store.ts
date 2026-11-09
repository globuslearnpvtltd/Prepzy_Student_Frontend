import { create } from 'zustand';

/** Open state of the mobile navigation drawer, shared by the header's menu button and the sidebar. */
export const useMobileNav = create<{ open: boolean; setOpen: (open: boolean) => void; toggle: () => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
