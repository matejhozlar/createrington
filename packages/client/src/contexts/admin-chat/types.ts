export interface OpenDrawerOptions {
  expanded?: boolean;
}

export interface AdminChatContextValue {
  enabled: boolean;
  bubbleVisible: boolean;
  drawerOpen: boolean;
  expanded: boolean;
  openDrawer: (options?: OpenDrawerOptions) => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setExpanded: (expanded: boolean) => void;
  setBubbleVisible: (visible: boolean) => void;
}
