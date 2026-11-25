import { File } from 'expo-file-system';

// Read a picked file as text (phone: a content:// or file:// address)
export function readTextFile(uri: string) {
  return new File(uri).text();
}
