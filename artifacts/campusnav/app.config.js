const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    ...(googleMapsApiKey
      ? [["react-native-maps", { androidGoogleMapsApiKey: googleMapsApiKey }]]
      : []),
  ],
});
