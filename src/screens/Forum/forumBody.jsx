import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import RenderHTML, { defaultHTMLElementModels } from 'react-native-render-html';
import { decode } from 'html-entities';

// 🔧 Strip out styles like font-size, margin, padding
const stripInlineStyles = (domNode) => {
  if (domNode.attribs?.style) {
    domNode.attribs.style = domNode.attribs.style
      .split(';')
      .filter((style) => {
        const s = style.trim().toLowerCase();
        return !s.startsWith('font-size') &&
               !s.startsWith('font-family') &&
               !s.startsWith('margin') &&
               !s.startsWith('padding');
      })
      .join(';');
  }
};

// ✅ Shared static config (won’t recreate each render)
const baseStyle = { fontSize: 14 };
const defaultTextProps = {
  selectable: true,
  style: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 0,
    marginBottom: 0,
  },
};
const tagStyles = {
  p: { marginTop: 0, marginBottom: 0 },
  div: { marginTop: 0, marginBottom: 0 },
  ul: { marginTop: 0, marginBottom: 0 },
  ol: { marginTop: 0, marginBottom: 0 },
  li: { marginTop: 0, marginBottom: 0 },
  span: { marginTop: 0, marginBottom: 0 },
  h1: { marginTop: 0, marginBottom: 0 },
  h2: { marginTop: 0, marginBottom: 0 },
  h3: { marginTop: 0, marginBottom: 0 },
  h4: { marginTop: 0, marginBottom: 0 },
  h5: { marginTop: 0, marginBottom: 0 },
  h6: { marginTop: 0, marginBottom: 0 },
};

const RenderHtmlRenderer = React.memo(({ sourceHtml, width }) => {
  const domVisitors = useMemo(() => ({ onElement: stripInlineStyles }), []);
  const memoSource = useMemo(() => ({ html: sourceHtml }), [sourceHtml]);

  return (
    <RenderHTML
      contentWidth={width}
      source={memoSource}
      emSize={14}
      ignoredStyles={[]}
      baseStyle={baseStyle}
      tagsStyles={tagStyles}
      defaultTextProps={defaultTextProps}
      domVisitors={domVisitors}
      ignoredDomTags={['font']}
      customHTMLElementModels={defaultHTMLElementModels}
    />
  );
});

export const ForumBody = ({ html = '', forumId, isExpanded, toggleFullText }) => {
  const { width } = useWindowDimensions();
  const MAX_PREVIEW_CHARS = 200;
  const MAX_HEIGHT = 23 * 4;

  const [shouldTruncate, setShouldTruncate] = useState(false);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    if (html.length > MAX_PREVIEW_CHARS) {
      setShouldTruncate(true);
    }
  }, [html]);

  const onTextLayout = useCallback((e) => {
    if (!measured) {
      const height = e.nativeEvent.layout.height;
      if (height > MAX_HEIGHT) {
        setShouldTruncate(true);
      }
      setMeasured(true);
    }
  }, [measured]);

  const plainText = useMemo(() => {
    const stripped = html?.replace(/<\/?[^>]+(>|$)/g, '') || '';
    return decode(stripped.trim());
  }, [html]);

  const shouldRenderHtml = isExpanded || !shouldTruncate;

  const content = (
    <View style={{ marginTop: 5 }}>
      <View onLayout={onTextLayout}>
        {shouldRenderHtml ? (
          <RenderHtmlRenderer sourceHtml={html} width={width} />
        ) : (
          <Text
            numberOfLines={4}
            ellipsizeMode="tail"
            style={{
              fontSize: 14,
              color: '#000',
              lineHeight: 21,
              marginBottom: 5,
              backgroundColor:'#fff'
            }}
          >
            {plainText}
          </Text>
        )}
      </View>

      {shouldTruncate && typeof toggleFullText === 'function' && (
        <TouchableOpacity
          onPress={() => toggleFullText(forumId)}
          activeOpacity={1}
          style={{ padding: 5 }}
        >
          <Text style={{ color: '#075cab', fontSize: 13 }}>
            {isExpanded ? 'Read less' : 'Read more'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (typeof toggleFullText === 'function') {
    return (
      <TouchableOpacity
        onPress={() => toggleFullText(forumId)}
        activeOpacity={1}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

export const ForumPostBody = ({ html, forumId, numberOfLines }) => {
  const plainText = useMemo(() => {
    const stripped = html?.replace(/<\/?[^>]+(>|$)/g, '') || '';
    return decode(stripped.trim());
  }, [html]);

  return (
    <View style={{ paddingHorizontal: 10, marginTop: 5 }}>
      <Text
        {...(numberOfLines ? {
          numberOfLines,
          ellipsizeMode: 'tail',
        } : {})}
        style={{
          fontSize: 14,
          color: '#fff',
          fontWeight: '400',
          lineHeight: 21,
        }}
      >
        {plainText}
      </Text>
    </View>
  );
};


export const MyPostBody = ({ html, forumId, numberOfLines }) => {
  const plainText = useMemo(() => {
    const stripped = html?.replace(/<\/?[^>]+(>|$)/g, '') || '';
    return decode(stripped.trim());
  }, [html]);

  return (
    <View style={{ marginTop: 5 }}>
      <Text
        {...(numberOfLines ? {
          numberOfLines,
          ellipsizeMode: 'tail',
        } : {})}
        style={{
          fontSize: 14,
          color: '#000',
          fontWeight: '400',
          lineHeight: 21,
        }}
      >
        {plainText}
      </Text>
    </View>
  );
};


