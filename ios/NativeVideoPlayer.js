import React, { useRef, useEffect } from 'react';
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  View,
  TouchableWithoutFeedback,
  NativeModules,
} from 'react-native';

const COMPONENT_NAME = 'NativeVideoView';
const NativeVideoView = requireNativeComponent(COMPONENT_NAME);
const { NativeVideoViewModule } = NativeModules;

const COMMANDS = {
  setSource: 'setSource',
  setPaused: 'setPaused',
  setRepeat: 'setRepeat',
};

const sendCommand = (ref, command, args) => {
  const node = findNodeHandle(ref.current);
  if (!node) return;
  const commandId = UIManager.getViewManagerConfig(COMPONENT_NAME).Commands[command];
  UIManager.dispatchViewManagerCommand(node, commandId, args);
};

const Video = ({ source, paused = true, repeat = false, style }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && source?.uri) {
      sendCommand(ref, COMMANDS.setSource, [source]);
    }
  }, [source?.uri]);

  useEffect(() => {
    sendCommand(ref, COMMANDS.setPaused, [paused]);
  }, [paused]);

  useEffect(() => {
    sendCommand(ref, COMMANDS.setRepeat, [repeat]);
  }, [repeat]);

  const openFullscreen = () => {
    if (source?.uri) {
      NativeVideoViewModule.pauseEmbedded(source.uri);
      NativeVideoViewModule.presentFullscreen(source.uri);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={openFullscreen}>
      <View style={style}>
        <NativeVideoView ref={ref} style={{ width: '100%', height: '100%' }} />
      </View>
    </TouchableWithoutFeedback>
  );
};

export default Video;
