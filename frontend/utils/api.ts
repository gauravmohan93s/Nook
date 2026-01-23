export const getApiUrl = () => {
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    if (!url.startsWith('http')) {
        return `https://${url}`;
    }
    return url;
};
