import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

export type DefinitionAudioPlayback = {
  stop: () => Promise<void>;
};

/** Thin expo-audio wrapper for run-screen definition audio. */
export async function playDefinitionAudio(
  uri: string,
  options?: { onFinished?: () => void },
): Promise<DefinitionAudioPlayback> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
  });
  const player = createAudioPlayer({ uri });
  let stopped = false;

  async function stop() {
    if (stopped) return;
    stopped = true;
    try {
      player.pause();
    } catch {
      // Already stopped / released.
    }
    try {
      player.release();
    } catch {
      // Best-effort cleanup.
    }
  }

  player.addListener('playbackStatusUpdate', (status) => {
    if (!status.isLoaded || !status.didJustFinish || stopped) return;
    void stop().then(() => options?.onFinished?.());
  });

  player.play();

  return { stop };
}
