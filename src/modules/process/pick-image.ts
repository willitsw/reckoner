import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PickedImage = {
  uri: string;
  contentType: string | null;
  byteSize: number | null;
};

async function fromResult(
  result: ImagePicker.ImagePickerResult,
): Promise<PickedImage | null> {
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    contentType: asset.mimeType ?? null,
    byteSize: asset.fileSize ?? null,
  };
}

/** Library picker (web + native). Returns null on cancel. */
export async function pickImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is needed to attach an image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });
  return fromResult(result);
}

/** Camera when available; falls back to the library on web. Returns null on cancel. */
export async function captureImage(): Promise<PickedImage | null> {
  if (Platform.OS === 'web') return pickImage();

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is needed to take a photo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsEditing: false,
  });
  return fromResult(result);
}
