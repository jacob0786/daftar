// Read a picked file as text (desktop: the picker hands back a blob: address)
export async function readTextFile(uri: string) {
  return (await fetch(uri)).text();
}
