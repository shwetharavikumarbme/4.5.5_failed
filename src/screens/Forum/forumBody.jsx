import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import RenderHTML, { defaultHTMLElementModels } from 'react-native-render-html';
import { decode } from 'html-entities';

// ========== Clean inline styles ==========
const stripInlineStyles = (domNode) => {
  if (domNode.attribs?.style) {
    domNode.attribs.style = domNode.attribs.style
      .split(';')
      .map((s) => s.trim())
      .filter((s) => {
        const lower = s.toLowerCase();
        return (
          lower.startsWith('font-weight') ||
          lower.startsWith('font-style') ||
          lower.startsWith('text-align') ||
          lower.startsWith('color')
        );
      })
      .join('; ');

    if (!domNode.attribs.style.trim()) {
      delete domNode.attribs.style;
    }
  }
};

// ========== Shared styling ==========
const baseStyle = { fontSize: 14 };

const defaultTextProps = {
  selectable: true,
  style: {
    fontSize: 13,
    lineHeight: 21,
    marginTop: 0,
    marginBottom: 0,
    fontWeight: '400',
  },
};

const tagStyles = {
  p: { marginTop: 0, marginBottom: 5 },
  'li > p': { marginTop: 0, marginBottom: 0 },
  div: { marginTop: 0, marginBottom: 0 },
  br: { marginBottom: 10 },
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

// ========== RenderHTML Wrapper (memoized) ==========
const RenderHtmlRenderer = React.memo(({ sourceHtml, width }) => {
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
      ignoredDomTags={['font']}
      customHTMLElementModels={defaultHTMLElementModels}
      domVisitors={{
        onElement: (domNode) => {
          stripInlineStyles(domNode);
        },
      }}
    />
  );
});

// ========== ForumBody Component ==========
export const ForumBody = ({ html = '' }) => {
  const { width } = useWindowDimensions();
  const MAX_CHARS = 200;
  const [isExpanded, setIsExpanded] = useState(false);

  const plainText = useMemo(() => {
    const stripped = html
      ?.replace(/<\/(p|div|br|h[1-6]|li)>/gi, ' ')
      .replace(/<[^>]+>/g, '') || '';
    return decode(stripped.trim());
  }, [html]);

  const showReadMore = plainText.length > MAX_CHARS;

  const collapsedHtml = useMemo(() => {
    if (!showReadMore || isExpanded) return html;
    const trimmed = plainText.slice(0, MAX_CHARS).trimEnd();
    return `<p>${trimmed}... <span style="color: #999">Read more</span></p>`;
  }, [html, plainText, isExpanded, showReadMore]);

  const handleExpand = () => {
    if (!isExpanded) setIsExpanded(true);
  };

  return (
    <TouchableOpacity
      onPress={showReadMore && !isExpanded ? handleExpand : undefined}
      activeOpacity={showReadMore && !isExpanded ? 0.9 : 1}
      style={{ marginTop: 5 }}
    >
      <View>
        <RenderHtmlRenderer sourceHtml={collapsedHtml} width={width} />
      </View>
    </TouchableOpacity>
  );
};


export const ForumPostBody = ({ html, forumId, numberOfLines }) => {
  const plainText = useMemo(() => {
    const stripped = html
      ?.replace(/<\/(p|div|br|h[1-6]|li)>/gi, ' ') // replace closing tags with space
      .replace(/<[^>]+>/g, '') || '';

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
          color: '#444',
          fontWeight: '600',
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
    const stripped = html
      ?.replace(/<\/(p|div|br|h[1-6]|li)>/gi, ' ') // replace closing tags with space
      .replace(/<[^>]+>/g, '') || '';

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


export const cleanForumHtml = (html) => {
  if (!html) return '';

  html = cleanTooltips(html);

  return html
    .replace(/style="[^"]*(color|background-color):[^";]*;?[^"]*"/gi, (match) => {
      return match
        .replace(/(?:color|background-color):[^";]*;?/gi, '')
        .replace(/style="\s*"/gi, '');
    })
    .replace(/style="([^"]*)"/gi, (match, styleContent) => {
      const allowed = styleContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.startsWith('font-weight') || s.startsWith('font-style') || s.startsWith('text-align'));
      return allowed.length ? `style="${allowed.join('; ')}"` : '';
    })
    .replace(/\sstyle="\s*"/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>/gi, '<a href="$1">')
    .replace(/<[^\/>][^>]*>\s*<\/[^>]+>/gi, '');
};

export const cleanTooltips = (html) => {
  return html
    .replace(/aria-[\w-]+="[^"]*"/gi, '')
    .replace(/<abbr[^>]*>.*?<\/abbr>/gi, '')
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/\b([A-Za-z]+)\b\s+\1\b/gi, '$1')
    .replace(/Tooltip:?\s+[^<\n]+/gi, '');
};

export const normalizeHtml = (input = '') => {
  if (!input?.trim()) return '';

  const isHtml = /<\/?[a-z][\s\S]*>/i.test(input);
  return isHtml
    ? decode(input)
    : `<p>${decode(input)
        .trim()
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .join('</p><p>')}</p>`;
};

export const generateHighlightedHTML = (rawHtml = '', query = '') => {
  if (!query?.trim()) return normalizeHtml(rawHtml);

  const safeQuery = query.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
  const regex = new RegExp(`(${safeQuery})`, 'gi');

  let html = normalizeHtml(rawHtml);

  // Split by tags to avoid replacing inside HTML tags
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag; // keep tags unchanged
    return text.replace(regex, (match) =>
      `<span style="background-color: #fff9c4; border-radius: 4px; padding: 0 2px;">${match}</span>`
    );
  });
};

