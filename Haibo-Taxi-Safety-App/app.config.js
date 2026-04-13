const base = require("./app.json");
const expo = base.expo;

module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || expo.android.googleServicesFile,
    },
  },
};
