import { Audio } from 'expo-av';

export type DefinitionAudioPlayback = {
  stop: () => Promise<void>;
};

/** Thin Expo AV wrapper for run-screen definition audio. */
export async function playDefinitionAudio(
  uri: string,
  options?: { onFinished?: () => void },
): Promise<DefinitionAudioPlayback> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
  let stopped = false;

  async function stop() {
    if (stopped) return;
    stopped = true;
    try {
      await sound.stopAsync();
    } catch {
      // Already stopped / unloaded.
    }
    try {
      await sound.unloadAsync();
    } catch {
      // Best-effort cleanup.
    }
  }

  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded || !status.didJustFinish || stopped) return;
    void stop().then(() => options?.onFinished?.());
  });

  return { stop };
}
