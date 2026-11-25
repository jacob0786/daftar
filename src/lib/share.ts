import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Hand a text file to Android's share sheet (save to Drive, Files, email it to yourself…)
export async function shareTextFile(name: string, text: string, mimeType = 'application/json') {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Save your Daftar backup' });
}
