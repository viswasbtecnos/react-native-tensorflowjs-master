import * as ScreenOrientation from 'expo-screen-orientation';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import React, { useState, useCallback, useEffect, useMemo } from 'react';

// Tensorflow js
import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

// Components
import TensorCamera from '../../components/TensorCamera';
import ActivityIndicator from '../../components/ActivityIndicator';

// Utils
import { COMPUTE_RECOGNITION_EVERY_N_FRAMES } from '../../constants/Tensorflow';
import { CAM_PREVIEW_HEIGHT, CAM_PREVIEW_WIDTH, checkIsPortrait } from '../../helpers/Camera';

// Types
import type { FC } from 'react';

let frame = 0;

interface DetectionProps {}

const DetectionMobilenet: FC<DetectionProps> = (props) => {
  const [net, setNet] = useState<mobilenet.MobileNet>();
  const [detections, setDetections] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<ScreenOrientation.Orientation>();

  useEffect(() => {
    async function prepare() {
      setNet(await mobilenet.load({ version: 1, alpha: 0.25 }));

      // Set initial orientation.
      const curOrientation = await ScreenOrientation.getOrientationAsync();
      setOrientation(curOrientation);

      // Listens to orientation change.
      ScreenOrientation.addOrientationChangeListener((event) => {
        setOrientation(event.orientationInfo.orientation);
      });
    }
    prepare();
  }, []);

  const isPortrait = useMemo(() => checkIsPortrait(orientation), [orientation]);

  const handleCameraStream = useCallback(
    (images: IterableIterator<tf.Tensor3D>) => {
      const loop = async () => {
        if (net) {
          if (frame % COMPUTE_RECOGNITION_EVERY_N_FRAMES === 0) {
            const nextImageTensor = images.next().value;
            if (nextImageTensor) {
              const objects = await net.classify(nextImageTensor);
              if (objects && objects.length > 0) {
                setDetections(
                  objects.map(
                    (object) => `${object.className}: ${(object.probability * 100).toFixed(5)}%\n`
                  )
                );
              }
              tf.dispose([nextImageTensor]);
            }
          }
          frame += 1;
          frame = frame % COMPUTE_RECOGNITION_EVERY_N_FRAMES;
        }

        requestAnimationFrame(loop);
      };
      loop();
    },
    [net]
  );

  if (!net) {
    return <ActivityIndicator />;
  }

  return (
    <View style={isPortrait ? styles.containerPortrait : styles.containerLandscape}>
      <TensorCamera style={styles.camera} isPortrait={isPortrait} onReady={handleCameraStream} />
      <View style={styles.text}>
        {detections.map((detection, index) => (
          <Text key={index}>{detection}</Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    flex: 1,
  },
  camera: {
    flex: 20,
    width: '100%',
    height: '100%',
  },
  cameraTypeSwitcher: {
    top: 10,
    right: 10,
    width: 180,
    padding: 8,
    zIndex: 20,
    borderRadius: 2,
    position: 'absolute',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, .7)',
  },
  containerPortrait: {
    marginTop: 35,
    position: 'relative',
    width: CAM_PREVIEW_WIDTH,
    height: CAM_PREVIEW_HEIGHT,
  },
  containerLandscape: {
    position: 'relative',
    width: CAM_PREVIEW_HEIGHT,
    height: CAM_PREVIEW_WIDTH,
    marginLeft: Dimensions.get('window').height / 2 - CAM_PREVIEW_HEIGHT / 2,
  },
});

export default DetectionMobilenet;
