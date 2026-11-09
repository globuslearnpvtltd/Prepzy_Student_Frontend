import { create } from 'zustand';

/** Event the previous app fired to open Atlas from anywhere; kept so old widgets keep working. */
export const OPEN_ATLAS_EVENT = 'prepzy:open-atlas';

interface AtlasState {
  /** The dashboard Atlas panel is open. */
  open: boolean;
  /** Desktop: the panel fills the screen (history sidebar shown). */
  expanded: boolean;
  /** Mobile "Ask" sheet: Atlas vs Socrates. */
  askSheet: boolean;
  openAtlas: () => void;
  close: () => void;
  setExpanded: (expanded: boolean) => void;
  setAskSheet: (open: boolean) => void;
}

export const useAtlas = create<AtlasState>((set) => ({
  open: false,
  expanded: false,
  askSheet: false,
  openAtlas: () => set({ open: true, askSheet: false }),
  close: () => set({ open: false, expanded: false }),
  setExpanded: (expanded) => set({ expanded }),
  setAskSheet: (askSheet) => set({ askSheet }),
}));

/** Opens the dashboard Atlas panel from any component (e.g. a "Use Atlas" link). */
export const openAtlas = () => useAtlas.getState().openAtlas();
