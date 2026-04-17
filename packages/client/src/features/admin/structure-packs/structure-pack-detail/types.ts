/** A pack mod targeted for removal, passed between the mods list and the remove dialog. */
export interface RemoveTarget {
  modId: number;
  modName: string;
  fileName: string;
}
