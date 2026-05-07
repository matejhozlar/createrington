export type FocusTarget =
  | "content"
  | "title"
  | "description"
  | "author"
  | "color"
  | "imageUrl"
  | "thumbnailUrl"
  | "footer"
  | "fields:add"
  | "buttons:add"
  | `field:${number}`
  | `button:link:${number}`
  | `button:action:${number}`;
