export const UNLIFTEDQ_BASE =
  "https://raw.githubusercontent.com/unliftedq/index-constitution/main/latest";

export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

export function unliftedqCsvUrl(index: "sp500" | "nasdaq100"): string {
  return `${UNLIFTEDQ_BASE}/${index}.csv`;
}
