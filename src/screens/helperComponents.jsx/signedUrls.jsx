
import apiClient from '../ApiClient';


export const getSignedUrl = async (id, key) => {

    if (!key) {
        return { [id]: '' }; 
    }
    try {
        const res = await apiClient.post('/getObjectSignedUrl', {
            command: 'getObjectSignedUrl',
            key,
        });

        return { [id]: res.data };
    } catch (error) {
        return { [id]: '' }; 
    }
};

export const getTimeDisplay = (timestampInSeconds) => {
    const secondsAgo = Math.floor(Date.now() / 1000 - timestampInSeconds);

    if (secondsAgo < 60) return `few sec ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) return `${minutesAgo} mins ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo} hours ago`;

    return new Date(timestampInSeconds * 1000).toLocaleDateString('en-GB');
  };
