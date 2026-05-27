export interface AdminChatContextValue {
  enabled: boolean;
  bubbleVisible: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setBubbleVisible: (visible: boolean) => void;
}
