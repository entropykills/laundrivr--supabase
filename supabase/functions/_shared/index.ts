// deno-lint-ignore no-explicit-any
export const stringify = (data: any) => {
  return JSON.stringify(
    data,
    (_, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
  );
};
