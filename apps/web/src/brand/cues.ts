export type GusCue = "honk" | "double-honk" | "squawk" | "celebrate" | "sad-honk";

export const CUE_CAPTIONS: Record<GusCue, string> = {
  honk: "Gus honks.",
  "double-honk": "Gus honks twice.",
  squawk: "Gus squawks loudly.",
  celebrate: "Gus does a triumphant three-note honk.",
  "sad-honk": "Gus lets out a deflated honk.",
};
