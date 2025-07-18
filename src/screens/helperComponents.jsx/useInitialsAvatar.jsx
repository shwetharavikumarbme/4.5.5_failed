const alphabetColors = {
  'A': '#075cab',
  'B': '#083763',
  'C': '#115f6d',
  'D': '#495eb8',
  'E': '#124436',
  'F': '#2f3f08',
  'G': '#055a2c',
  'H': '#150a6d',
  'I': '#0e5a67',
  'J': '#730e4c',
  'K': '#422b71',
  'L': '#7a1433',
  'M': '#7a551d',
  'N': '#075cab',
  'O': '#083763',
  'P': '#115f6d',
  'Q': '#495eb8',
  'R': '#124436',
  'S': '#2f3f08',
  'T': '#055a2c',
  'U': '#150a6d',
  'V': '#0e5a67',
  'W': '#730e4c',
  'X': '#422b71',
  'Y': '#7a1433',
  'Z': '#7a551d'
};

export const generateAvatarFromName = (name) => {
  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0]?.toUpperCase() || '';
    const last = parts[1]?.[0]?.toUpperCase() || '';
    return `${first}${last}` || '?';
  };

  const getBackgroundColorFromInitial = (name) => {
    if (!name) return '#888888'; // fallback color
    const firstChar = name.trim().charAt(0).toUpperCase();
    return alphabetColors[firstChar] || '#888888';
  };

  const getContrastColor = (hexColor) => {
    if (!hexColor.startsWith('#') || hexColor.length !== 7) return '#FFFFFF';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    // luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance > 186 ? '#000000' : '#FFFFFF';
  };

  const initials = getInitials(name);
  const backgroundColor = getBackgroundColorFromInitial(name);
  const textColor = getContrastColor(backgroundColor);

  return {
    initials,
    backgroundColor,
    textColor
  };
};
