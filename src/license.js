const LICENSE_KEY = 'license_status';
const USAGE_COUNT = 'usage_count';

const LicenseManager = {
  async checkLicense() {
    const license = await Storage.get(LICENSE_KEY);
    return !!license;
  },

  async incrementUsage() {
    const count = (await Storage.get(USAGE_COUNT) || 0) + 1;
    await Storage.set(USAGE_COUNT, count);
    return count;
  },

  async isWithinFreeLimit(limit = 5) {
    const count = await Storage.get(USAGE_COUNT) || 0;
    return count < limit;
  }
};