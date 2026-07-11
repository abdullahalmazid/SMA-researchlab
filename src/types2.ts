// src/types.ts

export type BlockType =
  | "hero"
  | "stats"
  | "text_section"
  | "mission_vision"
  | "cta";

export interface PageBlock {
  id: string;
  type: BlockType;
  order: number;
}
